// O palco: o DB11 visto de cima, ao vivo. Um canvas fixo por cima das cenas (hero, mapa, fecho) e por baixo das
// seções comuns, que passam por cima dele. Os módulos de motion só mexem no `estado`: em que caixa da página o carro
// fica (vagaA → vagaB), quanto ele já virou desenho técnico, qual área do serviço acende, onde está a faixa de limpeza
// da abertura e quanto ele andou para chegar ou sair. O acabamento é matcap chapado: preto fosco com volume suave e
// borda azul, sem reflexo (PBR com reflexo de estúdio fica realista demais numa página gráfica).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const FOV = 14; // lente longa: quase a vista chapada de cima, como uma planta
const AZUL = [0.3608, 0.2275, 0.1176]; // marrom do Pit Stop #5C3A1E em sRGB (no pacote original era o azul)
const TINTA = [0.0863, 0.0863, 0.0863]; // #161616

// esfera de tons desenhada no canvas: o centro é a superfície virada para a câmera (teto, capô), a borda é a lateral
function matcap(paradas, cx = 0.44, cy = 0.4) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(256 * cx, 256 * cy, 2, 128, 128, 128);
  paradas.forEach(([t, cor]) => r.addColorStop(t, cor));
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// classe de cada malha do DB11 (pelos nomes do arquivo da Black Snow)
function classe(o) {
  const nm = `${o.userData.mat} ${o.name}`;
  if (/^amdb11 |amdb11_roof/.test(nm + ' ') && !/glass|light/.test(nm)) return 'pintura';
  if (/amdb11_rearglass/.test(nm)) return 'lanterna';
  if (/headlightglass/.test(nm)) return 'vidroFarol';
  if (/amdb11_glass/.test(nm)) return 'vidro';
  if (/leather|stitch|interior|gauge|screen|steer|seat|signalstalk|pedal|doorpanel/.test(nm)) return 'interior';
  if (/light|lamp|signal|highbeam|chmsl|reverse/.test(nm)) return 'farol';
  if (/wheel|rim|silver|brake|caliper|bolt/.test(nm)) return 'roda';
  if (/tire|tyre|rubber|etkc|Scene_-_Root/.test(nm)) return 'pneu';
  return 'preto';
}

