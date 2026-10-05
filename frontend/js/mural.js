/* Mural anônimo de mensagens — lê e publica via API Java. */
(() => {
  const $ = id => document.getElementById(id);
  const TAGS = { superacao: 'Superação', apoio: 'Apoio', familia: 'Família' };

  function tempoRelativo(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'agora mesmo';
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  function cartao(d) {
    return `<article class="recado ${d.equipe ? 'recado--equipe' : ''}">
      <div class="recado__topo">
        <span class="recado__autor">${Util.escapar(d.apelido)}</span>
        <span class="recado__tag recado__tag--${d.tipo}">${TAGS[d.tipo] || 'Apoio'}</span>
      </div>
      <p>${Util.escapar(d.texto)}</p>
      <div class="recado__rodape">
        <span>${d.diasSemApostar > 0 ? `💪 ${Util.numero(d.diasSemApostar)} dias sem apostar` : d.equipe ? 'Mensagem da equipe' : ''}</span>
        <span>${tempoRelativo(d.data)}</span>
      </div>
    </article>`;
  }

  async function carregar() {
    try {
      const lista = await Api.get('depoimentos');
      $('muralLista').innerHTML = lista.length ? lista.map(cartao).join('') : '<p class="vazio">Seja a primeira pessoa a deixar uma mensagem.</p>';
    } catch {
      $('muralLista').innerHTML = '<p class="vazio">Não foi possível carregar o mural.</p>';
    }
  }

  $('muralTexto').addEventListener('input', e => { $('muralConta').textContent = e.target.value.length; });

  // Sugere os dias da jornada, se houver
  const jornada = Util.ler('jornada', null);
  if (jornada?.inicio) {
    const [a, m, d] = jornada.inicio.split('-').map(Number);
    $('muralDias').value = Math.max(0, Math.round((new Date(new Date().toDateString()) - new Date(a, m - 1, d)) / 86400000));
  }

  $('formMural').addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('muralStatus');
    const texto = $('muralTexto').value.trim();
    if (texto.length < 10) { status.className = 'mural__status erro'; status.textContent = 'Escreva pelo menos 10 caracteres.'; return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const novo = await Api.post('depoimentos', {
        apelido: $('muralApelido').value,
        tipo: $('muralTipo').value,
        texto,
        diasSemApostar: Number($('muralDias').value) || 0,
      });
      $('muralLista').querySelector('.vazio')?.remove();
      $('muralLista').insertAdjacentHTML('afterbegin', cartao(novo));
      $('muralTexto').value = '';
      $('muralConta').textContent = '0';
      status.className = 'mural__status ok';
      status.textContent = 'Mensagem publicada. Obrigado por compartilhar! 💚';
    } catch (err) {
      status.className = 'mural__status erro';
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  carregar();
})();
