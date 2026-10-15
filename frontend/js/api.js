/* Utilitários compartilhados: chamadas à API, formatação, armazenamento local, sons e confete. */
const Api = {
  // Sem o servidor Java (ex.: GitHub Pages), usa a versão local da API em offline.js.
  semServidor: location.hostname.endsWith('github.io') || location.protocol === 'file:',

  async chamar(metodo, rota, dados) {
    if (!this.semServidor) {
      let res;
      try {
        res = await fetch(`/api/${rota}`, metodo === 'GET' ? { credentials: 'same-origin' } : {
          method: metodo,
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados ?? {}),
        });
      } catch { res = null; }
      if (res && (res.headers.get('Content-Type') || '').includes('application/json')) {
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) {
          const erro = new Error(corpo.erro || `Erro ${res.status}`);
          erro.status = res.status;
          throw erro;
        }
        return corpo;
      }
      this.semServidor = true;
    }
    return ApiLocal.chamar(metodo, rota, dados);
  },
  get(rota) { return this.chamar('GET', rota); },
  post(rota, dados) { return this.chamar('POST', rota, dados); },
  put(rota, dados) { return this.chamar('PUT', rota, dados); },
};

const Util = {
  moeda(v, casas = 0) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: casas, minimumFractionDigits: casas });
  },
  numero(v, casas = 0) {
    return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });
  },
  escapar(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
  },
  ler(chave, padrao) {
    try {
      const v = localStorage.getItem(`recomeco-${chave}`);
      return v === null ? padrao : JSON.parse(v);
    } catch { return padrao; }
  },
  salvar(chave, valor, { silencioso = false } = {}) {
    try { localStorage.setItem(`recomeco-${chave}`, JSON.stringify(valor)); } catch { /* armazenamento indisponível */ }
    // Avisa a conta (conta.js) para sincronizar com o servidor.
    if (!silencioso) window.dispatchEvent(new CustomEvent('dado-salvo', { detail: chave }));
  },
  remover(chave) {
    try { localStorage.removeItem(`recomeco-${chave}`); } catch { /* ignora */ }
  },
  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 3200);
  },
  css(nome) {
    return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  },
  embaralhar(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  movimentoReduzido() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  // ---------- Sons suaves (Web Audio), sem nada que lembre máquinas de cassino ----------
  _audio: null,
  somLigado() { return Util.ler('som', true); },
  som(tipo) {
    if (!Util.somLigado()) return;
    try {
      Util._audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const ctx = Util._audio;
      const notas = {
        clique: [[520, 0.05]],
        pop: [[660, 0.06]],
        acerto: [[523, 0.09], [659, 0.12]],
        erro: [[220, 0.16]],
        nivel: [[523, 0.08], [659, 0.08], [784, 0.14]],
        vitoria: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.22]],
      }[tipo] || [[440, 0.08]];
      let t = ctx.currentTime;
      for (const [freq, dur] of notas) {
        const osc = ctx.createOscillator();
        const ganho = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        ganho.gain.setValueAtTime(0.0001, t);
        ganho.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
        ganho.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(ganho).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur * 0.9;
      }
    } catch { /* áudio indisponível */ }
  },

  // ---------- Confete para comemorar conquistas ----------
  confete(qtd = 120) {
    if (Util.movimentoReduzido()) return;
    const cv = document.getElementById('confete');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cores = [Util.css('--primaria'), Util.css('--sol'), Util.css('--ok'), '#7cc6fe', '#f472b6'];
    const pecas = Array.from({ length: qtd }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.4,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      t: Math.random() * 6 + 4,
      cor: cores[Math.floor(Math.random() * cores.length)],
    }));
    cv.hidden = false;
    const inicio = performance.now();
    const passo = agora => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      pecas.forEach(p => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.t / 2, -p.t / 4, p.t, p.t / 2);
        ctx.restore();
      });
      if (agora - inicio < 2600) requestAnimationFrame(passo);
      else { ctx.clearRect(0, 0, innerWidth, innerHeight); cv.hidden = true; }
    };
    requestAnimationFrame(passo);
  },
};
