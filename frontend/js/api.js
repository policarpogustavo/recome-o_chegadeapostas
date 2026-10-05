/* Utilitários compartilhados: chamadas à API, formatação e armazenamento local. */
const Api = {
  async get(rota) {
    const res = await fetch(`/api/${rota}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).erro || `Erro ${res.status}`);
    return res.json();
  },
  async post(rota, dados) {
    const res = await fetch(`/api/${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(corpo.erro || `Erro ${res.status}`);
    return corpo;
  },
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
