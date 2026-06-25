import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const G = 1;
const DT = 0.004;
const SOFTENING = 0.02;
const TRAIL_LENGTH = 1200;

const PRESETS = {
  'Figure-8': [
    { mass: 1, color: '#ff6b6b', size: 0.14, pos: [-0.97000436, 0.24308753, 0], vel: [0.4662036850, 0.4323657300, 0] },
    { mass: 1, color: '#4ecdc4', size: 0.14, pos: [0, 0, 0], vel: [-0.93240737, -0.86473146, 0] },
    { mass: 1, color: '#45b7d1', size: 0.14, pos: [0.97000436, -0.24308753, 0], vel: [0.4662036850, 0.4323657300, 0] },
  ],
  'Butterfly I': [
    { mass: 1, color: '#ff6b6b', size: 0.14, pos: [-0.775, 0.277, 0], vel: [0.476, 0.400, 0] },
    { mass: 1, color: '#4ecdc4', size: 0.14, pos: [0, 0, 0], vel: [-0.952, -0.800, 0] },
    { mass: 1, color: '#45b7d1', size: 0.14, pos: [0.775, -0.277, 0], vel: [0.476, 0.400, 0] },
  ],
  'Butterfly II': [
    { mass: 1, color: '#ff6b6b', size: 0.14, pos: [-0.605, 0.344, 0], vel: [0.511, 0.338, 0] },
    { mass: 1, color: '#4ecdc4', size: 0.14, pos: [0, 0, 0], vel: [-1.022, -0.676, 0] },
    { mass: 1, color: '#45b7d1', size: 0.14, pos: [0.605, -0.344, 0], vel: [0.511, 0.338, 0] },
  ],
  'Moth I': [
    { mass: 1, color: '#ff6b6b', size: 0.14, pos: [-0.485, 0.345, 0], vel: [0.460, 0.307, 0] },
    { mass: 1, color: '#4ecdc4', size: 0.14, pos: [0, 0, 0], vel: [-0.920, -0.614, 0] },
    { mass: 1, color: '#45b7d1', size: 0.14, pos: [0.485, -0.345, 0], vel: [0.460, 0.307, 0] },
  ],
  'Chaotic': [
    { mass: 1.2, color: '#ff6b6b', size: 0.16, pos: [-1.2, 0.5, 0.3], vel: [0.3, 0.4, 0.1] },
    { mass: 0.8, color: '#4ecdc4', size: 0.12, pos: [1.0, -0.3, -0.2], vel: [-0.2, -0.5, -0.1] },
    { mass: 1.0, color: '#45b7d1', size: 0.14, pos: [0.2, 1.0, 0.1], vel: [-0.1, 0.1, 0] },
  ],
};

let bodies = [];
let meshes = [];
let trails = [];
let trailHistory = [];
let glows = [];
let currentPreset = 'Figure-8';
let running = true;
let speed = 1;
let showTrails = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(3, 1.5, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('container').appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0x404060, 0.4);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0x8888ff, 0.5);
dirLight2.position.set(-5, -3, -5);
scene.add(dirLight2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1;
controls.maxDistance = 30;
controls.target.set(0, 0, 0);

const starsGeo = new THREE.BufferGeometry();
const starCount = 3000;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 300;
starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.6 })));

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
const glowTexture = createGlowTexture();

function loadPreset(name) {
  const defs = PRESETS[name];
  if (!defs) return;
  currentPreset = name;

  for (const m of meshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  for (const t of trails) { scene.remove(t); t.geometry.dispose(); t.material.dispose(); }
  for (const g of glows) { scene.remove(g); g.material.dispose(); }

  bodies = [];
  meshes = [];
  trails = [];
  trailHistory = [];
  glows = [];

  for (const def of defs) {
    const body = {
      mass: def.mass,
      pos: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]),
      vel: new THREE.Vector3(def.vel[0], def.vel[1], def.vel[2]),
      acc: new THREE.Vector3(),
    };
    bodies.push(body);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(def.size, 32, 32),
      new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.3 })
    );
    sphere.position.copy(body.pos);
    scene.add(sphere);
    meshes.push(sphere);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture, color: def.color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.scale.set(1.5, 1.5, 1);
    glow.position.copy(body.pos);
    scene.add(glow);
    glows.push(glow);

    trailHistory.push([]);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
    trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.35 }));
    scene.add(trail);
    trails.push(trail);
  }

  document.getElementById('presetSelect').value = name;
}

