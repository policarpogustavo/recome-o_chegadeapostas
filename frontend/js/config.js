/*
 * Endereço da API.
 * - Publicado no GitHub Pages: usa o servidor no Render (API_PRODUCAO).
 * - Em localhost: o servidor Java da sua máquina (porta 8080), mesmo abrindo o site pelo Live Server.
 * - Servido pelo próprio Java (ex.: localhost:8080 ou o endereço do Render): mesma origem.
 * Ao trocar API_PRODUCAO, atualize também o connect-src do Content-Security-Policy no index.html.
 */
const Config = (() => {
  const API_PRODUCAO = 'https://recomeco-api.onrender.com';

  const host = location.hostname;
  let apiBase;
  if (location.protocol === 'file:') apiBase = null;  // aberto direto do disco: sem servidor
  else if (host.endsWith('github.io')) apiBase = API_PRODUCAO;
  else if ((host === 'localhost' || host === '127.0.0.1') && location.port !== '8080') apiBase = `http://${host}:8080`;
  else apiBase = '';

  return {
    apiBase,
    /** Depois disso sem resposta, aparece a mensagem "Conectando ao servidor...". */
    avisoAposMs: 1500,
    /** O Render gratuito leva cerca de um minuto para acordar; depois disso, o site passa para o modo offline. */
    esperaMaximaMs: 90_000,
  };
})();
