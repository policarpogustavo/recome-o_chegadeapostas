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
                "Banco Central do Brasil, Estudo Especial nº 119/2024"));
        destaques.add(dado("R$ 3 bi", "em um mês",
                "enviados às bets em agosto de 2024 por cerca de 5 milhões de pessoas de famílias beneficiárias do Bolsa Família.",
                "Banco Central do Brasil, nota técnica de setembro de 2024"));
        destaques.add(dado("86%", "dos apostadores",
                "têm dívidas, e 64% estão com o nome negativado.",
                "Instituto Locomotiva, 2024"));
        destaques.add(dado("80 mi", "de pessoas",
                "no mundo vivem com transtorno do jogo. Entre quem joga cassino online e slots, a taxa chega a cerca de 16%.",
                "The Lancet Public Health Commission on Gambling, 2024"));
        destaques.add(dado("10,9 mi", "de brasileiros",
                "apostam com prejuízo pessoal, profissional ou financeiro: 7,3% de toda a população a partir de 14 anos.",
                "III LENAD (Unifesp)"));
        destaques.add(dado("1,4 mi", "de pessoas",
                "já preenchem os critérios clínicos do transtorno do jogo, uma doença reconhecida pela OMS.",
                "III LENAD (Unifesp)"));
        destaques.add(dado("66,8%", "de quem usa bets",
                "apresenta jogo de risco ou problemático. Entre quem aposta só em modalidades físicas, são 26,8%.",
                "III LENAD (Unifesp)"));
        destaques.add(dado("55,2%", "dos adolescentes",
                "de 14 a 17 anos que apostam já estão na zona de risco. Mesmo proibido, 1,4 milhão de menores apostaram no último ano.",
                "III LENAD (Unifesp)"));
        destaques.add(dado("R$ 62,5 bi", "em 2025",
                "saíram do bolso das famílias brasileiras e ficaram com as plataformas de apostas.",
                "Comsefaz, via AMB"));
        destaques.add(dado("R$ 17 bi", "por ano",
                "é o custo social das mortes por suicídio ligadas às apostas, dentro de um prejuízo total de R$ 38,8 bilhões.",
                "IEPS, Umane e FPSM, via AMB"));
        destaques.add(dado("4 pessoas", "adoecem junto",
                "para cada pessoa com problema de jogo, outras quatro passam a ter problemas de saúde: familiares, parceiros e filhos.",
                "Associação Médica Brasileira (AMB)"));
        destaques.add(dado("+104%", "no SUS",
                "de alta nos atendimentos por jogo patológico: foram 10.553 entre janeiro de 2018 e maio de 2025.",
                "Ministério da Saúde, via AMB"));
        out.put("destaques", destaques);

        // Proporção de apostadores com jogo de risco ou problemático, por grupo (III LENAD).
        List<Object> risco = new ArrayList<>();
        risco.add(barra("Usuários de bets", 66.8, "Contra 26,8% entre quem aposta só em modalidades físicas."));
        risco.add(barra("Adolescentes (14 a 17 anos)", 55.2, "Apostar é proibido para menores, mas 1,4 milhão de adolescentes apostaram no último ano."));
        risco.add(barra("Renda de até 1 salário", 52.8, "Quem tem menos é quem mais adoece: o vício leva o dinheiro que falta em casa."));
        risco.add(barra("Região Nordeste", 52.3, "Só 16,3% dos nordestinos apostam, mas metade deles já está em risco."));
        risco.add(barra("Região Norte", 46.2, "É a segunda região com a maior proporção de jogadores em risco."));
        risco.add(barra("Média de quem aposta", 38.6, "Quase 4 em cada 10 pessoas que apostaram no último ano já mostram sinais de risco."));
        risco.add(barra("Renda acima de 2 salários", 21.1, "Mesmo entre quem ganha mais, 1 em cada 5 apostadores está em risco."));
        out.put("riscoPorGrupo", risco);

        // Prejuízo social anual, em bilhões de reais (IEPS/Umane/FPSM).
        List<Object> custo = new ArrayList<>();
        custo.add(barra("Mortes por suicídio", 17, "Vidas perdidas para o desespero causado pelas dívidas e pela compulsão."));
        custo.add(barra("Depressão e qualidade de vida", 10.4, "Anos de vida com depressão, ansiedade e sofrimento."));
        custo.add(barra("Tratamento médico", 3, "Custo de consultas, internações e acompanhamento no sistema de saúde."));
        out.put("custoSocial", custo);

        List<Object> danos = List.of(
                "Depressão, ansiedade e estresse crônico",
                "Risco elevado de suicídio",
                "Dívidas, empréstimos e venda de bens para continuar apostando",
                "Culpa, vergonha, humilhação e mentiras para esconder o jogo",
                "Isolamento social e conflitos dentro de casa",
                "Noites sem dormir e queda no rendimento nos estudos e no trabalho",
                "Falta de comida em casa: a renda da família vai para as apostas",
                "Perda de controle: apostar cada vez mais para recuperar o que perdeu");
        out.put("danos", danos);

        // Quanto volta, em média, a cada R$ 100 apostados (valores típicos de mercado).
        List<Object> retorno = new ArrayList<>();
        retorno.add(barra("Roleta europeia", 97.3, "Margem matemática fixa de 2,7% (1 zero em 37 números)."));
        retorno.add(barra("Slots e \"tigrinho\"", 94, "RTP típico entre 90% e 97%, definido pelo fornecedor do jogo."));
        retorno.add(barra("Aposta esportiva", 93, "As casas embutem uma margem de 5% a 10% nas odds."));
        retorno.add(barra("Jogos crash (Aviator)", 97, "RTP declarado de cerca de 97%, mas a velocidade das rodadas multiplica a perda."));
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
                passo("Aposta", "A expectativa libera dopamina, e o cérebro sente prazer antes mesmo do resultado."),
                passo("Ganho ou \"quase\"", "Pequenos ganhos e quase vitórias reforçam a ilusão de que dá para vencer."),
                passo("Perda", "A matemática sempre vence. Vêm a culpa, a vergonha e o desejo de recuperar o dinheiro."),
                passo("Recuperar", "Apostar de novo para cobrir o prejuízo. E o ciclo recomeça, mais forte."));
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
        q.add(pergunta("Existe uma estratégia que garante lucro no cassino online.", false,
                "Slots e roletas usam geradores de números aleatórios com vantagem fixa para a casa. Nenhuma estratégia muda a matemática."));
        q.add(pergunta("Depois de muitas perdas seguidas, a chance de ganhar aumenta.", false,
                "Isso é a \"falácia do apostador\". Cada rodada é independente: o jogo não tem memória."));
        q.add(pergunta("O vício em apostas é reconhecido como doença pela OMS.", true,
                "Sim. O transtorno do jogo está na CID-11 (6C50) e tem tratamento."));
        q.add(pergunta("Quem entende muito de futebol consegue viver de apostas esportivas.", false,
                "A margem embutida nas odds e os limites impostos a quem ganha tornam isso praticamente impossível no longo prazo."));
        q.add(pergunta("O \"quase ganhei\" faz o cérebro reagir como se fosse uma vitória.", true,
                "Estudos mostram que as quase vitórias ativam o sistema de recompensa do cérebro, o que incentiva a pessoa a continuar jogando."));
        q.add(pergunta("Influenciadores que divulgam bets sempre mostram ganhos reais.", false,
                "Muitos usam contas de demonstração ou recebem comissão sobre o que os seguidores perdem."));
        q.add(pergunta("Menores de 18 anos podem apostar se usarem a conta de um adulto.", false,
                "Apostar é proibido para menores no Brasil, e emprestar a conta também é irregular."));
        q.add(pergunta("Bloquear aplicativos e usar a autoexclusão ajuda a parar.", true,
                "Reduzir o acesso é uma das estratégias mais eficazes, principalmente nas primeiras semanas."));
        q.add(pergunta("Apostar um pouquinho todo dia não faz mal.", false,
                "A frequência é um dos principais fatores de risco: o hábito diário treina o cérebro a depender do jogo."));
        q.add(pergunta("Recaídas fazem parte de muitas recuperações.", true,
                "Uma recaída não é fracasso. O importante é retomar o plano e buscar apoio."));
        q.add(pergunta("Ganhar uma bolada resolve a vida de quem está endividado por causa das apostas.", false,
                "Quem ganha alto costuma continuar apostando e devolve o prêmio à casa. Sem tratamento, um grande ganho tende a aumentar o vício."));
        q.add(pergunta("Os jogos crash, como o Aviator, podem ser previstos com robôs ou grupos de sinais.", false,
                "Os resultados são aleatórios. Quem vende sinais ou robôs lucra com a venda ou com a comissão sobre as perdas de quem compra."));
        q.add(pergunta("A vontade intensa de apostar costuma passar em poucos minutos se você não agir sobre ela.", true,
                "A fissura vem em ondas. Respirar, sair do ambiente e se ocupar com outra coisa ajudam a atravessar esse momento."));
        q.add(pergunta("Apostas esportivas são seguras porque dependem de conhecimento, e não de sorte.", false,
                "Elas também causam vício. Segundo o III LENAD, 66,8% de quem usa bets apresenta jogo de risco ou problemático."));
        q.add(pergunta("Familiares de quem tem vício em apostas também podem procurar ajuda no CAPS.", true,
                "Sim. O vício afeta a casa inteira, e os familiares também têm direito a acolhimento gratuito pelo SUS."));
        q.add(pergunta("Pagar as dívidas de quem aposta, sem um plano de tratamento, ajuda a pessoa a parar.", false,
                "Sem tratamento, quitar as dívidas costuma liberar dinheiro e crédito para novas apostas."));
        q.add(pergunta("O retorno ao jogador (RTP) dos cassinos online é sempre menor que 100%.", true,
                "O RTP é definido pelo fornecedor do jogo e fica sempre abaixo de 100%. A diferença é o lucro garantido da casa."));
        q.add(pergunta("Exercícios físicos ajudam a reduzir a ansiedade de quem está parando de apostar.", true,
                "A atividade física libera substâncias que melhoram o humor e diminuem a ansiedade e a fissura."));
        q.add(pergunta("Os sites de apostas autorizados no Brasil terminam em .bet.br.", true,
                "Desde 2025, só empresas autorizadas pelo Ministério da Fazenda podem operar, com sites terminados em .bet.br."));
        q.add(pergunta("Quem tem vício em apostas é uma pessoa fraca ou sem caráter.", false,
                "O transtorno do jogo é uma condição de saúde reconhecida pela OMS. Força de vontade sozinha não basta, e o tratamento funciona."));
        return q;
    }

    private static final String[] FRASES = {
            "Um dia de cada vez. Hoje você só precisa vencer hoje.",
            "A vontade de apostar passa. Em geral, ela dura poucos minutos; espere até que ela vá embora.",
            "O dinheiro que você não apostou hoje já é uma vitória.",
            "Pedir ajuda não é fraqueza, é estratégia.",
            "Você é muito mais do que o seu vício.",
            "A casa sempre ganha. Desta vez, quem ganha é você, ficando de fora.",
            "Recomeçar é para os corajosos.",
            "Cada \"não\" que você diz à aposta é um \"sim\" para a sua família.",
            "Você não precisa ser perfeito(a). Só precisa continuar.",
            "Cada real que fica no seu bolso é um passo em direção aos seus sonhos.",
            "Falar sobre o problema tira o poder que ele tem sobre você.",
            "Hoje é um ótimo dia para continuar o seu recomeço.",
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
