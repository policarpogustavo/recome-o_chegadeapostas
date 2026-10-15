/*
 * Conta anônima (apelido e senha): login, cadastro e sincronização dos dados
 * pessoais (jornada, diário, vontades vencidas e recordes) com o servidor Java.
 */
const Conta = (() => {
  const $ = id => document.getElementById(id);

  // Nome no servidor → chave(s) no localStorage
  const SIMPLES = { jornada: 'jornada', diario: 'diario', vontadesVencidas: 'vontades-vencidas' };
  const RECORDES = ['mem-recorde', 'cobra-recorde', 'quiz-recorde', 'velha-placar', 'bolhas-recorde', 'ideias-feitas'];
  const LOCAIS = new Set([...Object.values(SIMPLES), ...RECORDES]);
  const PESSOAIS = [...LOCAIS, 'ultima-avaliacao', 'relato'];

  const estado = { logado: false, usuario: null, disponivel: true };
  let modo = 'login';
  let timerSync = null;
  let resolverPronto;
  const pronto = new Promise(r => { resolverPronto = r; });

  // ------------------------------------------------------------ sincronização

  function coletar() {
    const dados = {};
    for (const [remoto, local] of Object.entries(SIMPLES)) {
      const v = Util.ler(local, undefined);
      if (v !== undefined) dados[remoto] = v;
    }
    const recordes = {};
    RECORDES.forEach(k => { const v = Util.ler(k, undefined); if (v !== undefined) recordes[k] = v; });
    if (Object.keys(recordes).length) dados.recordes = recordes;
    return dados;
  }

  function aplicar(dados) {
    for (const [remoto, local] of Object.entries(SIMPLES)) {
      if (dados[remoto] !== undefined) Util.salvar(local, dados[remoto], { silencioso: true });
    }
    Object.entries(dados.recordes || {}).forEach(([k, v]) => { if (RECORDES.includes(k)) Util.salvar(k, v, { silencioso: true }); });
    window.dispatchEvent(new Event('sincronizado'));
  }

  async function enviar() {
    if (!estado.logado) return;
    try {
      await Api.put('usuario/dados', { dados: coletar() });
      $('contaSync').textContent = `Última sincronização: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
    } catch (e) {
      if (e.status === 401) definir({ logado: false, usuario: null });
    }
  }

  function agendar() {
    clearTimeout(timerSync);
    timerSync = setTimeout(enviar, 1500);
  }

  async function puxar({ novaConta = false } = {}) {
    try {
      const { dados } = await Api.get('usuario/dados');
      if (!novaConta && dados && Object.keys(dados).length) aplicar(dados);
      else if (Object.keys(coletar()).length) await enviar();
    } catch { /* tenta de novo na próxima mudança */ }
  }

  window.addEventListener('dado-salvo', e => { if (estado.logado && LOCAIS.has(e.detail)) agendar(); });
  window.addEventListener('pagehide', () => { if (timerSync) { clearTimeout(timerSync); enviar(); } });

  // ------------------------------------------------------------ interface

  function definir(novo) {
    Object.assign(estado, novo);
    $('contaNome').textContent = estado.logado ? estado.usuario.usuario : 'Entrar';
    $('btnConta').classList.toggle('conta-btn--logado', estado.logado);
    $('btnConta').setAttribute('aria-label', estado.logado ? `Conta de ${estado.usuario.usuario}` : 'Entrar ou criar conta');
    $('contaDeslogado').hidden = estado.logado;
    $('contaLogado').hidden = !estado.logado;
    if (estado.logado) $('contaOla').textContent = estado.usuario.usuario;
    $('formConta').hidden = !estado.disponivel;
    document.querySelector('.abas--conta').hidden = !estado.disponivel;
    $('contaOffline').hidden = estado.disponivel;
    window.dispatchEvent(new CustomEvent('conta', { detail: { ...estado } }));
  }

  function trocarModo(m) {
    modo = m;
    document.querySelectorAll('.abas--conta [data-modo]').forEach(b => b.setAttribute('aria-selected', b.dataset.modo === m));
    $('contaEnviar').textContent = m === 'login' ? 'Entrar' : 'Criar minha conta';
    $('contaSenha').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('contaDica').hidden = m === 'login';
    $('contaErro').textContent = '';
  }

  function abrir(m) {
    if (m) trocarModo(m);
    const modal = $('modalConta');
    if (!modal.open) modal.showModal();
    if (!estado.logado && estado.disponivel) setTimeout(() => $('contaUsuario').focus(), 50);
  }

  $('btnConta').addEventListener('click', () => abrir());
  $('contaFechar').addEventListener('click', () => $('modalConta').close());
  $('modalConta').addEventListener('click', e => { if (e.target === $('modalConta')) $('modalConta').close(); });
  document.querySelectorAll('.abas--conta [data-modo]').forEach(b => b.addEventListener('click', () => trocarModo(b.dataset.modo)));
  ['contaJornada', 'contaAvaliacao'].forEach(id => $(id).addEventListener('click', () => $('modalConta').close()));

  $('formConta').addEventListener('submit', async e => {
    e.preventDefault();
    const usuario = $('contaUsuario').value.trim();
    const senha = $('contaSenha').value;
    const erro = $('contaErro');
    if (usuario.length < 3) { erro.textContent = 'O apelido precisa ter pelo menos 3 caracteres.'; return; }
    if (senha.length < 6) { erro.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
    const btn = $('contaEnviar');
    btn.disabled = true;
    erro.textContent = '';
    try {
      const r = await Api.post(modo === 'login' ? 'auth/login' : 'auth/cadastro', { usuario, senha });
      $('formConta').reset();
      // Leva para a conta a avaliação feita antes do login neste aparelho.
      const ultima = Util.ler('ultima-avaliacao', null);
      if (ultima?.id) await Api.post('avaliacao/vincular', { id: ultima.id }).catch(() => {});
      definir({ logado: true, usuario: r.usuario });
      await puxar({ novaConta: modo === 'cadastro' });
      $('modalConta').close();
      Util.toast(modo === 'login' ? `Bem-vindo(a) de volta, ${r.usuario.usuario}!` : 'Conta criada! Seus dados agora ficam salvos com segurança.');
    } catch (err) {
      erro.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('contaSair').addEventListener('click', async () => {
    clearTimeout(timerSync);
    await enviar();
    try { await Api.post('auth/sair'); } catch { /* sai mesmo assim */ }
    PESSOAIS.forEach(Util.remover);
    location.reload();
  });

  // ------------------------------------------------------------ início

  (async () => {
    try {
      const r = await Api.get('auth/eu');
      definir({ logado: !!r.logado, usuario: r.usuario, disponivel: !r.indisponivel });
      if (r.logado) await puxar();
    } catch {
      definir({ logado: false, usuario: null });
    }
    resolverPronto({ ...estado });
  })();

  return { estado, pronto, abrir };
})();
