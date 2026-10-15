/* Jogos e distrações: nenhum envolve dinheiro, sorte paga ou recompensa aleatória. */
(() => {
  const $ = id => document.getElementById(id);

  // =====================================================================
  // Abas
  // =====================================================================
  const abas = [...document.querySelectorAll('.abas[aria-label="Jogos"] [role="tab"]')];
  const pausas = {};
  const aoAbrir = {};

  function abrirAba(aba, focar = false) {
    abas.forEach(a => {
      a.setAttribute('aria-selected', a === aba);
      a.tabIndex = a === aba ? 0 : -1;
    });
    document.querySelectorAll('.jogo').forEach(j => { j.hidden = j.id !== `jogo-${aba.dataset.aba}`; });
    Object.entries(pausas).forEach(([nome, pausar]) => { if (nome !== aba.dataset.aba) pausar(); });
    aoAbrir[aba.dataset.aba]?.();
    if (focar) aba.focus();
  }
  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => abrirAba(aba));
    aba.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); abrirAba(abas[(i + d + abas.length) % abas.length], true); }
    });
    aba.tabIndex = aba.getAttribute('aria-selected') === 'true' ? 0 : -1;
  });

  // =====================================================================
  // Som e tempo longe das apostas
  // =====================================================================
  const btnSom = $('btnSom');
  function mostrarSom() {
    const ligado = Util.somLigado();
    btnSom.textContent = ligado ? '🔊' : '🔇';
    btnSom.setAttribute('aria-pressed', ligado);
    btnSom.setAttribute('aria-label', ligado ? 'Desligar os sons dos jogos' : 'Ligar os sons dos jogos');
  }
  btnSom.addEventListener('click', () => { Util.salvar('som', !Util.somLigado(), { silencioso: true }); mostrarSom(); Util.som('clique'); });
  mostrarSom();

  const META_FOCO = 15 * 60;
  const hojeTxt = () => new Date().toLocaleDateString('sv-SE');
  let foco = Util.ler('foco', { dia: hojeTxt(), seg: 0 });
  if (foco.dia !== hojeTxt()) foco = { dia: hojeTxt(), seg: 0 };
  let ultimaInteracao = 0;
  let secaoVisivel = false;
  new IntersectionObserver(([en]) => { secaoVisivel = en.isIntersecting; }, { threshold: 0.25 }).observe($('distrair'));
  ['pointerdown', 'keydown'].forEach(ev => $('distrair').addEventListener(ev, () => { ultimaInteracao = Date.now(); }));

  function mostrarFoco() {
    const min = Math.floor(foco.seg / 60);
    $('focoTempo').textContent = min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
    $('focoMeta').textContent = foco.seg >= META_FOCO ? 'Meta de hoje cumprida! 🎉' : `Meta: ${META_FOCO / 60} minutos`;
    $('focoMeta').classList.toggle('foco__meta--ok', foco.seg >= META_FOCO);
  }
  setInterval(() => {
    if (foco.dia !== hojeTxt()) foco = { dia: hojeTxt(), seg: 0 };
    if (document.hidden || !secaoVisivel || Date.now() - ultimaInteracao > 60_000) return;
    foco.seg += 5;
    if (foco.seg === META_FOCO) {
      Util.toast('Você completou 15 minutos longe das apostas hoje. A vontade costuma passar nesse tempo. Parabéns!');
      Util.confete();
      Util.som('vitoria');
    }
    Util.salvar('foco', foco, { silencioso: true });
    mostrarFoco();
  }, 5000);
  mostrarFoco();

  // =====================================================================
  // Jogo da memória
  // =====================================================================
  const EMOJIS = ['🌻', '🐢', '🎸', '⚽', '📚', '🚲', '🌈', '🍉', '🎨', '🧩', '🐶', '🌙'];
  const mem = { primeira: null, travado: false, jogadas: 0, pares: 0, total: 8, combo: 0, inicio: 0, timer: null };

  function memRecordes() {
    const r = Util.ler('mem-recorde', {});
    return typeof r === 'number' ? { 8: r } : r || {};
  }

  function memIniciar() {
    clearInterval(mem.timer);
    const total = Number($('memNivel').value);
    Object.assign(mem, { primeira: null, travado: false, jogadas: 0, pares: 0, total, combo: 0, inicio: 0 });
    $('memJogadas').textContent = '0';
    $('memTempo').textContent = '0s';
    $('memCombo').textContent = '0';
    $('memMsg').textContent = `Encontre os ${total} pares.`;
    const rec = memRecordes()[total];
    $('memRecorde').textContent = rec ? `${rec} jogadas` : 'nenhum';
    const colunas = total === 12 ? 6 : 4;
    const grade = $('memoria');
    grade.style.setProperty('--colunas', colunas);
    grade.innerHTML = Util.embaralhar([...EMOJIS.slice(0, total), ...EMOJIS.slice(0, total)]).map((e, i) => `
      <button class="carta" data-emoji="${e}" aria-label="Carta virada" style="--atraso:${i * 25}ms">
        <span class="carta__face carta__verso"></span>
        <span class="carta__face carta__frente">${e}</span>
      </button>`).join('');
  }

  function memEstrelas() {
    const r = mem.jogadas / mem.total;
    return r <= 1.5 ? 3 : r <= 2 ? 2 : 1;
  }

  $('memoria').addEventListener('click', e => {
    const carta = e.target.closest('.carta');
    if (!carta || mem.travado || carta.classList.contains('virada') || carta.classList.contains('par')) return;
    if (!mem.inicio) {
      mem.inicio = Date.now();
      mem.timer = setInterval(() => { $('memTempo').textContent = `${Math.round((Date.now() - mem.inicio) / 1000)}s`; }, 1000);
    }
    carta.classList.add('virada');
    carta.setAttribute('aria-label', carta.dataset.emoji);
    Util.som('pop');
    if (!mem.primeira) { mem.primeira = carta; return; }

    mem.jogadas++;
    $('memJogadas').textContent = mem.jogadas;
    const a = mem.primeira;
    mem.primeira = null;
    if (a.dataset.emoji === carta.dataset.emoji) {
      a.classList.add('par'); carta.classList.add('par');
      mem.pares++;
      mem.combo++;
      $('memCombo').textContent = mem.combo;
      Util.som('acerto');
      if (mem.combo >= 2) $('memMsg').textContent = `🔥 ${mem.combo} pares seguidos! Continue assim.`;
      else $('memMsg').textContent = `Faltam ${mem.total - mem.pares} par(es).`;
      if (mem.pares === mem.total) {
        clearInterval(mem.timer);
        const seg = Math.round((Date.now() - mem.inicio) / 1000);
        const recordes = memRecordes();
        const novo = !recordes[mem.total] || mem.jogadas < recordes[mem.total];
        if (novo) {
          recordes[mem.total] = mem.jogadas;
          Util.salvar('mem-recorde', recordes);
          $('memRecorde').textContent = `${mem.jogadas} jogadas`;
        }
        const estrelas = '⭐'.repeat(memEstrelas()) + '☆'.repeat(3 - memEstrelas());
        $('memMsg').textContent = `${estrelas} Parabéns! ${mem.jogadas} jogadas em ${seg}s.${novo ? ' Novo recorde!' : ''}`;
        Util.som('vitoria');
        Util.confete(novo ? 160 : 90);
      }
    } else {
      mem.travado = true;
      mem.combo = 0;
      $('memCombo').textContent = '0';
      a.classList.add('erro'); carta.classList.add('erro');
      Util.som('erro');
      setTimeout(() => {
        a.classList.remove('virada', 'erro'); carta.classList.remove('virada', 'erro');
        a.setAttribute('aria-label', 'Carta virada'); carta.setAttribute('aria-label', 'Carta virada');
        mem.travado = false;
      }, 800);
    }
  });
  $('memReiniciar').addEventListener('click', memIniciar);
  $('memNivel').addEventListener('change', memIniciar);
  memIniciar();

  // =====================================================================
  // Cobrinha (com níveis, fruta especial e obstáculos)
  // =====================================================================
  const cv = $('canvasCobra');
  const ctx = cv.getContext('2d');
  const N = 20, T = cv.width / N;
  const FRUTAS = ['🍎', '🍓', '🍌', '🍇', '🍊', '🥝'];
  const cobra = {
    corpo: [], dir: { x: 1, y: 0 }, prox: { x: 1, y: 0 }, fruta: null, emoji: '🍎', especial: null,
    obstaculos: [], particulas: [], pontos: 0, comidas: 0, nivel: 1, loop: null, rodando: false, pausado: false,
  };

  const ocupado = p => cobra.corpo.some(c => c.x === p.x && c.y === p.y) || cobra.obstaculos.some(o => o.x === p.x && o.y === p.y)
    || (cobra.fruta && cobra.fruta.x === p.x && cobra.fruta.y === p.y) || (cobra.especial && cobra.especial.x === p.x && cobra.especial.y === p.y);

  function posLivre(longeDaCabeca = 0) {
    let p, tentativas = 0;
    do {
      p = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
      tentativas++;
    } while ((ocupado(p) || (longeDaCabeca && cobra.corpo[0]
      && Math.abs(p.x - cobra.corpo[0].x) + Math.abs(p.y - cobra.corpo[0].y) < longeDaCabeca)) && tentativas < 500);
    return p;
  }

  function cobraNovaFruta() {
    cobra.fruta = null;
    cobra.fruta = posLivre();
    cobra.emoji = FRUTAS[Math.floor(Math.random() * FRUTAS.length)];
  }

  const velocidade = () => Math.max(60, 135 - (cobra.nivel - 1) * 12);

  function explodir(x, y, cor) {
    if (Util.movimentoReduzido()) return;
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2, v = Math.random() * 3 + 1;
      cobra.particulas.push({ x: x * T + T / 2, y: y * T + T / 2, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 1, cor });
    }
  }

  function cobraDesenhar(msg) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = Util.css('--borda');
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) ctx.fillRect(i * T, j * T, T, T);
    ctx.font = `${T - 2}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    cobra.obstaculos.forEach(o => {
      ctx.fillStyle = Util.css('--texto-3');
      ctx.beginPath(); ctx.roundRect(o.x * T + 2, o.y * T + 2, T - 4, T - 4, 5); ctx.fill();
    });
    if (cobra.fruta) ctx.fillText(cobra.emoji, cobra.fruta.x * T + T / 2, cobra.fruta.y * T + T / 2 + 1);
    if (cobra.especial) {
      const pulso = 1 + Math.sin(Date.now() / 120) * 0.12;
      ctx.save();
      ctx.translate(cobra.especial.x * T + T / 2, cobra.especial.y * T + T / 2 + 1);
      ctx.scale(pulso, pulso);
      ctx.fillText('⭐', 0, 0);
      ctx.restore();
    }
    const cor = Util.css('--primaria'), corForte = Util.css('--primaria-forte');
    cobra.corpo.forEach((c, i) => {
      ctx.fillStyle = i === 0 ? corForte : cor;
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.55, 1 - i / (cobra.corpo.length * 1.6));
      ctx.beginPath();
      ctx.roundRect(c.x * T + 1, c.y * T + 1, T - 2, T - 2, 6);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (cobra.corpo[0]) {
      const c = cobra.corpo[0];
      ctx.fillStyle = '#fff';
      const ox = cobra.dir.y !== 0 ? 4 : 0, oy = cobra.dir.x !== 0 ? 4 : 0;
      [-1, 1].forEach(s => {
        ctx.beginPath();
        ctx.arc(c.x * T + T / 2 + cobra.dir.x * 4 + s * ox, c.y * T + T / 2 + cobra.dir.y * 4 + s * oy, 2.6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    cobra.particulas.forEach(p => {
      ctx.globalAlpha = p.vida;
      ctx.fillStyle = p.cor;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (msg) {
      ctx.fillStyle = 'rgb(0 0 0 / .5)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const linhas = msg.split('\n');
      linhas.forEach((l, i) => ctx.fillText(l, cv.width / 2, cv.height / 2 + (i - (linhas.length - 1) / 2) * 32));
    }
  }

  // Partículas e a estrela pulsante são animadas fora do ritmo da cobrinha.
  (function animar() {
    if (cobra.particulas.length) {
      cobra.particulas.forEach(p => { p.x += p.vx; p.y += p.vy; p.vida -= 0.05; });
      cobra.particulas = cobra.particulas.filter(p => p.vida > 0);
      if (cobra.rodando && !cobra.pausado) cobraDesenhar();
    } else if (cobra.especial && cobra.rodando && !cobra.pausado) {
      cobraDesenhar();
    }
    requestAnimationFrame(animar);
  })();

  function agendarPasso() {
    clearTimeout(cobra.loop);
    cobra.loop = setTimeout(() => { cobraPasso(); if (cobra.rodando && !cobra.pausado) agendarPasso(); }, velocidade());
  }

  function cobraIniciar() {
    clearTimeout(cobra.loop);
    Object.assign(cobra, {
      corpo: [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }], dir: { x: 1, y: 0 }, prox: { x: 1, y: 0 },
      pontos: 0, comidas: 0, nivel: 1, obstaculos: [], especial: null, particulas: [], rodando: true, pausado: false,
    });
    $('cobraPontos').textContent = 0;
    $('cobraNivel').textContent = 1;
    $('cobraIniciar').textContent = 'Reiniciar';
    cobraNovaFruta();
    cobraDesenhar();
    agendarPasso();
    Util.som('clique');
  }

  function subirNivel() {
    cobra.nivel++;
    $('cobraNivel').textContent = cobra.nivel;
    if (cobra.nivel >= 3 && cobra.obstaculos.length < 10) {
      for (let k = 0; k < 2; k++) cobra.obstaculos.push(posLivre(5));
    }
    Util.som('nivel');
    Util.toast(`Nível ${cobra.nivel}! A cobrinha ficou mais rápida.${cobra.nivel >= 3 ? ' Cuidado com os obstáculos.' : ''}`);
  }

  function cobraPasso() {
    cobra.dir = cobra.prox;
    const cab = { x: cobra.corpo[0].x + cobra.dir.x, y: cobra.corpo[0].y + cobra.dir.y };
    cab.x = (cab.x + N) % N; cab.y = (cab.y + N) % N; // atravessa as bordas
    if (cobra.corpo.some(c => c.x === cab.x && c.y === cab.y) || cobra.obstaculos.some(o => o.x === cab.x && o.y === cab.y)) return cobraFim();
    cobra.corpo.unshift(cab);
    let cresceu = false;
    if (cab.x === cobra.fruta.x && cab.y === cobra.fruta.y) {
      cobra.pontos++;
      cobra.comidas++;
      cresceu = true;
      explodir(cab.x, cab.y, Util.css('--sol'));
      Util.som('pop');
      cobraNovaFruta();
      if (cobra.comidas % 5 === 0) subirNivel();
      // A cada 7 frutas aparece uma estrela que vale 3 pontos, por alguns segundos.
      if (cobra.comidas % 7 === 0 && !cobra.especial) {
        cobra.especial = posLivre(3);
        const esta = cobra.especial;
        setTimeout(() => { if (cobra.especial === esta) cobra.especial = null; }, 6000);
      }
    } else if (cobra.especial && cab.x === cobra.especial.x && cab.y === cobra.especial.y) {
      cobra.pontos += 3;
      cresceu = true;
      explodir(cab.x, cab.y, Util.css('--primaria'));
      Util.som('acerto');
      cobra.especial = null;
    }
    if (!cresceu) cobra.corpo.pop();
    $('cobraPontos').textContent = cobra.pontos;
    cobraDesenhar();
  }

  function cobraFim() {
    clearTimeout(cobra.loop);
    cobra.rodando = false;
    const rec = Util.ler('cobra-recorde', 0);
    const novo = cobra.pontos > rec;
    if (novo) { Util.salvar('cobra-recorde', cobra.pontos); Util.confete(); Util.som('vitoria'); } else Util.som('erro');
    $('cobraRecorde').textContent = Math.max(rec, cobra.pontos);
    $('cobraIniciar').textContent = 'Jogar de novo';
    cobraDesenhar(`${novo ? 'Novo recorde! ' : 'Fim de jogo! '}${cobra.pontos} ponto(s)\nNível ${cobra.nivel}`);
  }

  function cobraPausar(forcar) {
    if (!cobra.rodando) return;
    cobra.pausado = forcar ?? !cobra.pausado;
    if (cobra.pausado) { clearTimeout(cobra.loop); cobraDesenhar('Pausado\nAperte espaço para continuar'); }
    else { cobraDesenhar(); agendarPasso(); }
  }

  function cobraDirecao(nome) {
    const d = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[nome];
    if (!d || !cobra.rodando || cobra.pausado) return;
    if (d.x === -cobra.dir.x && d.y === -cobra.dir.y) return; // não volta para trás
    cobra.prox = d;
  }

  addEventListener('keydown', e => {
    if ($('jogo-cobrinha').hidden || !cobra.rodando) return;
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'p') { e.preventDefault(); cobraPausar(); return; }
    const mapa = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    if (mapa[e.key]) { e.preventDefault(); cobraDirecao(mapa[e.key]); }
  });
  document.querySelector('.dpad').addEventListener('click', e => cobraDirecao(e.target.dataset.dir));
  let toque = null;
  cv.addEventListener('touchstart', e => { toque = e.touches[0]; }, { passive: true });
  cv.addEventListener('touchend', e => {
    if (!toque) return;
    const dx = e.changedTouches[0].clientX - toque.clientX, dy = e.changedTouches[0].clientY - toque.clientY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 20) cobraDirecao(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    toque = null;
  });
  $('cobraIniciar').addEventListener('click', cobraIniciar);
  $('cobraRecorde').textContent = Util.ler('cobra-recorde', 0);
  pausas.cobrinha = () => cobraPausar(true);
  cobraDesenhar('Clique em Jogar');
  addEventListener('tema', () => cobraDesenhar(cobra.rodando ? (cobra.pausado ? 'Pausado' : null) : 'Clique em Jogar'));

  // =====================================================================
  // Bolhas: estoure o que faz bem, desvie das armadilhas
  // =====================================================================
  const BOAS = ['Família', 'Calma', 'Saúde', 'Amigos', 'Música', 'Sono bom', 'Foco', 'Paz', 'Sonhos', 'Economia',
    'Natureza', 'Esporte', 'Leitura', 'Risadas', 'Futuro', 'Coragem', 'Abraço', 'Café', 'Passeio', 'Respirar'];
  const ARMADILHAS = ['🎰 Tigrinho', '✈️ Aviator', '📲 Bet', '💸 Bônus', '🎲 Aposta', '🃏 Cassino', '📢 Sinais'];
  const DURACAO_BOLHAS = 45;
  const bol = { ativo: false, pontos: 0, restante: DURACAO_BOLHAS, criar: null, relogio: null, acertos: 0, armadilhas: 0 };
  const area = $('bolhasArea');

  function bolhaNova() {
    if (!bol.ativo) return;
    const sorteio = Math.random();
    const tipo = sorteio < 0.06 ? 'ouro' : sorteio < 0.3 ? 'armadilha' : 'boa';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `bolha bolha--${tipo}`;
    b.textContent = tipo === 'ouro' ? '⭐ +3' : tipo === 'armadilha'
      ? ARMADILHAS[Math.floor(Math.random() * ARMADILHAS.length)]
      : BOAS[Math.floor(Math.random() * BOAS.length)];
    const tam = tipo === 'ouro' ? 74 : 70 + Math.random() * 30;
    // Quanto mais o tempo passa, mais rápido as bolhas sobem.
    const progresso = 1 - bol.restante / DURACAO_BOLHAS;
    const dur = (6.5 - progresso * 3 + Math.random()) * (tipo === 'ouro' ? 0.75 : 1);
    b.style.cssText = `--tam:${tam}px; left:${Math.random() * (area.clientWidth - tam)}px; --dur:${dur}s; --balanco:${(Math.random() - 0.5) * 60}px`;
    b.addEventListener('pointerdown', () => estourar(b, tipo), { once: true });
    b.addEventListener('animationend', e => { if (e.animationName === 'subir') b.remove(); });
    area.appendChild(b);
    bol.criar = setTimeout(bolhaNova, Math.max(320, 750 - progresso * 420));
  }

  function estourar(b, tipo) {
    if (!bol.ativo) return;
    const ganho = { boa: 1, ouro: 3, armadilha: -2 }[tipo];
    bol.pontos = Math.max(0, bol.pontos + ganho);
    if (tipo === 'armadilha') {
      bol.armadilhas++;
      area.classList.remove('tremer'); void area.offsetWidth; area.classList.add('tremer');
      Util.som('erro');
      $('bolhasMsg').textContent = 'Essa era uma armadilha! Na vida real, desviar dela também é o melhor caminho.';
    } else {
      bol.acertos++;
      Util.som(tipo === 'ouro' ? 'acerto' : 'pop');
    }
    $('bolhasPontos').textContent = bol.pontos;
    const r = b.getBoundingClientRect(), ra = area.getBoundingClientRect();
    const tag = document.createElement('span');
    tag.className = `bolha-pontos ${ganho < 0 ? 'bolha-pontos--neg' : ''}`;
    tag.textContent = ganho > 0 ? `+${ganho}` : ganho;
    tag.style.left = `${r.left - ra.left + r.width / 2}px`;
    tag.style.top = `${r.top - ra.top}px`;
    area.appendChild(tag);
    setTimeout(() => tag.remove(), 800);
    // Congela a posição atual antes de trocar a animação de subida pela de estouro.
    const estilo = getComputedStyle(b);
    b.style.transform = estilo.transform;
    b.style.translate = estilo.translate;
    b.style.animation = 'none';
    b.classList.add('estourada');
    setTimeout(() => b.remove(), 260);
  }

  function bolhasIniciar() {
    bolhasParar(false);
    area.querySelectorAll('.bolha, .bolha-pontos').forEach(b => b.remove());
    $('bolhasIntro').hidden = true;
    Object.assign(bol, { ativo: true, pontos: 0, restante: DURACAO_BOLHAS, acertos: 0, armadilhas: 0 });
    $('bolhasPontos').textContent = '0';
    $('bolhasTempo').textContent = `${DURACAO_BOLHAS}s`;
    $('bolhasMsg').textContent = 'Estoure as bolhas verdes e douradas!';
    $('bolhasIniciar').textContent = 'Recomeçar';
    Util.som('clique');
    bolhaNova();
    bol.relogio = setInterval(() => {
      bol.restante--;
      $('bolhasTempo').textContent = `${bol.restante}s`;
      if (bol.restante <= 0) bolhasParar(true);
    }, 1000);
  }

  function bolhasParar(terminou) {
    if (!bol.ativo) return;
    bol.ativo = false;
    clearTimeout(bol.criar);
    clearInterval(bol.relogio);
    area.querySelectorAll('.bolha').forEach(b => b.classList.add('sumir'));
    setTimeout(() => area.querySelectorAll('.bolha').forEach(b => b.remove()), 400);
    $('bolhasIniciar').textContent = terminou ? 'Jogar de novo' : 'Começar';
    if (!terminou) { $('bolhasMsg').textContent = 'Jogo pausado. Clique em Começar para jogar de novo.'; return; }
    const rec = Util.ler('bolhas-recorde', 0);
    const novo = bol.pontos > rec;
    if (novo) { Util.salvar('bolhas-recorde', bol.pontos); $('bolhasRecorde').textContent = bol.pontos; Util.confete(); Util.som('vitoria'); }
    $('bolhasMsg').textContent = `${novo ? '🎉 Novo recorde! ' : ''}Você fez ${bol.pontos} ponto(s), estourou ${bol.acertos} bolha(s) boas`
      + `${bol.armadilhas ? ` e caiu em ${bol.armadilhas} armadilha(s)` : ' e não caiu em nenhuma armadilha'}.`;
  }

  $('bolhasIniciar').addEventListener('click', bolhasIniciar);
  $('bolhasRecorde').textContent = Util.ler('bolhas-recorde', 0);
  pausas.bolhas = () => bolhasParar(false);
  document.addEventListener('visibilitychange', () => { if (document.hidden) bolhasParar(false); });

  // =====================================================================
  // Quiz Mito ou verdade (perguntas vindas do backend), com tempo e sequência
  // =====================================================================
  const TEMPO_PERGUNTA = 20;
  const POR_RODADA = 10;
  const quiz = {
    carregado: false, todas: [], perguntas: [], i: 0, acertos: 0, pontos: 0, sequencia: 0, timer: null, restante: 0,
    async iniciar() {
      const el = $('quiz');
      if (!this.carregado) {
        try {
          this.todas = await Api.get('quiz');
          this.carregado = true;
        } catch {
          el.innerHTML = '<p class="vazio">Não foi possível carregar o quiz.</p>';
          return;
        }
      }
      this.perguntas = Util.embaralhar(this.todas).slice(0, POR_RODADA);
      Object.assign(this, { i: 0, acertos: 0, pontos: 0, sequencia: 0 });
      this.mostrar();
    },
    parar() { clearInterval(this.timer); },
    mostrar() {
      this.parar();
      const el = $('quiz');
      const total = this.perguntas.length;
      if (this.i >= total) {
        const rec = Util.ler('quiz-recorde', 0);
        const novo = this.pontos > rec;
        if (novo) Util.salvar('quiz-recorde', this.pontos);
        if (this.acertos >= total * 0.7) { Util.confete(); Util.som('vitoria'); }
        el.innerHTML = `<div class="quiz__final">
          <p class="quiz__prog">Resultado</p>
          <strong>${this.acertos}/${total}</strong>
          <p class="quiz__pontos">${Util.numero(this.pontos)} pontos${novo ? ' · novo recorde! 🎉' : ''}</p>
          <p>${this.acertos === total ? 'Perfeito! Você conhece bem as armadilhas das apostas.' : this.acertos >= total * 0.7 ? 'Muito bem! Você está bem informado(a).' : 'Agora você sabe mais sobre como as apostas enganam. Conhecimento é proteção.'}</p>
          <p class="painel__sub">Seu recorde: ${Util.numero(Math.max(rec, this.pontos))} pontos</p>
          <button class="btn btn--primario" id="quizDeNovo">Jogar de novo</button>
        </div>`;
        $('quizDeNovo').addEventListener('click', () => this.iniciar());
        return;
      }
      const p = this.perguntas[this.i];
      el.innerHTML = `
        <div class="quiz__topo">
          <span class="quiz__prog">Pergunta ${this.i + 1} de ${total}</span>
          <span class="quiz__prog">${Util.numero(this.pontos)} pontos${this.sequencia >= 2 ? ` · 🔥 ${this.sequencia} seguidas` : ''}</span>
        </div>
        <div class="quiz__progresso" aria-hidden="true"><span style="width:${(this.i / total) * 100}%"></span></div>
        <div class="quiz__tempo" aria-hidden="true"><span id="quizTempoBarra"></span></div>
        <p class="quiz__afirmacao">“${Util.escapar(p.afirmacao)}”</p>
        <div class="quiz__btns">
          <button class="btn btn--mito" data-r="false">❌ Mito</button>
          <button class="btn btn--verdade" data-r="true">✅ Verdade</button>
        </div>
        <div id="quizFb" aria-live="polite"></div>`;
      el.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => this.responder(b.dataset.r === 'true')));
      this.restante = TEMPO_PERGUNTA;
      const barraTempo = $('quizTempoBarra');
      void barraTempo.offsetWidth; // garante que a barra cheia seja desenhada antes de começar a esvaziar
      barraTempo.style.transitionDuration = `${TEMPO_PERGUNTA}s`;
      barraTempo.style.width = '0%';
      this.timer = setInterval(() => {
        this.restante--;
        if (this.restante <= 5) barraTempo.classList.add('acabando');
        if (this.restante <= 0) this.responder(null);
      }, 1000);
    },
    responder(resp) {
      this.parar();
      const p = this.perguntas[this.i];
      const certo = resp === p.verdade;
      let ganho = 0;
      if (certo) {
        this.acertos++;
        this.sequencia++;
        ganho = 100 + this.restante * 5 + (this.sequencia >= 3 ? 50 : 0);
        this.pontos += ganho;
        Util.som('acerto');
      } else {
        this.sequencia = 0;
        Util.som('erro');
      }
      const barraTempo = $('quizTempoBarra');
      if (barraTempo) { barraTempo.style.transitionDuration = '0s'; barraTempo.style.width = getComputedStyle(barraTempo).width; }
      $('quiz').querySelectorAll('[data-r]').forEach(b => {
        b.disabled = true;
        if ((b.dataset.r === 'true') === p.verdade) b.classList.add('correta');
      });
      const titulo = resp === null ? '⏰ O tempo acabou.' : certo ? `🎯 Acertou! +${ganho} pontos` : '🤔 Não foi dessa vez.';
      $('quizFb').innerHTML = `<div class="quiz__fb ${certo ? 'certo' : 'errado'}">
          <strong>${titulo} É ${p.verdade ? 'verdade' : 'mito'}.</strong>
          ${Util.escapar(p.explicacao)}
        </div>
        <p style="margin-top:16px"><button class="btn btn--primario" id="quizProx">${this.i + 1 < this.perguntas.length ? 'Próxima →' : 'Ver resultado'}</button></p>`;
      $('quizProx').addEventListener('click', () => { this.i++; this.mostrar(); });
      $('quizProx').focus({ preventScroll: true });
    },
  };
  aoAbrir.quiz = () => {
    if (!quiz.carregado) quiz.iniciar();
    else if (quiz.i < quiz.perguntas.length && !$('quizFb')?.innerHTML) quiz.mostrar();
  };
  pausas.quiz = () => quiz.parar();

  // =====================================================================
  // Respiração guiada
  // =====================================================================
  const TECNICAS = {
    caixa: [['Inspire', 4, 1], ['Segure', 4, 1], ['Expire', 4, 0.6], ['Segure', 4, 0.6]],
    478: [['Inspire', 4, 1], ['Segure', 7, 1], ['Expire', 8, 0.6]],
    coerente: [['Inspire', 5, 1], ['Expire', 5, 0.6]],
  };
  const META_CICLOS = 5;
  const resp = { ativo: false, timeout: null, contador: null, relogio: null, ciclos: 0, seg: 0 };
  const circulo = $('respCirculo'), respTexto = $('respTexto');

  function respMostrarMeta() {
    $('respCiclos').textContent = resp.ciclos;
    $('respTempo').textContent = `${Math.floor(resp.seg / 60)}:${String(resp.seg % 60).padStart(2, '0')}`;
    $('respMetaBarra').style.width = `${Math.min(100, (resp.ciclos / META_CICLOS) * 100)}%`;
    $('respMetaTxt').textContent = resp.ciclos >= META_CICLOS
      ? 'Meta cumprida! Perceba como o seu corpo está mais calmo agora.'
      : `Meta: ${META_CICLOS} ciclos para acalmar o corpo. Faltam ${META_CICLOS - resp.ciclos}.`;
  }

  function respParar() {
    resp.ativo = false;
    clearTimeout(resp.timeout); clearInterval(resp.contador); clearInterval(resp.relogio);
    circulo.style.transitionDuration = '1s';
    circulo.style.transform = 'scale(.6)';
    circulo.classList.remove('respiracao__circulo--ativo');
    respTexto.textContent = 'Pronto?';
    $('respBtn').textContent = 'Começar';
  }

  function respFase(fases, k) {
    if (!resp.ativo) return;
    const [nome, seg, escala] = fases[k];
    circulo.style.transitionDuration = `${seg}s`;
    circulo.style.transform = `scale(${escala})`;
    let restante = seg;
    respTexto.textContent = `${nome}\n${restante}`;
    respTexto.style.whiteSpace = 'pre-line';
    Util.som('clique');
    clearInterval(resp.contador);
    resp.contador = setInterval(() => { restante--; if (restante > 0) respTexto.textContent = `${nome}\n${restante}`; }, 1000);
    resp.timeout = setTimeout(() => {
      const prox = (k + 1) % fases.length;
      if (prox === 0) {
        resp.ciclos++;
        respMostrarMeta();
        if (resp.ciclos === META_CICLOS) { Util.som('vitoria'); Util.toast(`${META_CICLOS} ciclos completos. Muito bem! 🌿`); }
      }
      respFase(fases, prox);
    }, seg * 1000);
  }

  $('respBtn').addEventListener('click', () => {
    if (resp.ativo) return respParar();
    resp.ativo = true;
    $('respBtn').textContent = 'Parar';
    circulo.classList.add('respiracao__circulo--ativo');
    clearInterval(resp.relogio);
    resp.relogio = setInterval(() => { resp.seg++; respMostrarMeta(); }, 1000);
    respFase(TECNICAS[$('respTecnica').value], 0);
  });
  $('respTecnica').addEventListener('change', () => { if (resp.ativo) { respParar(); $('respBtn').click(); } });
  pausas.respiracao = () => { if (resp.ativo) respParar(); };
  respMostrarMeta();

  // =====================================================================
  // Jogo da velha (você = X, computador = O), com três níveis
  // =====================================================================
  const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const ERRO_POR_NIVEL = { facil: 0.7, medio: 0.25, dificil: 0 };
  const velha = { tab: Array(9).fill(null), fim: false, partida: 0, placar: Util.ler('velha-placar', { voce: 0, cpu: 0, empate: 0 }) };

  function vencedor(t) {
    for (const l of LINHAS) if (t[l[0]] && t[l[0]] === t[l[1]] && t[l[0]] === t[l[2]]) return { quem: t[l[0]], linha: l };
    return t.every(Boolean) ? { quem: 'empate' } : null;
  }

  // Minimax completo; nos níveis fácil e médio, às vezes faz uma jogada aleatória.
  function minimax(t, vez) {
    const v = vencedor(t);
    if (v) return { score: v.quem === 'O' ? 1 : v.quem === 'X' ? -1 : 0 };
    let melhor = { score: vez === 'O' ? -2 : 2 };
    t.forEach((c, i) => {
      if (c) return;
      t[i] = vez;
      const r = minimax(t, vez === 'O' ? 'X' : 'O');
      t[i] = null;
      if ((vez === 'O' && r.score > melhor.score) || (vez === 'X' && r.score < melhor.score)) melhor = { score: r.score, i };
    });
    return melhor;
  }

  function velhaRender(v) {
    $('velha').innerHTML = velha.tab.map((c, i) => `
      <button data-i="${i}" class="${c ? c.toLowerCase() : ''} ${v?.linha?.includes(i) ? 'vence' : ''}" ${c || velha.fim ? 'disabled' : ''}
        aria-label="Casa ${i + 1}: ${c || 'vazia'}">${c || ''}</button>`).join('');
    $('velhaVoce').textContent = velha.placar.voce;
    $('velhaCpu').textContent = velha.placar.cpu;
    $('velhaEmpates').textContent = velha.placar.empate;
  }

  function velhaChecar() {
    const v = vencedor(velha.tab);
    if (!v) return false;
    velha.fim = true;
    if (v.quem === 'X') {
      velha.placar.voce++;
      $('velhaMsg').textContent = $('velhaNivel').value === 'dificil' ? '🏆 Você venceu no nível difícil! Incrível!' : '🎉 Você venceu!';
      Util.som('vitoria');
      Util.confete(80);
    } else if (v.quem === 'O') {
      velha.placar.cpu++;
      $('velhaMsg').textContent = '🤖 O computador venceu. Tente de novo!';
      Util.som('erro');
    } else {
      velha.placar.empate++;
      $('velhaMsg').textContent = '🤝 Empate!';
      Util.som('clique');
    }
    Util.salvar('velha-placar', velha.placar);
    velhaRender(v);
    return true;
  }

  $('velha').addEventListener('click', e => {
    const i = Number(e.target.dataset.i);
    if (Number.isNaN(i) || velha.tab[i] || velha.fim) return;
    velha.tab[i] = 'X';
    Util.som('pop');
    velhaRender();
    if (velhaChecar()) return;
    $('velhaMsg').textContent = 'O computador está pensando…';
    velha.fim = true; // bloqueia cliques enquanto o computador joga
    velhaRender();
    const partida = velha.partida;
    setTimeout(() => {
      if (partida !== velha.partida) return; // a pessoa começou outra partida
      velha.fim = false;
      const livres = velha.tab.map((c, k) => (c ? null : k)).filter(k => k !== null);
      const errar = Math.random() < ERRO_POR_NIVEL[$('velhaNivel').value];
      const jogada = errar ? livres[Math.floor(Math.random() * livres.length)] : minimax([...velha.tab], 'O').i;
      velha.tab[jogada] = 'O';
      if (!velhaChecar()) { $('velhaMsg').textContent = 'Sua vez!'; velhaRender(); }
    }, 450);
  });
  function velhaNova() {
    velha.partida++;
    velha.tab = Array(9).fill(null);
    velha.fim = false;
    $('velhaMsg').textContent = 'Sua vez!';
    velhaRender();
  }
  $('velhaReiniciar').addEventListener('click', velhaNova);
  $('velhaNivel').addEventListener('change', velhaNova);
  velhaRender();

  // =====================================================================
  // Ideias do que fazer agora
  // =====================================================================
  const IDEIAS = [
    ['🚶', 'Saia para uma caminhada de 15 minutos, sem o celular.', 'corpo'],
    ['📞', 'Ligue para alguém de quem você gosta só para conversar.', 'pessoas'],
    ['💧', 'Beba um copo de água gelada devagar e respire fundo.', 'mente'],
    ['🧹', 'Arrume uma gaveta ou um cantinho da casa.', 'casa'],
    ['🎧', 'Coloque a sua música favorita e cante junto.', 'mente'],
    ['🍳', 'Cozinhe algo simples, como um café, uma tapioca ou um bolo de caneca.', 'casa'],
    ['📝', 'Escreva três coisas pelas quais você é grato(a) hoje.', 'mente'],
    ['🏋️', 'Faça 20 polichinelos, 10 agachamentos e 10 flexões.', 'corpo'],
    ['🚿', 'Tome um banho demorado e relaxante.', 'casa'],
    ['📖', 'Leia 10 páginas de um livro ou uma reportagem interessante.', 'mente'],
    ['🌱', 'Cuide de uma planta ou comece a cultivar uma.', 'casa'],
    ['🎨', 'Desenhe qualquer coisa, sem se preocupar se está bonito.', 'mente'],
    ['⚽', 'Bata uma bola com os amigos, só pelo prazer do jogo.', 'pessoas'],
    ['🧩', 'Jogue uma partida do jogo da memória aqui ao lado.', 'mente'],
    ['💌', 'Escreva uma mensagem para você mesmo(a) ler daqui a um ano.', 'mente'],
    ['🐶', 'Brinque com o seu animal de estimação ou passeie com ele.', 'pessoas'],
    ['🧘', 'Faça três ciclos da respiração guiada desta página.', 'mente'],
    ['🗓️', 'Planeje algo legal para o fim de semana que não envolva apostas.', 'casa'],
    ['🎬', 'Assista a um episódio de uma série de comédia.', 'casa'],
    ['💰', 'Calcule quanto você já economizou desde que parou. Veja em "Minha jornada".', 'mente'],
    ['🚴', 'Dê uma volta de bicicleta pelo bairro.', 'corpo'],
    ['🤸', 'Faça cinco minutos de alongamento, devagar.', 'corpo'],
    ['☕', 'Convide alguém para um café e conte como você está.', 'pessoas'],
    ['🧑‍🤝‍🧑', 'Procure um grupo de apoio, como os Jogadores Anônimos, e veja o horário da próxima reunião.', 'pessoas'],
    ['🛏️', 'Se já for tarde, deixe o celular em outro cômodo e vá dormir.', 'casa'],
    ['🏃', 'Suba e desça escadas por cinco minutos.', 'corpo'],
  ];
  let filtro = 'todas';
  let ultimaIdeia = -1;
  $('ideiasFeitas').textContent = Util.ler('ideias-feitas', 0);

  document.querySelectorAll('.ideias__filtros .chip').forEach(chip => chip.addEventListener('click', () => {
    filtro = chip.dataset.cat;
    document.querySelectorAll('.ideias__filtros .chip').forEach(c => c.setAttribute('aria-pressed', c === chip));
    $('ideiaBtn').click();
  }));

  $('ideiaBtn').addEventListener('click', () => {
    const opcoes = IDEIAS.map((x, k) => k).filter(k => filtro === 'todas' || IDEIAS[k][2] === filtro);
    let k;
    do { k = opcoes[Math.floor(Math.random() * opcoes.length)]; } while (k === ultimaIdeia && opcoes.length > 1);
    ultimaIdeia = k;
    const icone = $('ideiaIcone'), texto = $('ideiaTexto');
    [icone, texto].forEach(el => { el.classList.remove('surgir'); void el.offsetWidth; el.classList.add('surgir'); });
    icone.textContent = IDEIAS[k][0];
    texto.textContent = IDEIAS[k][1];
    $('ideiaBtn').textContent = 'Outra ideia';
    $('ideiaFeita').hidden = false;
    $('ideiaFeita').disabled = false;
    Util.som('clique');
  });

  $('ideiaFeita').addEventListener('click', () => {
    const n = Util.ler('ideias-feitas', 0) + 1;
    Util.salvar('ideias-feitas', n);
    $('ideiasFeitas').textContent = n;
    $('ideiaFeita').disabled = true;
    Util.som('acerto');
    Util.confete(60);
    Util.toast(n === 1 ? 'Primeira ideia colocada em prática. Que orgulho!' : `Você já colocou ${n} ideias em prática. Continue assim!`);
  });

  // Recordes podem chegar da conta depois do carregamento.
  addEventListener('sincronizado', () => {
    $('cobraRecorde').textContent = Util.ler('cobra-recorde', 0);
    $('bolhasRecorde').textContent = Util.ler('bolhas-recorde', 0);
    $('ideiasFeitas').textContent = Util.ler('ideias-feitas', 0);
    const rec = memRecordes()[mem.total];
    $('memRecorde').textContent = rec ? `${rec} jogadas` : 'nenhum';
    velha.placar = Util.ler('velha-placar', velha.placar);
    velhaRender();
  });
})();
