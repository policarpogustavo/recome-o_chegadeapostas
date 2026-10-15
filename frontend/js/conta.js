/*
 * Conta anônima (apelido e senha): login, cadastro e sincronização dos dados
 * pessoais (jornada, diário, vontades vencidas e recordes) com o servidor Java.
 * O token da sessão fica neste aparelho (Api.token) e vai no header Authorization.
 * Também oferece baixar os dados da conta e apagá-la (LGPD, art. 18).
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
      if (e.status === 401) sessaoEncerrada();
    }
  }

  function sessaoEncerrada() {
    Api.definirToken(null);
    definir({ logado: false, usuario: null });
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
    erro.textContent = Api.estado === 'conectando' ? 'Conectando ao servidor… isso pode levar até um minuto.' : '';
    try {
      const r = await Api.post(modo === 'login' ? 'auth/login' : 'auth/cadastro', { usuario, senha });
      erro.textContent = '';
      Api.definirToken(r.token);
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
    Api.definirToken(null);
    PESSOAIS.forEach(Util.remover);
    location.reload();
  });

  // ------------------------------------------------------------ seus dados (LGPD)

  $('contaExportar').addEventListener('click', async () => {
    const btn = $('contaExportar');
    btn.disabled = true;
    try {
      const dados = await Api.get('usuario/exportar');
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `recomeco-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      if (e.status === 401) sessaoEncerrada();
      Util.toast(e.message);
    } finally {
      btn.disabled = false;
    }
  });

  function mostrarApagar(visivel) {
    $('formApagar').hidden = !visivel;
    $('contaApagarAbrir').hidden = visivel;
    $('apagarErro').textContent = '';
    $('formApagar').reset();
    if (visivel) $('apagarSenha').focus();
  }
  $('contaApagarAbrir').addEventListener('click', () => mostrarApagar(true));
  $('apagarCancelar').addEventListener('click', () => mostrarApagar(false));

  $('formApagar').addEventListener('submit', async e => {
    e.preventDefault();
    const senha = $('apagarSenha').value;
    if (!senha) { $('apagarErro').textContent = 'Digite a sua senha para confirmar.'; return; }
    const btn = $('apagarEnviar');
    btn.disabled = true;
    try {
      clearTimeout(timerSync);
      await Api.apagar('usuario', { senha });
      Api.definirToken(null);
      PESSOAIS.forEach(Util.remover);
      $('modalConta').close();
      Util.toast('Sua conta e todos os dados dela foram apagados.');
      setTimeout(() => location.reload(), 2500);
    } catch (err) {
      if (err.status === 401) { sessaoEncerrada(); $('modalConta').close(); }
      $('apagarErro').textContent = err.message;
      btn.disabled = false;
    }
  });

  // ------------------------------------------------------------ início

  (async () => {
    try {
      const r = await Api.get('auth/eu');
      if (!r.logado && !r.indisponivel) Api.definirToken(null); // sessão vencida ou encerrada
      definir({ logado: !!r.logado, usuario: r.usuario, disponivel: !r.indisponivel });
      if (r.logado) await puxar();
    } catch {
      definir({ logado: false, usuario: null });
    }
    resolverPronto({ ...estado });
  })();

  return { estado, pronto, abrir };
})();
