import "./style.css";
import * as THREE from "three";
import wallUrl from "./assets/textures/textura_amarilla.png";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { generateMap } from "./mapGenerator.js";

const overlay = document.querySelector(".overlay");
const hud = document.querySelector(".hud");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6b5a24);
scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
document.body.appendChild(renderer.domElement);

const playerRig = new THREE.Object3D();
playerRig.position.y = 0;
scene.add(playerRig);
playerRig.add(camera);
camera.position.set(0, 1.6, 0);

// ─── ROTACIÓN MANUAL (reemplaza PointerLockControls) ───────────────────────
let yaw = 0;    // rotación horizontal (Y) — aplicada al playerRig
let pitch = 0;  // rotación vertical   (X) — aplicada a la cámara
let isLocked = false;

const PITCH_LIMIT = Math.PI / 2 - 0.05; // ~85°, evita el flip
const MOUSE_SENSITIVITY = 0.002;

function applyRotation() {
  // Yaw en el rig (giro horizontal del cuerpo)
  playerRig.rotation.y = yaw;
  // Pitch solo en la cámara (mirar arriba/abajo)
  camera.rotation.x = pitch;
}

document.addEventListener("mousemove", (event) => {
  if (!isLocked) return;
  yaw   -= event.movementX * MOUSE_SENSITIVITY;
  pitch -= event.movementY * MOUSE_SENSITIVITY;
  pitch  = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  applyRotation();
});

// ─── POINTER LOCK (sin PointerLockControls) ────────────────────────────────
overlay.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  if (isLocked) {
    overlay.classList.add("hidden");
    hud.classList.remove("hidden");
  } else {
    overlay.classList.remove("hidden");
    hud.classList.add("hidden");
  }
});

// ─── DEBUG CAMERA ──────────────────────────────────────────────────────────
const debugCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
debugCamera.position.set(5, 5, 5);
const debugControls = new OrbitControls(debugCamera, renderer.domElement);
debugControls.enabled = false;
let useDebugCamera = false;

// ─── LUCES ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x5f5a37, 0.08);
scene.add(ambient);

const flashlight = new THREE.SpotLight(0xfff1b5, 3.2, 22, Math.PI / 6, 0.6, 1.2);
flashlight.position.set(0, 0, 0);
flashlight.target.position.set(0, 0, -1);
flashlight.castShadow = false;
camera.add(flashlight);
camera.add(flashlight.target);

const fill = new THREE.PointLight(0xfff5c7, 0.08, 6);
fill.position.set(0, 0, 2.5);
camera.add(fill);

// ─── MODELO LINTERNA ───────────────────────────────────────────────────────
const gltfLoader = new GLTFLoader();
gltfLoader.load("/src/assets/models/flashlight.glb", (gltf) => {
  const model = gltf.scene;
  model.traverse((child) => {
    if (child.isMesh) {
      const oldMat = child.material;
      if (oldMat.emissiveMap || (oldMat.emissive && oldMat.emissive.r > 0)) {
        child.material = new THREE.MeshBasicMaterial({
          map: oldMat.emissiveMap ?? oldMat.map ?? null,
          color: 0xffffcc,
        });
      } else {
        child.material = new THREE.MeshBasicMaterial({
          map: oldMat.map ?? null,
          color: oldMat.map ? 0xffffff : 0x999988,
        });
      }
    }
  });
  model.scale.set(0.001, 0.001, 0.001);
  model.position.set(0.15, -0.10, -0.25);
  model.rotation.y = Math.PI;
  camera.add(model);
});

// ─── TEXTURAS Y MATERIALES ─────────────────────────────────────────────────
const textureLoader = new THREE.TextureLoader();
const wallTexture = textureLoader.load(wallUrl);
wallTexture.colorSpace = THREE.SRGBColorSpace;
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const floorMaterial   = new THREE.MeshStandardMaterial({ color: 0x7a6c2b, roughness: 0.9, metalness: 0.05 });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x5a542b, roughness: 0.95, metalness: 0.02 });
const wallMaterial    = new THREE.MeshStandardMaterial({ map: wallTexture, color: 0xffffff, roughness: 0.9, metalness: 0.02 });

