/*
 * Versão da API que roda no próprio navegador. É usada quando o servidor Java
 * não está disponível (por exemplo, no GitHub Pages). Espelha o comportamento
 * de AvaliacaoService, ConteudoService e DepoimentoService; os dados ficam
 * salvos no localStorage deste aparelho.
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
          'Banco Central do Brasil — Estudo Especial nº 119/2024'),
        dado('R$ 3 bi', 'em um mês',
          'enviados às bets em agosto de 2024 por cerca de 5 milhões de pessoas de famílias beneficiárias do Bolsa Família.',
          'Banco Central do Brasil — Nota técnica, set/2024'),
        dado('86%', 'dos apostadores',
          'têm dívidas, e 64% estão com o nome negativado.',
          'Instituto Locomotiva, 2024'),
        dado('80 mi', 'de pessoas',
          'no mundo vivem com transtorno do jogo. Entre quem joga cassino online e slots, a taxa chega a cerca de 16%.',
          'The Lancet Public Health Commission on Gambling, 2024'),
      ],
      retornoMedio: [
        barra('Roleta europeia', 97.3, 'Margem matemática fixa de 2,7% (1 zero em 37 números).'),
        barra('Slots / "tigrinho"', 94, 'RTP típico entre 90% e 97%, definido pelo fornecedor do jogo.'),
        barra('Aposta esportiva', 93, 'As casas embutem uma margem de ~5% a 10% nas odds.'),
        barra('Jogos crash (Aviator)', 97, 'RTP declarado ~97%, mas a velocidade das rodadas multiplica a perda.'),
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
        passo('Aposta', 'A expectativa libera dopamina — o cérebro sente prazer antes mesmo do resultado.'),
        passo('Ganho ou "quase"', 'Pequenos ganhos e quase-vitórias reforçam a ilusão de que dá para vencer.'),
        passo('Perda', 'A matemática sempre vence. Vem a culpa, a vergonha e o desejo de recuperar.'),
        passo('Recuperar', 'Apostar de novo para cobrir o prejuízo — e o ciclo recomeça, mais forte.'),
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
      pergunta('Existe estratégia que garante lucro no cassino online.', false,
        'Slots e roletas usam geradores de números aleatórios com vantagem fixa para a casa. Nenhuma estratégia muda a matemática.'),
      pergunta('Depois de muitas perdas seguidas, a chance de ganhar aumenta.', false,
        'Isso é a "falácia do apostador". Cada rodada é independente: o jogo não tem memória.'),
      pergunta('O vício em apostas é reconhecido como doença pela OMS.', true,
        'Sim. O transtorno do jogo está na CID-11 (6C50) e tem tratamento.'),
      pergunta('Quem entende muito de futebol consegue viver de apostas esportivas.', false,
        'A margem embutida nas odds e os limites impostos a quem ganha tornam isso praticamente impossível no longo prazo.'),
      pergunta('O "quase ganhei" faz o cérebro reagir como se fosse uma vitória.', true,
        'Estudos mostram que quase-vitórias ativam o sistema de recompensa, o que incentiva continuar jogando.'),
      pergunta('Influenciadores que divulgam bets sempre mostram ganhos reais.', false,
        'Muitos usam contas de demonstração ou recebem comissão sobre o que os seguidores perdem.'),
      pergunta('Menores de 18 anos podem apostar se usarem a conta de um adulto.', false,
        'Apostar é proibido para menores no Brasil, e emprestar a conta também é irregular.'),
      pergunta('Bloquear apps e usar a autoexclusão ajuda a parar.', true,
        'Reduzir o acesso é uma das estratégias mais eficazes, principalmente nas primeiras semanas.'),
      pergunta('Apostar um pouquinho todo dia não faz mal.', false,
        'A frequência é um dos principais fatores de risco: o hábito diário treina o cérebro a depender do jogo.'),
      pergunta('Recaídas fazem parte de muitas recuperações.', true,
        'Uma recaída não é fracasso. O importante é retomar o plano e buscar apoio.'),
    ];
  }

  const FRASES = [
    'Um dia de cada vez. Hoje você só precisa vencer hoje.',
    'A vontade de apostar passa. Em geral, ela dura poucos minutos — espere ela ir embora.',
    'O dinheiro que você não apostou hoje já é uma vitória.',
    'Pedir ajuda não é fraqueza, é estratégia.',
    'Você é muito mais do que o seu vício.',
    'A casa sempre ganha. Desta vez, quem ganha é você — ficando fora.',
    'Recomeçar é para os corajosos.',
    'Cada "não" que você diz à aposta é um "sim" para sua família.',
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
      nivel = { codigo: 'sem_risco', titulo: 'Sem sinais de problema', descricao: 'Suas respostas não indicam problemas com apostas agora. Ótimo! Mesmo assim, fique atento: as plataformas são feitas para prender.' };
    } else if (score <= 2) {
      nivel = { codigo: 'baixo', titulo: 'Risco baixo', descricao: 'Existem alguns sinais de alerta. É o melhor momento para agir: parar agora é muito mais fácil do que depois.' };
    } else if (score <= 7) {
      nivel = { codigo: 'moderado', titulo: 'Risco moderado', descricao: 'As apostas já estão trazendo consequências para sua vida. Você não precisa enfrentar isso sozinho(a) — pedir ajuda é um ato de coragem.' };
    } else {
      nivel = { codigo: 'problematico', titulo: 'Jogo problemático', descricao: 'Suas respostas indicam um padrão compatível com vício em apostas (transtorno do jogo). Isso é uma condição de saúde, tem tratamento e muita gente se recupera. Procure apoio profissional o quanto antes.' };
    }

    const alertas = [];
    if (r.faixaEtaria === 'menor') {
      alertas.push('Apostar é proibido para menores de 18 anos no Brasil. Converse com um adulto de confiança — você não vai ser julgado(a) por pedir ajuda.');
    }
    if (r.dividas === 'grandes') {
      alertas.push('Dívidas grandes aumentam muito o risco de tentar "recuperar" o prejuízo apostando. Essa é a armadilha mais comum: ela só aumenta o buraco.');
    }
    if (dia.includes('recuperar_perdas')) {
      alertas.push('Apostar para recuperar perdas ("chasing") é um dos sinais mais fortes de vício. Aceite a perda como custo do aprendizado e pare aqui.');
    }
    if (r.frequencia === 'varias_dia') {
      alertas.push('Apostar várias vezes ao dia indica que o jogo virou hábito automático. Bloquear o acesso (apps e sites) é o primeiro passo prático.');
    }

    const recs = [rec('Bloqueie o acesso hoje',
      'Use a autoexclusão nas casas de apostas em que tem conta (é obrigatória nos sites autorizados, com final .bet.br), desinstale os apps e instale um bloqueador gratuito como o BetBlocker no celular e no computador.')];
    if (r.dividas !== 'nao') {
      recs.push(rec('Organize as dívidas sem apostar',
        'Liste tudo o que deve, priorize contas essenciais e procure renegociar diretamente com bancos ou pelo Procon da sua cidade. Peça a alguém de confiança para ajudar a controlar seu dinheiro por um tempo.'));
    }
    if (tipos.includes('cassino') || tipos.includes('crash')) {
      recs.push(rec('Entenda por que o cassino online sempre ganha',
        'Slots (como o "tigrinho") e jogos crash (como o Aviator) são programados com retorno matemático menor que 100%. Cada rodada leva uma parte do seu dinheiro — no longo prazo, perder é garantido. Veja o simulador nesta página.'));
    }
    if (tipos.includes('esportiva')) {
      recs.push(rec('Assista ao jogo sem apostar',
        'As casas embutem uma margem em todas as odds. Tente reaprender a curtir o futebol pelo esporte: escolha um time para torcer, chame amigos, mas deixe o celular longe na hora do jogo.'));
    }
    if (r.origem === 'influenciador' || r.origem === 'propaganda') {
      recs.push(rec('Desconfie de quem lucra com sua perda',
        'Muitos influenciadores recebem uma porcentagem do que os seguidores perdem. Deixe de seguir perfis que divulgam apostas e silencie anúncios de bets nas redes sociais.'));
    }
    if (r.escondeFamilia === 'sim' || r.escondeFamilia === 'as_vezes' || dia.includes('mente')) {
      recs.push(rec('Conte para alguém de confiança',
        'O segredo alimenta o vício. Escolha uma pessoa (familiar, amigo, colega) e conte a verdade. A seção "Para a família" pode ajudar essa conversa.'));
    }
    if (dia.includes('ansiedade') || dia.includes('perde_sono') || dia.includes('isolamento')) {
      recs.push(rec('Cuide da sua saúde mental',
        'Ansiedade, insônia e isolamento andam junto com o vício. O CAPS (Centro de Atenção Psicossocial) do SUS atende de graça. Se estiver em sofrimento intenso, ligue 188 (CVV), 24h.'));
    }
    if (score >= 3) {
      recs.push(rec('Procure tratamento',
        'Psicólogos e psiquiatras tratam o transtorno do jogo. Grupos como os Jogadores Anônimos (JA) oferecem reuniões gratuitas, presenciais e online.'));
    }
    if (dia.includes('deixou_lazer') || dia.includes('aposta_trabalho') || r.origem === 'tedio') {
      recs.push(rec('Preencha o tempo livre',
        'O vício ocupa um espaço. Planeje atividades para os horários em que costumava apostar: exercício, um curso, um hobby, os jogos desta página.'));
    }
    recs.push(rec('Comece seu contador de dias',
      'Na seção "Minha jornada" você marca quantos dias está sem apostar e vê quanto dinheiro está economizando. Cada dia conta.'));

    const mensagem = {
      sim: 'Você deu o passo mais difícil: admitir que quer ajuda. Siga o plano abaixo, um passo de cada vez.',
      talvez: 'É normal ter dúvidas. Que tal tentar só uma semana sem apostar e ver como se sente? O plano abaixo é um bom começo.',
    }[r.querAjuda] || 'Tudo bem não estar pronto(a) agora. Guarde esta página: quando quiser, ela estará aqui. Pense em como seria sua vida daqui a um ano sem apostas.';

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
    registros.push({ ...r, score: resultado.score, nivel: resultado.nivel.codigo, data: new Date().toISOString() });
    Util.salvar('local-avaliacoes', registros);
    return resultado;
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
  const TIPOS_MURAL = ['superacao', 'apoio', 'familia'];

  function muralLido() {
    let lista = Util.ler('local-mural', null);
    if (!lista) {
      const agora = new Date().toISOString();
      lista = [
        ['apoio', 'Se você chegou até aqui, já deu um passo importante. Recaídas podem acontecer — elas não apagam o caminho que você já percorreu.'],
        ['familia', 'Familiares: o vício não é falta de caráter. Proteja as finanças da casa, mas não feche a porta do diálogo.'],
        ['superacao', 'Deixe aqui sua mensagem anônima. Contar quantos dias você está sem apostar inspira quem está começando agora.'],
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

  // ------------------------------------------------------------ rotas

  const ROTAS = {
    'GET dados': dados,
    'GET quiz': quiz,
    'GET motivacao': motivacao,
    'GET estatisticas': estatisticas,
    'POST avaliacao': avaliar,
    'GET depoimentos': () => recentes(30),
    'POST depoimentos': criarDepoimento,
  };

  return {
    async chamar(metodo, rota, corpo) {
      const fn = ROTAS[`${metodo} ${rota}`];
      if (!fn) throw new Error('Rota não encontrada');
      // Clona para que quem chama não altere os dados internos.
      return JSON.parse(JSON.stringify(fn(corpo)));
    },
  };
})();