export async function criarPalco(canvas, { celular = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, celular ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 120);
  camera.up.set(0, 0, -1); // tela para cima = -z; a frente do carro aponta para -x (esquerda)

  // ---------- materiais ----------
  const MC = {
    limpo: matcap([[0, '#3b3430'], [0.5, '#1e1a17'], [0.8, '#0e0c0b'], [0.93, '#2b1a0d'], [1, '#8a5a2b']]),
    sujo: matcap([[0, '#8d877d'], [0.5, '#6d6860'], [0.82, '#4c4945'], [1, '#3a3836']]),
    vidro: matcap([[0, '#665a50'], [0.6, '#302a26'], [0.9, '#1c1816'], [1, '#6b4423']]),
    escuro: matcap([[0, '#26272c'], [0.6, '#111215'], [1, '#08090b']]),
    roda: matcap([[0, '#6a6e76'], [0.6, '#2f3237'], [1, '#121316']]),
  };
  const uPintura = {
    mcLimpo: { value: MC.limpo }, mcSujo: { value: MC.sujo }, brilho: { value: new THREE.Vector2() },
    varredura: { value: 9 }, poeira: { value: 0 }, resolucao: { value: new THREE.Vector2(1, 1) }, origem: { value: new THREE.Vector3() },
  };
  const pintura = new THREE.ShaderMaterial({
    uniforms: uPintura,
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vM;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz; vN = normalize(normalMatrix * normal); vM = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D mcLimpo, mcSujo; uniform vec2 brilho, resolucao; uniform float varredura, poeira; uniform vec3 origem;
      varying vec3 vN; varying vec3 vV; varying vec3 vM;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 vd = normalize(vV);
        vec3 x = normalize(vec3(vd.z, 0.0, -vd.x)); vec3 y = cross(vd, x);
        vec2 uv = vec2(dot(x, n), dot(y, n)) * 0.495 + 0.5;
        vec3 limpo = texture2D(mcLimpo, clamp(uv - brilho * 0.07, 0.01, 0.99)).rgb;
        vec3 sujo = texture2D(mcSujo, uv).rgb;
        vec2 q = (vM - origem).xz;
        sujo *= 0.78 + 0.34 * (ruido(q * 2.3) * 0.6 + ruido(q * 9.0) * 0.4);
        // a faixa de limpeza: diagonal na tela ("/"), andando da esquerda para a direita
        float d = (gl_FragCoord.x - 0.35 * gl_FragCoord.y) / resolucao.x;
        float m = 1.0 - smoothstep(varredura - 0.025, varredura + 0.025, d);
        m = max(m, 1.0 - poeira);
        vec3 cor = mix(sujo, limpo, m);
        cor += vec3(1.0, 0.86, 0.62) * exp(-pow((d - varredura) / 0.012, 2.0)) * poeira * 0.6;
        gl_FragColor = vec4(cor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mat = {
    pintura,
    vidro: new THREE.MeshMatcapMaterial({ matcap: MC.vidro, transparent: true, opacity: 0.88 }),
    vidroFarol: new THREE.MeshBasicMaterial({ color: '#d3d9e2' }),
    lanterna: new THREE.MeshBasicMaterial({ color: '#6e0d0d' }),
    farol: new THREE.MeshBasicMaterial({ color: '#e9edf2' }),
    roda: new THREE.MeshMatcapMaterial({ matcap: MC.roda }),
    pneu: new THREE.MeshMatcapMaterial({ matcap: MC.escuro }),
    preto: new THREE.MeshMatcapMaterial({ matcap: MC.escuro }),
  };

  // ---------- carro ----------
  const carro = new THREE.Group();
  scene.add(carro);
  const draco = new DRACOLoader(); // o three 0.186 acha o decodificador sozinho (o Vite empacota)
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('/modelo/db11.glb');
  const modelo = gltf.scene;
  carro.add(modelo);
  const malhas = [];
  modelo.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.mat = o.material.name;
    const c = classe(o);
    o.userData.classe = c;
    o.material = c === 'interior' ? new THREE.MeshBasicMaterial({ color: o.material.color ? o.material.color.clone().multiplyScalar(0.8) : 0x3a2a20 }) : mat[c];
    malhas.push(o);
  });
  // comprido no x e de frente para a esquerda (-x): gira até o capô ficar do lado do -x
  let b = new THREE.Box3().setFromObject(modelo);
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();
  if (b.getSize(v).z > v.x) modelo.rotation.y = Math.PI / 2;
  modelo.updateMatrixWorld(true);
  const capo = new THREE.Box3();
  malhas.filter((o) => /_hood_/.test(o.name)).forEach((o) => capo.expandByObject(o));
  b = new THREE.Box3().setFromObject(modelo);
  if (capo.getCenter(v).x > b.getCenter(v2).x) modelo.rotation.y += Math.PI;
  modelo.updateMatrixWorld(true);
  const caixa = new THREE.Box3();
  malhas.forEach((o) => caixa.expandByObject(o));
  modelo.position.sub(new THREE.Vector3((caixa.min.x + caixa.max.x) / 2, caixa.min.y, (caixa.min.z + caixa.max.z) / 2));
  modelo.updateMatrixWorld(true);
  caixa.makeEmpty();
  malhas.forEach((o) => caixa.expandByObject(o));
  const tam = caixa.getSize(new THREE.Vector3());

  // interior é só o que fica na cabine (os faróis e o cofre usam os mesmos materiais pretos do painel)
  const cabine = new THREE.Box3();
  malhas.filter((o) => /seat_F|steer/.test(o.name)).forEach((o) => cabine.expandByObject(o));
  cabine.expandByVector(new THREE.Vector3(tam.x * 0.08, 0.5, tam.z * 0.12));
  for (const o of malhas) {
    if (o.userData.classe !== 'interior') continue;
    if (!cabine.containsPoint(new THREE.Box3().setFromObject(o).getCenter(v))) { o.userData.classe = 'preto'; o.material = mat.preto; }
  }

  // área do PPF frontal: capô, para-choque e retrovisores inteiros; a carroceria só até o começo da porta
  const porta = malhas.find((o) => /_door_L_amdb11_0/.test(o.name));
  const corteX = porta ? new THREE.Box3().setFromObject(porta).min.x : caixa.min.x + tam.x * 0.33;
  for (const o of malhas) {
    if (/_(hood|bumper_F)_amdb11_0|_mirror_[LR]_amdb11_mirrors/.test(o.name)) o.userData.ppf = 'inteira';
    else if (/_body_amdb11_0/.test(o.name)) o.userData.ppf = 'corte';
  }

  // sombra de contato: retângulo arredondado desfocado, um pouco maior que o carro
  const sombra = (() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.filter = 'blur(16px)';
    g.fillStyle = '#000';
    g.beginPath();
    g.roundRect(512 * 0.1, 256 * 0.17, 512 * 0.8, 256 * 0.66, 70);
    g.fill();
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(tam.x * 1.25, tam.z * 1.5),
      new THREE.MeshBasicMaterial({ color: '#000', alphaMap: new THREE.CanvasTexture(c), transparent: true, opacity: 0.5, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.renderOrder = -1;
    return m;
  })();
  carro.add(sombra);

  const tela_ = { w: 0, h: 0 }; // tamanho do canvas em px CSS

  // ---------- estado (quem muda são os módulos de motion) ----------
  const estado = {
    vagaA: null, vagaB: null, mistura: 0,
    desenho: 0,
    zona: null, zonaMix: 1, raioX: 0.3,
    varredura: 9, poeira: 0,
    desloc: 0,
    ativo: true,
  };

  // ---------- encaixe: o comprimento do carro na caixa da página ----------
  const ret = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
  const mist = (a, c, t) => ({ x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t, w: a.w + (c.w - a.w) * t, h: a.h + (c.h - a.h) * t });
  let retrato = false;
  function encaixar() {
    const W = tela_.w, H = tela_.h;
    if (!estado.vagaA) return;
    let r = ret(estado.vagaA);
    if (estado.vagaB && estado.mistura > 0) r = mist(r, ret(estado.vagaB), estado.mistura);
    retrato = r.h > r.w * 1.1; // no celular o carro fica de bico para cima
    carro.rotation.y = retrato ? -Math.PI / 2 : 0;
    carro.position.set(retrato ? 0 : estado.desloc, 0, retrato ? estado.desloc : 0);
    const largH = retrato ? tam.z : tam.x, altV = retrato ? tam.x : tam.z;
    const k = Math.max(largH / r.w, altV / r.h); // metros por pixel
    camera.aspect = W / H;
    const altura = (H * k) / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)) + tam.y / 2;
    const cx = (W / 2 - r.x) * k, cz = -(r.y - H / 2) * k;
    camera.position.set(cx, altura, cz);
    camera.lookAt(cx, 0, cz);
    camera.updateProjectionMatrix();
    uPintura.origem.value.copy(carro.position);
  }

  // ponto em cima do carro (frações do comprimento e da largura, frente = -0,5) → pixel na tela
  const pt = new THREE.Vector3();
  function projetar(fx, fz) {
    encaixar(); // a câmera do estado atual (depois de um salto, a do último quadro ainda é a da posição anterior)
    pt.set(fx * tam.x, tam.y * 0.85, fz * tam.z);
    carro.localToWorld(pt).project(camera);
    return { x: (pt.x * 0.5 + 0.5) * tela_.w, y: (-pt.y * 0.5 + 0.5) * tela_.h };
  }

  // ---------- desenho técnico: contorno por normal e profundidade, áreas por máscara ----------
  const tela = new THREE.Scene();
  const telaCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  tela.add(quad);
  const matNormal = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  const zonaVert = 'varying vec3 vM; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vM = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const branco = new THREE.ShaderMaterial({ vertexShader: zonaVert, fragmentShader: 'void main(){ gl_FragColor = vec4(1.0); }', side: THREE.DoubleSide });
  const uCorte = { limite: { value: 0 } };
  const brancoCorte = new THREE.ShaderMaterial({
    uniforms: uCorte, vertexShader: zonaVert, side: THREE.DoubleSide,
    fragmentShader: 'uniform float limite; varying vec3 vM; void main(){ if (vM.x > limite) discard; gl_FragColor = vec4(1.0); }',
  });
  const preto = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const REGRAS = {
    lavagem: (o) => (o.userData.classe === 'interior' ? null : branco),
    polimento: (o) => (o.userData.classe === 'pintura' ? branco : /vidro/.test(o.userData.classe) ? null : preto),
    vitrificacao: (o) => (['pintura', 'vidro', 'roda'].includes(o.userData.classe) ? branco : o.userData.classe === 'vidroFarol' ? null : preto),
    ppf: (o) => (o.userData.ppf === 'inteira' ? branco : o.userData.ppf === 'corte' ? brancoCorte : /vidro/.test(o.userData.classe) ? null : preto),
    interior: (o) => (o.userData.classe === 'interior' ? branco : null), // raio X: sem nada na frente
    farois: (o) => (/headlight/.test(o.name) ? branco : /vidro/.test(o.userData.classe) ? null : preto),
  };

  const matFinal = new THREE.ShaderMaterial({
    uniforms: {
      tCor: { value: null }, tN: { value: null }, tP: { value: null }, tNi: { value: null }, tPi: { value: null },
      tZa: { value: null }, tZb: { value: null }, zMix: { value: 1 }, desenho: { value: 0 }, raioX: { value: 0.3 },
      texel: { value: new THREE.Vector2() }, perto: { value: camera.near }, longe: { value: camera.far },
      tinta: { value: new THREE.Vector3(...TINTA) }, azul: { value: new THREE.Vector3(...AZUL) },
    },
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tCor, tN, tP, tNi, tPi, tZa, tZb; uniform vec2 texel;
      uniform float zMix, desenho, raioX, perto, longe; uniform vec3 tinta, azul;
      varying vec2 vUv;
      float prof(sampler2D t, vec2 o){ float z = texture2D(t, vUv + o * texel).r; return perto * longe / (longe - z * (longe - perto)); }
      vec3 nor(sampler2D t, vec2 o){ return texture2D(t, vUv + o * texel).rgb * 2.0 - 1.0; }
      float borda(sampler2D tn, sampler2D tp){
        // profundidade: laplaciano (degrau, não rampa) em metros; normal: diferença entre vizinhos
        float lap = abs(prof(tp, vec2(-1, 0)) + prof(tp, vec2(1, 0)) + prof(tp, vec2(0, 1)) + prof(tp, vec2(0, -1)) - 4.0 * prof(tp, vec2(0)));
        vec3 c = nor(tn, vec2(0));
        float dn = max(max(1.0 - dot(c, nor(tn, vec2(-1, 0))), 1.0 - dot(c, nor(tn, vec2(1, 0)))), max(1.0 - dot(c, nor(tn, vec2(0, 1))), 1.0 - dot(c, nor(tn, vec2(0, -1)))));
        return max(smoothstep(0.015, 0.05, lap), smoothstep(0.06, 0.16, dn));
      }
      void main(){
        vec4 cor = vec4(0.0);
        if (desenho < 1.0) {
          vec4 c = texture2D(tCor, vUv);
          vec3 s = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
          cor = vec4(linearToOutputTexel(vec4(s, 1.0)).rgb * c.a, c.a);
        }
        if (desenho <= 0.0) { gl_FragColor = cor; return; }
        float z = mix(texture2D(tZa, vUv).r, texture2D(tZb, vUv).r, zMix);
        float linha = max(borda(tN, tP), borda(tNi, tPi) * mix(raioX, 0.9, z));
        vec3 tl = mix(tinta, azul, z * 0.9);
        float zf = z * 0.2;
        float a = linha + zf * (1.0 - linha);
        vec3 dc = (tl * linha + azul * zf * (1.0 - linha)) / max(a, 1e-4);
        gl_FragColor = mix(cor, vec4(dc * a, a), desenho);
      }`,
  });
  quad.material = matFinal;

  const rts = {};
  function alvo(chave, w, h, prof = true) {
    const r = rts[chave];
    if (r && r.width === w && r.height === h) return r;
    r?.dispose();
    return (rts[chave] = new THREE.WebGLRenderTarget(w, h, prof ? { depthTexture: new THREE.DepthTexture(w, h) } : {}));
  }
  // um passe: cada malha recebe o material que a regra der (null esconde)
  function passe(rt, regra) {
    const antes = malhas.map((o) => [o, o.material]);
    for (const o of malhas) { const m = regra(o); if (m) o.material = m; else o.visible = false; }
    sombra.visible = false;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    for (const [o, m] of antes) { o.material = m; o.visible = true; }
    sombra.visible = true;
  }

  let chaveAnt = '', zonaAnt = '-', zonaAtual = '-';
  function mascara(rt, chave) {
    if (REGRAS[chave]) passe(rt, REGRAS[chave]);
    else { renderer.setRenderTarget(rt); renderer.clear(); }
  }
  function desenhar(w, h) {
    // contorno e áreas só são refeitos quando a câmera, o tamanho ou a área mudam
    const chave = `${w}x${h}|${camera.position.toArray().map((n) => n.toFixed(4))}|${carro.position.x.toFixed(4)},${carro.position.z.toFixed(4)}|${carro.rotation.y}`;
    const nova = estado.zona || '-';
    const mudouCamera = chave !== chaveAnt;
    uCorte.limite.value = carro.localToWorld(v.set(corteX, 0, 0)).x;
    if (mudouCamera) {
      passe(alvo('casca', w, h), (o) => (/vidro|lanterna/.test(o.userData.classe) ? null : matNormal));
      passe(alvo('interior', w, h), (o) => (o.userData.classe === 'interior' ? matNormal : null));
      chaveAnt = chave;
    }
    if (nova !== zonaAtual) { zonaAnt = zonaAtual; zonaAtual = nova; }
    else if (!mudouCamera) return;
    // A = área anterior, B = área atual; o motion funde de A para B com estado.zonaMix
    mascara(alvo('zonaA', w, h, false), zonaAnt);
    mascara(alvo('zonaB', w, h, false), zonaAtual);
  }

  // ---------- quadro ----------
  const brilho = { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0 };
  let aceso = false;
  function apontar(nx, ny) { brilho.ax = nx; brilho.ay = ny; }

  function quadro(dt = 1 / 60) {
    // o brilho da pintura segue o cursor numa mola pouco amortecida (passa do ponto e volta)
    const k = 26, c = 3.4;
    brilho.vx += ((brilho.ax - brilho.x) * k - brilho.vx * c) * dt;
    brilho.vy += ((brilho.ay - brilho.y) * k - brilho.vy * c) * dt;
    brilho.x += brilho.vx * dt; brilho.y += brilho.vy * dt;
    if (!estado.ativo) {
      if (aceso) { renderer.setRenderTarget(null); renderer.clear(); aceso = false; } // não deixa quadro velho por cima do fecho
      return;
    }
    aceso = true;
    const w = renderer.domElement.width, h = renderer.domElement.height;
    encaixar();
    uPintura.brilho.value.set(brilho.x, -brilho.y);
    uPintura.varredura.value = estado.varredura;
    uPintura.poeira.value = estado.poeira;
    uPintura.resolucao.value.set(w, h);
    const u = matFinal.uniforms;
    if (estado.desenho <= 0) { // caminho curto: só o carro
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
      return;
    }
    desenhar(w, h);
    if (estado.desenho < 1) {
      const rc = alvo('cor', w, h, false);
      renderer.setRenderTarget(rc);
      renderer.clear();
      renderer.render(scene, camera);
      u.tCor.value = rc.texture;
    }
    u.tN.value = rts.casca.texture; u.tP.value = rts.casca.depthTexture;
    u.tNi.value = rts.interior.texture; u.tPi.value = rts.interior.depthTexture;
    u.tZa.value = rts.zonaA.texture; u.tZb.value = rts.zonaB.texture;
    u.zMix.value = estado.zonaMix; u.desenho.value = estado.desenho; u.raioX.value = estado.raioX;
    u.texel.value.set(1 / w, 1 / h);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(tela, telaCam);
  }

  // aquecimento: compila os shaders e cria os alvos do desenho técnico antes do mapa aparecer, um passe por quadro
  // ocioso (de uma vez, a primeira entrada no mapa travava ~200 ms no celular)
  function aquecer() {
    const fila = [];
    const w = () => renderer.domElement.width, h = () => renderer.domElement.height;
    const u = matFinal.uniforms;
    fila.push(() => passe(alvo('casca', w(), h()), (o) => (/vidro|lanterna/.test(o.userData.classe) ? null : matNormal)));
    fila.push(() => passe(alvo('interior', w(), h()), (o) => (o.userData.classe === 'interior' ? matNormal : null)));
    for (const k of Object.keys(REGRAS)) fila.push(() => mascara(alvo('zonaA', w(), h(), false), k));
    fila.push(() => mascara(alvo('zonaB', w(), h(), false), '-'));
    fila.push(() => {
      const rc = alvo('cor', w(), h(), false);
      renderer.setRenderTarget(rc); renderer.clear(); renderer.render(scene, camera);
      u.tCor.value = rc.texture; u.tN.value = rts.casca.texture; u.tP.value = rts.casca.depthTexture;
      u.tNi.value = rts.interior.texture; u.tPi.value = rts.interior.depthTexture; u.tZa.value = rts.zonaA.texture; u.tZb.value = rts.zonaB.texture;
      u.desenho.value = 0.5;
      renderer.setRenderTarget(alvo('aquece', 8, 8, false)); renderer.render(tela, telaCam);
      renderer.setRenderTarget(null);
      chaveAnt = ''; zonaAtual = '-'; zonaAnt = '-'; // a entrada de verdade refaz tudo
    });
    const ocioso = window.requestIdleCallback || ((f) => setTimeout(f, 60));
    const passo = () => { const t = fila.shift(); if (!t) return; encaixar(); t(); ocioso(passo, { timeout: 400 }); };
    ocioso(passo, { timeout: 400 });
  }

  function medir() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const toque = matchMedia('(hover: none)').matches;
    if (toque && w === tela_.w && Math.abs(h - tela_.h) < 120) return; // barra do navegador indo e vindo
    tela_.w = w; tela_.h = h;
    renderer.setSize(w, h, false);
  }
  medir();
  addEventListener('resize', medir);

  return { estado, quadro, projetar, apontar, aquecer, tam, get retrato() { return retrato; } };
}
