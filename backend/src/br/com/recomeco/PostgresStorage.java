package br.com.recomeco;

import java.io.IOException;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;

/**
 * Persistência em uma tabela do Postgres. Carrega a tabela na inicialização e
 * mantém uma cópia em memória para leituras; toda escrita vai primeiro ao banco
 * (sempre com PreparedStatement) e só depois altera a memória.
 * Pressupõe uma única instância do servidor (o caso do Render gratuito).
 * Números voltam como Double, como no parser JSON, para os serviços não notarem diferença.
 */
public final class PostgresStorage implements Storage {

    private final Banco banco;
    private final Tabela tabela;
    private final Tabela.Coluna chave;
    private final List<Map<String, Object>> records = new ArrayList<>();
    private final String sqlInsert;
    private final String sqlUpdate;
    private final String sqlDelete;

    public PostgresStorage(Banco banco, Tabela tabela) throws IOException {
        this.banco = banco;
        this.tabela = tabela;
        this.chave = tabela.colunaDaChave();
        List<Tabela.Coluna> cols = tabela.colunas();
        String nomes = cols.stream().map(Tabela.Coluna::nome).collect(Collectors.joining(", "));
        this.sqlInsert = "insert into " + tabela.nome() + " (" + nomes + ") values ("
                + cols.stream().map(c -> marcador(c.tipo())).collect(Collectors.joining(", ")) + ")";
        this.sqlUpdate = "update " + tabela.nome() + " set "
                + cols.stream().map(c -> c.nome() + " = " + marcador(c.tipo())).collect(Collectors.joining(", "))
                + " where " + chave.nome() + " = " + marcador(chave.tipo());
        this.sqlDelete = "delete from " + tabela.nome() + " where " + chave.nome() + " = " + marcador(chave.tipo());
        String select = "select " + nomes + " from " + tabela.nome() + " order by seq";
        try {
            banco.executar(c -> {
                try (PreparedStatement ps = c.prepareStatement(select); ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) records.add(ler(rs));
                }
                return null;
            });
        } catch (SQLException e) {
            throw new IOException("Não foi possível ler " + tabela.nome() + ": " + e.getMessage(), e);
        }
    }

    @Override
    public synchronized void append(Map<String, Object> record) throws IOException {
        conferirCampos(record);
        try {
            banco.executar(c -> {
                try (PreparedStatement ps = c.prepareStatement(sqlInsert)) {
                    preencher(ps, record, 1);
                    return ps.executeUpdate();
                }
            });
        } catch (SQLException e) {
            throw new IOException("Erro ao gravar em " + tabela.nome() + ": " + e.getMessage(), e);
        }
        records.add(record);
    }

    @Override
    public synchronized List<Map<String, Object>> all() {
        return new ArrayList<>(records);
    }

    @Override
    public synchronized int size() {
        return records.size();
    }

    @Override
    public synchronized Map<String, Object> ultimo(Predicate<Map<String, Object>> filtro) {
        for (int i = records.size() - 1; i >= 0; i--) {
            if (filtro.test(records.get(i))) return records.get(i);
        }
        return null;
    }

    @Override
    public synchronized int atualizar(Predicate<Map<String, Object>> filtro, UnaryOperator<Map<String, Object>> mudanca)
            throws IOException {
        List<Integer> indices = new ArrayList<>();
        List<Map<String, Object>> novos = new ArrayList<>();
        for (int i = 0; i < records.size(); i++) {
            if (filtro.test(records.get(i))) {
                Map<String, Object> novo = mudanca.apply(records.get(i));
                conferirCampos(novo);
                indices.add(i);
                novos.add(novo);
            }
        }
        if (indices.isEmpty()) return 0;
        try {
            banco.transacao(c -> {
                try (PreparedStatement ps = c.prepareStatement(sqlUpdate)) {
                    for (int k = 0; k < indices.size(); k++) {
                        int n = preencher(ps, novos.get(k), 1);
                        definir(ps, n, chave.tipo(), records.get(indices.get(k)).get(chave.campo()));
                        ps.addBatch();
                    }
                    return ps.executeBatch();
                }
            });
        } catch (SQLException e) {
            throw new IOException("Erro ao atualizar " + tabela.nome() + ": " + e.getMessage(), e);
        }
        for (int k = 0; k < indices.size(); k++) records.set(indices.get(k), novos.get(k));
        return indices.size();
    }

    @Override
    public synchronized int remover(Predicate<Map<String, Object>> filtro) throws IOException {
        List<Map<String, Object>> alvo = records.stream().filter(filtro).toList();
        if (alvo.isEmpty()) return 0;
        try {
            banco.transacao(c -> {
                try (PreparedStatement ps = c.prepareStatement(sqlDelete)) {
                    for (Map<String, Object> r : alvo) {
                        definir(ps, 1, chave.tipo(), r.get(chave.campo()));
                        ps.addBatch();
                    }
                    return ps.executeBatch();
                }
            });
        } catch (SQLException e) {
            throw new IOException("Erro ao remover de " + tabela.nome() + ": " + e.getMessage(), e);
        }
        records.removeIf(r -> alvo.stream().anyMatch(a -> a == r));
        return alvo.size();
    }

    // ------------------------------------------------------------------ conversão

    private void conferirCampos(Map<String, Object> record) {
        for (String campo : record.keySet()) {
            if (tabela.colunas().stream().noneMatch(c -> c.campo().equals(campo)))
                throw new IllegalStateException("Campo sem coluna em " + tabela.nome() + ": " + campo);
        }
        if (record.get(chave.campo()) == null)
            throw new IllegalStateException("Registro sem chave em " + tabela.nome());
    }

    private static String marcador(Tabela.Tipo tipo) {
        return switch (tipo) {
            case UUID -> "cast(? as uuid)";
            case DATA -> "cast(? as timestamptz)";
            case JSON -> "cast(? as jsonb)";
            default -> "?";
        };
    }

    /** Preenche os parâmetros a partir de "inicio"; devolve a próxima posição livre. */
    private int preencher(PreparedStatement ps, Map<String, Object> record, int inicio) throws SQLException {
        int i = inicio;
        for (Tabela.Coluna c : tabela.colunas()) definir(ps, i++, c.tipo(), record.get(c.campo()));
        return i;
    }

    private static void definir(PreparedStatement ps, int i, Tabela.Tipo tipo, Object v) throws SQLException {
        switch (tipo) {
            case NUMERO -> {
                if (v == null) ps.setNull(i, Types.DOUBLE);
                else ps.setDouble(i, ((Number) v).doubleValue());
            }
            case INTEIRO -> {
                if (v == null) ps.setNull(i, Types.BIGINT);
                else ps.setLong(i, Math.round(((Number) v).doubleValue()));
            }
            case BOOLEANO -> {
                if (v == null) ps.setNull(i, Types.BOOLEAN);
                else ps.setBoolean(i, (Boolean) v);
            }
            case JSON -> {
                if (v == null) ps.setNull(i, Types.VARCHAR);
                else ps.setString(i, Json.stringify(v));
            }
            default -> {
                if (v == null) ps.setNull(i, Types.VARCHAR);
                else ps.setString(i, v.toString());
            }
        }
    }

    private Map<String, Object> ler(ResultSet rs) throws SQLException {
        Map<String, Object> r = new LinkedHashMap<>();
        int i = 1;
        for (Tabela.Coluna c : tabela.colunas()) {
            Object v = switch (c.tipo()) {
                case NUMERO, INTEIRO -> {
                    double d = rs.getDouble(i);
                    yield rs.wasNull() ? null : d;
                }
                case BOOLEANO -> {
                    boolean b = rs.getBoolean(i);
                    yield rs.wasNull() ? null : b;
                }
                case DATA -> {
                    OffsetDateTime d = rs.getObject(i, OffsetDateTime.class);
                    yield d == null ? null : d.toInstant().toString();
                }
                case JSON -> {
                    String s = rs.getString(i);
                    yield s == null ? null : Json.parse(s);
                }
                default -> rs.getString(i);
            };
            if (v != null) r.put(c.campo(), v);
            i++;
        }
        return r;
    }
}
