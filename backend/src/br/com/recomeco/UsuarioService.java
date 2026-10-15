package br.com.recomeco;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Contas anônimas (só apelido e senha, sem e-mail), sessões e os dados da
 * jornada de cada pessoa, para que ela continue de onde parou em qualquer aparelho.
 * Senhas são guardadas com PBKDF2 e sal aleatório; sessões, apenas pelo hash do token.
 */
public final class UsuarioService {

    public static final Duration DURACAO_SESSAO = Duration.ofDays(30);
    private static final int ITERACOES = 210_000;
    private static final Pattern USUARIO = Pattern.compile("[a-z0-9_.]{3,24}");
    private static final List<String> CHAVES_SINCRONIZADAS = List.of(
            "jornada", "diario", "vontadesVencidas", "recordes");
    private static final int MAX_DADOS = 60_000;

    private final Storage usuarios;
    private final Storage sessoes;
    private final Storage dados;
    private final SecureRandom random = new SecureRandom();

    public UsuarioService(Storage usuarios, Storage sessoes, Storage dados) throws IOException {
        this.usuarios = usuarios;
        this.sessoes = sessoes;
        this.dados = dados;
        sessoes.remover(s -> Instant.parse((String) s.get("expira")).isBefore(Instant.now()));
    }

    /** Resultado de cadastro ou login: o token vai para o cookie, o resto para o corpo. */
    public record Sessao(String token, Map<String, Object> usuario) {}

    // ------------------------------------------------------------------ cadastro e login

    public synchronized Sessao cadastrar(Map<String, Object> in) throws IOException {
        String usuario = normalizar(in.get("usuario"));
        String senha = senha(in.get("senha"));
        if (!USUARIO.matcher(usuario).matches())
            throw new ValidacaoException("O apelido deve ter de 3 a 24 caracteres: letras, números, ponto ou sublinhado.");
        if (buscar(usuario) != null) throw new ValidacaoException("Esse apelido já está em uso. Escolha outro.");

        byte[] sal = new byte[16];
        random.nextBytes(sal);
        Map<String, Object> u = new LinkedHashMap<>();
        u.put("id", UUID.randomUUID().toString());
        u.put("usuario", usuario);
        u.put("sal", Base64.getEncoder().encodeToString(sal));
        u.put("iteracoes", ITERACOES);
        u.put("hash", Base64.getEncoder().encodeToString(pbkdf2(senha, sal, ITERACOES)));
        u.put("criadoEm", Instant.now().toString());
        usuarios.append(u);
        return abrirSessao(u);
    }

    public Sessao entrar(Map<String, Object> in) throws IOException {
        String usuario = normalizar(in.get("usuario"));
        String senha = in.get("senha") instanceof String s ? s : "";
        Map<String, Object> u = buscar(usuario);
        // Calcula o hash mesmo quando o apelido não existe, para não revelar quais apelidos existem pelo tempo de resposta.
        byte[] sal = u == null ? new byte[16] : Base64.getDecoder().decode((String) u.get("sal"));
        int iteracoes = u == null ? ITERACOES : ((Number) u.get("iteracoes")).intValue();
        byte[] calculado = pbkdf2(senha, sal, iteracoes);
        if (u == null || !MessageDigest.isEqual(calculado, Base64.getDecoder().decode((String) u.get("hash"))))
            throw new ValidacaoException("Apelido ou senha incorretos.");
        return abrirSessao(u);
    }

    public void sair(String token) throws IOException {
        if (token == null) return;
        String h = hashToken(token);
        sessoes.remover(s -> h.equals(s.get("token")));
    }

    /** Usuário dono do token, ou null se a sessão não existe ou expirou. */
    public Map<String, Object> porToken(String token) {
        if (token == null || token.isBlank()) return null;
        String h = hashToken(token);
        Map<String, Object> s = sessoes.ultimo(x -> h.equals(x.get("token")));
        if (s == null || Instant.parse((String) s.get("expira")).isBefore(Instant.now())) return null;
        Object id = s.get("usuarioId");
        return usuarios.ultimo(u -> id.equals(u.get("id")));
    }

    public static Map<String, Object> publico(Map<String, Object> u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.get("id"));
        m.put("usuario", u.get("usuario"));
        m.put("criadoEm", u.get("criadoEm"));
        return m;
    }

    // ------------------------------------------------------------------ dados da jornada

    public Map<String, Object> lerDados(Map<String, Object> u) {
        Object id = u.get("id");
        Map<String, Object> d = dados.ultimo(x -> id.equals(x.get("usuarioId")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("dados", d == null ? Map.of() : d.get("dados"));
        out.put("atualizadoEm", d == null ? null : d.get("atualizadoEm"));
        return out;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> salvarDados(Map<String, Object> u, Map<String, Object> in) throws IOException {
        if (!(in.get("dados") instanceof Map<?, ?> recebido)) throw new ValidacaoException("Dados inválidos.");
        Map<String, Object> limpo = new LinkedHashMap<>();
        for (String chave : CHAVES_SINCRONIZADAS) {
            if (recebido.containsKey(chave)) limpo.put(chave, ((Map<String, Object>) recebido).get(chave));
        }
        if (Json.stringify(limpo).length() > MAX_DADOS) throw new ValidacaoException("Dados grandes demais para salvar.");

        Object id = u.get("id");
        String agora = Instant.now().toString();
        Map<String, Object> registro = new LinkedHashMap<>();
        registro.put("usuarioId", id);
        registro.put("dados", limpo);
        registro.put("atualizadoEm", agora);
        synchronized (dados) {
            if (dados.atualizar(x -> id.equals(x.get("usuarioId")), x -> registro) == 0) dados.append(registro);
        }
        return Map.of("atualizadoEm", agora);
    }

    // ------------------------------------------------------------------ auxiliares

    private Sessao abrirSessao(Map<String, Object> u) throws IOException {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("token", hashToken(token));
        s.put("usuarioId", u.get("id"));
        s.put("expira", Instant.now().plus(DURACAO_SESSAO).toString());
        sessoes.append(s);
        return new Sessao(token, publico(u));
    }

    private Map<String, Object> buscar(String usuario) {
        return usuarios.ultimo(u -> usuario.equals(u.get("usuario")));
    }

    private static String normalizar(Object o) {
        return o instanceof String s ? s.strip().toLowerCase(Locale.ROOT) : "";
    }

    private static String senha(Object o) {
        if (!(o instanceof String s) || s.length() < 6) throw new ValidacaoException("A senha precisa ter pelo menos 6 caracteres.");
        if (s.length() > 128) throw new ValidacaoException("A senha pode ter no máximo 128 caracteres.");
        return s;
    }

    private static byte[] pbkdf2(String senha, byte[] sal, int iteracoes) {
        try {
            PBEKeySpec spec = new PBEKeySpec(senha.toCharArray(), sal, iteracoes, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static String hashToken(String token) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
