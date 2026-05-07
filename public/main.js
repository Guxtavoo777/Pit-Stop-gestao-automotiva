/* ═══════════════════════════════════════════════
   PIT STOP — Client-Side JavaScript v4.0
═══════════════════════════════════════════════ */

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

/* ─── INTERSECTION OBSERVER — scroll animations ─ */
(function () {
  if (!window.IntersectionObserver) {
    // Fallback: make all .an elements visible immediately
    document.querySelectorAll('.an').forEach(function (el) {
      el.classList.add('is-visible');
    });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

  document.querySelectorAll('.an').forEach(function (el) {
    observer.observe(el);
  });
})();

/* ─── NAVBAR SCROLL EFFECT ───────────────────── */
(function () {
  var nav = document.getElementById('topnav');
  if (!nav) return;
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ─── STAT COUNTER ANIMATION ─────────────────── */
(function () {
  if (!window.IntersectionObserver) return;
  var counters = document.querySelectorAll('.stat-value');
  if (!counters.length) return;

  function animateCount(el, target, isCurrency) {
    var start = 0;
    var duration = 900;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      var current = Math.floor(eased * target);
      if (isCurrency) {
        el.textContent = el.dataset.prefix + current.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        el.textContent = current;
      }
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = el.dataset.original;
    }
    requestAnimationFrame(step);
  }

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var text = el.dataset.original || el.textContent.trim();
      el.dataset.original = text;

      // Match "R$ 1.234,56" format
      var currMatch = text.match(/R\$\s*([\d.,]+)/);
      if (currMatch) {
        var num = parseFloat(currMatch[1].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(num) && num > 0) {
          el.dataset.prefix = 'R$ ';
          animateCount(el, num, true);
        }
      } else {
        // Plain integer
        var n = parseInt(text.replace(/\D/g, ''), 10);
        if (!isNaN(n) && n > 1) animateCount(el, n, false);
      }
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(function (el) { obs.observe(el); });
})();

/* ─── PAGE TRANSITION (leave) ────────────────── */
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    // Only same-origin, non-hash, non-download links
    if (!href || href.startsWith('#') || href.startsWith('javascript') ||
        href.startsWith('http') || a.hasAttribute('download') ||
        a.target === '_blank') return;
    e.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(function () { window.location.href = href; }, 180);
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