// ─── MAPA ──────────────────────────────────────────────────────────────────
const mapData   = generateMap({ width: 25, height: 25, walkLength: 320 });
const grid      = mapData.grid;
const mapHeight = grid.length;
const mapWidth  = grid[0].length;
const cellSize      = 3;
const wallHeight    = 3.2;
const wallThickness = 0.25;
const halfWidth  = (mapWidth  * cellSize) / 2;
const halfHeight = (mapHeight * cellSize) / 2;

wallTexture.repeat.set(cellSize, wallHeight);

const cellToWorld   = (x, y) => ({ x: x * cellSize - halfWidth + cellSize / 2, z: y * cellSize - halfHeight + cellSize / 2 });
const isWalkableCell = (x, y) => grid[y] && grid[y][x] === 1;

const walkableCells = [];
for (let y = 0; y < mapHeight; y++)
  for (let x = 0; x < mapWidth; x++)
    if (isWalkableCell(x, y)) walkableCells.push({ x, y });

const floorGeometry   = new THREE.PlaneGeometry(1, 1);
const floorMesh       = new THREE.InstancedMesh(floorGeometry, floorMaterial, walkableCells.length);
const ceilingGeometry = new THREE.PlaneGeometry(1, 1);
const ceilingMesh     = new THREE.InstancedMesh(ceilingGeometry, ceilingMaterial, walkableCells.length);
scene.add(floorMesh);
scene.add(ceilingMesh);

const horizontalWallGeometry = new THREE.BoxGeometry(cellSize, wallHeight, wallThickness);
const verticalWallGeometry   = new THREE.BoxGeometry(wallThickness, wallHeight, cellSize);
const horizontalWalls = [], verticalWalls = [];
for (const cell of walkableCells) {
  const center = cellToWorld(cell.x, cell.y);
  if (!isWalkableCell(cell.x, cell.y - 1)) horizontalWalls.push({ x: center.x, z: center.z - cellSize / 2 });
  if (!isWalkableCell(cell.x, cell.y + 1)) horizontalWalls.push({ x: center.x, z: center.z + cellSize / 2 });
  if (!isWalkableCell(cell.x - 1, cell.y)) verticalWalls.push({ x: center.x - cellSize / 2, z: center.z });
  if (!isWalkableCell(cell.x + 1, cell.y)) verticalWalls.push({ x: center.x + cellSize / 2, z: center.z });
}

const horizontalWallMesh = new THREE.InstancedMesh(horizontalWallGeometry, wallMaterial, horizontalWalls.length);
const verticalWallMesh   = new THREE.InstancedMesh(verticalWallGeometry,   wallMaterial, verticalWalls.length);
scene.add(horizontalWallMesh);
scene.add(verticalWallMesh);

const matrix   = new THREE.Matrix4();
const position = new THREE.Vector3();
const scale    = new THREE.Vector3();
const quaternion  = new THREE.Quaternion();
const floorRot   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI / 2);
const ceilingRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),  Math.PI / 2);

walkableCells.forEach((cell, i) => {
  const c = cellToWorld(cell.x, cell.y);
  position.set(c.x, 0, c.z); scale.set(cellSize, cellSize, 1);
  matrix.compose(position, floorRot, scale); floorMesh.setMatrixAt(i, matrix);
});
floorMesh.instanceMatrix.needsUpdate = true;

walkableCells.forEach((cell, i) => {
  const c = cellToWorld(cell.x, cell.y);
  position.set(c.x, wallHeight, c.z); scale.set(cellSize, cellSize, 1);
  matrix.compose(position, ceilingRot, scale); ceilingMesh.setMatrixAt(i, matrix);
});
ceilingMesh.instanceMatrix.needsUpdate = true;

