/* "Minha jornada": contador de dias sem apostar, economia, metas, conquistas e diário (localStorage). */
(() => {
  const MARCOS = [
    { dias: 1, icone: '🌱', nome: '1º dia' },
    { dias: 3, icone: '🌿', nome: '3 dias' },
    { dias: 7, icone: '🌳', nome: '1 semana' },
    { dias: 14, icone: '⭐', nome: '2 semanas' },
    { dias: 30, icone: '🏅', nome: '1 mês' },
    { dias: 60, icone: '💎', nome: '2 meses' },
    { dias: 90, icone: '🏆', nome: '3 meses' },
    { dias: 180, icone: '🌄', nome: '6 meses' },
    { dias: 365, icone: '👑', nome: '1 ano' },
  ];
  const HUMORES = { 5: '😄', 4: '🙂', 3: '😐', 2: '😔', 1: '😣' };
  const CIRC = 326.7;

  const $ = id => document.getElementById(id);
  let estado = Util.ler('jornada', { inicio: null, gasto: 0, recaidas: 0, metaNome: '', metaValor: 0 });
  let humorEscolhido = null;

  const hoje = () => new Date(new Date().toDateString());
  const dataLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function diasSem() {
    if (!estado.inicio) return 0;
    const [a, m, d] = estado.inicio.split('-').map(Number);
    return Math.max(0, Math.round((hoje() - new Date(a, m - 1, d)) / 86400000));
  }

  function render() {
    const dias = diasSem();
    $('diasNum').textContent = Util.numero(dias);
    $('dataInicio').value = estado.inicio || '';
    $('dataInicio').max = dataLocal(hoje());
    $('gastoJornada').value = estado.gasto || '';
    $('metaNome').value = estado.metaNome || '';
    $('metaValor').value = estado.metaValor || '';

    const prox = MARCOS.find(m => m.dias > dias);
    const ant = [...MARCOS].reverse().find(m => m.dias <= dias);
    const base = ant ? ant.dias : 0;
    const progresso = prox ? (dias - base) / (prox.dias - base) : 1;
    $('anelValor').style.strokeDashoffset = CIRC * (1 - progresso);

    const vontades = Util.ler('vontades-vencidas', 0);
    if (!estado.inicio) {
      $('proximaMeta').textContent = 'Defina a data abaixo para começar.';
    } else {
      const falta = prox ? `Faltam ${prox.dias - dias} dia(s) para ${prox.icone} ${prox.nome}.` : 'Você passou de 1 ano! Inspiração pura. 👑';
      $('proximaMeta').textContent = falta + (vontades ? ` Vontades vencidas: ${vontades}.` : '');
    }

    const economia = (estado.gasto / 30) * dias;
    $('economia').textContent = Util.moeda(economia);
    $('economiaTxt').textContent = estado.gasto
      ? `Baseado em ${Util.moeda(estado.gasto)} por mês. Em um ano sem apostar: ${Util.moeda(estado.gasto * 12)}.`
      : 'Informe quanto gastava por mês para calcular.';

    if (estado.metaValor > 0) {
      const pct = Math.min(100, (economia / estado.metaValor) * 100);
      $('metaBarra').style.width = `${pct}%`;
      const nome = estado.metaNome ? `"${estado.metaNome}"` : 'seu objetivo';
      $('metaTxt').textContent = pct >= 100
        ? `🎉 Você já preservou o suficiente para ${nome}!`
        : `${Util.numero(pct)}% de ${nome}. ${estado.gasto ? `Faltam cerca de ${Math.ceil((estado.metaValor - economia) / (estado.gasto / 30))} dias.` : ''}`;
    } else {
      $('metaBarra').style.width = '0';
      $('metaTxt').textContent = '';
    }

    $('conquistas').innerHTML = MARCOS.map(m =>
      `<li class="${estado.inicio && dias >= m.dias ? 'ganha' : ''}" title="${m.nome} sem apostar"><span>${m.icone}</span>${m.nome}</li>`).join('');

    renderDiario();
  }

  function renderDiario() {
    const lista = Util.ler('diario', []);
    $('diarioLista').innerHTML = lista.slice(0, 7).map(d => `
      <li>
        <span>${HUMORES[d.humor] || '📝'}</span>
        <span>${d.texto ? Util.escapar(d.texto) : '<small>Sem anotação</small>'}${d.vontade ? ' <small>· senti vontade e resisti 💪</small>' : ''}</span>
        <small>${new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</small>
      </li>`).join('');
  }

  function salvar() {
    Util.salvar('jornada', estado);
    render();
  }

  $('formJornada').addEventListener('submit', e => {
    e.preventDefault();
    const data = $('dataInicio').value;
    if (!data) return Util.toast('Escolha a data do último dia em que apostou.');
    if (data > dataLocal(hoje())) return Util.toast('A data não pode estar no futuro.');
    estado.inicio = data;
    estado.gasto = Math.max(0, Number($('gastoJornada').value) || 0);
    salvar();
    Util.toast(diasSem() === 0 ? 'Jornada iniciada! O primeiro dia começa agora. 🌱' : `Que orgulho: ${diasSem()} dia(s) sem apostar!`);
  });

  ['metaNome', 'metaValor'].forEach(id => $(id).addEventListener('change', () => {
    estado.metaNome = $('metaNome').value.trim();
    estado.metaValor = Math.max(0, Number($('metaValor').value) || 0);
    salvar();
  }));

  $('btnRecaida').addEventListener('click', () => {
    if (!estado.inicio) return Util.toast('Você ainda não começou a contar os dias.');
    if (!confirm('Tudo bem. Recaídas fazem parte de muitas recuperações. Reiniciar o contador a partir de hoje?')) return;
    estado.recaidas = (estado.recaidas || 0) + 1;
    estado.inicio = dataLocal(hoje());
    salvar();
    Util.toast('Contador reiniciado. O que você aprendeu continua com você. 💚');
  });

  $('humor').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    humorEscolhido = Number(b.dataset.humor);
    $('humor').querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b));
  });
  $('humor').querySelectorAll('button').forEach(b => { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); });

  $('btnDiario').addEventListener('click', () => {
    if (!humorEscolhido) return Util.toast('Escolha como você está se sentindo.');
    const lista = Util.ler('diario', []);
    lista.unshift({ humor: humorEscolhido, texto: $('diarioTexto').value.trim(), vontade: $('diarioVontade').checked, data: new Date().toISOString() });
    Util.salvar('diario', lista.slice(0, 60));
    $('diarioTexto').value = '';
    $('diarioVontade').checked = false;
    humorEscolhido = null;
    $('humor').querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', 'false'));
    renderDiario();
    Util.toast('Dia registrado. Obrigado por cuidar de você.');
  });

  // Usado pelo resultado da avaliação para preencher o gasto mensal
  window.definirGastoJornada = gasto => {
    if (gasto > 0 && !estado.gasto) { estado.gasto = gasto; salvar(); }
  };
  addEventListener('jornada', render);

  render();
})();
