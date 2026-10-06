/* Utilitários compartilhados: chamadas à API, formatação e armazenamento local. */
const Api = {
  // Sem o servidor Java (ex.: GitHub Pages), usa a versão local da API em offline.js.
  semServidor: location.hostname.endsWith('github.io') || location.protocol === 'file:',

  async chamar(metodo, rota, dados) {
    if (!this.semServidor) {
      let res;
      try {
        res = await fetch(`/api/${rota}`, metodo === 'GET' ? undefined : {
          method: metodo,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados),
        });
      } catch { res = null; }
      if (res && (res.headers.get('Content-Type') || '').includes('application/json')) {
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.erro || `Erro ${res.status}`);
        return corpo;
      }
      this.semServidor = true;
    }
    return ApiLocal.chamar(metodo, rota, dados);
  },
  get(rota) { return this.chamar('GET', rota); },
  post(rota, dados) { return this.chamar('POST', rota, dados); },
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
  salvar(chave, valor) {
    try { localStorage.setItem(`recomeco-${chave}`, JSON.stringify(valor)); } catch { /* armazenamento indisponível */ }
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
};