horizontalWalls.forEach((wall, i) => {
  position.set(wall.x, wallHeight/2, wall.z); scale.set(1,1,1);
  matrix.compose(position, quaternion, scale); horizontalWallMesh.setMatrixAt(i, matrix);
});
horizontalWallMesh.instanceMatrix.needsUpdate = true;

verticalWalls.forEach((wall, i) => {
  position.set(wall.x, wallHeight/2, wall.z); scale.set(1,1,1);
  matrix.compose(position, quaternion, scale); verticalWallMesh.setMatrixAt(i, matrix);
});
verticalWallMesh.instanceMatrix.needsUpdate = true;

// ─── AUDIO ─────────────────────────────────────────────────────────────────
const listener = new THREE.AudioListener();
camera.add(listener);
let humStarted = false;

// ─── INPUT ─────────────────────────────────────────────────────────────────
const keys = { forward: false, back: false, left: false, right: false };
function onKey(event, pressed) {
  switch (event.code) {
    case "KeyW": keys.forward = pressed; break;
    case "KeyS": keys.back    = pressed; break;
    case "KeyA": keys.left    = pressed; break;
    case "KeyD": keys.right   = pressed; break;
  }
}
document.addEventListener("keydown", (e) => {
  onKey(e, true);
  if (e.code === "KeyC") {
    useDebugCamera = !useDebugCamera;
    if (useDebugCamera) {
      document.exitPointerLock();
      debugControls.enabled = true;
      debugCamera.position.set(playerRig.position.x + 2, playerRig.position.y + 2, playerRig.position.z + 2);
      debugControls.target.copy(playerRig.position);
      debugControls.update();
    } else {
      debugControls.enabled = false;
      renderer.domElement.requestPointerLock();
    }
  }
});
document.addEventListener("keyup", (e) => onKey(e, false));

// ─── POSICIÓN INICIAL ──────────────────────────────────────────────────────
const startCell = cellToWorld(mapData.start.x, mapData.start.y);
playerRig.position.set(startCell.x, 0, startCell.z);

// ─── SALIDA ────────────────────────────────────────────────────────────────
const exitCell = cellToWorld(mapData.exit.x, mapData.exit.y);

const exitLight = new THREE.PointLight(0xff0000, 2, 8);
exitLight.position.set(exitCell.x, 1.6, exitCell.z);
scene.add(exitLight);

const exitGeo  = new THREE.BoxGeometry(1.5, 3.2, 1.5);
const exitMat  = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x550000 });
const exitMesh = new THREE.Mesh(exitGeo, exitMat);
exitMesh.position.set(exitCell.x, 1.6, exitCell.z);
scene.add(exitMesh);

// ─── BREADCRUMBS ───────────────────────────────────────────────────────────
const queue = [[mapData.start]];
const visited = new Set([`${mapData.start.x},${mapData.start.y}`]);
let shortestPath = [];
while (queue.length > 0) {
  const currPath = queue.shift();
  const curr = currPath[currPath.length - 1];
  if (curr.x === mapData.exit.x && curr.y === mapData.exit.y) { shortestPath = currPath; break; }
  for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    const nx = curr.x + dx, ny = curr.y + dy;
    if (isWalkableCell(nx, ny) && !visited.has(`${nx},${ny}`)) {
      visited.add(`${nx},${ny}`);
      queue.push([...currPath, { x: nx, y: ny }]);
    }
  }
}
const crumbGeo  = new THREE.BoxGeometry(0.3, 0.05, 0.3);
const crumbMat  = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const crumbMesh = new THREE.InstancedMesh(crumbGeo, crumbMat, shortestPath.length);
scene.add(crumbMesh);
const crumbM = new THREE.Matrix4(), crumbP = new THREE.Vector3(), crumbQ = new THREE.Quaternion(), crumbS = new THREE.Vector3(1,1,1);
shortestPath.forEach((cell, idx) => {
  const cw = cellToWorld(cell.x, cell.y);
  crumbP.set(cw.x, 0.05, cw.z);
  crumbM.compose(crumbP, crumbQ, crumbS);
  crumbMesh.setMatrixAt(idx, crumbM);
});
crumbMesh.instanceMatrix.needsUpdate = true;

