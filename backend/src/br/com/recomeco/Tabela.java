package br.com.recomeco;

import java.util.List;

/**
 * Descreve como uma coleção de registros (mapas JSON) é guardada numa tabela do
 * Postgres: cada campo do mapa vira uma coluna tipada. Toda tabela tem também
 * uma coluna "seq" (identity) que preserva a ordem de inserção.
 */
public record Tabela(String nome, String chave, List<Coluna> colunas) {

    public enum Tipo { TEXTO, NUMERO, INTEIRO, BOOLEANO, UUID, DATA, JSON }

    /** campo = nome no mapa JSON; nome = coluna no banco. */
    public record Coluna(String campo, String nome, Tipo tipo) {}

    public static Coluna col(String campo, String nome, Tipo tipo) {
        return new Coluna(campo, nome, tipo);
    }

    public Coluna colunaDaChave() {
        return colunas.stream().filter(c -> c.campo().equals(chave)).findFirst().orElseThrow();
    }

    // ------------------------------------------------------------------ tabelas do Recomeço (ver backend/schema.sql)

    public static final Tabela USUARIOS = new Tabela("recomeco.usuarios", "id", List.of(
            col("id", "id", Tipo.UUID),
            col("usuario", "usuario", Tipo.TEXTO),
            col("algoritmo", "algoritmo", Tipo.TEXTO),
            col("sal", "sal", Tipo.TEXTO),
            col("iteracoes", "iteracoes", Tipo.INTEIRO),
            col("hash", "hash", Tipo.TEXTO),
            col("criadoEm", "criado_em", Tipo.DATA)));

    public static final Tabela SESSOES = new Tabela("recomeco.sessoes", "token", List.of(
            col("token", "token_hash", Tipo.TEXTO),
            col("usuarioId", "usuario_id", Tipo.UUID),
            col("criadaEm", "criada_em", Tipo.DATA),
            col("expira", "expira", Tipo.DATA)));

    public static final Tabela DADOS_USUARIOS = new Tabela("recomeco.dados_usuarios", "usuarioId", List.of(
            col("usuarioId", "usuario_id", Tipo.UUID),
            col("dados", "dados", Tipo.JSON),
            col("atualizadoEm", "atualizado_em", Tipo.DATA)));

    public static final Tabela AVALIACOES = new Tabela("recomeco.avaliacoes", "id", List.of(
            col("id", "id", Tipo.UUID),
            col("usuarioId", "usuario_id", Tipo.UUID),
            col("ip", "ip_hash", Tipo.TEXTO),
            col("data", "data", Tipo.DATA),
            col("faixaEtaria", "faixa_etaria", Tipo.TEXTO),
            col("origem", "origem", Tipo.TEXTO),
            col("tempo", "tempo", Tipo.TEXTO),
            col("tipos", "tipos", Tipo.JSON),
            col("frequencia", "frequencia", Tipo.TEXTO),
            col("gastoMensal", "gasto_mensal", Tipo.NUMERO),
            col("dividas", "dividas", Tipo.TEXTO),
            col("escondeFamilia", "esconde_familia", Tipo.TEXTO),
            col("arrependimento", "arrependimento", Tipo.NUMERO),
            col("diaADia", "dia_a_dia", Tipo.JSON),
            col("querAjuda", "quer_ajuda", Tipo.TEXTO),
            col("pgsi", "pgsi", Tipo.JSON),
            col("score", "score", Tipo.INTEIRO),
            col("nivel", "nivel", Tipo.TEXTO)));

    public static final Tabela DEPOIMENTOS = new Tabela("recomeco.depoimentos", "id", List.of(
            col("id", "id", Tipo.UUID),
            col("apelido", "apelido", Tipo.TEXTO),
            col("texto", "texto", Tipo.TEXTO),
            col("tipo", "tipo", Tipo.TEXTO),
            col("diasSemApostar", "dias_sem_apostar", Tipo.INTEIRO),
            col("equipe", "equipe", Tipo.BOOLEANO),
            col("data", "data", Tipo.DATA)));
}
