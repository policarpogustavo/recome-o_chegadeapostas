package br.com.recomeco;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Recebe o questionário, calcula o nível de risco (baseado no PGSI, Problem
 * Gambling Severity Index, 9 itens pontuados de 0 a 3) e monta um plano
 * personalizado. Os registros são anônimos: nenhum texto livre é armazenado.
 */
public final class AvaliacaoService {

    static final Set<String> ORIGENS = Set.of("amigos", "propaganda", "influenciador", "dinheiro_rapido",
            "tedio", "futebol", "familia", "outro");
    static final Set<String> TEMPOS = Set.of("menos6m", "6a12m", "1a3a", "mais3a");
    static final Set<String> TIPOS = Set.of("esportiva", "cassino", "crash", "poquer", "loteria");
    static final Set<String> FREQUENCIAS = Set.of("raramente", "semanal", "diaria", "varias_dia");
    static final Set<String> DIVIDAS = Set.of("nao", "pequenas", "grandes");
    static final Set<String> ESCONDE = Set.of("nao", "as_vezes", "sim");
    static final Set<String> AJUDA = Set.of("sim", "talvez", "nao");
    static final Set<String> FAIXAS = Set.of("menor", "18-24", "25-34", "35-44", "45-59", "60+");
    static final Set<String> DIA_A_DIA = Set.of("acorda_pensando", "aposta_trabalho", "perde_sono", "ansiedade",
            "mente", "isolamento", "pede_emprestado", "recuperar_perdas", "irritado_sem_jogar", "deixou_lazer");

    private final Storage storage;

    public AvaliacaoService(Storage storage) {
        this.storage = storage;
    }

    /**
     * Calcula e grava a avaliação. Ela fica associada ao hash do IP (nunca ao IP em si)
     * e, se a pessoa estiver logada, à conta dela.
     */
    public Map<String, Object> avaliar(Map<String, Object> in, String ipHash, String usuarioId) throws IOException {
        Map<String, Object> r = validar(in);
        Map<String, Object> resultado = calcular(r);

        Map<String, Object> registro = new LinkedHashMap<>(r);
        registro.put("id", UUID.randomUUID().toString());
        registro.put("score", resultado.get("score"));
        registro.put("nivel", ((Map<?, ?>) resultado.get("nivel")).get("codigo"));
        registro.put("data", Instant.now().toString());
        registro.put("ip", ipHash);
        if (usuarioId != null) registro.put("usuarioId", usuarioId);
        storage.append(registro);
        resultado.put("data", registro.get("data"));
        resultado.put("id", registro.get("id"));
        return resultado;
    }

    /**
     * Associa à conta uma avaliação feita antes do login (por exemplo, na janela da
     * primeira visita). O id é aleatório e só o aparelho que fez a avaliação o conhece.
     */
    public Map<String, Object> vincular(Map<String, Object> in, String usuarioId) throws IOException {
        if (!(in.get("id") instanceof String id) || id.isBlank()) throw new ValidacaoException("Avaliação inválida.");
        int n = storage.atualizar(a -> id.equals(a.get("id")) && a.get("usuarioId") == null, a -> {
            Map<String, Object> novo = new LinkedHashMap<>(a);
            novo.put("usuarioId", usuarioId);
            return novo;
        });
        return Map.of("vinculada", n > 0);
    }

