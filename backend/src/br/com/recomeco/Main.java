package br.com.recomeco;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;

/**
 * Servidor do Recomeço: API REST em /api/* e arquivos estáticos do frontend.
 * Usa apenas o JDK (com.sun.net.httpserver), sem dependências externas.
 * As rotas /api/analise/* são repassadas ao serviço de análise em Python.
 */
public final class Main {

    private static final int MAX_BODY = 64 * 1024;
    private static final String COOKIE = "recomeco_sessao";

    private static final Map<String, String> MIME = Map.of(
            "html", "text/html; charset=utf-8",
            "css", "text/css; charset=utf-8",
            "js", "text/javascript; charset=utf-8",
            "json", "application/json; charset=utf-8",
            "svg", "image/svg+xml",
            "png", "image/png",
            "ico", "image/x-icon",
            "webp", "image/webp");

    private static final String CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; "
            + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
            + "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'";

    /** Limites por IP e por minuto: escrita em geral e tentativas de login/cadastro. */
    private static final int LIMITE_ESCRITA = 40;
    private static final int LIMITE_AUTH = 10;

    private final Path frontend;
    private final AvaliacaoService avaliacoes;
    private final DepoimentoService depoimentos;
    private final UsuarioService usuarios;
    private final AnaliseCliente analise;
    private final ConteudoService conteudo = new ConteudoService();
    private final Map<String, Deque<Long>> limites = new ConcurrentHashMap<>();
    private final byte[] segredoIp;
    private final boolean confiarProxy = "1".equals(System.getenv("CONFIAR_PROXY"));
    private final boolean cookieSeguro = "1".equals(System.getenv("COOKIE_SEGURO"));

    private Main(Path frontend, Path dataDir, String urlAnalise) throws IOException {
        this.frontend = frontend.toAbsolutePath().normalize();
        this.analise = new AnaliseCliente(urlAnalise);
        this.avaliacoes = new AvaliacaoService(new Storage(dataDir.resolve("avaliacoes.jsonl")));
        this.depoimentos = new DepoimentoService(new Storage(dataDir.resolve("depoimentos.jsonl")), analise);
        this.usuarios = new UsuarioService(
                new Storage(dataDir.resolve("usuarios.jsonl")),
                new Storage(dataDir.resolve("sessoes.jsonl")),
                new Storage(dataDir.resolve("dados-usuarios.jsonl")));
        this.segredoIp = segredo(dataDir.resolve("segredo.key"));
    }

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        String urlAnalise = System.getenv().getOrDefault("ANALISE_URL", "http://127.0.0.1:8081");
        Path frontend = Path.of(args.length > 0 ? args[0] : "frontend");
        Path data = Path.of(args.length > 1 ? args[1] : "data");
        if (!Files.isDirectory(frontend)) {
            System.err.println("Pasta do frontend não encontrada: " + frontend.toAbsolutePath());
            System.exit(1);
        }

