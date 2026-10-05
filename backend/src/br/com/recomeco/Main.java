package br.com.recomeco;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;

/**
 * Servidor do Recomeço: API REST em /api/* e arquivos estáticos do frontend.
 * Usa apenas o JDK (com.sun.net.httpserver), sem dependências externas.
 */
public final class Main {

    private static final int MAX_BODY = 16 * 1024;
    private static final int POSTS_POR_MINUTO = 15;

    private static final Map<String, String> MIME = Map.of(
            "html", "text/html; charset=utf-8",
            "css", "text/css; charset=utf-8",
            "js", "text/javascript; charset=utf-8",
            "json", "application/json; charset=utf-8",
            "svg", "image/svg+xml",
            "png", "image/png",
            "ico", "image/x-icon",
            "webp", "image/webp");

    private final Path frontend;
    private final AvaliacaoService avaliacoes;
    private final DepoimentoService depoimentos;
    private final ConteudoService conteudo = new ConteudoService();
    private final Map<String, Deque<Long>> postsPorIp = new ConcurrentHashMap<>();

    private Main(Path frontend, Path dataDir) throws IOException {
        this.frontend = frontend.toAbsolutePath().normalize();
        this.avaliacoes = new AvaliacaoService(new Storage(dataDir.resolve("avaliacoes.jsonl")));
        this.depoimentos = new DepoimentoService(new Storage(dataDir.resolve("depoimentos.jsonl")));
    }

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        Path frontend = Path.of(args.length > 0 ? args[0] : "frontend");
        Path data = Path.of(args.length > 1 ? args[1] : "data");
        if (!Files.isDirectory(frontend)) {
            System.err.println("Pasta do frontend não encontrada: " + frontend.toAbsolutePath());
            System.exit(1);
        }

        Main app = new Main(frontend, data);
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/", app::api);
        server.createContext("/", app::estatico);
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.start();
        System.out.println("Recomeço rodando em http://localhost:" + port);
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

            if ("POST".equals(method) && !permitirPost(ex)) {
                json(ex, 429, Map.of("erro", "Muitas requisições. Aguarde um minuto."));
                return;
            }

            switch (method + " " + path) {
                case "GET /api/dados" -> json(ex, 200, conteudo.dados());
                case "GET /api/quiz" -> json(ex, 200, conteudo.quiz());
                case "GET /api/motivacao" -> json(ex, 200, conteudo.motivacao());
                case "GET /api/estatisticas" -> json(ex, 200, avaliacoes.estatisticas());
                case "POST /api/avaliacao" -> json(ex, 201, avaliacoes.avaliar(Json.parseObject(corpo(ex))));
                case "GET /api/depoimentos" -> json(ex, 200, depoimentos.recentes(30));
                case "POST /api/depoimentos" -> json(ex, 201, depoimentos.criar(Json.parseObject(corpo(ex))));
                default -> json(ex, 404, Map.of("erro", "Rota não encontrada"));
            }
        } catch (ValidacaoException e) {
            json(ex, 400, Map.of("erro", e.getMessage()));
        } catch (IllegalArgumentException e) {
            json(ex, 400, Map.of("erro", "Dados enviados em formato inválido"));
        } catch (Exception e) {
            e.printStackTrace();
            json(ex, 500, Map.of("erro", "Erro interno do servidor"));
        }
    }

    private boolean permitirPost(HttpExchange ex) {
        String ip = ex.getRemoteAddress().getAddress().getHostAddress();
        long agora = System.currentTimeMillis();
        Deque<Long> fila = postsPorIp.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (fila) {
            while (!fila.isEmpty() && agora - fila.peekFirst() > 60_000) fila.pollFirst();
            if (fila.size() >= POSTS_POR_MINUTO) return false;
            fila.addLast(agora);
            return true;
        }
    }

    private static String corpo(HttpExchange ex) throws IOException {
        try (InputStream in = ex.getRequestBody()) {
            byte[] bytes = in.readNBytes(MAX_BODY + 1);
            if (bytes.length > MAX_BODY) throw new ValidacaoException("Requisição muito grande");
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
            ex.getResponseHeaders().set("Content-Type", MIME.getOrDefault(ext, "application/octet-stream"));
            ex.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
            if ("HEAD".equals(ex.getRequestMethod())) {
                ex.sendResponseHeaders(200, -1);
            } else {
                ex.sendResponseHeaders(200, bytes.length);
                ex.getResponseBody().write(bytes);
            }
        }
    }
}
