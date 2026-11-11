// Texto por máscara de linha: entra subindo por dentro da máscara (folga para acento e descendente em base.css)
// e sai no lugar, sem atravessar a máscara. Nunca preso ao scroll: cada cena chama entrar()/sair() num marco.
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { REDUZIDO } from './ease.js';

gsap.registerPlugin(SplitText);

export function linhas(el) {
  const s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'ln' });
  const L = s.lines;
  let dentro = false;
  gsap.set(L, REDUZIDO ? { opacity: 0 } : { yPercent: 140, opacity: 0 });

  return {
    el,
    get dentro() { return dentro; },
    entrar(atraso = 0, dur = 1.05) {
      dentro = true;
      gsap.killTweensOf(L);
      if (REDUZIDO) return gsap.to(L, { opacity: 1, duration: 0.4, delay: atraso });
      gsap.set(L, { yPercent: 140, opacity: 0 });
      // a opacidade acende junto com a subida de cada linha (parada embaixo, nada aparece na folga da máscara)
      gsap.to(L, { opacity: 1, duration: 0.18, ease: 'none', stagger: 0.085, delay: atraso });
      return gsap.to(L, { yPercent: 0, duration: dur, ease: 'ob-out', stagger: 0.085, delay: atraso });
    },
    sair(dur = 0.42) {
      dentro = false;
      gsap.killTweensOf(L);
      if (REDUZIDO) return gsap.to(L, { opacity: 0, duration: 0.25 });
      return gsap.to(L, {
        opacity: 0, yPercent: -10, duration: dur, ease: 'ob-in', stagger: 0.03,
        onComplete: () => gsap.set(L, { yPercent: 140, opacity: 0 }),
      });
    },
    // estados imediatos (pulo de navegação, volta rápida)
    ja(visivel) {
      dentro = visivel;
      gsap.killTweensOf(L);
      gsap.set(L, REDUZIDO ? { opacity: visivel ? 1 : 0 } : { yPercent: visivel ? 0 : 140, opacity: visivel ? 1 : 0 });
    },
  };
}

// grupo de textos que entram juntos, com um atraso em cascata
export function grupo(els, passo = 0.08) {
  const g = els.filter(Boolean).map(linhas);
  return {
    entrar(atraso = 0) { g.forEach((l, i) => l.entrar(atraso + i * passo)); },
    sair() { g.forEach((l) => l.sair()); },
    ja(v) { g.forEach((l) => l.ja(v)); },
  };
}

// elementos que não são texto corrido (botões, painéis): sobem e aparecem. autoAlpha: escondidos, saem também
// do Tab (nada recebe foco invisível)
export function pecas(els) {
  const E = els.filter(Boolean);
  gsap.set(E, REDUZIDO ? { autoAlpha: 0 } : { autoAlpha: 0, y: 26 });
  return {
    entrar(atraso = 0) {
      gsap.killTweensOf(E);
      return gsap.to(E, REDUZIDO ? { autoAlpha: 1, duration: 0.4, delay: atraso } : { autoAlpha: 1, y: 0, duration: 1, ease: 'ob-out', stagger: 0.07, delay: atraso });
    },
    sair() {
      gsap.killTweensOf(E);
      return gsap.to(E, { autoAlpha: 0, y: REDUZIDO ? 0 : -8, duration: 0.35, ease: 'ob-in' });
    },
    ja(v) { gsap.killTweensOf(E); gsap.set(E, { autoAlpha: v ? 1 : 0, y: 0 }); },
  };
}
