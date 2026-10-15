package br.com.recomeco;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;

/**
 * Coleção de registros (mapas JSON) com cópia em memória para leituras rápidas.
 * Implementações: {@link ArquivoStorage} (JSON Lines, desenvolvimento) e
 * {@link PostgresStorage} (produção). A ordem dos registros é a de inserção.
 */
public interface Storage {

    void append(Map<String, Object> record) throws IOException;

    List<Map<String, Object>> all();

    int size();

    /** Primeiro registro que atende ao filtro, procurando do mais novo para o mais antigo. */
    Map<String, Object> ultimo(Predicate<Map<String, Object>> filtro);

    /** Altera os registros que atendem ao filtro. */
    int atualizar(Predicate<Map<String, Object>> filtro, UnaryOperator<Map<String, Object>> mudanca) throws IOException;

    /** Remove os registros que atendem ao filtro. */
    int remover(Predicate<Map<String, Object>> filtro) throws IOException;
}
