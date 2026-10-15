/*
 * Questionário em etapas, envio para o backend Java e exibição do plano personalizado.
 * Na primeira visita, a avaliação abre numa janela antes de todo o resto. Ela fica
 * guardada na conta (se a pessoa entrar) e pelo IP, para não ser pedida de novo.
 */
(() => {
  const PGSI = [
    'Você apostou mais do que podia perder?',
    'Precisou apostar valores maiores para sentir a mesma emoção?',
    'Voltou outro dia para tentar recuperar o dinheiro perdido?',
    'Pegou dinheiro emprestado ou vendeu algo para conseguir apostar?',
    'Sentiu que pode ter um problema com apostas?',
    'As apostas causaram problemas de saúde, como estresse ou ansiedade?',
    'Outras pessoas criticaram as suas apostas ou disseram que você tem um problema?',
    'As apostas causaram problemas financeiros para você ou para a sua casa?',
    'Você se sentiu culpado(a) pela forma como aposta ou pelo que acontece quando aposta?',
  ];
  const RESPOSTAS = ['Nunca', 'Às vezes', 'Na maioria das vezes', 'Quase sempre'];
  const OBRIGATORIOS = {
    1: ['faixaEtaria'], 2: ['origem'], 3: ['tempo', 'frequencia'], 4: ['tipos'],
    5: [], 6: ['dividas', 'escondeFamilia'], 7: [], 8: ['arrependimento', 'querAjuda'],
  };
  const TOTAL = 8;
  const ADIADA = 'recomeco-avaliacao-adiada';
  const NOMES_NIVEL = { sem_risco: 'Sem sinais', baixo: 'Risco baixo', moderado: 'Risco moderado', problematico: 'Jogo problemático' };

  const $ = id => document.getElementById(id);
  const form = $('formQuest');
  const etapas = [...form.querySelectorAll('.etapa')];
  const barra = $('questBarra');
  const passoTxt = $('questPasso');
  const erro = $('questErro');
  const btnVoltar = $('btnVoltar');
  const btnAvancar = $('btnAvancar');
  const resultadoEl = $('resultado');
  const quest = $('quest');
  const modal = $('modalAvaliacao');
  let atual = 1;
  let noModal = false;
  let temResultado = false;
  let fecharEmSilencio = false;

  // O questionário é um só: vai para a janela e volta para a seção, mantendo as respostas.
  const marcador = document.createComment('lugar do questionário');
  quest.before(marcador);

  // PGSI
  $('pgsi').innerHTML = PGSI.map((p, i) => `
    <div class="pgsi__item" data-pgsi="${i}">
      <p>${i + 1}. ${p}</p>
      <div class="pgsi__ops">
        ${RESPOSTAS.map((r, v) => `<label class="opcao"><input type="radio" name="pgsi${i}" value="${v}"><span>${r}</span></label>`).join('')}
      </div>
    </div>`).join('');
  form.addEventListener('change', e => {
    const item = e.target.closest('.pgsi__item');
    if (item) item.classList.remove('faltando');
    erro.textContent = '';
  });

  // Gasto mensal: controle deslizante e campo exato sincronizados
  const range = $('gastoRange');
  const exato = $('gastoMensal');
  const out = $('gastoOut');
  const mostrarGasto = v => { out.textContent = Util.numero(v); };
  range.addEventListener('input', () => { exato.value = range.value; mostrarGasto(range.value); });
  exato.addEventListener('input', () => {
    const v = Math.max(0, Number(exato.value) || 0);
    range.value = Math.min(10000, v);
    mostrarGasto(v);
  });

  function valor(nome) {
    const marcados = [...form.querySelectorAll(`[name="${nome}"]:checked`)].map(i => i.value);
    const tipo = form.querySelector(`[name="${nome}"]`)?.type;
    return tipo === 'checkbox' ? marcados : marcados[0];
  }

  function rolarAte(el) {
    el.scrollIntoView({ behavior: Util.movimentoReduzido() ? 'auto' : 'smooth', block: noModal ? 'nearest' : 'start' });
  }

  function validar(n) {
    for (const campo of OBRIGATORIOS[n]) {
      const v = valor(campo);
      if (!v || (Array.isArray(v) && !v.length)) {
        erro.textContent = 'Escolha uma opção para continuar.';
        return false;
      }
    }
    if (n === 4) {
      const g = Number(exato.value);
      if (!Number.isFinite(g) || g < 0) { erro.textContent = 'Informe um valor de gasto válido.'; return false; }
    }
    if (n === 7) {
      const faltam = PGSI.map((_, i) => i).filter(i => valor(`pgsi${i}`) === undefined);
      faltam.forEach(i => form.querySelector(`[data-pgsi="${i}"]`).classList.add('faltando'));
      if (faltam.length) {
        erro.textContent = faltam.length === 1 ? 'Falta responder 1 pergunta.' : `Faltam ${faltam.length} perguntas.`;
        form.querySelector(`[data-pgsi="${faltam[0]}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
    }
    erro.textContent = '';
    return true;
  }

  function irPara(n, rolar = true) {
    atual = n;
    etapas.forEach(e => e.classList.toggle('ativa', Number(e.dataset.etapa) === n));
    barra.style.width = `${(n / TOTAL) * 100}%`;
    passoTxt.textContent = `Etapa ${n} de ${TOTAL}`;
    btnVoltar.disabled = n === 1;
    btnAvancar.textContent = n === TOTAL ? 'Ver meu resultado ✓' : 'Avançar →';
    if (rolar) rolarAte(quest);
  }

  btnVoltar.addEventListener('click', () => { erro.textContent = ''; if (atual > 1) irPara(atual - 1); });
  btnAvancar.addEventListener('click', async () => {
    if (!validar(atual)) return;
    if (atual < TOTAL) return irPara(atual + 1);
    await enviar();
  });

  // Avança sozinho nas etapas de uma única escolha
  form.addEventListener('change', e => {
    if (e.target.type !== 'radio' || ![1, 2].includes(atual)) return;
    setTimeout(() => { if (validar(atual)) irPara(atual + 1); }, 280);
  });

  async function enviar() {
    const dados = {
      faixaEtaria: valor('faixaEtaria'),
      origem: valor('origem'),
      tempo: valor('tempo'),
      frequencia: valor('frequencia'),
      tipos: valor('tipos'),
      gastoMensal: Math.max(0, Number(exato.value) || 0),
      diaADia: valor('diaADia'),
      dividas: valor('dividas'),
      escondeFamilia: valor('escondeFamilia'),
      pgsi: PGSI.map((_, i) => Number(valor(`pgsi${i}`))),
      arrependimento: Number(valor('arrependimento')),
      querAjuda: valor('querAjuda'),
    };
    const relato = $('relato').value.trim();
    if (relato) Util.salvar('relato', relato);

    btnAvancar.disabled = true;
    btnAvancar.textContent = 'Analisando…';
    try {
      const r = await Api.post('avaliacao', dados);
      Util.salvar('ultima-avaliacao', r);
      let historico = null;
      if (Conta.estado.logado) historico = (await Api.get('avaliacao/minha').catch(() => ({}))).historico;
      mostrarResultado(r, { historico });
      window.carregarStats?.();
    } catch (e) {
      erro.textContent = `Não foi possível enviar: ${e.message}`;
    } finally {
      btnAvancar.disabled = false;
      btnAvancar.textContent = 'Ver meu resultado ✓';
    }
  }

  const CORES_NIVEL = { sem_risco: '--ok', baixo: '--ok', moderado: '--sol', problematico: '--perigo' };

  function dataCurta(iso) {
    return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  }

  function blocoEvolucao(historico) {
    if (!historico || historico.length < 2) return '';
    const primeira = historico[0], ultima = historico[historico.length - 1];
    const dif = ultima.score - primeira.score;
    const resumo = dif < 0
      ? `Sua pontuação caiu ${-dif} ponto(s) desde a primeira avaliação. Isso é progresso de verdade! 💚`
      : dif > 0
        ? `Sua pontuação subiu ${dif} ponto(s) desde a primeira avaliação. Não desanime: este é um bom momento para buscar apoio.`
        : 'Sua pontuação está igual à da primeira avaliação. Continue firme no seu plano.';
    const max = 27;
    return `
      <h4>Sua evolução</h4>
      <div class="evolucao">
        ${historico.slice(-6).map(h => `
          <div class="evolucao__item" title="${Util.escapar(NOMES_NIVEL[h.nivel] || '')}">
            <span class="evolucao__barra"><span style="height:${Math.max(6, (h.score / max) * 100)}%" class="evolucao__fill evolucao__fill--${h.nivel}"></span></span>
            <strong>${h.score}</strong>
            <small>${new Date(h.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</small>
          </div>`).join('')}
      </div>
      <p class="evolucao__resumo">${resumo}</p>`;
  }

  function mostrarResultado(r, { rolar = true, historico = null } = {}) {
    temResultado = true;
    form.hidden = true;
    document.querySelector('.quest__progresso').hidden = true;
    passoTxt.hidden = true;
    resultadoEl.hidden = false;

    const arco = 251.3; // comprimento do semicírculo (raio 80)
    const anual = r.prejuizoAnual;
    const podeCriarConta = !Conta.estado.logado && Conta.estado.disponivel;
    resultadoEl.innerHTML = `
      <div class="resultado__topo">
        <div class="medidor" aria-label="Pontuação ${r.score} de ${r.scoreMaximo}">
          <svg viewBox="0 0 200 115" aria-hidden="true">
            <path class="medidor__fundo" d="M20 100 A80 80 0 0 1 180 100"/>
            <path class="medidor__valor" id="medidorValor" d="M20 100 A80 80 0 0 1 180 100"
              stroke="var(${CORES_NIVEL[r.nivel.codigo]})" stroke-dasharray="${arco}" stroke-dashoffset="${arco}"/>
          </svg>
          <div class="medidor__num"><strong>${r.score}</strong><span>de ${r.scoreMaximo} pontos</span></div>
        </div>
        <div>
          <span class="nivel nivel--${r.nivel.codigo}">● ${Util.escapar(r.nivel.titulo)}</span>
          <h3>Seu resultado</h3>
          ${r.data ? `<p class="resultado__data">Avaliação feita em ${dataCurta(r.data)}</p>` : ''}
          <p>${Util.escapar(r.nivel.descricao)}</p>
        </div>
      </div>
      <p class="resultado__msg">${Util.escapar(r.mensagem)}</p>
      <div id="resComparacao"></div>
      ${r.alertas.length ? `<ul class="alertas">${r.alertas.map(a => `<li>${Util.escapar(a)}</li>`).join('')}</ul>` : ''}
      ${anual > 0 ? `
      <h4>O custo das apostas na sua vida</h4>
      <div class="prejuizo">
        <div class="tile destaque-perda"><strong>${Util.moeda(anual)}</strong><span>por ano em apostas</span></div>
        <div class="tile"><strong>${Util.numero(anual / 800)}</strong><span>cestas básicas (cerca de R$ 800 cada)</span></div>
        <div class="tile"><strong>${Util.moeda(anual * 5)}</strong><span>em 5 anos, se nada mudar</span></div>
      </div>` : ''}
      ${blocoEvolucao(historico)}
      <h4>Seu plano de recomeço</h4>
      <ol class="plano">
        ${r.recomendacoes.map(x => `<li><div><h4>${Util.escapar(x.titulo)}</h4><p>${Util.escapar(x.texto)}</p></div></li>`).join('')}
      </ol>
      ${podeCriarConta ? `
      <div class="resultado__conta">
        <p><strong>Guarde este resultado.</strong> Crie uma conta só com apelido e senha para ver a sua evolução nas próximas avaliações, de qualquer aparelho.</p>
        <button class="btn btn--secundario btn--peq" id="btnCriarConta">Criar conta grátis</button>
      </div>` : ''}
      <div class="resultado__acoes">
        <a href="#jornada" class="btn btn--primario" id="btnIrJornada">Começar minha jornada</a>
        <a href="#ajuda" class="btn btn--secundario">Ver onde buscar ajuda</a>
        <button class="btn btn--fantasma" id="btnRefazer">Refazer a avaliação</button>
      </div>
      <p class="painel__sub" style="margin-top:16px">Esta avaliação é uma orientação e não substitui o diagnóstico de um profissional de saúde.</p>`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      $('medidorValor').style.strokeDashoffset = arco * (1 - r.score / r.scoreMaximo);
    }));
    $('btnRefazer').addEventListener('click', refazer);
    $('btnIrJornada').addEventListener('click', () => window.definirGastoJornada?.(r.prejuizoMensal));
    $('btnCriarConta')?.addEventListener('click', () => {
      if (noModal) fecharSemAviso();
      Conta.abrir('cadastro');
    });
    carregarComparacao(r.score);
    if (noModal) modal.scrollTo({ top: 0, behavior: Util.movimentoReduzido() ? 'auto' : 'smooth' });
    else if (rolar) rolarAte(quest);
  }

  async function carregarComparacao(score) {
    try {
      const c = await Api.get(`analise/percentil?score=${encodeURIComponent(score)}`);
      if (!c.suficiente) return;
      const el = $('resComparacao');
      if (!el) return;
      el.innerHTML = `
        <div class="comparacao">
          <div class="comparacao__escala" aria-hidden="true">
            <span class="comparacao__marca" style="left:${Math.min(97, Math.max(3, c.percentil))}%"></span>
          </div>
          <p><strong>Comparação com a comunidade:</strong> sua pontuação é maior que a de ${c.percentil}% das ${Util.numero(c.total)} avaliações feitas aqui. ${Util.escapar(c.mensagem)}</p>
        </div>`;
    } catch { /* serviço de análise indisponível: segue sem a comparação */ }
  }

  function refazer() {
    temResultado = false;
    form.reset();
    exato.value = range.value = 300;
    mostrarGasto(300);
    form.querySelectorAll('.faltando').forEach(e => e.classList.remove('faltando'));
    resultadoEl.hidden = true;
    form.hidden = false;
    document.querySelector('.quest__progresso').hidden = false;
    passoTxt.hidden = false;
    irPara(1);
  }

  // ------------------------------------------------------------ janela da primeira visita

  function abrirJanela() {
    $('avIntro').hidden = false;
    $('avCorpo').hidden = true;
    $('avIntroConta').hidden = !Conta.estado.disponivel || Conta.estado.logado;
    if (!modal.open) modal.showModal();
  }

  function levarParaJanela() {
    $('avCorpo').appendChild(quest);
    quest.classList.add('visivel');
    noModal = true;
    $('avIntro').hidden = true;
    $('avCorpo').hidden = false;
    irPara(atual, false);
    modal.scrollTop = 0;
    quest.querySelector('.etapa.ativa input')?.focus({ preventScroll: true });
  }

  $('avComecar').addEventListener('click', levarParaJanela);
  $('avDepois').addEventListener('click', () => modal.close());
  $('avFechar').addEventListener('click', () => modal.close());
  const fecharSemAviso = () => { fecharEmSilencio = true; modal.close(); };
  $('avEntrar').addEventListener('click', () => { fecharSemAviso(); Conta.abrir('login'); });
  modal.querySelector('[data-abrir-sos]').addEventListener('click', fecharSemAviso);
  // Links do resultado (jornada, ajuda) fecham a janela e levam para a seção.
  resultadoEl.addEventListener('click', e => { if (noModal && e.target.closest('a[href^="#"]')) modal.close(); });

  modal.addEventListener('close', () => {
    if (noModal) {
      marcador.after(quest);
      noModal = false;
    }
    if (!temResultado) {
      try { sessionStorage.setItem(ADIADA, '1'); } catch { /* ignora */ }
      if (!fecharEmSilencio) Util.toast('Tudo bem. A avaliação continua disponível no menu, quando você quiser.');
    }
    fecharEmSilencio = false;
  });

  // ------------------------------------------------------------ verificação inicial

  async function verificar({ podeAbrir = true } = {}) {
    let info = { feita: false };
    try { info = await Api.get('avaliacao/minha'); } catch { /* sem servidor: usa o aparelho */ }

    if (info.resultado) {
      Util.salvar('ultima-avaliacao', info.resultado, { silencioso: true });
      mostrarResultado(info.resultado, { rolar: false, historico: info.historico });
      return;
    }
    const local = Util.ler('ultima-avaliacao', null);
    if (local?.nivel) {
      mostrarResultado(local, { rolar: false });
      return;
    }
    if (!podeAbrir || info.feita) return; // já respondida a partir desta rede
    let adiada = false;
    try { adiada = sessionStorage.getItem(ADIADA) === '1'; } catch { /* ignora */ }
    if (!adiada) abrirJanela();
  }

  irPara(1, false);
  Conta.pronto.then(inicial => {
    verificar();
    let logado = inicial.logado;
    addEventListener('conta', e => {
      if (e.detail.logado === logado) return;
      logado = e.detail.logado;
      if (logado) verificar({ podeAbrir: false });
    });
  });
})();
