import "./style.css";
import * as THREE from "three";
import wallUrl from "./assets/textures/textura_amarilla.png";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { generateMap } from "./mapGenerator.js";

const overlay = document.querySelector(".overlay");
const hud = document.querySelector(".hud");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6b5a24);
scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);

// ✅ FIX: Ignorar el primer mousemove tras cada lock (ese evento viene corrupto por la PointerLock API)
let skipNextMouseMove = false;

document.addEventListener("mousemove", (event) => {
  if (skipNextMouseMove) {
    skipNextMouseMove = false;
    event.stopImmediatePropagation();
    return;
  }
}, true); // 'true' = captura antes de que llegue a PointerLockControls

overlay.addEventListener("click", () => controls.lock());
controls.addEventListener("lock", () => {
  skipNextMouseMove = true; // Marcar para descartar el primer evento tras bloquear
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
});
controls.addEventListener("unlock", () => {
  overlay.classList.remove("hidden");
  hud.classList.add("hidden");
});

const ambient = new THREE.AmbientLight(0x5f5a37, 0.08);
scene.add(ambient);

const flashlight = new THREE.SpotLight(0xfff1b5, 3.2, 22, Math.PI / 6, 0.6, 1.2);
flashlight.position.set(0, 1.6, 0);
flashlight.target.position.set(0, 1.6, -1);
flashlight.castShadow = false;
camera.add(flashlight);
camera.add(flashlight.target);
scene.add(camera);

const fill = new THREE.PointLight(0xfff5c7, 0.08, 6);
fill.position.set(0, 1.6, 2.5);
camera.add(fill);

const textureLoader = new THREE.TextureLoader();
const wallTexture = textureLoader.load(wallUrl);
wallTexture.colorSpace = THREE.SRGBColorSpace;
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x7a6c2b, roughness: 0.9, metalness: 0.05 });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x5a542b, roughness: 0.95, metalness: 0.02 });
const wallMaterial = new THREE.MeshStandardMaterial({
  map: wallTexture,
  color: 0xffffff,
  roughness: 0.9,
  metalness: 0.02
});

const mapData = generateMap({ width: 25, height: 25, walkLength: 320 });
const grid = mapData.grid;
const mapHeight = grid.length;
const mapWidth = grid[0].length;
const cellSize = 3;
const wallHeight = 3.2;
const wallThickness = 0.25;
const halfWidth = (mapWidth * cellSize) / 2;
const halfHeight = (mapHeight * cellSize) / 2;

wallTexture.repeat.set(cellSize, wallHeight);

const cellToWorld = (x, y) => ({
  x: x * cellSize - halfWidth + cellSize / 2,
  z: y * cellSize - halfHeight + cellSize / 2
});

const isWalkableCell = (x, y) => grid[y] && grid[y][x] === 1;

const walkableCells = [];
for (let y = 0; y < mapHeight; y += 1) {
  for (let x = 0; x < mapWidth; x += 1) {
    if (isWalkableCell(x, y)) {
      walkableCells.push({ x, y });
    }
  }
}

const floorGeometry = new THREE.PlaneGeometry(1, 1);
const floorMesh = new THREE.InstancedMesh(floorGeometry, floorMaterial, walkableCells.length);
scene.add(floorMesh);

const ceilingGeometry = new THREE.PlaneGeometry(1, 1);
const ceilingMesh = new THREE.InstancedMesh(ceilingGeometry, ceilingMaterial, walkableCells.length);
scene.add(ceilingMesh);

const horizontalWallGeometry = new THREE.BoxGeometry(cellSize, wallHeight, wallThickness);
const verticalWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, cellSize);
const horizontalWalls = [];
const verticalWalls = [];
for (const cell of walkableCells) {
  const center = cellToWorld(cell.x, cell.y);

  if (!isWalkableCell(cell.x, cell.y - 1)) {
    horizontalWalls.push({ x: center.x, z: center.z - cellSize / 2 });
  }
  if (!isWalkableCell(cell.x, cell.y + 1)) {
    horizontalWalls.push({ x: center.x, z: center.z + cellSize / 2 });
  }
  if (!isWalkableCell(cell.x - 1, cell.y)) {
    verticalWalls.push({ x: center.x - cellSize / 2, z: center.z });
  }
  if (!isWalkableCell(cell.x + 1, cell.y)) {
    verticalWalls.push({ x: center.x + cellSize / 2, z: center.z });
  }
}