function resetSimulation() {
  const defs = PRESETS[currentPreset];
  if (!defs) return;
  for (let i = 0; i < bodies.length; i++) {
    const d = defs[i];
    bodies[i].pos.set(d.pos[0], d.pos[1], d.pos[2]);
    bodies[i].vel.set(d.vel[0], d.vel[1], d.vel[2]);
    bodies[i].acc.set(0, 0, 0);
    trailHistory[i] = [];
    meshes[i].position.copy(bodies[i].pos);
    glows[i].position.copy(bodies[i].pos);
    trails[i].geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
    trails[i].geometry.setDrawRange(0, 0);
  }
}

function computeAccelerations() {
  for (const b of bodies) b.acc.set(0, 0, 0);
  const dir = new THREE.Vector3();
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      dir.copy(bodies[j].pos).sub(bodies[i].pos);
      const distSq = dir.lengthSq() + SOFTENING * SOFTENING;
      const dist = Math.sqrt(distSq);
      const force = G / distSq;
      const f = dir.clone().multiplyScalar(force / dist);
      bodies[i].acc.add(f.clone().multiplyScalar(bodies[j].mass));
      bodies[j].acc.sub(f.clone().multiplyScalar(bodies[i].mass));
    }
  }
}

function computeEnergy() {
  let KE = 0, PE = 0;
  const dir = new THREE.Vector3();
  for (const b of bodies) KE += 0.5 * b.mass * b.vel.lengthSq();
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      dir.copy(bodies[i].pos).sub(bodies[j].pos);
      PE -= G * bodies[i].mass * bodies[j].mass / Math.max(dir.length(), 0.001);
    }
  }
  return { KE, PE, total: KE + PE };
}

function updatePhysics() {
  computeAccelerations();
  for (const b of bodies) {
    b.vel.x += b.acc.x * DT;
    b.vel.y += b.acc.y * DT;
    b.vel.z += b.acc.z * DT;
    b.pos.x += b.vel.x * DT;
    b.pos.y += b.vel.y * DT;
    b.pos.z += b.vel.z * DT;
  }
}

function updateVisuals() {
  for (let i = 0; i < bodies.length; i++) {
    meshes[i].position.copy(bodies[i].pos);
    glows[i].position.copy(bodies[i].pos);

    trailHistory[i].push(bodies[i].pos.x, bodies[i].pos.y, bodies[i].pos.z);
    if (trailHistory[i].length > TRAIL_LENGTH * 3) trailHistory[i].splice(0, 3);

    const positions = new Float32Array(trailHistory[i]);
    trails[i].geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trails[i].geometry.setDrawRange(0, trailHistory[i].length / 3);
    trails[i].visible = showTrails;
  }

  const e = computeEnergy();
  document.getElementById('keValue').textContent = e.KE.toFixed(4);
  document.getElementById('peValue').textContent = e.PE.toFixed(4);
  document.getElementById('totalValue').textContent = e.total.toFixed(4);
}

function perturb() {
  for (const b of bodies) {
    b.vel.x += (Math.random() - 0.5) * 0.05;
    b.vel.y += (Math.random() - 0.5) * 0.05;
    b.vel.z += (Math.random() - 0.5) * 0.05;
  }
}

document.getElementById('presetSelect').addEventListener('change', (e) => {
  loadPreset(e.target.value);
  resetSimulation();
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  running = !running;
  document.getElementById('pauseBtn').textContent = running ? '⏸' : '▶';
});

document.getElementById('resetBtn').addEventListener('click', resetSimulation);
document.getElementById('perturbBtn').addEventListener('click', perturb);

document.getElementById('speedSlider').addEventListener('input', (e) => {
  speed = parseFloat(e.target.value);
  document.getElementById('speedLabel').textContent = speed.toFixed(1) + '\u00d7';
});

document.getElementById('trailToggle').addEventListener('change', (e) => { showTrails = e.target.checked; });
document.getElementById('autoRotateToggle').addEventListener('change', (e) => {
  controls.autoRotate = e.target.checked;
  controls.autoRotateSpeed = 1.5;
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') { e.preventDefault(); document.getElementById('pauseBtn').click(); }
  if (e.code === 'KeyR') { e.preventDefault(); resetSimulation(); }
  if (e.code === 'KeyP') { e.preventDefault(); perturb(); }
});

loadPreset('Figure-8');

function animate() {
  requestAnimationFrame(animate);
  if (running) {
    for (let s = 0; s < Math.ceil(speed); s++) updatePhysics();
    updateVisuals();
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
