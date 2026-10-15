package br.com.recomeco;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Servidor do Recomeço: API REST em /api/* e arquivos estáticos do frontend.
 * Usa só o JDK (com.sun.net.httpserver) e, em produção, o driver JDBC do Postgres.
 * As rotas /api/analise/* são repassadas ao serviço de análise em Python.
 */
public final class Main {

    private static final int MAX_BODY = 64 * 1024;

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

    /** Origens liberadas no CORS quando CORS_ORIGENS não está definida (desenvolvimento). */
    private static final String ORIGENS_DEV = "http://localhost:8080,http://127.0.0.1:8080,"
            + "http://localhost:5501,http://127.0.0.1:5501";

    /** Limites por IP e por minuto: escrita em geral e tentativas com senha (login, cadastro, apagar conta). */
    private static final int LIMITE_ESCRITA = 40;
    private static final int LIMITE_AUTH = 10;

    private final Path frontend;
    private final AvaliacaoService avaliacoes;
    private final DepoimentoService depoimentos;
    private final UsuarioService usuarios;
    private final AnaliseCliente analise;
    private final Banco banco;
    private final ConteudoService conteudo = new ConteudoService();
    private final Map<String, Deque<Long>> limites = new ConcurrentHashMap<>();
    private final byte[] segredoIp;
    private final boolean confiarProxy = "1".equals(System.getenv("CONFIAR_PROXY"));
    private final Set<String> origens = Arrays.stream(
                    System.getenv().getOrDefault("CORS_ORIGENS", ORIGENS_DEV).split(","))
            .map(String::strip).filter(s -> !s.isEmpty()).map(s -> s.replaceAll("/+$", ""))
            .collect(Collectors.toUnmodifiableSet());

    private Main(Path frontend, Path dataDir, String urlAnalise, Banco banco) throws IOException {
        this.frontend = frontend.toAbsolutePath().normalize();
        this.banco = banco;
        this.analise = new AnaliseCliente(urlAnalise);
        this.avaliacoes = new AvaliacaoService(abrir(dataDir, "avaliacoes.jsonl", Tabela.AVALIACOES));
        this.depoimentos = new DepoimentoService(abrir(dataDir, "depoimentos.jsonl", Tabela.DEPOIMENTOS), analise);
        this.usuarios = new UsuarioService(
                abrir(dataDir, "usuarios.jsonl", Tabela.USUARIOS),
                abrir(dataDir, "sessoes.jsonl", Tabela.SESSOES),
                abrir(dataDir, "dados-usuarios.jsonl", Tabela.DADOS_USUARIOS));
        this.segredoIp = segredo(dataDir.resolve("segredo.key"));
    }

    /** Postgres quando DATABASE_URL existe; senão, arquivos JSON Lines em data/ (desenvolvimento). */
    private Storage abrir(Path dataDir, String arquivo, Tabela tabela) throws IOException {
        return banco == null ? new ArquivoStorage(dataDir.resolve(arquivo)) : new PostgresStorage(banco, tabela);
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

        Banco banco = Banco.doAmbiente();
        if (banco == null && "1".equals(System.getenv("EXIGIR_BANCO"))) {
            // Em produção (Dockerfile), gravar em arquivo perderia tudo a cada reinício do container.
            System.err.println("DATABASE_URL não definida. Configure a conexão com o banco nas variáveis de ambiente.");
            System.exit(1);
        }
        if (banco != null && System.getenv("IP_HMAC_SEGREDO") == null) {
            System.err.println("Com banco configurado, defina também IP_HMAC_SEGREDO (64 caracteres hexadecimais).");
            System.exit(1);
        }
        Main app = new Main(frontend, data, urlAnalise, banco);
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/", app::api);
        server.createContext("/", app::estatico);
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.start();
        app.agendarManutencao();
        System.out.println("Recomeço rodando em http://localhost:" + port + " (análise em " + urlAnalise + ", dados em "
                + (banco == null ? data.toAbsolutePath() : "Postgres") + "; CORS: " + app.origens + ")");
    }

