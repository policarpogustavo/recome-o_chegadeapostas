/* Seção "Entenda" e "Dados": conteúdo da API, gráficos de barras, estatísticas e simulador. */
(() => {
  // ---------- Gráfico de barras horizontal (série única) ----------
  function renderBarras(container, itens, { max, formatar = v => Util.numero(v) } = {}) {
    if (!itens.length) {
      container.innerHTML = '<p class="vazio">Ainda não há dados suficientes.</p>';
      return;
    }
    const topo = max ?? Math.max(...itens.map(i => i.valor), 1);
    container.innerHTML = itens.map(i => `
      <div class="barra">
        <span class="barra__rot">${Util.escapar(i.rotulo)}</span>
        <div class="barra__trilho" tabindex="0" data-nota="${Util.escapar(i.nota || '')}" aria-label="${Util.escapar(i.rotulo)}: ${formatar(i.valor)}">
          <span class="barra__fill" style="width:${Math.max(0.5, (i.valor / topo) * 82)}%"></span>
          <span class="barra__val">${formatar(i.valor)}</span>
        </div>
      </div>`).join('');

    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.hidden = true;
    container.style.position = 'relative';
    container.appendChild(tip);
    container.querySelectorAll('.barra__trilho').forEach(t => {
      const mostrar = () => {
        if (!t.dataset.nota) return;
        tip.textContent = t.dataset.nota;
        tip.style.whiteSpace = 'normal';
        tip.style.maxWidth = '260px';
        const r = t.getBoundingClientRect(), c = container.getBoundingClientRect();
        tip.style.left = `${r.left - c.left + Math.min(r.width / 2, 160)}px`;
        tip.style.top = `${r.top - c.top}px`;
        tip.hidden = false;
      };
      t.addEventListener('mouseenter', mostrar);
      t.addEventListener('focus', mostrar);
      t.addEventListener('mouseleave', () => { tip.hidden = true; });
      t.addEventListener('blur', () => { tip.hidden = true; });
    });

    const obs = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { container.classList.add('animar'); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(container);
  }
  window.renderBarras = renderBarras;

  // ---------- Conteúdo educativo ----------
  async function carregarDados() {
    let d;
    try { d = await Api.get('dados'); } catch {
      document.getElementById('destaques').innerHTML = '<p class="vazio">Não foi possível carregar os dados. O servidor está rodando?</p>';
      return;
    }

    document.getElementById('ciclo').innerHTML = d.ciclo.map(p => `
      <div class="ciclo__passo"><h4>${Util.escapar(p.titulo)}</h4><p>${Util.escapar(p.texto)}</p></div>`).join('')
      + '<p class="ciclo__volta">↺ E tudo recomeça — cada volta deixa o vício mais forte.</p>';

    const dest = document.getElementById('destaques');
    dest.innerHTML = d.destaques.map(x => `
      <article class="destaque revelar">
        <span class="destaque__valor">${Util.escapar(x.valor)}</span>
        <span class="destaque__unidade">${Util.escapar(x.unidade)}</span>
        <p>${Util.escapar(x.texto)}</p>
        <cite>${Util.escapar(x.fonte)}</cite>
      </article>`).join('');
    dest.querySelectorAll('.revelar').forEach(observarRevelar);

    renderBarras(document.getElementById('barrasCasa'),
      d.retornoMedio
        .map(b => ({ rotulo: b.rotulo, valor: +(100 - b.valor).toFixed(1), nota: b.nota }))
        .sort((a, b) => b.valor - a.valor),
      { max: 60, formatar: v => Util.moeda(v, v % 1 ? 2 : 0) });

    renderBarras(document.getElementById('barrasRisco'), d.riscoPorGrupo,
      { max: 100, formatar: v => `${Util.numero(v, 1)}%` });

    renderBarras(document.getElementById('barrasCusto'), d.custoSocial,
      { max: 20, formatar: v => `R$ ${Util.numero(v, v % 1 ? 1 : 0)} bi` });

    document.getElementById('danos').innerHTML = d.danos.map(x => `<li>${Util.escapar(x)}</li>`).join('');

    const sinais = document.getElementById('sinais');
    sinais.innerHTML = d.sinais.map(s => `<li role="checkbox" aria-checked="false" tabindex="0">${Util.escapar(s)}</li>`).join('');
    const res = document.createElement('p');
    res.className = 'checklist__res';
    res.setAttribute('aria-live', 'polite');
    sinais.after(res);
    const alternar = li => {
      li.classList.toggle('marcado');
      li.setAttribute('aria-checked', li.classList.contains('marcado'));
      const n = sinais.querySelectorAll('.marcado').length;
      res.textContent = n === 0 ? '' : n === 1
        ? '1 sinal marcado. Fique atento(a).'
        : `${n} sinais marcados. Considere fazer a avaliação abaixo e procurar apoio.`;
      res.style.color = n >= 2 ? 'var(--perigo)' : 'var(--texto-2)';
    };
    sinais.addEventListener('click', e => { if (e.target.tagName === 'LI') alternar(e.target); });
    sinais.addEventListener('keydown', e => {
      if ((e.key === ' ' || e.key === 'Enter') && e.target.tagName === 'LI') { e.preventDefault(); alternar(e.target); }
    });

    document.getElementById('legislacao').innerHTML = d.legislacao.map(l => `<li>${Util.escapar(l)}</li>`).join('');
  }

  // ---------- Estatísticas da comunidade ----------
  const ROTULOS = {
    tipos: { esportiva: 'Esportivas', cassino: 'Cassino / slots', crash: 'Jogos crash', poquer: 'Pôquer', loteria: 'Loterias' },
    origem: { amigos: 'Amigos', propaganda: 'Propaganda', influenciador: 'Influenciador', dinheiro_rapido: 'Dinheiro rápido', futebol: 'Futebol', tedio: 'Tédio', familia: 'Família', outro: 'Outro' },
    dia: { acorda_pensando: 'Acorda pensando', aposta_trabalho: 'Aposta no trabalho', perde_sono: 'Perde o sono', ansiedade: 'Ansiedade/culpa', mente: 'Mente', isolamento: 'Isolamento', pede_emprestado: 'Pede emprestado', recuperar_perdas: 'Tenta recuperar', irritado_sem_jogar: 'Irritação', deixou_lazer: 'Largou o lazer' },
  };
  window.ROTULOS = ROTULOS;

  function paraBarras(mapa, rotulos, total, limite = 6) {
    return Object.entries(mapa)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ rotulo: rotulos[k] || k, valor: total ? (100 * v) / total : 0, nota: `${v} pessoa(s)` }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, limite);
  }

  async function carregarStats() {
    let s;
    try { s = await Api.get('estatisticas'); } catch { return; }
    if (Api.semServidor) {
      document.getElementById('statsTitulo').textContent = 'Suas avaliações';
      document.getElementById('statsSub').textContent = 'Nesta versão online, os resultados ficam só no seu aparelho — ninguém mais vê.';
    }
    const graficos = document.querySelector('.stats-graficos');
    if (!s.total) {
      document.getElementById('statsTiles').innerHTML =
        '<p class="stats-vazio">Ainda não há avaliações por aqui. <a href="#avaliacao">Faça a sua avaliação</a> — leva 3 minutos e o resultado aparece neste painel.</p>';
      graficos.style.display = 'none';
      return;
    }
    graficos.style.display = '';
    const tiles = [
      [Util.numero(s.total), 'avaliações feitas'],
      [`${Util.numero(s.percentQueremAjuda)}%`, 'querem ajuda para parar'],
      [`${Util.numero(s.percentComDividas)}%`, 'têm dívidas com apostas'],
      [Util.moeda(s.mediaGastoMensal), 'gasto médio por mês'],
    ];
    document.getElementById('statsTiles').innerHTML = tiles
      .map(([v, t]) => `<div class="tile"><strong>${v}</strong><span>${t}</span></div>`).join('');
    const pct = v => `${Util.numero(v)}%`;
    renderBarras(document.getElementById('statsTipo'), paraBarras(s.porTipo, ROTULOS.tipos, s.total), { max: 100, formatar: pct });
    renderBarras(document.getElementById('statsOrigem'), paraBarras(s.porOrigem, ROTULOS.origem, s.total), { max: 100, formatar: pct });
    renderBarras(document.getElementById('statsDia'), paraBarras(s.porDiaADia, ROTULOS.dia, s.total), { max: 100, formatar: pct });
  }
  window.carregarStats = carregarStats;
  document.getElementById('btnAtualizarStats').addEventListener('click', () => { carregarStats(); Util.toast('Estatísticas atualizadas'); });

  // ---------- Simulador "a casa sempre ganha" ----------
  // Tabela de prêmios no estilo slot: probabilidade e multiplicador. EV base = 1,01.
  const TABELA = [
    { p: 0.25, m: 1.2 }, { p: 0.10, m: 2 }, { p: 0.04, m: 5 }, { p: 0.008, m: 20 }, { p: 0.0015, m: 100 },
  ];
  const EV_BASE = TABELA.reduce((s, t) => s + t.p * t.m, 0);

  function rodada(aposta, rtp) {
    let r = Math.random();
    for (const t of TABELA) {
      if (r < t.p) return aposta * t.m * (rtp / EV_BASE);
      r -= t.p;
    }
    return 0;
  }

  function simular(saldo, aposta, rtp, rodadas) {
    const hist = [saldo];
    for (let i = 0; i < rodadas && saldo >= aposta; i++) {
      saldo += rodada(aposta, rtp) - aposta;
      hist.push(saldo);
    }
    return hist;
  }

  const canvas = document.getElementById('canvasSim');
  const tip = document.getElementById('tooltipSim');
  let estado = null;

  function lerForm() {
    const n = (id, min, max) => Math.min(max, Math.max(min, Number(document.getElementById(id).value) || min));
    return {
      saldo: n('simSaldo', 10, 100000),
      aposta: n('simAposta', 1, 1000),
      rtp: n('simRtp', 85, 99) / 100,
      rodadas: n('simRodadas', 50, 5000),
    };
  }

  function desenhar() {
    if (!estado) return;
    const dpr = devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 64, r: 16, t: 34, b: 30 };
    const { linhas, cfg, esperado } = estado;
    const maxX = cfg.rodadas;
    const maxY = Math.max(cfg.saldo * 1.15, ...linhas.flat());
    const x = i => pad.l + (i / maxX) * (w - pad.l - pad.r);
    const y = v => pad.t + (1 - v / maxY) * (h - pad.t - pad.b);

    const corTexto = Util.css('--texto-3'), corGrade = Util.css('--borda');
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = corTexto;
    ctx.strokeStyle = corGrade;
    ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = (maxY / 4) * k;
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(w - pad.r, y(v)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(Util.moeda(v), pad.l - 8, y(v));
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let k = 0; k <= 4; k++) ctx.fillText(Util.numero((maxX / 4) * k), x((maxX / 4) * k), h - pad.b + 8);

    // Linha do saldo inicial
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = corTexto;
    ctx.beginPath(); ctx.moveTo(pad.l, y(cfg.saldo)); ctx.lineTo(w - pad.r, y(cfg.saldo)); ctx.stroke();
    ctx.setLineDash([]);

    const corLinha = Util.css('--primaria');
    const varias = linhas.length > 1;
    ctx.lineJoin = 'round';
    linhas.forEach(l => {
      ctx.strokeStyle = corLinha;
      ctx.globalAlpha = varias ? 0.22 : 1;
      ctx.lineWidth = varias ? 1.2 : 2;
      ctx.beginPath();
      l.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Linha da perda esperada
    const corEsp = Util.css('--perigo');
    ctx.strokeStyle = corEsp;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(x(0), y(cfg.saldo)); ctx.lineTo(x(esperado.ate), y(esperado.valor)); ctx.stroke();
    ctx.setLineDash([]);

    // Legenda
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const legenda = [[corLinha, varias ? 'Saldo de 30 jogadores (amostra)' : 'Seu saldo', false], [corEsp, 'Perda esperada pela matemática', true]];
    let lx = pad.l;
    legenda.forEach(([cor, txt, tracejada]) => {
      ctx.strokeStyle = cor; ctx.lineWidth = 2;
      ctx.setLineDash(tracejada ? [6, 4] : []);
      ctx.beginPath(); ctx.moveTo(lx, 14); ctx.lineTo(lx + 22, 14); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = Util.css('--texto-2');
      ctx.fillText(txt, lx + 28, 14);
      lx += 28 + ctx.measureText(txt).width + 22;
    });

    estado.escala = { x, y, pad, w, maxX };
    if (estado.hover != null && !varias) {
      const i = estado.hover, v = linhas[0][i];
      ctx.strokeStyle = corTexto; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(i), pad.t); ctx.lineTo(x(i), h - pad.b); ctx.stroke();
      ctx.fillStyle = corLinha;
      ctx.strokeStyle = Util.css('--superficie-2'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x(i), y(v), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  canvas.addEventListener('mousemove', e => {
    if (!estado?.escala || estado.linhas.length > 1) return;
    const { pad, w, maxX } = estado.escala;
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const l = estado.linhas[0];
    const i = Math.round(((px - pad.l) / (w - pad.l - pad.r)) * maxX);
    if (i < 0 || i >= l.length) { tip.hidden = true; estado.hover = null; desenhar(); return; }
    estado.hover = i;
    desenhar();
    tip.innerHTML = `Rodada ${Util.numero(i)}<br><strong>${Util.moeda(l[i], 2)}</strong>`;
    tip.style.left = `${estado.escala.x(i)}px`;
    tip.style.top = `${estado.escala.y(l[i])}px`;
    tip.hidden = false;
  });
  canvas.addEventListener('mouseleave', () => { tip.hidden = true; if (estado) { estado.hover = null; desenhar(); } });

  function esperadoDe(cfg, ate) {
    return { ate, valor: Math.max(0, cfg.saldo - cfg.aposta * (1 - cfg.rtp) * ate) };
  }

  document.getElementById('simRtp').addEventListener('input', e => {
    document.getElementById('simRtpOut').textContent = `${e.target.value}%`;
  });

  const resultado = document.getElementById('simResultado');
  document.getElementById('formSimulador').addEventListener('submit', e => {
    e.preventDefault();
    const cfg = lerForm();
    const hist = simular(cfg.saldo, cfg.aposta, cfg.rtp, cfg.rodadas);
    estado = { cfg, linhas: [hist], esperado: esperadoDe(cfg, cfg.rodadas) };
    desenhar();
    const final = hist[hist.length - 1];
    const dif = final - cfg.saldo;
    const apostado = (hist.length - 1) * cfg.aposta;
    resultado.innerHTML = dif >= 0
      ? `Depois de <strong>${Util.numero(hist.length - 1)}</strong> rodadas você terminou com <strong>${Util.moeda(final, 2)}</strong> (+${Util.moeda(dif, 2)}). Sorte rara — simule de novo ou com 1.000 jogadores e veja o que acontece com a maioria.`
      : `Depois de <strong>${Util.numero(hist.length - 1)}</strong> rodadas (${Util.moeda(apostado)} apostados no total), sobraram <strong>${Util.moeda(final, 2)}</strong>. Prejuízo: <strong class="perda">${Util.moeda(-dif, 2)}</strong>.${final < cfg.aposta ? ' <strong class="perda">O saldo acabou.</strong>' : ''}`;
  });

  document.getElementById('simMuitos').addEventListener('click', () => {
    const cfg = lerForm();
    const linhas = [];
    let lucro = 0, quebrou = 0, soma = 0;
    for (let k = 0; k < 1000; k++) {
      const h = simular(cfg.saldo, cfg.aposta, cfg.rtp, cfg.rodadas);
      const f = h[h.length - 1];
      if (k < 30) linhas.push(h);
      if (f > cfg.saldo) lucro++;
      if (f < cfg.aposta) quebrou++;
      soma += f;
    }
    estado = { cfg, linhas, esperado: esperadoDe(cfg, cfg.rodadas) };
    desenhar();
    const media = soma / 1000;
    resultado.innerHTML = `De 1.000 jogadores, só <strong>${Util.numero(lucro / 10, 1)}%</strong> terminaram no lucro. <strong class="perda">${Util.numero(quebrou / 10, 1)}%</strong> perderam tudo. Em média, cada um terminou com <strong>${Util.moeda(media, 2)}</strong> — perda de <strong class="perda">${Util.moeda(cfg.saldo - media, 2)}</strong>. Quem ganha sempre é a casa.`;
  });

  addEventListener('resize', desenhar);
  addEventListener('tema', desenhar);

  carregarDados();
  carregarStats();
  // primeira simulação automática quando o simulador aparecer
  const obsSim = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { document.getElementById('simMuitos').click(); obsSim.disconnect(); }
  }, { threshold: 0.3 });
  obsSim.observe(canvas);
})();
