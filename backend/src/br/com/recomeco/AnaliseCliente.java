package br.com.recomeco;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/**
 * Cliente do serviço de análise em Python (pasta analise/). O Java continua
 * funcionando se o Python estiver desligado: as chamadas devolvem null e cada
 * recurso usa sua alternativa local.
 */
public final class AnaliseCliente {

    /** Resposta crua do serviço Python, repassada ao navegador. */
    public record Resposta(int status, String corpo) {}

    private final String base;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(800))
            .build();

    public AnaliseCliente(String base) {
        this.base = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    /** GET em uma rota do serviço Python; null se ele não responder. */
    public Resposta get(String caminhoEConsulta) {
        return enviar(HttpRequest.newBuilder(URI.create(base + caminhoEConsulta)).GET());
    }

    /**
     * POST com um corpo JSON; null se o serviço não responder. É assim que as avaliações
     * chegam ao Python, que não tem acesso ao banco.
     */
    public Resposta post(String caminho, Object corpo) {
        return enviar(HttpRequest.newBuilder(URI.create(base + caminho))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(Json.stringify(corpo), StandardCharsets.UTF_8)));
    }

    /**
     * Pede ao Python que revise um texto do mural. Devolve o motivo da recusa,
     * "" se o texto foi aprovado ou null se o serviço não está disponível.
     */
    public String moderar(String texto) {
        String corpo = Json.stringify(Map.of("texto", texto));
        Resposta r = enviar(HttpRequest.newBuilder(URI.create(base + "/moderar"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(corpo, StandardCharsets.UTF_8)));
        if (r == null || r.status() != 200) return null;
        try {
            Map<String, Object> m = Json.parseObject(r.corpo());
            return Boolean.TRUE.equals(m.get("aprovado")) ? "" : String.valueOf(m.get("motivo"));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Resposta enviar(HttpRequest.Builder req) {
        try {
            HttpResponse<String> res = http.send(req.timeout(Duration.ofSeconds(5)).build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return new Resposta(res.statusCode(), res.body());
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return null;
        }
    }
}
