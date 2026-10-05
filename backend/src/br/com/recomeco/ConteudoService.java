package br.com.recomeco;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Conteúdo educativo servido pela API: dados sobre apostas, perguntas do quiz
 * "Mito ou verdade" e frases de motivação.
 */
public final class ConteudoService {

    public Map<String, Object> dados() {
        Map<String, Object> out = new LinkedHashMap<>();

        List<Object> destaques = new ArrayList<>();
        destaques.add(dado("R$ 20 bi", "por mês",
                "foram transferidos via Pix para casas de apostas em 2024, segundo estimativa do Banco Central (entre R$ 18 e 21 bilhões mensais).",
                "Banco Central do Brasil — Estudo Especial nº 119/2024"));
        destaques.add(dado("R$ 3 bi", "em um mês",
                "enviados às bets em agosto de 2024 por cerca de 5 milhões de pessoas de famílias beneficiárias do Bolsa Família.",
                "Banco Central do Brasil — Nota técnica, set/2024"));
        destaques.add(dado("86%", "dos apostadores",
                "têm dívidas, e 64% estão com o nome negativado.",
                "Instituto Locomotiva, 2024"));
        destaques.add(dado("80 mi", "de pessoas",
                "no mundo vivem com transtorno do jogo. Entre quem joga cassino online e slots, a taxa chega a cerca de 16%.",
                "The Lancet Public Health Commission on Gambling, 2024"));
        out.put("destaques", destaques);

        // Quanto volta, em média, a cada R$ 100 apostados (valores típicos de mercado).
        List<Object> retorno = new ArrayList<>();
        retorno.add(barra("Roleta europeia", 97.3, "Margem matemática fixa de 2,7% (1 zero em 37 números)."));
        retorno.add(barra("Slots / \"tigrinho\"", 94, "RTP típico entre 90% e 97%, definido pelo fornecedor do jogo."));
        retorno.add(barra("Aposta esportiva", 93, "As casas embutem uma margem de ~5% a 10% nas odds."));
        retorno.add(barra("Jogos crash (Aviator)", 97, "RTP declarado ~97%, mas a velocidade das rodadas multiplica a perda."));
        retorno.add(barra("Loterias (Mega-Sena)", 44, "Menos da metade da arrecadação volta em prêmios."));
        out.put("retornoMedio", retorno);

        List<Object> sinais = List.of(
                "Pensar em apostas o tempo todo, mesmo trabalhando ou com a família",
                "Precisar apostar valores cada vez maiores para sentir a mesma emoção",
                "Ficar irritado(a) ou ansioso(a) ao tentar parar",
                "Apostar para recuperar o que perdeu",
                "Mentir sobre quanto aposta ou esconder extratos",
                "Pegar dinheiro emprestado ou usar contas da casa para apostar",
                "Perder o interesse por coisas que antes davam prazer");
        out.put("sinais", sinais);

        List<Object> ciclo = List.of(
                passo("Gatilho", "Tédio, estresse, propaganda, um jogo na TV ou uma notificação do app."),
                passo("Aposta", "A expectativa libera dopamina — o cérebro sente prazer antes mesmo do resultado."),
                passo("Ganho ou \"quase\"", "Pequenos ganhos e quase-vitórias reforçam a ilusão de que dá para vencer."),
                passo("Perda", "A matemática sempre vence. Vem a culpa, a vergonha e o desejo de recuperar."),
                passo("Recuperar", "Apostar de novo para cobrir o prejuízo — e o ciclo recomeça, mais forte."));
        out.put("ciclo", ciclo);

        List<Object> leis = List.of(
                "A Lei 14.790/2023 regulamentou as apostas de quota fixa no Brasil.",
                "Desde 2025, só podem operar empresas autorizadas pelo Ministério da Fazenda, com sites terminados em .bet.br.",
                "Apostar é proibido para menores de 18 anos.",
                "As casas autorizadas não podem aceitar cartão de crédito e devem oferecer ferramentas de autoexclusão e limites.",
                "O transtorno do jogo é reconhecido como doença pela Organização Mundial da Saúde (CID-11, código 6C50).");
        out.put("legislacao", leis);
        return out;
    }

