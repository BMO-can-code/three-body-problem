import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const G = 1;
const DT = 0.004;
const SOFTENING = 0.02;
const TRAIL_LENGTH = 1000;

const bodyDefs = [
  { mass: 1, color: 0xff6b6b, size: 0.14, pos: [-0.97000436, 0.24308753, 0], vel: [0.4662036850, 0.4323657300, 0] },
  { mass: 1, color: 0x4ecdc4, size: 0.14, pos: [0, 0, 0], vel: [-0.93240737, -0.86473146, 0] },
  { mass: 1, color: 0x45b7d1, size: 0.14, pos: [0.97000436, -0.24308753, 0], vel: [0.4662036850, 0.4323657300, 0] },
];

const initPos = bodyDefs.map(d => new THREE.Vector3(d.pos[0], d.pos[1], d.pos[2]));
const initVel = bodyDefs.map(d => new THREE.Vector3(d.vel[0], d.vel[1], d.vel[2]));

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
for (let i = 0; i < starCount * 3; i++) {
  starPos[i] = (Math.random() - 0.5) * 300;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.6 });
scene.add(new THREE.Points(starsGeo, starMat));

const bodies = [];
const meshes = [];
const trails = [];
const trailHistory = [];

bodyDefs.forEach((def, i) => {
  const body = {
    mass: def.mass,
    pos: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]),
    vel: new THREE.Vector3(def.vel[0], def.vel[1], def.vel[2]),
    acc: new THREE.Vector3(),
  };
  bodies.push(body);

  const geo = new THREE.SphereGeometry(def.size, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.color,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(body.pos);
  scene.add(mesh);
  meshes.push(mesh);

  trailHistory.push([]);

  const trailMat = new THREE.LineBasicMaterial({
    color: def.color,
    transparent: true,
    opacity: 0.35,
  });
  const trailGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(TRAIL_LENGTH * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  trailGeo.setDrawRange(0, 0);
  const trailLine = new THREE.Line(trailGeo, trailMat);
  scene.add(trailLine);
  trails.push(trailLine);
});

function computeAccelerations() {
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].acc.set(0, 0, 0);
  }

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

function updatePhysics() {
  computeAccelerations();
  for (const body of bodies) {
    body.vel.x += body.acc.x * DT;
    body.vel.y += body.acc.y * DT;
    body.vel.z += body.acc.z * DT;
    body.pos.x += body.vel.x * DT;
    body.pos.y += body.vel.y * DT;
    body.pos.z += body.vel.z * DT;
  }
}

function updateMeshes() {
  for (let i = 0; i < bodies.length; i++) {
    meshes[i].position.copy(bodies[i].pos);
  }
}

function updateTrails() {
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    trailHistory[i].push(body.pos.x, body.pos.y, body.pos.z);
    if (trailHistory[i].length > TRAIL_LENGTH * 3) {
      trailHistory[i].splice(0, 3);
    }

    const positions = new Float32Array(trailHistory[i]);
    trails[i].geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trails[i].geometry.setDrawRange(0, trailHistory[i].length / 3);
    trails[i].visible = showTrails;
  }
}

function resetSimulation() {
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].pos.copy(initPos[i]);
    bodies[i].vel.copy(initVel[i]);
    bodies[i].acc.set(0, 0, 0);
    trailHistory[i] = [];
    meshes[i].position.copy(initPos[i]);
    trails[i].geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
    trails[i].geometry.setDrawRange(0, 0);
  }
}

let running = true;
let speed = 1;
let showTrails = true;

document.getElementById('pauseBtn').addEventListener('click', () => {
  running = !running;
  document.getElementById('pauseBtn').textContent = running ? '⏸' : '▶';
});

document.getElementById('resetBtn').addEventListener('click', resetSimulation);

document.getElementById('speedSlider').addEventListener('input', (e) => {
  speed = parseFloat(e.target.value);
  document.getElementById('speedLabel').textContent = speed.toFixed(1) + '\u00d7';
});

document.getElementById('trailToggle').addEventListener('change', (e) => {
  showTrails = e.target.checked;
});

function animate() {
  requestAnimationFrame(animate);

  if (running) {
    for (let s = 0; s < Math.ceil(speed); s++) {
      updatePhysics();
    }
    updateMeshes();
    updateTrails();
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