    /** De hora em hora: apaga sessões vencidas e esquece contadores de limite antigos. */
    private void agendarManutencao() {
        ScheduledExecutorService agenda = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "manutencao");
            t.setDaemon(true);
            return t;
        });
        agenda.scheduleAtFixedRate(() -> {
            try {
                usuarios.limparSessoes();
            } catch (Exception e) {
                System.err.println("Falha ao limpar sessões: " + e.getMessage());
            }
            long agora = System.currentTimeMillis();
            limites.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    Long ultimo = e.getValue().peekLast();
                    return ultimo == null || agora - ultimo > 60_000;
                }
            });
        }, 1, 1, TimeUnit.HOURS);
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
            var h = ex.getResponseHeaders();
            h.set("Cache-Control", "no-store");
            h.set("X-Content-Type-Options", "nosniff");

            if (!cors(ex)) {
                json(ex, 403, Map.of("erro", "Origem não permitida."));
                return;
            }
            if ("OPTIONS".equals(method)) {
                ex.sendResponseHeaders(204, -1);
                return;
            }

            boolean escrita = "POST".equals(method) || "PUT".equals(method) || "DELETE".equals(method);
            if (escrita) {
                // Exigir JSON obriga o navegador a fazer o preflight do CORS antes de qualquer escrita.
                String tipo = ex.getRequestHeaders().getFirst("Content-Type");
                if (tipo == null || !tipo.toLowerCase().startsWith("application/json")) {
                    json(ex, 415, Map.of("erro", "Envie os dados em JSON."));
                    return;
                }
                String ip = ip(ex);
                boolean comSenha = path.startsWith("/api/auth/") || ("DELETE".equals(method) && "/api/usuario".equals(path));
                if (!permitir("escrita:" + ip, LIMITE_ESCRITA) || (comSenha && !permitir("auth:" + ip, LIMITE_AUTH))) {
                    json(ex, 429, Map.of("erro", "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."));
                    return;
                }
            }

            String token = token(ex);
            Map<String, Object> usuario = usuarios.porToken(token);
            String usuarioId = usuario == null ? null : (String) usuario.get("id");

            switch (method + " " + path) {
                case "GET /api/dados" -> json(ex, 200, conteudo.dados());
                case "GET /api/quiz" -> json(ex, 200, conteudo.quiz());
                case "GET /api/motivacao" -> json(ex, 200, conteudo.motivacao());
                case "GET /api/estatisticas" -> json(ex, 200, avaliacoes.estatisticas());
                case "GET /api/saude" -> saude(ex);
                case "GET /api/analise/resumo" ->
                        repassarAnalise(ex, analise.post("/resumo", Map.of("avaliacoes", avaliacoes.anonimas())));
                case "GET /api/analise/percentil" -> {
                    Map<String, Object> corpo = new LinkedHashMap<>();
                    corpo.put("avaliacoes", avaliacoes.anonimas());
                    corpo.put("score", score(ex.getRequestURI().getRawQuery()));
                    repassarAnalise(ex, analise.post("/percentil", corpo));
                }

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
                    usuarios.sair(token);
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
                case "GET /api/usuario/exportar" -> {
                    if (usuario == null) naoLogado(ex);
                    else {
                        Map<String, Object> out = new LinkedHashMap<>();
                        out.put("exportadoEm", Instant.now().toString());
                        out.putAll(usuarios.exportar(usuario));
                        out.put("avaliacoes", avaliacoes.doUsuario(usuarioId));
                        out.put("observacao", "O campo \"ip\" das avaliações é um código irreversível (HMAC), "
                                + "não o seu endereço IP. A senha e os tokens de sessão só existem como hash e não são exportados.");
                        json(ex, 200, out);
                    }
                }
                case "DELETE /api/usuario" -> {
                    if (usuario == null) naoLogado(ex);
                    else {
                        usuarios.apagarConta(usuario, Json.parseObject(corpo(ex)), avaliacoes);
                        json(ex, 200, Map.of("apagada", true));
                    }
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

    /**
     * CORS: só as origens de CORS_ORIGENS (e a própria origem do servidor) podem chamar a API
     * pelo navegador. Devolve false se a requisição veio de uma origem não permitida.
     */
    private boolean cors(HttpExchange ex) {
        String origem = ex.getRequestHeaders().getFirst("Origin");
        if (origem == null) return true; // mesma origem em GET, curl, GitHub Action
        var h = ex.getResponseHeaders();
        h.add("Vary", "Origin");
        if (!origens.contains(origem) && !mesmaOrigem(ex, origem)) return false;
        h.set("Access-Control-Allow-Origin", origem);
        if ("OPTIONS".equals(ex.getRequestMethod())) {
            h.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
            h.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
            h.set("Access-Control-Max-Age", "600");
        }
        return true;
    }

    private static boolean mesmaOrigem(HttpExchange ex, String origem) {
        String host = ex.getRequestHeaders().getFirst("Host");
        try {
            return host != null && host.equalsIgnoreCase(URI.create(origem).getRawAuthority());
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /** Usado pelo site para saber se o servidor acordou e pela GitHub Action que mantém o banco ativo. */
    private void saude(HttpExchange ex) throws IOException {
        Boolean bancoOk = banco == null ? null : banco.ping();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("java", true);
        out.put("python", analise.get("/saude") != null);
        out.put("banco", bancoOk);
        json(ex, Boolean.FALSE.equals(bancoOk) ? 503 : 200, out);
    }

    /** Pontuação de "?score=N"; null se ausente ou inválida (o Python responde 400). */
    private static Integer score(String consulta) {
        if (consulta == null) return null;
        for (String par : consulta.split("&")) {
            if (par.startsWith("score=") && par.substring(6).matches("\\d{1,2}")) return Integer.parseInt(par.substring(6));
        }
        return null;
    }

    private static void repassarAnalise(HttpExchange ex, AnaliseCliente.Resposta r) throws IOException {
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

    /** O token vai no corpo da resposta; o site o guarda e o envia no header Authorization. */
    private static void sessao(HttpExchange ex, UsuarioService.Sessao s, int status) throws IOException {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("logado", true);
        out.put("usuario", s.usuario());
        out.put("token", s.token());
        out.put("expiraEmSegundos", UsuarioService.DURACAO_SESSAO.toSeconds());
        json(ex, status, out);
    }

    private static void naoLogado(HttpExchange ex) throws IOException {
        json(ex, 401, Map.of("erro", "Entre na sua conta para continuar."));
    }

    /** Token de sessão do header "Authorization: Bearer ..." (nunca da URL). */
    private static String token(HttpExchange ex) {
        String valor = ex.getRequestHeaders().getFirst("Authorization");
        if (valor == null || !valor.regionMatches(true, 0, "Bearer ", 0, 7)) return null;
        String t = valor.substring(7).strip();
        return t.isEmpty() || t.length() > 200 ? null : t;
    }

    /**
     * IP de quem fez a requisição. Atrás de um proxy (Render), o último valor de
     * X-Forwarded-For é o que o proxy viu; os anteriores podem ter sido inventados pelo cliente.
     */
    private String ip(HttpExchange ex) {
        if (confiarProxy) {
            String xff = ex.getRequestHeaders().getFirst("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                String[] partes = xff.split(",");
                return partes[partes.length - 1].strip();
            }
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

    /** Chave do HMAC do IP: de IP_HMAC_SEGREDO (produção) ou de um arquivo gerado na primeira execução. */
    private static byte[] segredo(Path arquivo) throws IOException {
        String env = System.getenv("IP_HMAC_SEGREDO");
        if (env != null && !env.isBlank()) {
            byte[] s = HexFormat.of().parseHex(env.strip());
            if (s.length < 32) throw new IllegalStateException("IP_HMAC_SEGREDO deve ter pelo menos 64 caracteres hexadecimais.");
            return s;
        }
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
