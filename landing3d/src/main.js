// Landing do Pit Stop: o carro 3D do pacote ORBO (palco, abertura, cena presa e fecho), com rolagem nativa.
// Sem Lenis e sem freio de roda: a página rola como qualquer outra. A cena 3D só liga quando há WebGL, o movimento
// não está reduzido e o texto está no tamanho padrão; senão a página mostra a versão em lista (CSS .sem-cena).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CELULAR, REDUZIDO } from './ease.js';
import { criarPalco } from './palco.js';
import { cena } from './cena.js';
import { abertura } from './abertura.js';
import { fecho } from './fecho.js';

gsap.registerPlugin(ScrollTrigger);
const html = document.documentElement;

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
const quer3d = () => !REDUZIDO && parseFloat(getComputedStyle(html).fontSize) <= 18.5 && webgl();
const modo3d = quer3d();

// trocar o tamanho do texto pode ligar ou desligar a cena: recarrega só quando o modo muda
document.addEventListener('click', (ev) => {
  if (!ev.target.closest('[data-fonte]')) return;
  setTimeout(() => { if (quer3d() !== modo3d) location.reload(); }, 120);
});

async function iniciar() {
  if (!modo3d) { html.classList.add('sem-cena'); return; }
  html.classList.add('cena-3d');
  history.scrollRestoration = 'manual';

  let palco;
  try {
    [palco] = await Promise.all([criarPalco(document.querySelector('.palco'), { celular: CELULAR }), document.fonts.ready]);
  } catch (e) {
    console.error('Palco 3D indisponível, usando a lista.', e);
    html.classList.remove('cena-3d'); html.classList.add('sem-cena');
    return;
  }
  gsap.ticker.add((_, dt) => palco.quadro(Math.min(dt, 50) / 1000));

  const c = cena(palco);
  abertura(palco, c);
  fecho(palco);

  // o palco só desenha quando a cena presa ou o fecho estão na tela; em cada um, o carro mora numa caixa diferente
  const e = palco.estado;
  const secCena = document.querySelector('.cena'), secFecho = document.querySelector('.fecho');
  const vagas = { hero: document.querySelector('.hero__vaga'), mapa: document.querySelector('.mapa__vaga'), fecho: document.querySelector('.fecho__vaga') };
  const naTela = (s) => { const r = s.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
  let ondeAnt = '';
  function onde() {
    const nc = naTela(secCena), nf = naTela(secFecho);
    const agora = nc ? 'cena' : nf ? 'fecho' : '';
    e.ativo = !!agora;
    if (agora === ondeAnt) return;
    ondeAnt = agora;
    if (agora === 'cena') { e.vagaA = vagas.hero; e.vagaB = vagas.mapa; ScrollTrigger.update(); }
    if (agora === 'fecho') { e.vagaA = vagas.fecho; e.vagaB = null; e.mistura = 0; e.desenho = 0; e.zona = null; }
  }
  gsap.ticker.add(onde, false, true);
  onde();

  // o brilho da pintura segue o cursor no hero (só mouse)
  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (ev) => palco.apontar((ev.clientX / innerWidth) * 2 - 1, (ev.clientY / innerHeight) * 2 - 1), { passive: true });
  }
  window.pitstopCena = c; // o menu usa para rolar até os recursos
  ScrollTrigger.refresh();
}
iniciar();