        Main app = new Main(frontend, data, urlAnalise);
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/", app::api);
        server.createContext("/", app::estatico);
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.start();
        System.out.println("Recomeço rodando em http://localhost:" + port + " (análise em " + urlAnalise + ")");
    }

    // ------------------------------------------------------------------ API

    private void api(HttpExchange ex) throws IOException {
        try (ex) {
            rotear(ex);
        }
    }

    private void rotear(HttpExchange ex) throws IOException {
        try {
            String method = ex.getRequestMethod();
            String path = ex.getRequestURI().getPath();
            ex.getResponseHeaders().set("Cache-Control", "no-store");
            ex.getResponseHeaders().set("X-Content-Type-Options", "nosniff");

            boolean escrita = "POST".equals(method) || "PUT".equals(method);
            if (escrita) {
                // Exigir JSON impede que outro site envie formulários em nome da pessoa (CSRF).
                String tipo = ex.getRequestHeaders().getFirst("Content-Type");
                if (tipo == null || !tipo.toLowerCase().startsWith("application/json")) {
                    json(ex, 415, Map.of("erro", "Envie os dados em JSON."));
                    return;
                }
                String ip = ip(ex);
                if (!permitir("escrita:" + ip, LIMITE_ESCRITA)
                        || (path.startsWith("/api/auth/") && !permitir("auth:" + ip, LIMITE_AUTH))) {
                    json(ex, 429, Map.of("erro", "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."));
                    return;
                }
            }

            if ("GET".equals(method) && path.startsWith("/api/analise/")) {
                repassarAnalise(ex, path.substring("/api/analise".length()));
                return;
            }

            Map<String, Object> usuario = usuarios.porToken(cookie(ex));
            String usuarioId = usuario == null ? null : (String) usuario.get("id");

            switch (method + " " + path) {
                case "GET /api/dados" -> json(ex, 200, conteudo.dados());
                case "GET /api/quiz" -> json(ex, 200, conteudo.quiz());
                case "GET /api/motivacao" -> json(ex, 200, conteudo.motivacao());
                case "GET /api/estatisticas" -> json(ex, 200, avaliacoes.estatisticas());
                case "GET /api/saude" -> json(ex, 200, Map.of("java", true, "python", analise.get("/saude") != null));

                case "POST /api/avaliacao" ->
                        json(ex, 201, avaliacoes.avaliar(Json.parseObject(corpo(ex)), ipHash(ex), usuarioId));
                case "GET /api/avaliacao/minha" -> json(ex, 200, avaliacoes.minha(ipHash(ex), usuarioId));
                case "POST /api/avaliacao/vincular" -> {
                    if (usuario == null) naoLogado(ex);
                    else json(ex, 200, avaliacoes.vincular(Json.parseObject(corpo(ex)), usuarioId));
                }

                case "GET /api/depoimentos" -> json(ex, 200, depoimentos.recentes(30));
                case "POST /api/depoimentos" -> json(ex, 201, depoimentos.criar(Json.parseObject(corpo(ex))));

                case "POST /api/auth/cadastro" -> sessao(ex, usuarios.cadastrar(Json.parseObject(corpo(ex))), 201);
                case "POST /api/auth/login" -> sessao(ex, usuarios.entrar(Json.parseObject(corpo(ex))), 200);
                case "POST /api/auth/sair" -> {
                    usuarios.sair(cookie(ex));
                    definirCookie(ex, "", 0);
                    json(ex, 200, Map.of("ok", true));
                }
                case "GET /api/auth/eu" -> {
                    Map<String, Object> out = new LinkedHashMap<>();
                    out.put("logado", usuario != null);
                    out.put("usuario", usuario == null ? null : UsuarioService.publico(usuario));
                    json(ex, 200, out);
                }

                case "GET /api/usuario/dados" -> {
                    if (usuario == null) naoLogado(ex);
                    else json(ex, 200, usuarios.lerDados(usuario));
                }
                case "PUT /api/usuario/dados" -> {
                    if (usuario == null) naoLogado(ex);
                    else json(ex, 200, usuarios.salvarDados(usuario, Json.parseObject(corpo(ex))));
                }
                default -> json(ex, 404, Map.of("erro", "Rota não encontrada."));
            }
        } catch (ValidacaoException e) {
            json(ex, 400, Map.of("erro", e.getMessage()));
        } catch (IllegalArgumentException e) {
            json(ex, 400, Map.of("erro", "Os dados foram enviados em um formato inválido."));
        } catch (Exception e) {
            e.printStackTrace();
            json(ex, 500, Map.of("erro", "Erro interno do servidor."));
        }
    }

    private void repassarAnalise(HttpExchange ex, String rota) throws IOException {
        String consulta = ex.getRequestURI().getRawQuery();
        AnaliseCliente.Resposta r = analise.get(rota + (consulta == null ? "" : "?" + consulta));
        if (r == null) {
            json(ex, 503, Map.of("erro", "O serviço de análise (Python) não está disponível."));
            return;
        }
        byte[] bytes = r.corpo().getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", MIME.get("json"));
        ex.sendResponseHeaders(r.status(), bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    private void sessao(HttpExchange ex, UsuarioService.Sessao s, int status) throws IOException {
        definirCookie(ex, s.token(), UsuarioService.DURACAO_SESSAO.toSeconds());
        json(ex, status, Map.of("logado", true, "usuario", s.usuario()));
    }

    private static void naoLogado(HttpExchange ex) throws IOException {
        json(ex, 401, Map.of("erro", "Entre na sua conta para continuar."));
    }

    private void definirCookie(HttpExchange ex, String valor, long maxAge) {
        ex.getResponseHeaders().add("Set-Cookie", COOKIE + "=" + valor + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge
                + (cookieSeguro ? "; Secure" : ""));
    }

    private static String cookie(HttpExchange ex) {
        List<String> cabecalhos = ex.getRequestHeaders().get("Cookie");
        if (cabecalhos == null) return null;
        for (String linha : cabecalhos) {
            for (String parte : linha.split(";")) {
                String p = parte.strip();
                if (p.startsWith(COOKIE + "=")) return p.substring(COOKIE.length() + 1);
            }
        }
        return null;
    }

    private String ip(HttpExchange ex) {
        if (confiarProxy) {
            String xff = ex.getRequestHeaders().getFirst("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) return xff.split(",")[0].strip();
        }
        return ex.getRemoteAddress().getAddress().getHostAddress();
    }

    /** O IP nunca é gravado: guardamos só um HMAC dele, que não pode ser revertido. */
    private String ipHash(HttpExchange ex) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(segredoIp, "HmacSHA256"));
            byte[] h = mac.doFinal(ip(ex).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h, 0, 16);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] segredo(Path arquivo) throws IOException {
        if (Files.exists(arquivo)) return HexFormat.of().parseHex(Files.readString(arquivo).strip());
        byte[] s = new byte[32];
        new SecureRandom().nextBytes(s);
        Files.createDirectories(arquivo.getParent());
        Files.writeString(arquivo, HexFormat.of().formatHex(s));
        return s;
    }

    private boolean permitir(String chave, int porMinuto) {
        long agora = System.currentTimeMillis();
        Deque<Long> fila = limites.computeIfAbsent(chave, k -> new ArrayDeque<>());
        synchronized (fila) {
            while (!fila.isEmpty() && agora - fila.peekFirst() > 60_000) fila.pollFirst();
            if (fila.size() >= porMinuto) return false;
            fila.addLast(agora);
            return true;
        }
    }

    private static String corpo(HttpExchange ex) throws IOException {
        try (InputStream in = ex.getRequestBody()) {
            byte[] bytes = in.readNBytes(MAX_BODY + 1);
            if (bytes.length > MAX_BODY) throw new ValidacaoException("A requisição é grande demais.");
            return new String(bytes, StandardCharsets.UTF_8);
        }
    }

    private static void json(HttpExchange ex, int status, Object body) throws IOException {
        byte[] bytes = Json.stringify(body).getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", MIME.get("json"));
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    // ------------------------------------------------------------------ arquivos estáticos

    private void estatico(HttpExchange ex) throws IOException {
        try (ex) {
            if (!List.of("GET", "HEAD").contains(ex.getRequestMethod())) {
                ex.sendResponseHeaders(405, -1);
                return;
            }
            String uri = ex.getRequestURI().getPath();
            if (uri.endsWith("/")) uri += "index.html";
            Path file = frontend.resolve(uri.substring(1)).normalize();

            if (!file.startsWith(frontend) || !Files.isRegularFile(file)) {
                byte[] msg = "Página não encontrada".getBytes(StandardCharsets.UTF_8);
                ex.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
                ex.sendResponseHeaders(404, msg.length);
                ex.getResponseBody().write(msg);
                return;
            }
            String name = file.getFileName().toString();
            String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase();
            byte[] bytes = Files.readAllBytes(file);
            var h = ex.getResponseHeaders();
            h.set("Content-Type", MIME.getOrDefault(ext, "application/octet-stream"));
            h.set("X-Content-Type-Options", "nosniff");
            h.set("Referrer-Policy", "no-referrer");
            h.set("Cache-Control", "no-cache");
            if ("html".equals(ext)) h.set("Content-Security-Policy", CSP);
            if ("HEAD".equals(ex.getRequestMethod())) {
                ex.sendResponseHeaders(200, -1);
            } else {
                ex.sendResponseHeaders(200, bytes.length);
                ex.getResponseBody().write(bytes);
            }
        }
    }
}