// ─── COLISIONES ────────────────────────────────────────────────────────────
const playerRadius = 0.35;
const collisionSamples = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3( playerRadius, 0, 0),
  new THREE.Vector3(-playerRadius, 0, 0),
  new THREE.Vector3(0, 0,  playerRadius),
  new THREE.Vector3(0, 0, -playerRadius),
];
const tempSample = new THREE.Vector3();
const worldToCell  = (pos) => ({ x: Math.floor((pos.x + halfWidth) / cellSize), y: Math.floor((pos.z + halfHeight) / cellSize) });
const isWalkableAt = (pos) => { const c = worldToCell(pos); return isWalkableCell(c.x, c.y); };
const canMoveTo    = (pos) => { for (const o of collisionSamples) { tempSample.copy(pos).add(o); if (!isWalkableAt(tempSample)) return false; } return true; };

// ─── MOVIMIENTO ────────────────────────────────────────────────────────────
const direction = new THREE.Vector3();
const forward   = new THREE.Vector3();
const right     = new THREE.Vector3();
const up        = new THREE.Vector3(0, 1, 0);
const inputDir  = new THREE.Vector3();
const maxSpeed  = 4.6;

function attemptMove(delta) {
  if (!isLocked) return;

  direction.z = Number(keys.forward) - Number(keys.back);
  direction.x = Number(keys.right)   - Number(keys.left);
  direction.normalize();

  // Dirección basada en yaw (sin usar getDirection de PointerLockControls)
  forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  right.crossVectors(forward, up).normalize();

  inputDir.set(0, 0, 0);
  inputDir.addScaledVector(forward, direction.z);
  inputDir.addScaledVector(right,   direction.x);
  if (inputDir.lengthSq() > 0) inputDir.normalize();

  const dist  = maxSpeed * delta;
  const prevX = playerRig.position.x;
  const prevZ = playerRig.position.z;

  playerRig.position.x += inputDir.x * dist;
  if (!canMoveTo(playerRig.position)) playerRig.position.x = prevX;

  playerRig.position.z += inputDir.z * dist;
  if (!canMoveTo(playerRig.position)) playerRig.position.z = prevZ;

  const distToExit = Math.hypot(playerRig.position.x - exitCell.x, playerRig.position.z - exitCell.z);
  if (distToExit < 1.5) {
    document.querySelector(".overlay .card strong").textContent = "¡HAS ESCAPADO!";
    document.querySelector(".overlay .card p").textContent = "Encontraste la salida.";
    document.exitPointerLock();
  }
}

// ─── LOOP ──────────────────────────────────────────────────────────────────
let lastTime    = performance.now();
let elapsed     = 0;
let currentSpeed = 0;
const bobAmplitude = 0.045;
const bobFrequency = 9.5;

function updateFlashlight(t) {
  flashlight.intensity = 2.4 + 0.15 + Math.sin(t * 18) * 0.08;
}

function animate(time) {
  const delta = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  elapsed += delta;

  attemptMove(delta);
  updateFlashlight(elapsed);

  const targetSpeed = inputDir.length() * maxSpeed;
  currentSpeed += (targetSpeed - currentSpeed) * 15 * delta;
  const speedFactor = Math.min(currentSpeed / maxSpeed, 1);
  const bobOffset = Math.sin(elapsed * bobFrequency) * bobAmplitude * speedFactor;
  playerRig.position.y = 0;
  camera.position.y = 1.6 + bobOffset;

  if (useDebugCamera) debugControls.update();

  renderer.render(scene, useDebugCamera ? debugCamera : camera);
  requestAnimationFrame(animate);
}

function onResize() {
  camera.aspect = debugCamera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  debugCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

document.addEventListener("pointerlockchange", () => {
  if (!humStarted && document.pointerLockElement === renderer.domElement) {
    listener.context.resume();
    humStarted = true;
  }
});

requestAnimationFrame(animate);