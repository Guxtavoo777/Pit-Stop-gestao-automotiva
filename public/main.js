/* ═══════════════════════════════════════════════
   PIT STOP — Client-Side JavaScript Global
═══════════════════════════════════════════════ */

/* ─── TOASTS ─────────────────────────────────── */
function toast(msg, type) {
  type = type || 'ok';
  var icons = { ok: '✅', erro: '❌', av: '⚠️' };
  var wrap = document.getElementById('toasts');
  if (!wrap) return;
  var el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML =
    '<span style="font-size:1.05rem">' + (icons[type] || 'ℹ️') + '</span>' +
    '<span class="toast-text">' + msg + '</span>';
  wrap.appendChild(el);
  setTimeout(function () {
    el.style.animation = 'toast-out .3s cubic-bezier(.4,0,.2,1) forwards';
    setTimeout(function () { el.remove(); }, 320);
  }, 3400);
}

/* ─── SIDEBAR MOBILE ─────────────────────────── */
(function () {
  var bm = document.getElementById('btn-menu');
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sb-overlay');
  function openSb() {
    if (sb) sb.classList.add('open');
    if (ov) ov.style.display = 'block';
  }
  function closeSb() {
    if (sb) sb.classList.remove('open');
    if (ov) ov.style.display = 'none';
  }
  if (bm) bm.addEventListener('click', openSb);
  if (ov) ov.addEventListener('click', closeSb);
})();

/* ─── ACTIVE NAV HIGHLIGHT ───────────────────── */
(function () {
  var links = document.querySelectorAll('.nav-link');
  var path = window.location.pathname;
  links.forEach(function (a) {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
})();

/* ─── CATALOG FILTER (Explorar page) ─────────── */
function catalogFilter(cat) {
  document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
  var clicked = document.querySelector('.filter-btn[data-cat="' + cat + '"]');
  if (clicked) clicked.classList.add('active');

  document.querySelectorAll('.catalog-card').forEach(function (card) {
    if (cat === 'Todos' || card.dataset.category === cat) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });

  var visible = document.querySelectorAll('.catalog-card:not(.hidden)').length;
  var info = document.getElementById('catalog-count');
  if (info) info.textContent = visible + ' modelo(s) encontrado(s)';
}

/* ─── CATALOG SEARCH ─────────────────────────── */
(function () {
  var inp = document.getElementById('catalog-search');
  if (!inp) return;
  inp.addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var visible = 0;
    document.querySelectorAll('.catalog-card').forEach(function (card) {
      var name = (card.dataset.name || '').toLowerCase();
      var brand = (card.dataset.brand || '').toLowerCase();
      var match = (name + ' ' + brand).indexOf(q) >= 0;
      if (match) { card.classList.remove('hidden'); visible++; }
      else card.classList.add('hidden');
    });
    var info = document.getElementById('catalog-count');
    if (info) info.textContent = visible + ' modelo(s) encontrado(s)';
    // also reset filter buttons
    if (q === '') {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      var all = document.querySelector('.filter-btn[data-cat="Todos"]');
      if (all) all.classList.add('active');
    }
  });
})();
