package br.com.recomeco;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Mural anônimo de mensagens de apoio e superação. */
public final class DepoimentoService {

    private static final int MAX_TEXTO = 600;
    private static final int MAX_APELIDO = 30;
    private static final Pattern LINK = Pattern.compile("(?i)(https?://|www\\.|\\.bet\\b|\\.com\\b)");
    private static final Set<String> TIPOS = Set.of("superacao", "apoio", "familia");

    private final Storage storage;

    public DepoimentoService(Storage storage) throws IOException {
        this.storage = storage;
        if (storage.size() == 0) semear();
    }

    public Map<String, Object> criar(Map<String, Object> in) throws IOException {
        String texto = texto(in.get("texto"), MAX_TEXTO);
        if (texto.length() < 10) throw new ValidacaoException("Escreva pelo menos 10 caracteres.");
        if (LINK.matcher(texto).find()) throw new ValidacaoException("Links não são permitidos no mural.");
        String apelido = texto(in.get("apelido"), MAX_APELIDO);
        if (apelido.isEmpty()) apelido = "Anônimo";
        String tipo = in.get("tipo") instanceof String s && TIPOS.contains(s) ? s : "apoio";
        double dias = in.get("diasSemApostar") instanceof Number n ? Math.max(0, Math.min(36500, n.intValue())) : 0;

        Map<String, Object> d = new LinkedHashMap<>();
        d.put("apelido", apelido);
        d.put("texto", texto);
        d.put("tipo", tipo);
        d.put("diasSemApostar", dias);
        d.put("equipe", false);
        d.put("data", Instant.now().toString());
        storage.append(d);
        return d;
    }

    public List<Map<String, Object>> recentes(int limite) {
        List<Map<String, Object>> all = new ArrayList<>(storage.all());
        Collections.reverse(all);
        return all.subList(0, Math.min(limite, all.size()));
    }

    private static String texto(Object o, int max) {
        if (!(o instanceof String s)) return "";
        s = s.strip().replaceAll("\\s+", " ");
        return s.length() > max ? s.substring(0, max) : s;
    }

    /** Mensagens iniciais da equipe, identificadas como tal na interface. */
    private void semear() throws IOException {
        String[][] msgs = {
                {"Equipe Recomeço", "apoio", "Se você chegou até aqui, já deu um passo importante. Recaídas podem acontecer — elas não apagam o caminho que você já percorreu."},
                {"Equipe Recomeço", "familia", "Familiares: o vício não é falta de caráter. Proteja as finanças da casa, mas não feche a porta do diálogo."},
                {"Equipe Recomeço", "superacao", "Deixe aqui sua mensagem anônima. Contar quantos dias você está sem apostar inspira quem está começando agora."},
        };
        for (String[] m : msgs) {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("apelido", m[0]);
            d.put("texto", m[2]);
            d.put("tipo", m[1]);
            d.put("diasSemApostar", 0);
            d.put("equipe", true);
            d.put("data", Instant.now().toString());
            storage.append(d);
        }
    }
}
