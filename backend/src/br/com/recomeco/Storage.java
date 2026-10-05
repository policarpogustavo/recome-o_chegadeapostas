package br.com.recomeco;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Persistência simples em arquivos JSON Lines (um registro por linha).
 * Mantém uma cópia em memória para leituras rápidas.
 */
public final class Storage {

    private final Path file;
    private final List<Map<String, Object>> records = new ArrayList<>();

    public Storage(Path file) throws IOException {
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

    public synchronized void append(Map<String, Object> record) throws IOException {
        Files.writeString(file, Json.stringify(record) + System.lineSeparator(), StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        records.add(record);
    }

    public synchronized List<Map<String, Object>> all() {
        return new ArrayList<>(records);
    }

    public synchronized int size() {
        return records.size();
    }
}
