/* Questionário em etapas, envio para o backend Java e exibição do plano personalizado. */
(() => {
  const PGSI = [
    'Você apostou mais do que podia perder?',
    'Precisou apostar valores maiores para sentir a mesma emoção?',
    'Voltou outro dia para tentar recuperar o dinheiro perdido?',
    'Pegou dinheiro emprestado ou vendeu algo para conseguir apostar?',
    'Sentiu que pode ter um problema com apostas?',
    'As apostas causaram problemas de saúde, como estresse ou ansiedade?',
    'Outras pessoas criticaram suas apostas ou disseram que você tem um problema?',
    'As apostas causaram problemas financeiros para você ou sua casa?',
    'Você se sentiu culpado(a) pela forma como aposta ou pelo que acontece quando aposta?',
  ];
  const RESPOSTAS = ['Nunca', 'Às vezes', 'Na maioria das vezes', 'Quase sempre'];
  const OBRIGATORIOS = {
    1: ['faixaEtaria'], 2: ['origem'], 3: ['tempo', 'frequencia'], 4: ['tipos'],
    5: [], 6: ['dividas', 'escondeFamilia'], 7: [], 8: ['arrependimento', 'querAjuda'],
  };
  const TOTAL = 8;

  const form = document.getElementById('formQuest');
  const etapas = [...form.querySelectorAll('.etapa')];
  const barra = document.getElementById('questBarra');
  const passoTxt = document.getElementById('questPasso');
  const erro = document.getElementById('questErro');
  const btnVoltar = document.getElementById('btnVoltar');
  const btnAvancar = document.getElementById('btnAvancar');
  const resultadoEl = document.getElementById('resultado');
  let atual = 1;

  // PGSI
  document.getElementById('pgsi').innerHTML = PGSI.map((p, i) => `
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

  // Gasto mensal: slider e campo exato sincronizados
  const range = document.getElementById('gastoRange');
  const exato = document.getElementById('gastoMensal');
  const out = document.getElementById('gastoOut');
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
        erro.textContent = `Faltam ${faltam.length} pergunta(s).`;
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
    if (rolar) document.getElementById('quest').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  btnVoltar.addEventListener('click', () => { erro.textContent = ''; if (atual > 1) irPara(atual - 1); });
  btnAvancar.addEventListener('click', async () => {
    if (!validar(atual)) return;
    if (atual < TOTAL) return irPara(atual + 1);
    await enviar();
  });

  // Avança automaticamente nas etapas de uma única escolha
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
    const relato = document.getElementById('relato').value.trim();
    if (relato) Util.salvar('relato', relato);

    btnAvancar.disabled = true;
    btnAvancar.textContent = 'Analisando…';
    try {
      const r = await Api.post('avaliacao', dados);
      Util.salvar('ultima-avaliacao', { ...r, data: new Date().toISOString() });
      mostrarResultado(r);
      window.carregarStats?.();
    } catch (e) {
      erro.textContent = `Não foi possível enviar: ${e.message}`;
    } finally {
      btnAvancar.disabled = false;
      btnAvancar.textContent = 'Ver meu resultado ✓';
    }
  }

  const CORES_NIVEL = { sem_risco: '--ok', baixo: '--ok', moderado: '--sol', problematico: '--perigo' };

  function mostrarResultado(r) {
    form.hidden = true;
    document.querySelector('.quest__progresso').hidden = true;
    passoTxt.hidden = true;
    resultadoEl.hidden = false;

    const arco = 251.3; // comprimento do semicírculo (raio 80)
    const anual = r.prejuizoAnual;
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
          <p>${Util.escapar(r.nivel.descricao)}</p>
        </div>
      </div>
      <p class="resultado__msg">${Util.escapar(r.mensagem)}</p>
      ${r.alertas.length ? `<ul class="alertas">${r.alertas.map(a => `<li>${Util.escapar(a)}</li>`).join('')}</ul>` : ''}
      ${anual > 0 ? `
      <h4>O custo das apostas na sua vida</h4>
      <div class="prejuizo">
        <div class="tile destaque-perda"><strong>${Util.moeda(anual)}</strong><span>por ano em apostas</span></div>
        <div class="tile"><strong>${Util.numero(anual / 800)}</strong><span>cestas básicas (≈ R$ 800 cada)</span></div>
        <div class="tile"><strong>${Util.moeda(anual * 5)}</strong><span>em 5 anos, se nada mudar</span></div>
      </div>` : ''}
      <h4>Seu plano de recomeço</h4>
      <ol class="plano">
        ${r.recomendacoes.map(x => `<li><div><h4>${Util.escapar(x.titulo)}</h4><p>${Util.escapar(x.texto)}</p></div></li>`).join('')}
      </ol>
      <div class="resultado__acoes">
        <a href="#jornada" class="btn btn--primario" id="btnIrJornada">Começar minha jornada</a>
        <a href="#ajuda" class="btn btn--secundario">Ver onde buscar ajuda</a>
        <button class="btn btn--fantasma" id="btnRefazer">Refazer avaliação</button>
      </div>
      <p class="painel__sub" style="margin-top:16px">Esta avaliação é uma orientação e não substitui o diagnóstico de um profissional de saúde.</p>`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('medidorValor').style.strokeDashoffset = arco * (1 - r.score / r.scoreMaximo);
    }));
    document.getElementById('btnRefazer').addEventListener('click', refazer);
    document.getElementById('btnIrJornada').addEventListener('click', () => {
      window.definirGastoJornada?.(r.prejuizoMensal);
    });
    document.getElementById('quest').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function refazer() {
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

  irPara(1, false);
})();
