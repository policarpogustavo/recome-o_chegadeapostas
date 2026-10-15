package br.com.recomeco;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Copia os arquivos JSON Lines da pasta data/ para o Postgres configurado em DATABASE_URL.
 * Rode uma vez, depois de criar as tabelas com backend/schema.sql:
 *   java -cp "backend/out:backend/lib/*" br.com.recomeco.Migrar data
 * Tabelas que já têm registros são puladas, para não duplicar nada.
 * As sessões não são migradas: quem estava logado entra de novo.
 */
public final class Migrar {

    private record Origem(String arquivo, Tabela tabela) {}

    // Ordem importa: avaliações e dados apontam para usuários.
    private static final List<Origem> ORIGENS = List.of(
            new Origem("usuarios.jsonl", Tabela.USUARIOS),
            new Origem("dados-usuarios.jsonl", Tabela.DADOS_USUARIOS),
            new Origem("avaliacoes.jsonl", Tabela.AVALIACOES),
            new Origem("depoimentos.jsonl", Tabela.DEPOIMENTOS));

    public static void main(String[] args) throws IOException {
        Path pasta = Path.of(args.length > 0 ? args[0] : "data");
        Banco banco = Banco.doAmbiente();
        if (banco == null) {
            System.err.println("Defina DATABASE_URL antes de migrar.");
            System.exit(1);
        }
        if (!Files.isDirectory(pasta)) {
            System.out.println("Pasta " + pasta.toAbsolutePath() + " não existe: não há dados locais para migrar.");
            return;
        }
        for (Origem o : ORIGENS) {
            Path arquivo = pasta.resolve(o.arquivo());
            if (!Files.exists(arquivo)) {
                System.out.println(o.arquivo() + ": não existe, pulando.");
                continue;
            }
            Storage origem = new ArquivoStorage(arquivo);
            Storage destino = new PostgresStorage(banco, o.tabela());
            if (destino.size() > 0) {
                System.out.println(o.arquivo() + ": " + o.tabela().nome() + " já tem " + destino.size() + " registros, pulando.");
                continue;
            }
            int ok = 0, falhas = 0;
            for (Map<String, Object> r : origem.all()) {
                Map<String, Object> limpo = new LinkedHashMap<>();
                for (Tabela.Coluna c : o.tabela().colunas()) {
                    if (r.get(c.campo()) != null) limpo.put(c.campo(), r.get(c.campo()));
                }
                // Mensagens do mural gravadas antes da migração não tinham id.
                if (o.tabela() == Tabela.DEPOIMENTOS) limpo.putIfAbsent("id", UUID.randomUUID().toString());
                try {
                    destino.append(limpo);
                    ok++;
                } catch (IOException | RuntimeException e) {
                    falhas++;
                    System.err.println(o.arquivo() + ": registro ignorado (" + e.getMessage() + ")");
                }
            }
            System.out.println(o.arquivo() + ": " + ok + " registros copiados" + (falhas > 0 ? ", " + falhas + " com erro" : "") + ".");
        }
        System.out.println("Migração concluída. Guarde a pasta data/ como cópia de segurança até conferir o site.");
    }
}