const horizontalWallMesh = new THREE.InstancedMesh(horizontalWallGeometry, wallMaterial, horizontalWalls.length);
const verticalWallMesh = new THREE.InstancedMesh(verticalWallGeometry, wallMaterial, verticalWalls.length);
scene.add(horizontalWallMesh);
scene.add(verticalWallMesh);

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const floorRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const ceilingRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

walkableCells.forEach((cell, index) => {
  const center = cellToWorld(cell.x, cell.y);
  position.set(center.x, 0, center.z);
  scale.set(cellSize, cellSize, 1);
  matrix.compose(position, floorRot, scale);
  floorMesh.setMatrixAt(index, matrix);
});
floorMesh.instanceMatrix.needsUpdate = true;

walkableCells.forEach((cell, index) => {
  const center = cellToWorld(cell.x, cell.y);
  position.set(center.x, wallHeight, center.z);
  scale.set(cellSize, cellSize, 1);
  matrix.compose(position, ceilingRot, scale);
  ceilingMesh.setMatrixAt(index, matrix);
});
ceilingMesh.instanceMatrix.needsUpdate = true;

horizontalWalls.forEach((wall, index) => {
  position.set(wall.x, wallHeight / 2, wall.z);
  scale.set(1, 1, 1);
  matrix.compose(position, quaternion, scale);
  horizontalWallMesh.setMatrixAt(index, matrix);
});
horizontalWallMesh.instanceMatrix.needsUpdate = true;

verticalWalls.forEach((wall, index) => {
  position.set(wall.x, wallHeight / 2, wall.z);
  scale.set(1, 1, 1);
  matrix.compose(position, quaternion, scale);
  verticalWallMesh.setMatrixAt(index, matrix);
});
verticalWallMesh.instanceMatrix.needsUpdate = true;

const listener = new THREE.AudioListener();
camera.add(listener);
const humAnchor = new THREE.Object3D();
humAnchor.position.set(0, 1.8, 0);
scene.add(humAnchor);

let humStarted = false;

const direction = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const inputDir = new THREE.Vector3();

const keys = { forward: false, back: false, left: false, right: false };

function onKey(event, pressed) {
  switch (event.code) {
    case "KeyW": keys.forward = pressed; break;
    case "KeyS": keys.back = pressed; break;
    case "KeyA": keys.left = pressed; break;
    case "KeyD": keys.right = pressed; break;
    default: break;
  }
}

document.addEventListener("keydown", (event) => onKey(event, true));
document.addEventListener("keyup", (event) => onKey(event, false));

let lastTime = performance.now();
let elapsed = 0;
const playerRadius = 0.35;
const playerHeight = 1.6;
const bobAmplitude = 0.045;
const bobFrequency = 9.5;
const maxSpeed = 4.6;

const startCell = cellToWorld(mapData.start.x, mapData.start.y);
controls.object.position.set(startCell.x, playerHeight, startCell.z);

// --- SALIDA Y CAMINO (BREADCRUMBS) ---
const exitCell = cellToWorld(mapData.exit.x, mapData.exit.y);

const exitLight = new THREE.PointLight(0xff0000, 2, 8);
exitLight.position.set(exitCell.x, 1.6, exitCell.z);
scene.add(exitLight);

const exitGeo = new THREE.BoxGeometry(1.5, 3.2, 1.5);
const exitMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x550000 });
const exitMesh = new THREE.Mesh(exitGeo, exitMat);
exitMesh.position.set(exitCell.x, 1.6, exitCell.z);
scene.add(exitMesh);

const queue = [[mapData.start]];
const visited = new Set([`${mapData.start.x},${mapData.start.y}`]);
let shortestPath = [];

