// Lightweight 3D viewer: three.js is only fetched when a viewer approaches the screen,
// each example's geometry (compact uint16 binary) is only fetched when selected,
// and frames are only rendered while the viewer is visible and something changes.

const SETS = {
  hor: {
    legend: [['#e5484d', 'Object'], ['#2463eb', 'Hand (MANO)'], ['#969696', 'Gripper']],
    items: [['hor_1', 'Example 1'], ['hor_2', 'Example 2'], ['hor_3', 'Example 3'], ['hor_4', 'Example 4']],
  },
  fga: {
    legend: [['#9ca3af', 'Scene object'], ['#0099ff', 'Target points'], ['#ff0000', 'Aligned memory object']],
    items: [
      '003_pan-spatula', '020_mug-mug', '035_ladle-ladle', '060_scissors-scissors', '099_fork-pan',
      '135_hammer-spoon', '123_measuring_cup-mug', '178_fork-spatula', '005_mortar-mortar',
    ].map((f) => {
      const [a, b] = f.slice(4).split('-').map((s) => s.replace(/_/g, ' '));
      return [f, `${a}<em>&harr;</em>${b}`];
    }),
  },
};

const ICONS = {
  rotate: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M3 12h4M17 12h4M12 3v4M12 17v4"/><circle cx="12" cy="12" r="3"/></svg>',
};

let threeP = null;
const loadThree = () => threeP ??= Promise.all([
  import('three'),
  import('three/addons/controls/OrbitControls.js'),
]);

function build(el) {
  const set = SETS[el.dataset.set];
  el.innerHTML = `
    <div class="viewer-stage">
      <div class="viewer-legend">${set.legend.map(([c, n]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>
      <div class="viewer-tools">
        <button class="on" data-act="rotate" title="Auto-rotate">${ICONS.rotate}</button>
        <button data-act="reset" title="Reset view">${ICONS.reset}</button>
      </div>
      <div class="viewer-status"><div class="bar"><i></i></div></div>
    </div>
    <div class="viewer-chips">${set.items.map(([f, n], i) => `<button class="chip${i ? '' : ' is-active'}" data-f="${f}">${n}</button>`).join('')}</div>`;
  return set;
}

async function fetchBin(url, onProgress) {
  const r = await fetch(url);
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !total) return r.arrayBuffer();
  const reader = r.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, got); got += value.length; onProgress(got / total);
  }
  return out.buffer;
}

async function init(el) {
  const set = build(el);
  const stage = el.querySelector('.viewer-stage');
  const status = el.querySelector('.viewer-status');
  const bar = status.querySelector('i');
  const [THREE, { OrbitControls }] = await loadThree();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 100);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.6;

  let visible = false, dirty = true, group = null, home = null, token = 0;
  const cache = new Map();

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix(); dirty = true;
  };
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0.05 }).observe(stage);
  controls.addEventListener('change', () => { dirty = true; });
  controls.addEventListener('start', () => setRotate(false));

  let raf = 0;
  function loop() {
    if (raf) return;
    const tick = () => {
      raf = 0;
      if (!visible) return;
      const moving = controls.update();
      if (dirty || moving || controls.autoRotate) {
        key.position.copy(camera.position);
        renderer.render(scene, camera); dirty = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  const rotBtn = el.querySelector('[data-act=rotate]');
  function setRotate(on) { controls.autoRotate = on; rotBtn.classList.toggle('on', on); }
  rotBtn.addEventListener('click', () => setRotate(!controls.autoRotate));
  el.querySelector('[data-act=reset]').addEventListener('click', () => { if (home) frame(home); setRotate(true); });

  function frame({ center, radius }) {
    const d = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
    camera.position.copy(center).add(new THREE.Vector3(1.25, 1.25, 1.0).normalize().multiplyScalar(d));
    camera.near = d / 100; camera.far = d * 10; camera.updateProjectionMatrix();
    controls.target.copy(center); controls.update(); dirty = true;
  }

  async function load(f) {
    const my = ++token;
    status.classList.remove('done'); bar.style.width = '0';
    let entry = cache.get(f);
    if (!entry) {
      const [meta, buf] = await Promise.all([
        fetch(`media/3d/${f}.json`).then((r) => r.json()),
        fetchBin(`media/3d/${f}.bin`, (p) => { if (my === token) bar.style.width = `${p * 100}%`; }),
      ]);
      entry = makeGroup(THREE, meta, buf);
      cache.set(f, entry);
    }
    if (my !== token) return;
    if (group) scene.remove(group);
    group = entry.group; scene.add(group);
    home = entry; frame(entry);
    status.classList.add('done');
  }

  el.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
    el.querySelectorAll('.chip').forEach((x) => x.classList.toggle('is-active', x === c));
    load(c.dataset.f);
  }));
  resize();
  await load(set.items[0][0]);
  loop();
}

function makeGroup(THREE, meta, buf) {
  const [lo, hi] = meta.bounds;
  const span = hi.map((h, i) => (h - lo[i]) / 65535);
  const group = new THREE.Group();
  meta.layers.forEach((L, order) => {
    const q = new Uint16Array(buf, L.pos, L.n * 3);
    const pos = new Float32Array(L.n * 3);
    for (let i = 0; i < q.length; i++) pos[i] = lo[i % 3] + q[i] * span[i % 3];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // the light-grey scene mesh disappears on a white stage; draw it a shade darker
    const rgb = L.name === 'Scene Mesh' ? [156, 163, 175] : L.color;
    const color = new THREE.Color().setRGB(...rgb.map((c) => c / 255), THREE.SRGBColorSpace);
    const transparent = L.opacity < 1;
    let obj;
    if (L.kind === 'mesh') {
      g.setIndex(new THREE.BufferAttribute(L.i32 ? new Uint32Array(buf, L.idx, L.tris * 3) : new Uint16Array(buf, L.idx, L.tris * 3), 1));
      obj = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color, flatShading: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide,
        transparent, opacity: L.opacity, depthWrite: !transparent,
      }));
    } else {
      obj = new THREE.Points(g, new THREE.PointsMaterial({
        color, size: (L.size || 2) * 1.1 * Math.min(devicePixelRatio, 2), sizeAttenuation: false,
        transparent, opacity: L.opacity, depthWrite: !transparent,
      }));
    }
    obj.renderOrder = transparent ? 10 + order : order;
    group.add(obj);
  });
  const box = new THREE.Box3().setFromObject(group);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return { group, center: sphere.center, radius: sphere.radius };
}

const vio = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { vio.unobserve(e.target); init(e.target); }
}), { rootMargin: '400px 0px' });
document.querySelectorAll('.viewer').forEach((v) => {
  // reserve layout space before three.js arrives
  v.innerHTML = '<div class="viewer-stage"><div class="viewer-status"><div class="bar"><i></i></div></div></div><div class="viewer-chips"></div>';
  vio.observe(v);
});
