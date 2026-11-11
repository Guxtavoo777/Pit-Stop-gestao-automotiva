/* Landing do Pit Stop — menu, cor da nav, links internos e dúvidas.
   A cena 3D (carro, abertura, mapa e fecho) fica em /landing3d/landing3d.js.
   Rolagem sempre nativa: nada aqui segura, atrasa ou captura a roda do mouse. */
(function () {
  var de = document.documentElement;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ─── Menu em tela cheia ─── */
  var menu = $('#menu'), btn = $('#btnMenu'), nav = $('#nav');
  menu.setAttribute('inert', '');
  function abrir(sim) {
    btn.setAttribute('aria-expanded', String(sim));
    menu.classList.toggle('is-aberto', sim);
    if (sim) { menu.removeAttribute('inert'); nav.dataset.menu = '1'; var a = $('a', menu); if (a) a.focus({ preventScroll: true }); }
    else { menu.setAttribute('inert', ''); nav.dataset.menu = ''; }
    tema();
  }
  window.fecharMenu = function () { abrir(false); btn.focus(); };
  btn.addEventListener('click', function () { abrir(btn.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') window.fecharMenu(); });

  /* ─── Links internos: "Recursos" para no começo do mapa, dentro da cena presa ─── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    var alvo = id === 'recursos' && window.pitstopCena ? window.pitstopCena.posicaoServicos() : document.getElementById(id);
    if (alvo == null) return;
    e.preventDefault();
    if (btn.getAttribute('aria-expanded') === 'true') abrir(false);
    var topo = typeof alvo === 'number' ? alvo : alvo.getBoundingClientRect().top + window.scrollY;
    var reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: topo, behavior: reduz ? 'auto' : 'smooth' });
    if (typeof alvo !== 'number') { alvo.setAttribute('tabindex', '-1'); alvo.focus({ preventScroll: true }); }
  });

  /* ─── Cor da nav: tinta sobre o papel (mapa e dúvidas), branca no resto ─── */
  var papel = $('.mapa__papel'), mapa = $('#recursos'), duvidas = $('#duvidas'), tick = false;
  function sob(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.top <= 36 && r.bottom > 36; }
  function tema() {
    tick = false;
    var claro = de.classList.contains('cena-3d') ? sob(papel) : sob(mapa);
    claro = claro || sob(duvidas);
    if (nav.dataset.menu) claro = false;
    nav.dataset.tema = claro ? 'claro' : 'escuro';
    var cena = $('.cena'), fora = cena && (de.classList.contains('cena-3d') ? cena.getBoundingClientRect().bottom <= 36 : window.scrollY > 80);
    nav.dataset.fora = fora ? '1' : '';
  }
  window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(tema); } }, { passive: true });
  window.addEventListener('resize', tema);
  tema();

  /* ─── Dúvidas: uma aberta por vez ─── */
  var caixas = $$('.caixas details');
  caixas.forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) caixas.forEach(function (o) { if (o !== d) o.open = false; }); }); });
})();
