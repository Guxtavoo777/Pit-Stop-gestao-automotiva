// Fecho: card azul com o carro parado no meio e o título revelado por blocos. Quando o rodapé começa a
// aparecer, o carro sai dirigindo pela esquerda (por tempo, de uma vez); subindo de volta, ele volta de ré para a vaga.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { REDUZIDO } from './ease.js';
import { pecas } from './split.js';

export function fecho(palco) {
  const sec = document.querySelector('.fecho');
  const palavras = [...sec.querySelectorAll('.fecho__titulo span')];
  const acoes = pecas([sec.querySelector('.fecho__acoes')]);
  const e = palco.estado;

  // cada palavra: um bloco preto cresce sobre ela e recolhe do outro lado, deixando a palavra
  palavras.forEach((p) => { p.innerHTML = `<i class="fecho__bloco"></i><b>${p.textContent}</b>`; });
  const blocos = palavras.map((p) => p.querySelector('i')), textos = palavras.map((p) => p.querySelector('b'));
  gsap.set(textos, { opacity: 0 });
  gsap.set(blocos, { scaleX: 0, transformOrigin: '0 50%' });

  let mostrado = false;
  function revelar() {
    if (mostrado) return;
    mostrado = true;
    if (REDUZIDO) { gsap.set(textos, { opacity: 1 }); acoes.ja(true); return; }
    const tl = gsap.timeline();
    palavras.forEach((_, i) => {
      tl.to(blocos[i], { scaleX: 1, duration: 0.32, ease: 'ob-io' }, i * 0.12)
        .set(textos[i], { opacity: 1 }, i * 0.12 + 0.32)
        .set(blocos[i], { transformOrigin: '100% 50%' }, i * 0.12 + 0.32)
        .to(blocos[i], { scaleX: 0, duration: 0.36, ease: 'ob-io' }, i * 0.12 + 0.34);
    });
    tl.add(() => acoes.entrar(0), 0.5);
  }
  ScrollTrigger.create({ trigger: sec, start: 'top 60%', once: true, onEnter: revelar });

  // o carro sai: só o deslocamento muda; a vaga continua a mesma
  let saida = null;
  ScrollTrigger.create({
    trigger: '.rodape', start: 'top 92%',
    onEnter: () => { saida?.kill(); saida = gsap.to(e, { desloc: -(palco.retrato ? 12 : 16), duration: REDUZIDO ? 0.01 : 1.5, ease: 'power3.in' }); },
    onLeaveBack: () => { saida?.kill(); saida = gsap.to(e, { desloc: 0, duration: REDUZIDO ? 0.01 : 1.3, ease: 'ob-freio' }); },
  });
}
