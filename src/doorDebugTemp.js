import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const app = document.getElementById("app");
const statusEl = document.getElementById("status");
const animListEl = document.getElementById("animList");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.4, 1.8, 3.4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const keyLight = new THREE.DirectionalLight(0xfff2d8, 1.0);
keyLight.position.set(4, 6, 2);
scene.add(keyLight);

const fill = new THREE.PointLight(0x9cc8ff, 0.45, 20);
fill.position.set(-3, 2, -2);
scene.add(fill);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0x1a1f27, roughness: 0.94, metalness: 0.02 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

let mixer = null;
let actions = [];
let modelRoot = null;

function normalizeModelHeight(root, targetHeight = 2.8) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.min.y === Infinity || box.max.y === -Infinity) return;

  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0) {
    const s = targetHeight / size.y;
    root.scale.multiplyScalar(s);
  }

  box.setFromObject(root);
  if (box.min.y !== Infinity) {
    root.position.y -= box.min.y;
  }
}

function clearActions() {
  actions.forEach((a) => a.stop());
}

function playActionByIndex(index, { loop = "once", reverse = false } = {}) {
  if (!actions[index]) return;
  clearActions();

  const action = actions[index];
  const duration = action.getClip().duration;

  action.enabled = true;
  action.clampWhenFinished = true;
  action.setLoop(loop === "repeat" ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  action.paused = false;

  if (reverse) {
    action.timeScale = -1;
    action.time = duration;
  } else {
    action.timeScale = 1;
    action.time = 0;
  }

  action.play();
}

function createAnimUI(animations) {
  animListEl.innerHTML = "";
  if (!animations.length) {
    animListEl.innerHTML = '<p class="sub">No se encontraron animaciones en el modelo.</p>';
    return;
  }

  animations.forEach((clip, index) => {
    const item = document.createElement("div");
    item.className = "anim-item";

    const title = document.createElement("p");
    title.className = "anim-name";
    title.textContent = `${index}: ${clip.name || "(sin nombre)"} | duracion: ${clip.duration.toFixed(2)}s`;

    const controlsRow = document.createElement("div");
    controlsRow.className = "controls";

    const playBtn = document.createElement("button");
    playBtn.textContent = "Play";
    playBtn.addEventListener("click", () => playActionByIndex(index, { loop: "once", reverse: false }));

    const reverseBtn = document.createElement("button");
    reverseBtn.textContent = "Play Reverse";
    reverseBtn.addEventListener("click", () => playActionByIndex(index, { loop: "once", reverse: true }));

    const loopBtn = document.createElement("button");
    loopBtn.textContent = "Loop";
    loopBtn.addEventListener("click", () => playActionByIndex(index, { loop: "repeat", reverse: false }));

    controlsRow.append(playBtn, reverseBtn, loopBtn);
    item.append(title, controlsRow);
    animListEl.appendChild(item);
  });
}

const loader = new GLTFLoader();
loader.load(
  "/src/assets/models/door_wood.glb",
  (gltf) => {
    modelRoot = gltf.scene;
    normalizeModelHeight(modelRoot);
    modelRoot.position.set(0, 0, 0);
    scene.add(modelRoot);

    mixer = new THREE.AnimationMixer(modelRoot);
    actions = gltf.animations.map((clip) => mixer.clipAction(clip));

    const names = gltf.animations.map((a, i) => `${i}: ${a.name || "(sin nombre)"}`);
    console.log("[doorDebug] Animaciones detectadas:");
    names.forEach((n) => console.log(" -", n));

    statusEl.textContent = `Cargado. Total animaciones: ${gltf.animations.length}`;
    createAnimUI(gltf.animations);
  },
  undefined,
  (error) => {
    console.error("Error cargando puerta:", error);
    statusEl.textContent = "Error al cargar el modelo. Revisa la consola.";
  }
);

const clock = new THREE.Clock();
function animate() {
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
