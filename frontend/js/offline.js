/*
 * Versão da API que roda no próprio navegador. É usada quando o servidor não
 * respondeu a tempo (ver Api.conectar em api.js) ou quando o site é aberto
 * direto do disco, e também serve o conteúdo fixo enquanto o servidor acorda.
 * Espelha AvaliacaoService, ConteudoService e DepoimentoService; os dados ficam
 * salvos no localStorage deste aparelho. Contas precisam do servidor.
 */
const ApiLocal = (() => {
  const ORIGENS = ['amigos', 'propaganda', 'influenciador', 'dinheiro_rapido', 'tedio', 'futebol', 'familia', 'outro'];
  const TEMPOS = ['menos6m', '6a12m', '1a3a', 'mais3a'];
  const TIPOS = ['esportiva', 'cassino', 'crash', 'poquer', 'loteria'];
  const FREQUENCIAS = ['raramente', 'semanal', 'diaria', 'varias_dia'];
  const DIVIDAS = ['nao', 'pequenas', 'grandes'];
  const ESCONDE = ['nao', 'as_vezes', 'sim'];
  const AJUDA = ['sim', 'talvez', 'nao'];
  const FAIXAS = ['menor', '18-24', '25-34', '35-44', '45-59', '60+'];
  const DIA_A_DIA = ['acorda_pensando', 'aposta_trabalho', 'perde_sono', 'ansiedade', 'mente', 'isolamento',
    'pede_emprestado', 'recuperar_perdas', 'irritado_sem_jogar', 'deixou_lazer'];
  const NIVEIS = ['sem_risco', 'baixo', 'moderado', 'problematico'];

  const dado = (valor, unidade, texto, fonte) => ({ valor, unidade, texto, fonte });
  const barra = (rotulo, valor, nota) => ({ rotulo, valor, nota });
  const passo = (titulo, texto) => ({ titulo, texto });
  const pergunta = (afirmacao, verdade, explicacao) => ({ afirmacao, verdade, explicacao });
  const rec = (titulo, texto) => ({ titulo, texto });

  // ------------------------------------------------------------ conteúdo

  function dados() {
    return {
      destaques: [
        dado('R$ 20 bi', 'por mês',
          'foram transferidos via Pix para casas de apostas em 2024, segundo estimativa do Banco Central (entre R$ 18 e 21 bilhões mensais).',
          'Banco Central do Brasil, Estudo Especial nº 119/2024'),
        dado('R$ 3 bi', 'em um mês',
          'enviados às bets em agosto de 2024 por cerca de 5 milhões de pessoas de famílias beneficiárias do Bolsa Família.',
          'Banco Central do Brasil, nota técnica de setembro de 2024'),
        dado('86%', 'dos apostadores',
          'têm dívidas, e 64% estão com o nome negativado.',
          'Instituto Locomotiva, 2024'),
        dado('80 mi', 'de pessoas',
          'no mundo vivem com transtorno do jogo. Entre quem joga cassino online e slots, a taxa chega a cerca de 16%.',
          'The Lancet Public Health Commission on Gambling, 2024'),
        dado('10,9 mi', 'de brasileiros',
          'apostam com prejuízo pessoal, profissional ou financeiro: 7,3% de toda a população a partir de 14 anos.',
          'III LENAD (Unifesp)'),
        dado('1,4 mi', 'de pessoas',
          'já preenchem os critérios clínicos do transtorno do jogo, uma doença reconhecida pela OMS.',
          'III LENAD (Unifesp)'),
        dado('66,8%', 'de quem usa bets',
          'apresenta jogo de risco ou problemático. Entre quem aposta só em modalidades físicas, são 26,8%.',
          'III LENAD (Unifesp)'),
        dado('55,2%', 'dos adolescentes',
          'de 14 a 17 anos que apostam já estão na zona de risco. Mesmo proibido, 1,4 milhão de menores apostaram no último ano.',
          'III LENAD (Unifesp)'),
        dado('R$ 62,5 bi', 'em 2025',
          'saíram do bolso das famílias brasileiras e ficaram com as plataformas de apostas.',
          'Comsefaz, via AMB'),
        dado('R$ 17 bi', 'por ano',
          'é o custo social das mortes por suicídio ligadas às apostas, dentro de um prejuízo total de R$ 38,8 bilhões.',
          'IEPS, Umane e FPSM, via AMB'),
        dado('4 pessoas', 'adoecem junto',
          'para cada pessoa com problema de jogo, outras quatro passam a ter problemas de saúde: familiares, parceiros e filhos.',
          'Associação Médica Brasileira (AMB)'),
        dado('+104%', 'no SUS',
          'de alta nos atendimentos por jogo patológico: foram 10.553 entre janeiro de 2018 e maio de 2025.',
          'Ministério da Saúde, via AMB'),
      ],
      riscoPorGrupo: [
        barra('Usuários de bets', 66.8, 'Contra 26,8% entre quem aposta só em modalidades físicas.'),
        barra('Adolescentes (14 a 17 anos)', 55.2, 'Apostar é proibido para menores, mas 1,4 milhão de adolescentes apostaram no último ano.'),
        barra('Renda de até 1 salário', 52.8, 'Quem tem menos é quem mais adoece: o vício leva o dinheiro que falta em casa.'),
        barra('Região Nordeste', 52.3, 'Só 16,3% dos nordestinos apostam, mas metade deles já está em risco.'),
        barra('Região Norte', 46.2, 'É a segunda região com a maior proporção de jogadores em risco.'),
        barra('Média de quem aposta', 38.6, 'Quase 4 em cada 10 pessoas que apostaram no último ano já mostram sinais de risco.'),
        barra('Renda acima de 2 salários', 21.1, 'Mesmo entre quem ganha mais, 1 em cada 5 apostadores está em risco.'),
      ],
      custoSocial: [
        barra('Mortes por suicídio', 17, 'Vidas perdidas para o desespero causado pelas dívidas e pela compulsão.'),
        barra('Depressão e qualidade de vida', 10.4, 'Anos de vida com depressão, ansiedade e sofrimento.'),
        barra('Tratamento médico', 3, 'Custo de consultas, internações e acompanhamento no sistema de saúde.'),
      ],
      danos: [
        'Depressão, ansiedade e estresse crônico',
        'Risco elevado de suicídio',
        'Dívidas, empréstimos e venda de bens para continuar apostando',
        'Culpa, vergonha, humilhação e mentiras para esconder o jogo',
        'Isolamento social e conflitos dentro de casa',
        'Noites sem dormir e queda no rendimento nos estudos e no trabalho',
        'Falta de comida em casa: a renda da família vai para as apostas',
        'Perda de controle: apostar cada vez mais para recuperar o que perdeu',
      ],
      retornoMedio: [
        barra('Roleta europeia', 97.3, 'Margem matemática fixa de 2,7% (1 zero em 37 números).'),
        barra('Slots e "tigrinho"', 94, 'RTP típico entre 90% e 97%, definido pelo fornecedor do jogo.'),
        barra('Aposta esportiva', 93, 'As casas embutem uma margem de 5% a 10% nas odds.'),
        barra('Jogos crash (Aviator)', 97, 'RTP declarado de cerca de 97%, mas a velocidade das rodadas multiplica a perda.'),
        barra('Loterias (Mega-Sena)', 44, 'Menos da metade da arrecadação volta em prêmios.'),
      ],
      sinais: [
        'Pensar em apostas o tempo todo, mesmo trabalhando ou com a família',
        'Precisar apostar valores cada vez maiores para sentir a mesma emoção',
        'Ficar irritado(a) ou ansioso(a) ao tentar parar',
        'Apostar para recuperar o que perdeu',
        'Mentir sobre quanto aposta ou esconder extratos',
        'Pegar dinheiro emprestado ou usar contas da casa para apostar',
        'Perder o interesse por coisas que antes davam prazer',
      ],
      ciclo: [
        passo('Gatilho', 'Tédio, estresse, propaganda, um jogo na TV ou uma notificação do app.'),
        passo('Aposta', 'A expectativa libera dopamina, e o cérebro sente prazer antes mesmo do resultado.'),
        passo('Ganho ou "quase"', 'Pequenos ganhos e quase vitórias reforçam a ilusão de que dá para vencer.'),
        passo('Perda', 'A matemática sempre vence. Vêm a culpa, a vergonha e o desejo de recuperar o dinheiro.'),
        passo('Recuperar', 'Apostar de novo para cobrir o prejuízo. E o ciclo recomeça, mais forte.'),
      ],
      legislacao: [
        'A Lei 14.790/2023 regulamentou as apostas de quota fixa no Brasil.',
        'Desde 2025, só podem operar empresas autorizadas pelo Ministério da Fazenda, com sites terminados em .bet.br.',
        'Apostar é proibido para menores de 18 anos.',
        'As casas autorizadas não podem aceitar cartão de crédito e devem oferecer ferramentas de autoexclusão e limites.',
        'O transtorno do jogo é reconhecido como doença pela Organização Mundial da Saúde (CID-11, código 6C50).',
      ],
    };
  }

  function quiz() {
    return [
      pergunta('Existe uma estratégia que garante lucro no cassino online.', false,
        'Slots e roletas usam geradores de números aleatórios com vantagem fixa para a casa. Nenhuma estratégia muda a matemática.'),
      pergunta('Depois de muitas perdas seguidas, a chance de ganhar aumenta.', false,
        'Isso é a "falácia do apostador". Cada rodada é independente: o jogo não tem memória.'),
      pergunta('O vício em apostas é reconhecido como doença pela OMS.', true,
        'Sim. O transtorno do jogo está na CID-11 (6C50) e tem tratamento.'),
      pergunta('Quem entende muito de futebol consegue viver de apostas esportivas.', false,
        'A margem embutida nas odds e os limites impostos a quem ganha tornam isso praticamente impossível no longo prazo.'),
      pergunta('O "quase ganhei" faz o cérebro reagir como se fosse uma vitória.', true,
        'Estudos mostram que as quase vitórias ativam o sistema de recompensa do cérebro, o que incentiva a pessoa a continuar jogando.'),
      pergunta('Influenciadores que divulgam bets sempre mostram ganhos reais.', false,
        'Muitos usam contas de demonstração ou recebem comissão sobre o que os seguidores perdem.'),
      pergunta('Menores de 18 anos podem apostar se usarem a conta de um adulto.', false,
        'Apostar é proibido para menores no Brasil, e emprestar a conta também é irregular.'),
      pergunta('Bloquear aplicativos e usar a autoexclusão ajuda a parar.', true,
        'Reduzir o acesso é uma das estratégias mais eficazes, principalmente nas primeiras semanas.'),
      pergunta('Apostar um pouquinho todo dia não faz mal.', false,
        'A frequência é um dos principais fatores de risco: o hábito diário treina o cérebro a depender do jogo.'),
      pergunta('Recaídas fazem parte de muitas recuperações.', true,
        'Uma recaída não é fracasso. O importante é retomar o plano e buscar apoio.'),
      pergunta('Ganhar uma bolada resolve a vida de quem está endividado por causa das apostas.', false,
        'Quem ganha alto costuma continuar apostando e devolve o prêmio à casa. Sem tratamento, um grande ganho tende a aumentar o vício.'),
      pergunta('Os jogos crash, como o Aviator, podem ser previstos com robôs ou grupos de sinais.', false,
        'Os resultados são aleatórios. Quem vende sinais ou robôs lucra com a venda ou com a comissão sobre as perdas de quem compra.'),
      pergunta('A vontade intensa de apostar costuma passar em poucos minutos se você não agir sobre ela.', true,
        'A fissura vem em ondas. Respirar, sair do ambiente e se ocupar com outra coisa ajudam a atravessar esse momento.'),
      pergunta('Apostas esportivas são seguras porque dependem de conhecimento, e não de sorte.', false,
        'Elas também causam vício. Segundo o III LENAD, 66,8% de quem usa bets apresenta jogo de risco ou problemático.'),
      pergunta('Familiares de quem tem vício em apostas também podem procurar ajuda no CAPS.', true,
        'Sim. O vício afeta a casa inteira, e os familiares também têm direito a acolhimento gratuito pelo SUS.'),
      pergunta('Pagar as dívidas de quem aposta, sem um plano de tratamento, ajuda a pessoa a parar.', false,
        'Sem tratamento, quitar as dívidas costuma liberar dinheiro e crédito para novas apostas.'),
      pergunta('O retorno ao jogador (RTP) dos cassinos online é sempre menor que 100%.', true,
        'O RTP é definido pelo fornecedor do jogo e fica sempre abaixo de 100%. A diferença é o lucro garantido da casa.'),
      pergunta('Exercícios físicos ajudam a reduzir a ansiedade de quem está parando de apostar.', true,
        'A atividade física libera substâncias que melhoram o humor e diminuem a ansiedade e a fissura.'),
      pergunta('Os sites de apostas autorizados no Brasil terminam em .bet.br.', true,
        'Desde 2025, só empresas autorizadas pelo Ministério da Fazenda podem operar, com sites terminados em .bet.br.'),
      pergunta('Quem tem vício em apostas é uma pessoa fraca ou sem caráter.', false,
        'O transtorno do jogo é uma condição de saúde reconhecida pela OMS. Força de vontade sozinha não basta, e o tratamento funciona.'),
    ];
  }

  const FRASES = [
    'Um dia de cada vez. Hoje você só precisa vencer hoje.',
    'A vontade de apostar passa. Em geral, ela dura poucos minutos; espere até que ela vá embora.',
    'O dinheiro que você não apostou hoje já é uma vitória.',
    'Pedir ajuda não é fraqueza, é estratégia.',
    'Você é muito mais do que o seu vício.',
    'A casa sempre ganha. Desta vez, quem ganha é você, ficando de fora.',
    'Recomeçar é para os corajosos.',
    'Cada "não" que você diz à aposta é um "sim" para a sua família.',
    'Você não precisa ser perfeito(a). Só precisa continuar.',
    'Cada real que fica no seu bolso é um passo em direção aos seus sonhos.',
    'Falar sobre o problema tira o poder que ele tem sobre você.',
    'Hoje é um ótimo dia para continuar o seu recomeço.',
  ];

  const motivacao = () => ({ frase: FRASES[Math.floor(Math.random() * FRASES.length)] });

  // ------------------------------------------------------------ avaliação

  function opcao(inp, campo, validas) {
    const v = inp[campo];
    if (typeof v !== 'string' || !validas.includes(v)) throw new Error(`Campo inválido: ${campo}`);
    return v;
  }

  function lista(inp, campo, validas, obrigatoria) {
    const v = inp[campo];
    if (!Array.isArray(v)) throw new Error(`Campo inválido: ${campo}`);
    const out = [];
    for (const s of v) {
      if (typeof s !== 'string' || !validas.includes(s)) throw new Error(`Valor inválido em ${campo}`);
      if (!out.includes(s)) out.push(s);
    }
    if (obrigatoria && !out.length) throw new Error(`Selecione ao menos uma opção em ${campo}`);
    return out;
  }

  function numero(inp, campo, min, max) {
    const v = inp[campo];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`Campo inválido: ${campo}`);
    return v;
  }

  function validar(inp) {
    const r = {
      faixaEtaria: opcao(inp, 'faixaEtaria', FAIXAS),
      origem: opcao(inp, 'origem', ORIGENS),
      tempo: opcao(inp, 'tempo', TEMPOS),
      tipos: lista(inp, 'tipos', TIPOS, true),
      frequencia: opcao(inp, 'frequencia', FREQUENCIAS),
      gastoMensal: numero(inp, 'gastoMensal', 0, 10_000_000),
      dividas: opcao(inp, 'dividas', DIVIDAS),
      escondeFamilia: opcao(inp, 'escondeFamilia', ESCONDE),
      arrependimento: Math.round(numero(inp, 'arrependimento', 1, 5)),
      diaADia: lista(inp, 'diaADia', DIA_A_DIA, false),
      querAjuda: opcao(inp, 'querAjuda', AJUDA),
    };
    const p = inp.pgsi;
    if (!Array.isArray(p) || p.length !== 9) throw new Error('pgsi deve ter 9 respostas');
    r.pgsi = p.map(n => {
      if (typeof n !== 'number' || n < 0 || n > 3) throw new Error('Respostas do pgsi devem estar entre 0 e 3');
      return Math.round(n);
    });
    return r;
  }

  function calcular(r) {
    const score = r.pgsi.reduce((a, b) => a + b, 0);
    const { tipos, diaADia: dia, gastoMensal: gasto } = r;

    let nivel;
    if (score === 0) {
      nivel = { codigo: 'sem_risco', titulo: 'Sem sinais de problema', descricao: 'Suas respostas não indicam problemas com apostas neste momento. Ótimo! Mesmo assim, fique atento(a): as plataformas são feitas para prender quem joga.' };
    } else if (score <= 2) {
      nivel = { codigo: 'baixo', titulo: 'Risco baixo', descricao: 'Existem alguns sinais de alerta. Este é o melhor momento para agir, porque parar agora é muito mais fácil do que depois.' };
    } else if (score <= 7) {
      nivel = { codigo: 'moderado', titulo: 'Risco moderado', descricao: 'As apostas já estão trazendo consequências para a sua vida. Você não precisa enfrentar isso sozinho(a): pedir ajuda é um ato de coragem.' };
    } else {
      nivel = { codigo: 'problematico', titulo: 'Jogo problemático', descricao: 'Suas respostas indicam um padrão compatível com o vício em apostas (transtorno do jogo). Essa é uma condição de saúde, tem tratamento, e muitas pessoas se recuperam. Procure apoio profissional o quanto antes.' };
    }

    const alertas = [];
    if (r.faixaEtaria === 'menor') {
      alertas.push('Apostar é proibido para menores de 18 anos no Brasil. Converse com um adulto de confiança; você não será julgado(a) por pedir ajuda.');
    }
    if (r.dividas === 'grandes') {
      alertas.push('Dívidas grandes aumentam muito o risco de tentar "recuperar" o prejuízo apostando. Essa é a armadilha mais comum, e ela só aumenta o buraco.');
    }
    if (dia.includes('recuperar_perdas')) {
      alertas.push('Apostar para recuperar perdas é um dos sinais mais fortes de vício. Aceite a perda como o custo do aprendizado e pare por aqui.');
    }
    if (r.frequencia === 'varias_dia') {
      alertas.push('Apostar várias vezes ao dia indica que o jogo virou um hábito automático. Bloquear o acesso a aplicativos e sites é o primeiro passo prático.');
    }

    const recs = [rec('Bloqueie o acesso hoje',
      'Peça a autoexclusão nas casas de apostas em que você tem conta (ela é obrigatória nos sites autorizados, que terminam em .bet.br), desinstale os aplicativos e instale um bloqueador gratuito, como o BetBlocker, no celular e no computador.')];
    if (r.dividas !== 'nao') {
      recs.push(rec('Organize as dívidas sem apostar',
        'Liste tudo o que você deve, priorize as contas essenciais e procure renegociar diretamente com os bancos ou pelo Procon da sua cidade. Peça a alguém de confiança que ajude a controlar o seu dinheiro por um tempo.'));
    }
    if (tipos.includes('cassino') || tipos.includes('crash')) {
      recs.push(rec('Entenda por que o cassino online sempre ganha',
        'Os slots (como o "tigrinho") e os jogos crash (como o Aviator) são programados para devolver menos de 100% do que recebem. Cada rodada leva uma parte do seu dinheiro e, no longo prazo, a perda é garantida. Veja o simulador nesta página.'));
    }
    if (tipos.includes('esportiva')) {
      recs.push(rec('Assista aos jogos sem apostar',
        'As casas embutem uma margem de lucro em todas as odds. Tente voltar a curtir o futebol pelo esporte: escolha um time para torcer e chame os amigos, mas deixe o celular longe na hora do jogo.'));
    }
    if (r.origem === 'influenciador' || r.origem === 'propaganda') {
      recs.push(rec('Desconfie de quem lucra com a sua perda',
        'Muitos influenciadores recebem uma porcentagem do que os seguidores perdem. Deixe de seguir perfis que divulgam apostas e silencie os anúncios de bets nas redes sociais.'));
    }
    if (r.escondeFamilia === 'sim' || r.escondeFamilia === 'as_vezes' || dia.includes('mente')) {
      recs.push(rec('Conte para alguém de confiança',
        'O segredo alimenta o vício. Escolha uma pessoa (um familiar, um amigo ou um colega) e conte a verdade. A seção "Para a família" pode ajudar nessa conversa.'));
    }
    if (dia.includes('ansiedade') || dia.includes('perde_sono') || dia.includes('isolamento')) {
      recs.push(rec('Cuide da sua saúde mental',
        'Ansiedade, insônia e isolamento costumam acompanhar o vício. O CAPS (Centro de Atenção Psicossocial) do SUS atende de graça. Se estiver em sofrimento intenso, ligue 188 (CVV), que atende 24 horas.'));
    }
    if (score >= 3) {
      recs.push(rec('Procure tratamento',
        'Psicólogos e psiquiatras tratam o transtorno do jogo. Grupos como os Jogadores Anônimos (JA) oferecem reuniões gratuitas, presenciais e online.'));
    }
    if (dia.includes('deixou_lazer') || dia.includes('aposta_trabalho') || r.origem === 'tedio') {
      recs.push(rec('Preencha o tempo livre',
        'O vício ocupa espaço na rotina. Planeje atividades para os horários em que você costumava apostar: exercícios, um curso, um hobby ou os jogos desta página.'));
    }
    recs.push(rec('Comece o seu contador de dias',
      'Na seção "Minha jornada", você marca há quantos dias está sem apostar e vê quanto dinheiro está economizando. Cada dia conta.'));

    const mensagem = {
      sim: 'Você deu o passo mais difícil: admitir que quer ajuda. Siga o plano abaixo, um passo de cada vez.',
      talvez: 'É normal ter dúvidas. Que tal tentar ficar só uma semana sem apostar e ver como se sente? O plano abaixo é um bom começo.',
    }[r.querAjuda] || 'Tudo bem não estar pronto(a) agora. Guarde esta página: quando quiser, ela estará aqui. Pense em como seria a sua vida daqui a um ano, sem apostas.';

    return {
      score, scoreMaximo: 27, nivel, mensagem,
      prejuizoMensal: gasto, prejuizoAnual: gasto * 12,
      alertas, recomendacoes: recs,
    };
  }

  function avaliar(inp) {
    const r = validar(inp || {});
    const resultado = calcular(r);
    const registros = Util.ler('local-avaliacoes', []);
    const data = new Date().toISOString();
    registros.push({ ...r, score: resultado.score, nivel: resultado.nivel.codigo, data });
    Util.salvar('local-avaliacoes', registros);
    return { ...resultado, data };
  }

  function estatisticas() {
    const all = Util.ler('local-avaliacoes', []);
    const zerado = chaves => Object.fromEntries([...chaves].sort().map(k => [k, 0]));
    const porTipo = zerado(TIPOS), porOrigem = zerado(ORIGENS), porTempo = zerado(TEMPOS);
    const porDia = zerado(DIA_A_DIA), porNivel = zerado(NIVEIS);
    const soma = (m, k) => { m[k] = (m[k] || 0) + 1; };

    let somaScore = 0, somaGasto = 0, somaArrep = 0, queremAjuda = 0, comDividas = 0, escondem = 0;
    for (const a of all) {
      (a.tipos || []).forEach(t => soma(porTipo, t));
      (a.diaADia || []).forEach(t => soma(porDia, t));
      soma(porOrigem, String(a.origem));
      soma(porTempo, String(a.tempo));
      soma(porNivel, String(a.nivel));
      somaScore += Number(a.score) || 0;
      somaGasto += Number(a.gastoMensal) || 0;
      somaArrep += Number(a.arrependimento) || 0;
      if (a.querAjuda === 'sim') queremAjuda++;
      if (a.dividas !== 'nao') comDividas++;
      if (a.escondeFamilia !== 'nao') escondem++;
    }
    const n = all.length;
    const media = v => (n === 0 ? 0 : v / n);
    return {
      total: n,
      mediaScore: media(somaScore),
      mediaGastoMensal: media(somaGasto),
      mediaArrependimento: media(somaArrep),
      percentQueremAjuda: media(100 * queremAjuda),
      percentComDividas: media(100 * comDividas),
      percentEscondem: media(100 * escondem),
      porTipo, porOrigem, porTempo, porNivel, porDiaADia: porDia,
    };
  }

  // ------------------------------------------------------------ mural

  const LINK = /(https?:\/\/|www\.|\.bet\b|\.com\b)/i;
  const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
  const TELEFONE = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[\s.-]?\d{4}\b/;
  const TIPOS_MURAL = ['superacao', 'apoio', 'familia'];

  function muralLido() {
    let lista = Util.ler('local-mural', null);
    if (!lista) {
      const agora = new Date().toISOString();
      lista = [
        ['apoio', 'Se você chegou até aqui, já deu um passo importante. Recaídas podem acontecer, mas elas não apagam o caminho que você já percorreu.'],
        ['familia', 'Familiares: o vício não é falta de caráter. Proteja as finanças da casa, mas não feche a porta do diálogo.'],
        ['superacao', 'Deixe aqui a sua mensagem anônima. Contar há quantos dias você está sem apostar inspira quem está começando agora.'],
      ].map(([tipo, texto]) => ({ apelido: 'Equipe Recomeço', texto, tipo, diasSemApostar: 0, equipe: true, data: agora }));
      Util.salvar('local-mural', lista);
    }
    return lista;
  }

  const limpar = (s, max) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, max) : '');

  function criarDepoimento(inp = {}) {
    const texto = limpar(inp.texto, 600);
    if (texto.length < 10) throw new Error('Escreva pelo menos 10 caracteres.');
    if (LINK.test(texto)) throw new Error('Links não são permitidos no mural.');
    if (EMAIL.test(texto)) throw new Error('Para proteger você, não coloque e-mails no mural.');
    if (TELEFONE.test(texto)) throw new Error('Para proteger você, não coloque números de telefone no mural.');
    const d = {
      apelido: limpar(inp.apelido, 30) || 'Anônimo',
      texto,
      tipo: TIPOS_MURAL.includes(inp.tipo) ? inp.tipo : 'apoio',
      diasSemApostar: typeof inp.diasSemApostar === 'number' ? Math.max(0, Math.min(36500, Math.trunc(inp.diasSemApostar))) : 0,
      equipe: false,
      data: new Date().toISOString(),
    };
    const lista = muralLido();
    lista.push(d);
    Util.salvar('local-mural', lista);
    return d;
  }

  const recentes = limite => muralLido().slice().reverse().slice(0, limite);

  // ------------------------------------------------------------ análise (espelha analise/servico.py)

  const ROTULO_FAIXA = { menor: 'Menos de 18', '18-24': '18 a 24', '25-34': '25 a 34', '35-44': '35 a 44', '45-59': '45 a 59', '60+': '60 ou mais' };
  const ROTULO_SINAL = {
    acorda_pensando: 'Acorda pensando em apostar', aposta_trabalho: 'Aposta no trabalho ou nos estudos',
    perde_sono: 'Perde o sono apostando', ansiedade: 'Sente ansiedade ou culpa', mente: 'Mente sobre as apostas',
    isolamento: 'Se afastou de amigos e família', pede_emprestado: 'Pede dinheiro emprestado',
    recuperar_perdas: 'Aposta para recuperar perdas', irritado_sem_jogar: 'Fica irritado sem apostar', deixou_lazer: 'Largou o lazer',
  };
  const emRisco = a => a.nivel === 'moderado' || a.nivel === 'problematico';
  const arred = v => Math.round(v * 10) / 10;

  function resumo() {
    const all = Util.ler('local-avaliacoes', []);
    const porFaixa = FAIXAS.map(f => {
      const g = all.filter(a => a.faixaEtaria === f);
      if (!g.length) return null;
      return {
        faixa: f, rotulo: ROTULO_FAIXA[f], total: g.length,
        mediaScore: arred(g.reduce((s, a) => s + (Number(a.score) || 0), 0) / g.length),
        percentRisco: arred((100 * g.filter(emRisco).length) / g.length),
      };
    }).filter(Boolean);
    const risco = all.filter(emRisco);
    const contagem = {};
    risco.forEach(a => (a.diaADia || []).forEach(s => { if (ROTULO_SINAL[s]) contagem[s] = (contagem[s] || 0) + 1; }));
    const sinaisNoRisco = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([sinal, n]) => ({ sinal, rotulo: ROTULO_SINAL[sinal], percent: arred((100 * n) / risco.length) }));
    return {
      total: all.length,
      percentEmRisco: all.length ? arred((100 * risco.length) / all.length) : 0,
      porFaixa, porSemana: [], sinaisNoRisco,
      gastoAnualComunidade: all.reduce((s, a) => s + (Number(a.gastoMensal) || 0), 0) * 12,
    };
  }

  function percentil(_, consulta) {
    const score = Number(consulta.get('score'));
    const scores = Util.ler('local-avaliacoes', []).map(a => Number(a.score) || 0);
    if (scores.length < 5) return { score, total: scores.length, suficiente: false };
    const menores = scores.filter(s => s < score).length;
    const iguais = scores.filter(s => s === score).length;
    const media = arred(scores.reduce((a, b) => a + b, 0) / scores.length);
    return {
      score, total: scores.length, suficiente: true, mediaScore: media,
      percentil: Math.round((100 * (menores + iguais / 2)) / scores.length),
      mensagem: score > media
        ? 'Sua pontuação ficou acima da média das suas avaliações anteriores. Vale a pena agir agora.'
        : 'Sua pontuação ficou abaixo ou na média das suas avaliações anteriores. Continue assim.',
    };
  }

  function minha() {
    const ultima = Util.ler('ultima-avaliacao', null);
    return { feita: !!ultima, origem: ultima ? 'aparelho' : null };
  }

  const semConta = () => {
    throw new Error('As contas precisam do servidor, que não respondeu agora. Enquanto isso, os seus dados ficam salvos neste aparelho.');
  };

  // ------------------------------------------------------------ rotas

  const ROTAS = {
    'GET dados': dados,
    'GET quiz': quiz,
    'GET motivacao': motivacao,
    'GET estatisticas': estatisticas,
    'POST avaliacao': avaliar,
    'GET depoimentos': () => recentes(30),
    'POST depoimentos': criarDepoimento,
    'GET avaliacao/minha': minha,
    'POST avaliacao/vincular': () => ({ vinculada: false }),
    'GET analise/resumo': resumo,
    'GET analise/percentil': percentil,
    'GET saude': () => ({ java: false, python: false }),
    'GET auth/eu': () => ({ logado: false, usuario: null, indisponivel: true }),
    'POST auth/login': semConta,
    'POST auth/cadastro': semConta,
    'POST auth/sair': () => ({ ok: true }),
    'GET usuario/exportar': semConta,
    'DELETE usuario': semConta,
  };

  return {
    async chamar(metodo, rota, corpo) {
      const [caminho, consulta = ''] = rota.split('?');
      const fn = ROTAS[`${metodo} ${caminho}`];
      if (!fn) throw new Error('Rota não encontrada.');
      // Clona para que quem chama não altere os dados internos.
      return JSON.parse(JSON.stringify(fn(corpo, new URLSearchParams(consulta)) ?? null));
    },
  };
})();