    /**
     * Diz se esta pessoa já fez a avaliação. Pela conta, devolve o resultado e o histórico.
     * Pelo IP, só informa que já foi feita: várias pessoas podem dividir a mesma rede
     * (uma família, por exemplo), então o resultado de uma nunca é mostrado para outra.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> minha(String ipHash, String usuarioId) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (usuarioId != null) {
            List<Object> historico = new ArrayList<>();
            Map<String, Object> ultima = null;
            for (Map<String, Object> a : storage.all()) {
                if (!usuarioId.equals(a.get("usuarioId"))) continue;
                ultima = a;
                Map<String, Object> h = new LinkedHashMap<>();
                h.put("data", a.get("data"));
                h.put("score", a.get("score"));
                h.put("nivel", a.get("nivel"));
                historico.add(h);
            }
            if (ultima != null) {
                Map<String, Object> resultado = calcular(new LinkedHashMap<>(ultima));
                resultado.put("data", ultima.get("data"));
                out.put("feita", true);
                out.put("origem", "conta");
                out.put("resultado", resultado);
                out.put("historico", historico);
                return out;
            }
        }
        Map<String, Object> porIp = storage.ultimo(a -> ipHash.equals(a.get("ip")));
        out.put("feita", porIp != null);
        out.put("origem", porIp != null ? "ip" : null);
        if (porIp != null) out.put("data", porIp.get("data"));
        return out;
    }

    // ------------------------------------------------------------------ validação

    private Map<String, Object> validar(Map<String, Object> in) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("faixaEtaria", opcao(in, "faixaEtaria", FAIXAS));
        r.put("origem", opcao(in, "origem", ORIGENS));
        r.put("tempo", opcao(in, "tempo", TEMPOS));
        r.put("tipos", lista(in, "tipos", TIPOS, true));
        r.put("frequencia", opcao(in, "frequencia", FREQUENCIAS));
        double gasto = numero(in, "gastoMensal", 0, 10_000_000);
        r.put("gastoMensal", gasto);
        r.put("dividas", opcao(in, "dividas", DIVIDAS));
        r.put("escondeFamilia", opcao(in, "escondeFamilia", ESCONDE));
        r.put("arrependimento", (double) Math.round(numero(in, "arrependimento", 1, 5)));
        r.put("diaADia", lista(in, "diaADia", DIA_A_DIA, false));
        r.put("querAjuda", opcao(in, "querAjuda", AJUDA));

        Object p = in.get("pgsi");
        if (!(p instanceof List<?> l) || l.size() != 9) throw new ValidacaoException("pgsi deve ter 9 respostas");
        List<Object> pgsi = new ArrayList<>();
        for (Object o : l) {
            if (!(o instanceof Number n) || n.doubleValue() < 0 || n.doubleValue() > 3)
                throw new ValidacaoException("Respostas do pgsi devem estar entre 0 e 3");
            pgsi.add((double) Math.round(n.doubleValue()));
        }
        r.put("pgsi", pgsi);
        return r;
    }

    private static String opcao(Map<String, Object> in, String campo, Set<String> validas) {
        Object v = in.get(campo);
        if (!(v instanceof String s) || !validas.contains(s))
            throw new ValidacaoException("Campo inválido: " + campo);
        return s;
    }

    private static List<Object> lista(Map<String, Object> in, String campo, Set<String> validas, boolean obrigatoria) {
        Object v = in.get(campo);
        if (!(v instanceof List<?> l)) throw new ValidacaoException("Campo inválido: " + campo);
        List<Object> out = new ArrayList<>();
        for (Object o : l) {
            if (!(o instanceof String s) || !validas.contains(s))
                throw new ValidacaoException("Valor inválido em " + campo);
            if (!out.contains(s)) out.add(s);
        }
        if (obrigatoria && out.isEmpty()) throw new ValidacaoException("Selecione ao menos uma opção em " + campo);
        return out;
    }

    private static double numero(Map<String, Object> in, String campo, double min, double max) {
        Object v = in.get(campo);
        if (!(v instanceof Number n) || n.doubleValue() < min || n.doubleValue() > max)
            throw new ValidacaoException("Campo inválido: " + campo);
        return n.doubleValue();
    }

    // ------------------------------------------------------------------ cálculo

    @SuppressWarnings("unchecked")
    private Map<String, Object> calcular(Map<String, Object> r) {
        int score = 0;
        for (Object o : (List<Object>) r.get("pgsi")) score += ((Number) o).intValue();

        List<Object> tipos = (List<Object>) r.get("tipos");
        List<Object> dia = (List<Object>) r.get("diaADia");
        double gasto = (Double) r.get("gastoMensal");

        Map<String, Object> nivel = new LinkedHashMap<>();
        if (score == 0) {
            nivel.put("codigo", "sem_risco");
            nivel.put("titulo", "Sem sinais de problema");
            nivel.put("descricao", "Suas respostas não indicam problemas com apostas neste momento. Ótimo! Mesmo assim, fique atento(a): as plataformas são feitas para prender quem joga.");
        } else if (score <= 2) {
            nivel.put("codigo", "baixo");
            nivel.put("titulo", "Risco baixo");
            nivel.put("descricao", "Existem alguns sinais de alerta. Este é o melhor momento para agir, porque parar agora é muito mais fácil do que depois.");
        } else if (score <= 7) {
            nivel.put("codigo", "moderado");
            nivel.put("titulo", "Risco moderado");
            nivel.put("descricao", "As apostas já estão trazendo consequências para a sua vida. Você não precisa enfrentar isso sozinho(a): pedir ajuda é um ato de coragem.");
        } else {
            nivel.put("codigo", "problematico");
            nivel.put("titulo", "Jogo problemático");
            nivel.put("descricao", "Suas respostas indicam um padrão compatível com o vício em apostas (transtorno do jogo). Essa é uma condição de saúde, tem tratamento, e muitas pessoas se recuperam. Procure apoio profissional o quanto antes.");
        }

        List<Object> alertas = new ArrayList<>();
        List<Object> recs = new ArrayList<>();

        if ("menor".equals(r.get("faixaEtaria"))) {
            alertas.add("Apostar é proibido para menores de 18 anos no Brasil. Converse com um adulto de confiança; você não será julgado(a) por pedir ajuda.");
        }
        if ("grandes".equals(r.get("dividas"))) {
            alertas.add("Dívidas grandes aumentam muito o risco de tentar \"recuperar\" o prejuízo apostando. Essa é a armadilha mais comum, e ela só aumenta o buraco.");
        }
        if (dia.contains("recuperar_perdas")) {
            alertas.add("Apostar para recuperar perdas é um dos sinais mais fortes de vício. Aceite a perda como o custo do aprendizado e pare por aqui.");
        }
        if ("varias_dia".equals(r.get("frequencia"))) {
            alertas.add("Apostar várias vezes ao dia indica que o jogo virou um hábito automático. Bloquear o acesso a aplicativos e sites é o primeiro passo prático.");
        }

        // recomendações: começam pelas ações mais concretas
        recs.add(rec("Bloqueie o acesso hoje",
                "Peça a autoexclusão nas casas de apostas em que você tem conta (ela é obrigatória nos sites autorizados, que terminam em .bet.br), desinstale os aplicativos e instale um bloqueador gratuito, como o BetBlocker, no celular e no computador."));
        if (!"nao".equals(r.get("dividas"))) {
            recs.add(rec("Organize as dívidas sem apostar",
                    "Liste tudo o que você deve, priorize as contas essenciais e procure renegociar diretamente com os bancos ou pelo Procon da sua cidade. Peça a alguém de confiança que ajude a controlar o seu dinheiro por um tempo."));
        }
        if (tipos.contains("cassino") || tipos.contains("crash")) {
            recs.add(rec("Entenda por que o cassino online sempre ganha",
                    "Os slots (como o \"tigrinho\") e os jogos crash (como o Aviator) são programados para devolver menos de 100% do que recebem. Cada rodada leva uma parte do seu dinheiro e, no longo prazo, a perda é garantida. Veja o simulador nesta página."));
        }
        if (tipos.contains("esportiva")) {
            recs.add(rec("Assista aos jogos sem apostar",
                    "As casas embutem uma margem de lucro em todas as odds. Tente voltar a curtir o futebol pelo esporte: escolha um time para torcer e chame os amigos, mas deixe o celular longe na hora do jogo."));
        }
        if ("influenciador".equals(r.get("origem")) || "propaganda".equals(r.get("origem"))) {
            recs.add(rec("Desconfie de quem lucra com a sua perda",
                    "Muitos influenciadores recebem uma porcentagem do que os seguidores perdem. Deixe de seguir perfis que divulgam apostas e silencie os anúncios de bets nas redes sociais."));
        }
        if ("sim".equals(r.get("escondeFamilia")) || "as_vezes".equals(r.get("escondeFamilia")) || dia.contains("mente")) {
            recs.add(rec("Conte para alguém de confiança",
                    "O segredo alimenta o vício. Escolha uma pessoa (um familiar, um amigo ou um colega) e conte a verdade. A seção \"Para a família\" pode ajudar nessa conversa."));
        }
        if (dia.contains("ansiedade") || dia.contains("perde_sono") || dia.contains("isolamento")) {
            recs.add(rec("Cuide da sua saúde mental",
                    "Ansiedade, insônia e isolamento costumam acompanhar o vício. O CAPS (Centro de Atenção Psicossocial) do SUS atende de graça. Se estiver em sofrimento intenso, ligue 188 (CVV), que atende 24 horas."));
        }
        if (score >= 3) {
            recs.add(rec("Procure tratamento",
                    "Psicólogos e psiquiatras tratam o transtorno do jogo. Grupos como os Jogadores Anônimos (JA) oferecem reuniões gratuitas, presenciais e online."));
        }
        if (dia.contains("deixou_lazer") || dia.contains("aposta_trabalho") || "tedio".equals(r.get("origem"))) {
            recs.add(rec("Preencha o tempo livre",
                    "O vício ocupa espaço na rotina. Planeje atividades para os horários em que você costumava apostar: exercícios, um curso, um hobby ou os jogos desta página."));
        }
        recs.add(rec("Comece o seu contador de dias",
                "Na seção \"Minha jornada\", você marca há quantos dias está sem apostar e vê quanto dinheiro está economizando. Cada dia conta."));

        String mensagemAjuda = switch ((String) r.get("querAjuda")) {
            case "sim" -> "Você deu o passo mais difícil: admitir que quer ajuda. Siga o plano abaixo, um passo de cada vez.";
            case "talvez" -> "É normal ter dúvidas. Que tal tentar ficar só uma semana sem apostar e ver como se sente? O plano abaixo é um bom começo.";
            default -> "Tudo bem não estar pronto(a) agora. Guarde esta página: quando quiser, ela estará aqui. Pense em como seria a sua vida daqui a um ano, sem apostas.";
        };

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("score", score);
        out.put("scoreMaximo", 27);
        out.put("nivel", nivel);
        out.put("mensagem", mensagemAjuda);
        out.put("prejuizoMensal", gasto);
        out.put("prejuizoAnual", gasto * 12);
        out.put("alertas", alertas);
        out.put("recomendacoes", recs);
        return out;
    }

    private static Map<String, Object> rec(String titulo, String texto) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("titulo", titulo);
        m.put("texto", texto);
        return m;
    }

    // ------------------------------------------------------------------ estatísticas

    /** Agregados anônimos de todas as avaliações, usados no painel "Nossa comunidade". */
    @SuppressWarnings("unchecked")
    public Map<String, Object> estatisticas() {
        List<Map<String, Object>> all = storage.all();
        Map<String, Integer> porTipo = new TreeMap<>();
        Map<String, Integer> porOrigem = new TreeMap<>();
        Map<String, Integer> porTempo = new TreeMap<>();
        Map<String, Integer> porNivel = new TreeMap<>();
        Map<String, Integer> porDia = new TreeMap<>();
        TIPOS.forEach(t -> porTipo.put(t, 0));
        ORIGENS.forEach(t -> porOrigem.put(t, 0));
        TEMPOS.forEach(t -> porTempo.put(t, 0));
        DIA_A_DIA.forEach(t -> porDia.put(t, 0));
        for (String n : List.of("sem_risco", "baixo", "moderado", "problematico")) porNivel.put(n, 0);

        double somaScore = 0, somaGasto = 0, somaArrep = 0;
        int queremAjuda = 0, comDividas = 0, escondem = 0;
        for (Map<String, Object> a : all) {
            for (Object t : (List<Object>) a.getOrDefault("tipos", List.of())) porTipo.merge((String) t, 1, Integer::sum);
            for (Object t : (List<Object>) a.getOrDefault("diaADia", List.of())) porDia.merge((String) t, 1, Integer::sum);
            porOrigem.merge(String.valueOf(a.get("origem")), 1, Integer::sum);
            porTempo.merge(String.valueOf(a.get("tempo")), 1, Integer::sum);
            porNivel.merge(String.valueOf(a.get("nivel")), 1, Integer::sum);
            somaScore += num(a.get("score"));
            somaGasto += num(a.get("gastoMensal"));
            somaArrep += num(a.get("arrependimento"));
            if ("sim".equals(a.get("querAjuda"))) queremAjuda++;
            if (!"nao".equals(a.get("dividas"))) comDividas++;
            if (!"nao".equals(a.get("escondeFamilia"))) escondem++;
        }
        int n = all.size();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", n);
        out.put("mediaScore", n == 0 ? 0 : somaScore / n);
        out.put("mediaGastoMensal", n == 0 ? 0 : somaGasto / n);
        out.put("mediaArrependimento", n == 0 ? 0 : somaArrep / n);
        out.put("percentQueremAjuda", n == 0 ? 0 : 100.0 * queremAjuda / n);
        out.put("percentComDividas", n == 0 ? 0 : 100.0 * comDividas / n);
        out.put("percentEscondem", n == 0 ? 0 : 100.0 * escondem / n);
        out.put("porTipo", porTipo);
        out.put("porOrigem", porOrigem);
        out.put("porTempo", porTempo);
        out.put("porNivel", porNivel);
        out.put("porDiaADia", porDia);
        return out;
    }

    private static double num(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0;
    }
}
