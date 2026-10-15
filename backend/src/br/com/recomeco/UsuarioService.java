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
 * Senhas são guardadas com PBKDF2-HMAC-SHA512 e sal aleatório; sessões, apenas pelo
 * hash do token, que o navegador envia no header Authorization.
 */
public final class UsuarioService {

    public static final Duration DURACAO_SESSAO = Duration.ofDays(30);
    /** OWASP: 210 mil iterações para PBKDF2-HMAC-SHA512. */
    private static final String ALGORITMO = "PBKDF2WithHmacSHA512";
    private static final int ITERACOES = 210_000;
    /** Contas criadas antes da troca de algoritmo não têm o campo "algoritmo". */
    private static final String ALGORITMO_ANTIGO = "PBKDF2WithHmacSHA256";
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
        limparSessoes();
    }

    /** Resultado de cadastro ou login: o token só existe aqui e no aparelho da pessoa. */
    public record Sessao(String token, Map<String, Object> usuario) {}

    // ------------------------------------------------------------------ cadastro e login

    public synchronized Sessao cadastrar(Map<String, Object> in) throws IOException {
        String usuario = normalizar(in.get("usuario"));
        String senha = senha(in.get("senha"));
        if (!USUARIO.matcher(usuario).matches())
            throw new ValidacaoException("O apelido deve ter de 3 a 24 caracteres: letras, números, ponto ou sublinhado.");
        if (buscar(usuario) != null) throw new ValidacaoException("Esse apelido já está em uso. Escolha outro.");

        Map<String, Object> u = new LinkedHashMap<>();
        u.put("id", UUID.randomUUID().toString());
        u.put("usuario", usuario);
        u.putAll(novoHash(senha));
        u.put("criadoEm", Instant.now().toString());
        usuarios.append(u);
        return abrirSessao(u);
    }

    public Sessao entrar(Map<String, Object> in) throws IOException {
        String usuario = normalizar(in.get("usuario"));
        String senha = in.get("senha") instanceof String s ? s : "";
        Map<String, Object> u = buscar(usuario);
        if (!senhaConfere(u, senha)) throw new ValidacaoException("Apelido ou senha incorretos.");
        // Contas no formato antigo ganham o hash novo agora, enquanto a senha está disponível.
        if (!ALGORITMO.equals(u.get("algoritmo")) || ((Number) u.get("iteracoes")).intValue() != ITERACOES) {
            Map<String, Object> hash = novoHash(senha);
            Object id = u.get("id");
            usuarios.atualizar(x -> id.equals(x.get("id")), x -> {
                Map<String, Object> novo = new LinkedHashMap<>(x);
                novo.putAll(hash);
                return novo;
            });
        }
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

    /** Remove as sessões vencidas (na inicialização e de hora em hora). */
    public void limparSessoes() throws IOException {
        Instant agora = Instant.now();
        sessoes.remover(s -> Instant.parse((String) s.get("expira")).isBefore(agora));
    }

    public static Map<String, Object> publico(Map<String, Object> u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.get("id"));
        m.put("usuario", u.get("usuario"));
        m.put("criadoEm", u.get("criadoEm"));
        return m;
    }

    // ------------------------------------------------------------------ direitos do titular (LGPD, art. 18)

    /** Tudo o que o servidor guarda sobre a conta, exceto o hash da senha e o dos tokens. */
    public Map<String, Object> exportar(Map<String, Object> u) {
        Object id = u.get("id");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("conta", publico(u));
        Map<String, Object> d = dados.ultimo(x -> id.equals(x.get("usuarioId")));
        out.put("dadosDaJornada", d == null ? null : d.get("dados"));
        out.put("dadosAtualizadosEm", d == null ? null : d.get("atualizadoEm"));
        out.put("sessoesAtivas", sessoes.all().stream()
                .filter(s -> id.equals(s.get("usuarioId")))
                .map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("criadaEm", s.get("criadaEm"));
                    m.put("expira", s.get("expira"));
                    return m;
                }).toList());
        return out;
    }

    /** Apaga a conta e tudo o que está ligado a ela. Pede a senha de novo para confirmar. */
    public void apagarConta(Map<String, Object> u, Map<String, Object> in, AvaliacaoService avaliacoes) throws IOException {
        String senha = in.get("senha") instanceof String s ? s : "";
        if (!senhaConfere(u, senha)) throw new ValidacaoException("Senha incorreta.");
        String id = (String) u.get("id");
        // Primeiro o que depende da conta, por último a conta: se algo falhar no meio, dá para repetir.
        avaliacoes.removerDoUsuario(id);
        dados.remover(x -> id.equals(x.get("usuarioId")));
        sessoes.remover(x -> id.equals(x.get("usuarioId")));
        usuarios.remover(x -> id.equals(x.get("id")));
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
        Instant agora = Instant.now();
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("token", hashToken(token));
        s.put("usuarioId", u.get("id"));
        s.put("criadaEm", agora.toString());
        s.put("expira", agora.plus(DURACAO_SESSAO).toString());
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

    private Map<String, Object> novoHash(String senha) {
        byte[] sal = new byte[16];
        random.nextBytes(sal);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("algoritmo", ALGORITMO);
        m.put("sal", Base64.getEncoder().encodeToString(sal));
        m.put("iteracoes", ITERACOES);
        m.put("hash", Base64.getEncoder().encodeToString(pbkdf2(ALGORITMO, senha, sal, ITERACOES, 512)));
        return m;
    }

    /**
     * Confere a senha. Calcula o hash mesmo quando a conta não existe, para não
     * revelar quais apelidos existem pelo tempo de resposta.
     */
    private static boolean senhaConfere(Map<String, Object> u, String senha) {
        if (u == null) {
            pbkdf2(ALGORITMO, senha, new byte[16], ITERACOES, 512);
            return false;
        }
        String algoritmo = u.get("algoritmo") instanceof String a ? a : ALGORITMO_ANTIGO;
        byte[] esperado = Base64.getDecoder().decode((String) u.get("hash"));
        byte[] sal = Base64.getDecoder().decode((String) u.get("sal"));
        int iteracoes = ((Number) u.get("iteracoes")).intValue();
        return MessageDigest.isEqual(pbkdf2(algoritmo, senha, sal, iteracoes, esperado.length * 8), esperado);
    }

    private static byte[] pbkdf2(String algoritmo, String senha, byte[] sal, int iteracoes, int bits) {
        try {
            PBEKeySpec spec = new PBEKeySpec(senha.toCharArray(), sal, iteracoes, bits);
            return SecretKeyFactory.getInstance(algoritmo).generateSecret(spec).getEncoded();
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
