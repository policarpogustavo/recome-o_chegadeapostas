/* Jogos e distrações — nenhum envolve dinheiro, sorte paga ou recompensa aleatória. */
(() => {
  const $ = id => document.getElementById(id);

  // ---------- Abas ----------
  const abas = document.querySelectorAll('.abas [role="tab"]');
  const pausas = {};
  abas.forEach(aba => aba.addEventListener('click', () => {
    abas.forEach(a => a.setAttribute('aria-selected', a === aba));
    document.querySelectorAll('.jogo').forEach(j => { j.hidden = j.id !== `jogo-${aba.dataset.aba}`; });
    Object.entries(pausas).forEach(([nome, pausar]) => { if (nome !== aba.dataset.aba) pausar(); });
    if (aba.dataset.aba === 'quiz' && !quiz.carregado) quiz.iniciar();
  }));

  // =====================================================================
  // Jogo da memória
  // =====================================================================
  const EMOJIS = ['🌻', '🐢', '🎸', '⚽', '📚', '🚲', '🌈', '🍉'];
  const mem = { primeira: null, travado: false, jogadas: 0, pares: 0, inicio: 0, timer: null };

  function memIniciar() {
    clearInterval(mem.timer);
    Object.assign(mem, { primeira: null, travado: false, jogadas: 0, pares: 0, inicio: 0 });
    $('memJogadas').textContent = '0';
    $('memTempo').textContent = '0s';
    $('memMsg').textContent = 'Encontre os 8 pares.';
    const rec = Util.ler('mem-recorde', null);
    $('memRecorde').textContent = rec ? `${rec} jogadas` : '—';
    $('memoria').innerHTML = Util.embaralhar([...EMOJIS, ...EMOJIS]).map(e => `
      <button class="carta" data-emoji="${e}" aria-label="Carta virada">
        <span class="carta__face carta__verso"></span>
        <span class="carta__face carta__frente">${e}</span>
      </button>`).join('');
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
    if (!mem.primeira) { mem.primeira = carta; return; }

    mem.jogadas++;
    $('memJogadas').textContent = mem.jogadas;
    const a = mem.primeira;
    mem.primeira = null;
    if (a.dataset.emoji === carta.dataset.emoji) {
      a.classList.add('par'); carta.classList.add('par');
      mem.pares++;
      if (mem.pares === EMOJIS.length) {
        clearInterval(mem.timer);
        const seg = Math.round((Date.now() - mem.inicio) / 1000);
        const rec = Util.ler('mem-recorde', null);
        const novo = !rec || mem.jogadas < rec;
        if (novo) { Util.salvar('mem-recorde', mem.jogadas); $('memRecorde').textContent = `${mem.jogadas} jogadas`; }
        $('memMsg').textContent = `🎉 Parabéns! ${mem.jogadas} jogadas em ${seg}s.${novo ? ' Novo recorde!' : ''}`;
      }
    } else {
      mem.travado = true;
      setTimeout(() => {
        a.classList.remove('virada'); carta.classList.remove('virada');
        a.setAttribute('aria-label', 'Carta virada'); carta.setAttribute('aria-label', 'Carta virada');
        mem.travado = false;
      }, 800);
    }
  });
  $('memReiniciar').addEventListener('click', memIniciar);
  memIniciar();

  // =====================================================================
  // Cobrinha
  // =====================================================================
  const cv = $('canvasCobra');
  const ctx = cv.getContext('2d');
  const N = 20, T = cv.width / N;
  const FRUTAS = ['🍎', '🍓', '🍌', '🍇', '🍊', '🥝'];
  const cobra = { corpo: [], dir: { x: 1, y: 0 }, prox: { x: 1, y: 0 }, fruta: null, emoji: '🍎', pontos: 0, loop: null, rodando: false };

  function cobraNovaFruta() {
    let p;
    do { p = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; }
    while (cobra.corpo.some(c => c.x === p.x && c.y === p.y));
    cobra.fruta = p;
    cobra.emoji = FRUTAS[Math.floor(Math.random() * FRUTAS.length)];
  }

  function cobraDesenhar(msg) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = Util.css('--borda');
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) ctx.fillRect(i * T, j * T, T, T);
    if (cobra.fruta) {
      ctx.font = `${T - 2}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cobra.emoji, cobra.fruta.x * T + T / 2, cobra.fruta.y * T + T / 2 + 1);
    }
    const cor = Util.css('--primaria'), corForte = Util.css('--primaria-forte');
    cobra.corpo.forEach((c, i) => {
      ctx.fillStyle = i === 0 ? corForte : cor;
      ctx.beginPath();
      ctx.roundRect(c.x * T + 1, c.y * T + 1, T - 2, T - 2, 6);
      ctx.fill();
    });
    if (msg) {
      ctx.fillStyle = 'rgb(0 0 0 / .45)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      msg.split('\n').forEach((l, i) => ctx.fillText(l, cv.width / 2, cv.height / 2 + i * 32 - 16));
    }
  }

  function cobraIniciar() {
    clearInterval(cobra.loop);
    Object.assign(cobra, { corpo: [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }], dir: { x: 1, y: 0 }, prox: { x: 1, y: 0 }, pontos: 0, rodando: true });
    $('cobraPontos').textContent = 0;
    $('cobraIniciar').textContent = 'Reiniciar';
    cobraNovaFruta();
    cobra.loop = setInterval(cobraPasso, 120);
  }

  function cobraPasso() {
    cobra.dir = cobra.prox;
    const cab = { x: cobra.corpo[0].x + cobra.dir.x, y: cobra.corpo[0].y + cobra.dir.y };
    cab.x = (cab.x + N) % N; cab.y = (cab.y + N) % N; // atravessa as bordas
    if (cobra.corpo.some(c => c.x === cab.x && c.y === cab.y)) return cobraFim();
    cobra.corpo.unshift(cab);
    if (cab.x === cobra.fruta.x && cab.y === cobra.fruta.y) {
      cobra.pontos++;
      $('cobraPontos').textContent = cobra.pontos;
      cobraNovaFruta();
    } else {
      cobra.corpo.pop();
    }
    cobraDesenhar();
  }

  function cobraFim() {
    clearInterval(cobra.loop);
    cobra.rodando = false;
    const rec = Util.ler('cobra-recorde', 0);
    if (cobra.pontos > rec) Util.salvar('cobra-recorde', cobra.pontos);
    $('cobraRecorde').textContent = Math.max(rec, cobra.pontos);
    cobraDesenhar(`Fim de jogo! ${cobra.pontos} ponto(s)\nClique em Reiniciar`);
  }

  function cobraDirecao(nome) {
    const d = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[nome];
    if (!d || !cobra.rodando) return;
    if (d.x === -cobra.dir.x && d.y === -cobra.dir.y) return; // não volta para trás
    cobra.prox = d;
  }

  addEventListener('keydown', e => {
    if ($('jogo-cobrinha').hidden || !cobra.rodando) return;
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
  pausas.cobrinha = () => { if (cobra.rodando) { clearInterval(cobra.loop); cobra.rodando = false; $('cobraIniciar').textContent = 'Jogar'; cobraDesenhar('Pausado'); } };
  cobraDesenhar('Clique em Jogar');
  addEventListener('tema', () => cobraDesenhar(cobra.rodando ? null : 'Clique em Jogar'));

  // =====================================================================
  // Quiz Mito ou Verdade (perguntas vindas do backend)
  // =====================================================================
  const quiz = {
    carregado: false, perguntas: [], i: 0, acertos: 0,
    async iniciar() {
      const el = $('quiz');
      try {
        this.perguntas = Util.embaralhar(await Api.get('quiz'));
        this.carregado = true;
      } catch {
        el.innerHTML = '<p class="vazio">Não foi possível carregar o quiz.</p>';
        return;
      }
      this.i = 0; this.acertos = 0;
      this.mostrar();
    },
    mostrar() {
      const el = $('quiz');
      if (this.i >= this.perguntas.length) {
        const total = this.perguntas.length;
        const rec = Math.max(Util.ler('quiz-recorde', 0), this.acertos);
        Util.salvar('quiz-recorde', rec);
        el.innerHTML = `<div class="quiz__final">
          <p class="quiz__prog">Resultado</p>
          <strong>${this.acertos}/${total}</strong>
          <p>${this.acertos === total ? 'Perfeito! Você conhece bem as armadilhas das apostas.' : this.acertos >= total * 0.7 ? 'Muito bem! Você está bem informado(a).' : 'Agora você sabe mais sobre como as apostas enganam. Conhecimento é proteção.'}</p>
          <p class="painel__sub">Seu recorde: ${rec}/${total}</p>
          <button class="btn btn--primario" id="quizDeNovo">Jogar de novo</button>
        </div>`;
        $('quizDeNovo').addEventListener('click', () => this.iniciar());
        return;
      }
      const p = this.perguntas[this.i];
      el.innerHTML = `
        <p class="quiz__prog">Pergunta ${this.i + 1} de ${this.perguntas.length} · ${this.acertos} acerto(s)</p>
        <p class="quiz__afirmacao">“${Util.escapar(p.afirmacao)}”</p>
        <div class="quiz__btns">
          <button class="btn btn--mito" data-r="false">❌ Mito</button>
          <button class="btn btn--verdade" data-r="true">✅ Verdade</button>
        </div>
        <div id="quizFb"></div>`;
      el.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => this.responder(b.dataset.r === 'true')));
    },
    responder(resp) {
      const p = this.perguntas[this.i];
      const certo = resp === p.verdade;
      if (certo) this.acertos++;
      $('quiz').querySelectorAll('[data-r]').forEach(b => { b.disabled = true; });
      $('quizFb').innerHTML = `<div class="quiz__fb ${certo ? 'certo' : 'errado'}">
          <strong>${certo ? '🎯 Acertou!' : '🤔 Não foi dessa vez.'} É ${p.verdade ? 'verdade' : 'mito'}.</strong>
          ${Util.escapar(p.explicacao)}
        </div>
        <p style="margin-top:16px"><button class="btn btn--primario" id="quizProx">${this.i + 1 < this.perguntas.length ? 'Próxima →' : 'Ver resultado'}</button></p>`;
      $('quizProx').addEventListener('click', () => { this.i++; this.mostrar(); });
      $('quizProx').focus();
    },
  };

  // =====================================================================
  // Respiração guiada
  // =====================================================================
  const TECNICAS = {
    caixa: [['Inspire', 4, 1], ['Segure', 4, 1], ['Expire', 4, 0.6], ['Segure', 4, 0.6]],
    478: [['Inspire', 4, 1], ['Segure', 7, 1], ['Expire', 8, 0.6]],
  };
  const resp = { ativo: false, timeout: null, contador: null, ciclos: 0 };
  const circulo = $('respCirculo'), respTexto = $('respTexto');

  function respParar() {
    resp.ativo = false;
    clearTimeout(resp.timeout); clearInterval(resp.contador);
    circulo.style.transitionDuration = '1s';
    circulo.style.transform = 'scale(.6)';
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
    clearInterval(resp.contador);
    resp.contador = setInterval(() => { restante--; if (restante > 0) respTexto.textContent = `${nome}\n${restante}`; }, 1000);
    resp.timeout = setTimeout(() => {
      const prox = (k + 1) % fases.length;
      if (prox === 0) { resp.ciclos++; $('respCiclos').textContent = resp.ciclos; }
      respFase(fases, prox);
    }, seg * 1000);
  }

  $('respBtn').addEventListener('click', () => {
    if (resp.ativo) return respParar();
    resp.ativo = true;
    $('respBtn').textContent = 'Parar';
    respFase(TECNICAS[$('respTecnica').value], 0);
  });
  $('respTecnica').addEventListener('change', () => { if (resp.ativo) { respParar(); $('respBtn').click(); } });
  pausas.respiracao = () => { if (resp.ativo) respParar(); };

  // =====================================================================
  // Jogo da velha (você = X, computador = O)
  // =====================================================================
  const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const velha = { tab: Array(9).fill(null), fim: false, placar: Util.ler('velha-placar', { voce: 0, cpu: 0, empate: 0 }) };

  function vencedor(t) {
    for (const l of LINHAS) if (t[l[0]] && t[l[0]] === t[l[1]] && t[l[0]] === t[l[2]]) return { quem: t[l[0]], linha: l };
    return t.every(Boolean) ? { quem: 'empate' } : null;
  }

  // Minimax completo; com 25% de chance faz uma jogada aleatória para dar chance ao jogador.
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
    if (v.quem === 'X') { velha.placar.voce++; $('velhaMsg').textContent = '🎉 Você venceu!'; }
    else if (v.quem === 'O') { velha.placar.cpu++; $('velhaMsg').textContent = '🤖 O computador venceu. Tente de novo!'; }
    else { velha.placar.empate++; $('velhaMsg').textContent = '🤝 Empate!'; }
    Util.salvar('velha-placar', velha.placar);
    velhaRender(v);
    return true;
  }

  $('velha').addEventListener('click', e => {
    const i = Number(e.target.dataset.i);
    if (Number.isNaN(i) || velha.tab[i] || velha.fim) return;
    velha.tab[i] = 'X';
    velhaRender();
    if (velhaChecar()) return;
    $('velhaMsg').textContent = 'Computador pensando…';
    setTimeout(() => {
      const livres = velha.tab.map((c, k) => (c ? null : k)).filter(k => k !== null);
      const jogada = Math.random() < 0.25 ? livres[Math.floor(Math.random() * livres.length)] : minimax([...velha.tab], 'O').i;
      velha.tab[jogada] = 'O';
      if (!velhaChecar()) { $('velhaMsg').textContent = 'Sua vez!'; velhaRender(); }
    }, 400);
  });
  $('velhaReiniciar').addEventListener('click', () => {
    velha.tab = Array(9).fill(null);
    velha.fim = false;
    $('velhaMsg').textContent = 'Sua vez!';
    velhaRender();
  });
  velhaRender();

  // =====================================================================
  // Ideias do que fazer agora
  // =====================================================================
  const IDEIAS = [
    ['🚶', 'Saia para uma caminhada de 15 minutos, sem o celular.'],
    ['📞', 'Ligue para alguém de quem você gosta só para conversar.'],
    ['💧', 'Beba um copo de água gelada devagar e respire fundo.'],
    ['🧹', 'Arrume uma gaveta ou um cantinho da casa.'],
    ['🎧', 'Coloque sua música favorita e cante junto.'],
    ['🍳', 'Cozinhe algo simples — um café, uma tapioca, um bolo de caneca.'],
    ['📝', 'Escreva 3 coisas pelas quais você é grato(a) hoje.'],
    ['🏋️', 'Faça 20 polichinelos, 10 agachamentos e 10 flexões.'],
    ['🚿', 'Tome um banho demorado e relaxante.'],
    ['📖', 'Leia 10 páginas de um livro ou uma reportagem interessante.'],
    ['🌱', 'Cuide de uma planta — ou comece a cultivar uma.'],
    ['🎨', 'Desenhe qualquer coisa, sem se preocupar se está bonito.'],
    ['⚽', 'Bata uma bola com os amigos — só pelo prazer do jogo.'],
    ['🧩', 'Jogue uma partida do jogo da memória aqui ao lado.'],
    ['💌', 'Escreva uma mensagem para você mesmo(a) daqui a um ano.'],
    ['🐶', 'Brinque com seu animal de estimação ou passeie com ele.'],
    ['🧘', 'Faça 3 ciclos da respiração guiada desta página.'],
    ['🗓️', 'Planeje algo legal para o fim de semana que não envolva apostas.'],
    ['🎬', 'Assista a um episódio de uma série de comédia.'],
    ['💰', 'Calcule quanto você economizou desde que parou. Veja em "Minha jornada".'],
  ];
  let ultimaIdeia = -1;
  $('ideiaBtn').addEventListener('click', () => {
    let k;
    do { k = Math.floor(Math.random() * IDEIAS.length); } while (k === ultimaIdeia);
    ultimaIdeia = k;
    $('ideiaIcone').textContent = IDEIAS[k][0];
    $('ideiaTexto').textContent = IDEIAS[k][1];
  });
})();
