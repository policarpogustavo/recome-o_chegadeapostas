/* Comportamentos gerais: tema, menu, animações, frase do dia e botão de ajuda. */
(() => {
  const raiz = document.documentElement;

  // ---------- Tema ----------
  document.getElementById('btnTema').addEventListener('click', () => {
    const escuroAgora = raiz.dataset.theme
      ? raiz.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    raiz.dataset.theme = escuroAgora ? 'light' : 'dark';
    try { localStorage.setItem('recomeco-tema', raiz.dataset.theme); } catch { /* ignora */ }
    window.dispatchEvent(new Event('tema'));
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => window.dispatchEvent(new Event('tema')));

  // ---------- Menu ----------
  const menu = document.getElementById('menu');
  const btnMenu = document.getElementById('btnMenu');
  btnMenu.addEventListener('click', () => {
    const aberto = menu.classList.toggle('aberto');
    btnMenu.setAttribute('aria-expanded', aberto);
  });
  menu.addEventListener('click', e => {
    if (e.target.tagName === 'A') { menu.classList.remove('aberto'); btnMenu.setAttribute('aria-expanded', false); }
  });

  const topo = document.getElementById('topo');
  addEventListener('scroll', () => topo.classList.toggle('rolado', scrollY > 10), { passive: true });

  // Link ativo conforme a seção visível
  const links = [...menu.querySelectorAll('a')];
  const obsSecao = new IntersectionObserver(entradas => {
    entradas.forEach(en => {
      if (en.isIntersecting) links.forEach(a => a.classList.toggle('ativo', a.hash === `#${en.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(s => obsSecao.observe(s));

  // ---------- Revelar ao rolar ----------
  const obsRevelar = new IntersectionObserver(entradas => {
    entradas.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('visivel');
      obsRevelar.unobserve(en.target);
    });
  }, { threshold: 0.12 });
  window.observarRevelar = el => obsRevelar.observe(el);
  document.querySelectorAll('.revelar').forEach(el => obsRevelar.observe(el));

  // ---------- Contadores animados ----------
  const obsContar = new IntersectionObserver(entradas => {
    entradas.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const alvo = Number(el.dataset.contar);
      const prefixo = el.dataset.prefixo || '';
      const sufixo = el.dataset.sufixo || '';
      const casas = Number(el.dataset.casas || 0);
      const inicio = performance.now();
      const dur = 1800;
      const passo = agora => {
        const t = Math.min(1, (agora - inicio) / dur);
        const v = alvo * (1 - Math.pow(1 - t, 3));
        el.textContent = prefixo + Util.numero(v, casas) + sufixo;
        if (t < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
      obsContar.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-contar]').forEach(el => obsContar.observe(el));

  // ---------- Frase do dia ----------
  const frase = document.getElementById('fraseDia');
  async function trocarFrase() {
    try {
      const { frase: f } = await Api.get('motivacao');
      frase.style.opacity = 0;
      setTimeout(() => { frase.textContent = f; frase.style.opacity = 1; }, 400);
    } catch { /* mantém a frase atual */ }
  }
  trocarFrase();
  setInterval(trocarFrase, 15000);

  // ---------- Botão "Estou com vontade de apostar" ----------
  const modal = document.getElementById('modalSos');
  const tempoEl = document.getElementById('sosTempo');
  const btnIniciar = document.getElementById('sosIniciar');
  let timer = null;

  document.querySelectorAll('[data-abrir-sos]').forEach(b => b.addEventListener('click', () => modal.showModal()));
  document.getElementById('sosFechar').addEventListener('click', () => modal.close());
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  document.getElementById('sosJogos').addEventListener('click', () => modal.close());

  btnIniciar.addEventListener('click', () => {
    clearInterval(timer);
    let restante = 600;
    btnIniciar.textContent = 'Recomeçar';
    const mostrar = () => {
      tempoEl.textContent = `${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`;
    };
    mostrar();
    timer = setInterval(() => {
      restante--;
      mostrar();
      if (restante <= 0) {
        clearInterval(timer);
        tempoEl.textContent = '🎉';
        btnIniciar.textContent = 'Começar de novo';
        const vitorias = Util.ler('vontades-vencidas', 0) + 1;
        Util.salvar('vontades-vencidas', vitorias);
        Util.toast(`Você venceu a vontade! Já são ${vitorias} vez(es).`);
        window.dispatchEvent(new Event('jornada'));
      }
    }, 1000);
  });
})();
