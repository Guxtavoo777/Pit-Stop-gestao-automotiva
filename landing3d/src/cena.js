// A cena presa: hero → passagem → mapa de serviços, com o mesmo carro do começo ao fim.
// A rolagem dirige só o contínuo (a meia-lua crescendo, o papel subindo, o carro indo da caixa do hero para a do mapa
// e virando desenho). Texto, área acesa e fio do rótulo trocam por marco, com tempo fixo: rolando rápido, cada marco
// termina inteiro, nunca fica meia linha na tela.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { REDUZIDO, CELULAR } from './ease.js';
import { grupo, pecas, linhas } from './split.js';

const faixa = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const suave = (t) => t * t * (3 - 2 * t);

// marcos da cena (fração da rolagem)
const M = { heroSai: 0.03, mapaTitulo: 0.31, servico0: 0.36, passoServico: 0.1 };

export function cena(palco) {
  const sec = document.querySelector('.cena');
  const marca = document.querySelector('.hero__marca');
  const cupula = document.querySelector('.hero__cupula');
  const papel = document.querySelector('.mapa__papel');
  const tituloMapa = document.querySelector('.mapa__titulo');
  const itens = [...document.querySelectorAll('.servico')];
  const fio = document.querySelector('.mapa__fio');
  const path = fio.querySelector('path'), ponto = fio.querySelector('circle');
  const e = palco.estado;

  const heroTitulo = grupo([document.querySelector('.hero__titulo')]);
  const heroBotao = pecas([...document.querySelectorAll('.hero__acoes .botao')]);
  const mapaTitulo = linhas(tituloMapa);
  gsap.set(tituloMapa, { visibility: 'visible' });
  gsap.set(itens, { autoAlpha: 0 });

  // quanto a meia-lua precisa crescer para cobrir a tela inteira
  let escala = 2;
  function medir() {
    const r = cupula.getBoundingClientRect();
    const R = cupula.offsetWidth / 2, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    escala = (Math.max(Math.hypot(cx, cy), Math.hypot(innerWidth - cx, cy)) / R) * 1.03;
    if (atual >= 0) posicionar(atual);
  }

  let heroDentro = true, tituloDentro = false, atual = -1;

  function aplicar(p) {
    // contínuo
    const a = suave(faixa(p, 0.03, 0.17));
    gsap.set(cupula, { scale: 1 + (escala - 1) * a });
    gsap.set(marca, { yPercent: -70 * a, opacity: 1 - faixa(p, 0.04, 0.13) });
    papel.style.setProperty('--papel-y', `${101 * (1 - suave(faixa(p, 0.15, 0.27)))}%`);
    e.mistura = suave(faixa(p, 0.17, 0.31));
    e.desenho = suave(faixa(p, 0.25, 0.33));

    // marcos
    const heroQuer = p < M.heroSai;
    if (heroQuer !== heroDentro) {
      heroDentro = heroQuer;
      if (heroQuer) { heroTitulo.entrar(0); heroBotao.entrar(0.15); } else { heroTitulo.sair(); heroBotao.sair(); }
    }
    const tituloQuer = p >= M.mapaTitulo;
    if (tituloQuer !== tituloDentro) {
      tituloDentro = tituloQuer;
      tituloQuer ? mapaTitulo.entrar(0) : mapaTitulo.sair();
    }
    const i = p < M.servico0 ? -1 : Math.min(itens.length - 1, Math.floor((p - M.servico0) / M.passoServico));
    if (i !== atual) mostrar(i);
  }

  // rótulo do serviço ao lado do carro, com o fio até a área
  function posicionar(i) {
    const li = itens[i];
    const [fx, fz] = li.dataset.ancora.split(',').map(Number);
    const alvo = palco.projetar(fx, fz);
    const W = innerWidth, H = innerHeight;
    let d;
    if (CELULAR) {
      const r = li.getBoundingClientRect();
      d = `M${alvo.x} ${r.top - 14} L${alvo.x} ${alvo.y}`;
    } else {
      const u = Math.min(W / 1456, H / 840);
      const largura = li.offsetWidth, altura = li.offsetHeight;
      const esquerda = li.dataset.lado === 'e';
      const x = esquerda ? 64 * u : W - 64 * u - largura;
      const minTop = esquerda ? tituloMapa.getBoundingClientRect().bottom + 40 * u : 120 * u;
      const y = Math.min(H - 60 * u - altura, Math.max(minTop, alvo.y - altura / 2));
      li.style.left = `${x}px`; li.style.top = `${y}px`;
      const x0 = esquerda ? x + largura + 16 * u : x - 16 * u, y0 = y + 14 * u;
      const xm = esquerda ? Math.min(alvo.x - 40 * u, Math.max(x0 + 20 * u, alvo.x - 40 * u)) : Math.max(alvo.x + 40 * u, x0 - 20 * u);
      d = `M${x0} ${y0} H${xm} L${alvo.x} ${alvo.y}`;
    }
    path.setAttribute('d', d);
    ponto.setAttribute('cx', alvo.x); ponto.setAttribute('cy', alvo.y);
  }

  function mostrar(i) {
    const ant = atual;
    atual = i;
    if (ant >= 0) gsap.to(itens[ant], { autoAlpha: 0, y: -8, duration: 0.3, ease: 'ob-in', overwrite: true });
    gsap.killTweensOf([path, ponto]);
    gsap.to(e, { raioX: i >= 0 && itens[i].dataset.zona === 'interior' ? 0.9 : 0.3, duration: 0.5, overwrite: 'auto' });
    if (i < 0) {
      e.zona = null; e.zonaMix = 0;
      gsap.to(e, { zonaMix: 1, duration: 0.4, ease: 'ob-out' });
      gsap.to(path, { strokeDashoffset: 1000, duration: 0.3, ease: 'ob-in' });
      gsap.to(ponto, { opacity: 0, duration: 0.2 });
      return;
    }
    e.zona = itens[i].dataset.zona; e.zonaMix = 0;
    gsap.to(e, { zonaMix: 1, duration: REDUZIDO ? 0.01 : 0.6, ease: 'ob-out' });
    posicionar(i);
    gsap.fromTo(itens[i], { autoAlpha: 0, y: REDUZIDO ? 0 : 18 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'ob-out', delay: 0.12, overwrite: true });
    gsap.fromTo(path, { strokeDashoffset: 1000 }, { strokeDashoffset: 0, duration: REDUZIDO ? 0.01 : 0.6, ease: 'ob-out', delay: 0.2 });
    gsap.fromTo(ponto, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.6 });
  }

  medir();
  addEventListener('resize', () => { medir(); ScrollTrigger.refresh(); });
  const st = ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom',
    onUpdate: (s) => aplicar(s.progress),
  });
  aplicar(st.progress);

  return {
    titulo: heroTitulo, botao: heroBotao,
    // rolagem até um serviço (links do menu e do rodapé)
    posicaoServicos: () => st.start + (st.end - st.start) * (M.servico0 + 0.02),
    get ativa() { const r = sec.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; },
    papel,
  };
}
