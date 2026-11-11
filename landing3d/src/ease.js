// Curvas da marca. REDUZIDO: movimento reduzido no sistema (abre direto no hero, sem Lenis, troca sem animação).
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

CustomEase.create('ob-out', '0.16, 1, 0.3, 1');
CustomEase.create('ob-in', '0.7, 0, 0.84, 0');
CustomEase.create('ob-io', '0.86, 0, 0.07, 1');
// o carro freando: chega rápido e assenta sem passar do ponto
CustomEase.create('ob-freio', 'M0,0 C0.12,0.62 0.32,0.94 0.55,0.985 0.75,1.0 0.86,1 1,1');

export const REDUZIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
// celular: tela estreita ou em pé (iPad em pé usa a composição do celular)
export const CELULAR = matchMedia('(max-width: 1023px), (max-aspect-ratio: 4/5)').matches;
