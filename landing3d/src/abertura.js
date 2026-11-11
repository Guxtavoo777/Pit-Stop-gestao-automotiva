// Abertura (~2,4 s, por tempo): a faixa diagonal atravessa a tela escura e deixa o azul, o nome
// entra de lado saindo do borrão, o carro chega pela direita empoeirado e freia no lugar, e uma faixa de luz passa por
// ele deixando a pintura limpa. Termina no hero, sem troca. Rolar, clicar ou teclar acelera até o fim; com movimento
// reduzido, ou se a página abriu já rolada, abre direto no hero.
import gsap from 'gsap';
import { REDUZIDO, CELULAR } from './ease.js';

export function abertura(palco, { titulo, botao }) {
  const el = document.querySelector('.abertura');
  const letras = [...document.querySelectorAll('.hero__marca span')];
  const cupula = document.querySelector('.hero__cupula');
  const nav = document.querySelector('.nav');
  const e = palco.estado;

  const fim = () => {
    el.classList.add('is-fim');
    palco.aquecer();
    e.poeira = 0; e.desloc = 0; e.varredura = 9;
    gsap.set(letras, { clearProps: 'all' });
    gsap.set(cupula, { '--sobe': '0%' });
    gsap.set(nav, { clearProps: 'opacity' });
  };
  if (REDUZIDO || scrollY > innerHeight * 0.5) {
    fim();
    titulo.ja(true); botao.ja(true);
    return { pular() {} };
  }

  // a borda da faixa: a mesma diagonal da limpeza no shader ("/"), em px da tela
  const faixa = { s: -0.45 };
  const borda = () => {
    const W = innerWidth, H = innerHeight, x = faixa.s * W, larg = W * 0.16;
    el.style.setProperty('--a2', `${x}px`); el.style.setProperty('--a1', `${x + 0.35 * H}px`);
    el.style.setProperty('--f2', `${x - larg}px`); el.style.setProperty('--f1', `${x - larg + 0.35 * H}px`);
  };
  borda();

  e.poeira = 1; e.varredura = -0.6; e.desloc = CELULAR ? 9 : 14;
  gsap.set(letras, { xPercent: 70, opacity: 0, filter: 'blur(14px)' });
  gsap.set(cupula, { '--sobe': '18%' }); // a escala da meia-lua é da cena; a abertura só a faz subir
  gsap.set(nav, { opacity: 0 });

  const tl = gsap.timeline({ delay: 0.15, onComplete: fim });
  tl.to(faixa, { s: 1.45, duration: 0.95, ease: 'power2.inOut', onUpdate: borda }, 0)
    .to(letras, { xPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.75, ease: 'ob-out', stagger: 0.06 }, 0.22)
    .to(e, { desloc: 0, duration: 1.15, ease: 'ob-freio' }, 0.35)
    .to(cupula, { '--sobe': '0%', duration: 1.0, ease: 'ob-out' }, 0.55)
    // a faixa de luz atravessa só o carro (a diagonal medida na tela: no celular o carro fica em pé), devagar o
    // bastante para ver a pintura ficando preta
    .fromTo(e, { varredura: CELULAR ? -0.36 : 0.08 }, { varredura: CELULAR ? 0.54 : 0.7, duration: 1.05, ease: 'sine.inOut', immediateRender: false }, 1.5)
    .to(nav, { opacity: 1, duration: 0.6, ease: 'none' }, 2.1)
    .add(() => { titulo.entrar(0); botao.entrar(0.25); }, 2.35);

  // pressa: qualquer gesto acelera a abertura até o fim (não segura a página)
  const pressa = () => { if (tl.isActive()) tl.timeScale(5); };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, pressa, { passive: true, once: true }));
  return { pular: pressa };
}