while (queue.length > 0) {
  const currPath = queue.shift();
  const curr = currPath[currPath.length - 1];
  if (curr.x === mapData.exit.x && curr.y === mapData.exit.y) {
    shortestPath = currPath;
    break;
  }
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dx, dy] of dirs) {
    const nx = curr.x + dx;
    const ny = curr.y + dy;
    if (isWalkableCell(nx, ny) && !visited.has(`${nx},${ny}`)) {
      visited.add(`${nx},${ny}`);
      queue.push([...currPath, { x: nx, y: ny }]);
    }
  }
}

const crumbGeo = new THREE.BoxGeometry(0.3, 0.05, 0.3);
const crumbMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const crumbMesh = new THREE.InstancedMesh(crumbGeo, crumbMat, shortestPath.length);
scene.add(crumbMesh);

const crumbM = new THREE.Matrix4();
const crumbP = new THREE.Vector3();
const crumbQ = new THREE.Quaternion();
const crumbS = new THREE.Vector3(1, 1, 1);

shortestPath.forEach((cell, idx) => {
  const cw = cellToWorld(cell.x, cell.y);
  crumbP.set(cw.x, 0.05, cw.z);
  crumbM.compose(crumbP, crumbQ, crumbS);
  crumbMesh.setMatrixAt(idx, crumbM);
});
crumbMesh.instanceMatrix.needsUpdate = true;
// --- FIN SALIDA ---

const collisionSamples = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(playerRadius, 0, 0),
  new THREE.Vector3(-playerRadius, 0, 0),
  new THREE.Vector3(0, 0, playerRadius),
  new THREE.Vector3(0, 0, -playerRadius)
];
const tempSample = new THREE.Vector3();

const worldToCell = (pos) => ({
  x: Math.floor((pos.x + halfWidth) / cellSize),
  y: Math.floor((pos.z + halfHeight) / cellSize)
});

const isWalkableAt = (pos) => {
  const cell = worldToCell(pos);
  return isWalkableCell(cell.x, cell.y);
};

const canMoveTo = (pos) => {
  for (const offset of collisionSamples) {
    tempSample.copy(pos).add(offset);
    if (!isWalkableAt(tempSample)) {
      return false;
    }
  }
  return true;
};

function attemptMove(delta) {
  if (!controls.isLocked) return;

  direction.z = Number(keys.forward) - Number(keys.back);
  direction.x = Number(keys.right) - Number(keys.left);
  direction.normalize();

  controls.getDirection(forward).normalize();
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, up).normalize();

  inputDir.set(0, 0, 0);
  inputDir.addScaledVector(forward, direction.z);
  inputDir.addScaledVector(right, direction.x);
  if (inputDir.lengthSq() > 0) inputDir.normalize();

  const moveDistance = maxSpeed * delta;
  const moveX = inputDir.x * moveDistance;
  const moveZ = inputDir.z * moveDistance;

  const currentPos = controls.object.position.clone();

  controls.object.position.x += moveX;
  if (!canMoveTo(controls.object.position)) {
    controls.object.position.x = currentPos.x;
  }

  controls.object.position.z += moveZ;
  if (!canMoveTo(controls.object.position)) {
    controls.object.position.z = currentPos.z;
  }

  const distToExit = Math.hypot(
    controls.object.position.x - exitCell.x,
    controls.object.position.z - exitCell.z
  );
  if (distToExit < 1.5) {
    document.querySelector(".overlay .card strong").textContent = "¡HAS ESCAPADO!";
    document.querySelector(".overlay .card p").textContent = "Encontraste la salida.";
    controls.unlock();
  }
}

let currentSpeed = 0;

function updateFlashlight(elapsed) {
  const flicker = 0.15 + Math.sin(elapsed * 18) * 0.08;
  flashlight.intensity = 2.4 + flicker;
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
  controls.object.position.y = playerHeight + bobOffset;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onResize);

controls.addEventListener("lock", () => {
  if (!humStarted) {
    listener.context.resume();
    humStarted = true;
  }
});

requestAnimationFrame(animate);