    public List<Object> quiz() {
        List<Object> q = new ArrayList<>();
        q.add(pergunta("Existe estratégia que garante lucro no cassino online.", false,
                "Slots e roletas usam geradores de números aleatórios com vantagem fixa para a casa. Nenhuma estratégia muda a matemática."));
        q.add(pergunta("Depois de muitas perdas seguidas, a chance de ganhar aumenta.", false,
                "Isso é a \"falácia do apostador\". Cada rodada é independente: o jogo não tem memória."));
        q.add(pergunta("O vício em apostas é reconhecido como doença pela OMS.", true,
                "Sim. O transtorno do jogo está na CID-11 (6C50) e tem tratamento."));
        q.add(pergunta("Quem entende muito de futebol consegue viver de apostas esportivas.", false,
                "A margem embutida nas odds e os limites impostos a quem ganha tornam isso praticamente impossível no longo prazo."));
        q.add(pergunta("O \"quase ganhei\" faz o cérebro reagir como se fosse uma vitória.", true,
                "Estudos mostram que quase-vitórias ativam o sistema de recompensa, o que incentiva continuar jogando."));
        q.add(pergunta("Influenciadores que divulgam bets sempre mostram ganhos reais.", false,
                "Muitos usam contas de demonstração ou recebem comissão sobre o que os seguidores perdem."));
        q.add(pergunta("Menores de 18 anos podem apostar se usarem a conta de um adulto.", false,
                "Apostar é proibido para menores no Brasil, e emprestar a conta também é irregular."));
        q.add(pergunta("Bloquear apps e usar a autoexclusão ajuda a parar.", true,
                "Reduzir o acesso é uma das estratégias mais eficazes, principalmente nas primeiras semanas."));
        q.add(pergunta("Apostar um pouquinho todo dia não faz mal.", false,
                "A frequência é um dos principais fatores de risco: o hábito diário treina o cérebro a depender do jogo."));
        q.add(pergunta("Recaídas fazem parte de muitas recuperações.", true,
                "Uma recaída não é fracasso. O importante é retomar o plano e buscar apoio."));
        return q;
    }

    private static final String[] FRASES = {
            "Um dia de cada vez. Hoje você só precisa vencer hoje.",
            "A vontade de apostar passa. Em geral, ela dura poucos minutos — espere ela ir embora.",
            "O dinheiro que você não apostou hoje já é uma vitória.",
            "Pedir ajuda não é fraqueza, é estratégia.",
            "Você é muito mais do que o seu vício.",
            "A casa sempre ganha. Desta vez, quem ganha é você — ficando fora.",
            "Recomeçar é para os corajosos.",
            "Cada \"não\" que você diz à aposta é um \"sim\" para sua família.",
    };

    public Map<String, Object> motivacao() {
        return Map.of("frase", FRASES[ThreadLocalRandom.current().nextInt(FRASES.length)]);
    }

    // ---------------------------------------------------------------- helpers

    private static Map<String, Object> dado(String valor, String unidade, String texto, String fonte) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("valor", valor);
        m.put("unidade", unidade);
        m.put("texto", texto);
        m.put("fonte", fonte);
        return m;
    }

    private static Map<String, Object> barra(String rotulo, double valor, String nota) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("rotulo", rotulo);
        m.put("valor", valor);
        m.put("nota", nota);
        return m;
    }

    private static Map<String, Object> passo(String titulo, String texto) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("titulo", titulo);
        m.put("texto", texto);
        return m;
    }

    private static Map<String, Object> pergunta(String afirmacao, boolean verdade, String explicacao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("afirmacao", afirmacao);
        m.put("verdade", verdade);
        m.put("explicacao", explicacao);
        return m;
    }
}
