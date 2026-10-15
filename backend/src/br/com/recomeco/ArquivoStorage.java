package br.com.recomeco;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;

/**
 * Persistência em arquivos JSON Lines (um registro por linha), usada no
 * desenvolvimento quando não há banco configurado (DATABASE_URL).
 * Mantém uma cópia em memória para leituras rápidas.
 */
public final class ArquivoStorage implements Storage {

    private final Path file;
    private final List<Map<String, Object>> records = new ArrayList<>();

    public ArquivoStorage(Path file) throws IOException {
        this.file = file;
        Files.createDirectories(file.getParent());
        if (Files.exists(file)) {
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                if (line.isBlank()) continue;
                try {
                    records.add(Json.parseObject(line));
                } catch (IllegalArgumentException e) {
                    System.err.println("Linha ignorada em " + file.getFileName() + ": " + e.getMessage());
                }
            }
        }
    }

    @Override
    public synchronized void append(Map<String, Object> record) throws IOException {
        Files.writeString(file, Json.stringify(record) + System.lineSeparator(), StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.APPEND);
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

    /** Primeiro registro que atende ao filtro, procurando do mais novo para o mais antigo. */
    @Override
    public synchronized Map<String, Object> ultimo(Predicate<Map<String, Object>> filtro) {
        for (int i = records.size() - 1; i >= 0; i--) {
            if (filtro.test(records.get(i))) return records.get(i);
        }
        return null;
    }

    /** Altera os registros que atendem ao filtro e regrava o arquivo inteiro. */
    @Override
    public synchronized int atualizar(Predicate<Map<String, Object>> filtro, UnaryOperator<Map<String, Object>> mudanca)
            throws IOException {
        int n = 0;
        for (int i = 0; i < records.size(); i++) {
            if (filtro.test(records.get(i))) {
                records.set(i, mudanca.apply(records.get(i)));
                n++;
            }
        }
        if (n > 0) regravar();
        return n;
    }

    /** Remove os registros que atendem ao filtro e regrava o arquivo. */
    @Override
    public synchronized int remover(Predicate<Map<String, Object>> filtro) throws IOException {
        int antes = records.size();
        records.removeIf(filtro);
        int n = antes - records.size();
        if (n > 0) regravar();
        return n;
    }

    /** Grava em um arquivo temporário e troca de uma vez, para nunca deixar o arquivo pela metade. */
    private void regravar() throws IOException {
        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> r : records) sb.append(Json.stringify(r)).append(System.lineSeparator());
        Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
        Files.writeString(tmp, sb, StandardCharsets.UTF_8);
        Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }
}
