/* ═══════════════════════════════════════════════
   PIT STOP — Client-Side JavaScript v5.0
═══════════════════════════════════════════════ */

/* ─── CSRF FETCH INTERCEPTOR ─────────────────── */
(function () {
  var _fetch = window.fetch;
  window.fetch = function (url, opts) {
    opts = opts || {};
    var method = (opts.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      var meta = document.querySelector('meta[name="csrf-token"]');
      if (meta) {
        opts.headers = opts.headers || {};
        opts.headers['x-csrf-token'] = meta.content;
      }
    }
    return _fetch(url, opts);
  };
})();

/* ─── SCROLL ANIMATION OBSERVER ─────────────── */
(function () {
  function showAll() {
    document.querySelectorAll('.an:not(.is-visible)').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }
  if (!window.IntersectionObserver) { showAll(); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.an').forEach(function (el) { io.observe(el); });
  setTimeout(showAll, 400);
})();

/* ─── LOADING STATE UTILITY ──────────────────── */
function withLoading(btn, asyncFn) {
  var original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span>';
  return Promise.resolve(asyncFn()).finally(function () {
    btn.disabled = false;
    btn.innerHTML = original;
  });
}

/* ─── TOASTS ─────────────────────────────────── */
function toast(msg, type) {
  type = type || 'ok';
  var wrap = document.getElementById('toasts');
  if (!wrap) return;
  var el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML =
    '<span class="toast-dot toast-dot-' + type + '"></span>' +
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
    if (q === '') {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      var all = document.querySelector('.filter-btn[data-cat="Todos"]');
      if (all) all.classList.add('active');
    }
  });
})();

/* ─── CONFIRM DIALOG ─────────────────────────── */
var _confirmCb = null;
function confirmDialog(msg, fn) {
  var modal = document.getElementById('confirmModal');
  if (!modal) { if (window.confirm(msg)) fn(); return; }
  document.getElementById('confirmMsg').textContent = msg;
  _confirmCb = fn;
  modal.style.display = 'flex';
  setTimeout(function () { document.getElementById('confirmOkBtn').focus(); }, 50);
}
function _confirmCancel() {
  var modal = document.getElementById('confirmModal');
  if (modal) modal.style.display = 'none';
  _confirmCb = null;
}
document.addEventListener('keydown', function (e) {
  var modal = document.getElementById('confirmModal');
  if (!modal || modal.style.display === 'none') return;
  if (e.key === 'Escape') { _confirmCancel(); }
  if (e.key === 'Enter' && _confirmCb) {
    modal.style.display = 'none';
    var cb = _confirmCb; _confirmCb = null; cb();
  }
});
document.addEventListener('DOMContentLoaded', function () {
  var okBtn = document.getElementById('confirmOkBtn');
  if (okBtn) okBtn.addEventListener('click', function () {
    var modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = 'none';
    if (_confirmCb) { var cb = _confirmCb; _confirmCb = null; cb(); }
  });
});
