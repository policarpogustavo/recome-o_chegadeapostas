package br.com.recomeco;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Properties;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Conexão com o Postgres (Supabase em produção) e um pool pequeno de conexões.
 * A configuração vem da variável DATABASE_URL, no formato que o Supabase mostra
 * (postgresql://usuario:senha@host:5432/postgres) ou já como URL JDBC.
 * A URL nunca é escrita no log, porque contém a senha.
 */
public final class Banco {

    /** Trabalho feito com uma conexão emprestada do pool. */
    @FunctionalInterface
    public interface Trabalho<T> {
        T com(Connection c) throws SQLException;
    }

    private record Ociosa(Connection conexao, long desde) {}

    private static final long VERIFICAR_APOS_MS = 30_000;

    private final String url;
    private final Properties props;
    private final Semaphore vagas;
    private final Deque<Ociosa> livres = new ArrayDeque<>();

    private Banco(String url, Properties props, int tamanho) {
        this.url = url;
        this.props = props;
        this.vagas = new Semaphore(tamanho);
    }

    /** Banco configurado pelas variáveis de ambiente, ou null se DATABASE_URL não existe. */
    public static Banco doAmbiente() {
        String valor = System.getenv("DATABASE_URL");
        if (valor == null || valor.isBlank()) return null;
        int tamanho = Integer.parseInt(System.getenv().getOrDefault("DB_POOL", "3"));
        return de(valor.strip(), tamanho);
    }

    static Banco de(String valor, int tamanho) {
        try {
            Class.forName("org.postgresql.Driver");
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("Driver do Postgres não encontrado no classpath (backend/lib/postgresql-*.jar).");
        }
        Properties props = new Properties();
        String url;
        if (valor.startsWith("jdbc:")) {
            url = valor;
        } else {
            URI u;
            try {
                u = URI.create(valor);
            } catch (IllegalArgumentException e) {
                throw new IllegalStateException("DATABASE_URL inválida. Se a senha tiver caracteres especiais, codifique-os (ex.: @ vira %40).");
            }
            if ((!"postgresql".equals(u.getScheme()) && !"postgres".equals(u.getScheme())) || u.getHost() == null)
                throw new IllegalStateException("DATABASE_URL deve começar com postgresql://");
            String info = u.getRawUserInfo();
            if (info != null) {
                int i = info.indexOf(':');
                props.setProperty("user", decodificar(i < 0 ? info : info.substring(0, i)));
                if (i >= 0) props.setProperty("password", decodificar(info.substring(i + 1)));
            }
            String db = u.getRawPath() == null || u.getRawPath().length() <= 1 ? "postgres" : u.getRawPath().substring(1);
            url = "jdbc:postgresql://" + u.getHost() + ":" + (u.getPort() == -1 ? 5432 : u.getPort()) + "/" + db;
            if (u.getRawQuery() != null) {
                for (String par : u.getRawQuery().split("&")) {
                    int i = par.indexOf('=');
                    if (i > 0) props.setProperty(decodificar(par.substring(0, i)), decodificar(par.substring(i + 1)));
                }
            }
        }
        // Os dados são sensíveis: sem TLS, só se for pedido explicitamente (ex.: Postgres local).
        if (!url.contains("sslmode=")) props.putIfAbsent("sslmode", "require");
        props.putIfAbsent("connectTimeout", "15");
        props.putIfAbsent("socketTimeout", "30");
        props.putIfAbsent("tcpKeepAlive", "true");
        props.putIfAbsent("ApplicationName", "recomeco");
        return new Banco(url, props, Math.max(1, tamanho));
    }

    /** Executa o trabalho com uma conexão do pool (em modo autocommit). */
    public <T> T executar(Trabalho<T> trabalho) throws SQLException {
        Connection c = pegar();
        boolean ok = false;
        try {
            T r = trabalho.com(c);
            ok = true;
            return r;
        } finally {
            devolver(c, ok);
        }
    }

    /** Executa o trabalho numa transação: tudo é gravado ou nada é. */
    public <T> T transacao(Trabalho<T> trabalho) throws SQLException {
        return executar(c -> {
            c.setAutoCommit(false);
            try {
                T r = trabalho.com(c);
                c.commit();
                return r;
            } catch (SQLException | RuntimeException e) {
                try { c.rollback(); } catch (SQLException ignorada) { /* a conexão será descartada */ }
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
        });
    }

    /** Consulta leve para verificar se o banco responde. */
    public boolean ping() {
        try {
            return executar(c -> {
                try (Statement s = c.createStatement()) {
                    return s.execute("select 1");
                }
            });
        } catch (SQLException e) {
            System.err.println("Banco indisponível: " + e.getMessage());
            return false;
        }
    }

    private Connection pegar() throws SQLException {
        try {
            if (!vagas.tryAcquire(15, TimeUnit.SECONDS)) throw new SQLException("Todas as conexões com o banco estão ocupadas.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SQLException("Interrompido esperando conexão.");
        }
        try {
            while (true) {
                Ociosa o;
                synchronized (livres) {
                    o = livres.pollLast();
                }
                if (o == null) return DriverManager.getConnection(url, props);
                // O pooler do Supabase pode fechar conexões paradas; confere antes de reutilizar.
                if (System.currentTimeMillis() - o.desde() < VERIFICAR_APOS_MS || o.conexao().isValid(3)) return o.conexao();
                fechar(o.conexao());
            }
        } catch (SQLException | RuntimeException e) {
            vagas.release();
            throw e;
        }
    }

    private void devolver(Connection c, boolean ok) {
        try {
            if (ok && !c.isClosed()) {
                synchronized (livres) {
                    livres.addLast(new Ociosa(c, System.currentTimeMillis()));
                }
            } else {
                fechar(c);
            }
        } catch (SQLException e) {
            fechar(c);
        } finally {
            vagas.release();
        }
    }

    private static void fechar(Connection c) {
        try { c.close(); } catch (SQLException ignorada) { /* já estava fechada */ }
    }

    /** Decodifica %XX (sem tratar '+' como espaço, que pode fazer parte da senha). */
    private static String decodificar(String s) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '%' && i + 2 < s.length()) {
                out.write(Integer.parseInt(s.substring(i + 1, i + 3), 16));
                i += 2;
            } else {
                out.writeBytes(String.valueOf(c).getBytes(StandardCharsets.UTF_8));
            }
        }
        return out.toString(StandardCharsets.UTF_8);
    }
}
