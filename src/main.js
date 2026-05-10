import "./style.css";
import * as THREE from "three";
import wallUrl from "./assets/textures/textura_amarilla.png";
import brownWallUrl from "./assets/textures/textura_marron.png";
import whiteWallUrl from "./assets/textures/textura_blanca.png";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { generateMap } from "./mapGenerator.js";
import { generateMapLevel2 } from "./mapGeneratorLevel2.js";
import { generateMapLevel3 } from "./mapGeneratorLevel3.js";
import { generateMapLevel4 } from "./mapGeneratorLevel4.js";

const overlay = document.querySelector(".overlay");
const hud = document.querySelector(".hud");
overlay?.remove();

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
scene.add(playerRig);

const controls = new PointerLockControls(camera, renderer.domElement);
playerRig.add(camera);

const STAND_EYE_HEIGHT = 1.6;
const CROUCH_EYE_HEIGHT = 1.05;
const JUMP_VELOCITY = 4.8;
const GRAVITY = 12;
const WALK_SPEED = 4.6;
const RUN_SPEED = 6.8;
const CROUCH_SPEED = 2.4;
let isLocked = false;
let isCrouching = false;
let isRunning = false;
let isGrounded = true;
let verticalVelocity = 0;
let currentEyeHeight = STAND_EYE_HEIGHT;
let lockRetryAt = 0;

hud.classList.remove("hidden");

controls.addEventListener("lock", () => {
  isLocked = true;
  hud.classList.remove("hidden");
  if (!humStarted) {
    listener.context.resume();
    humStarted = true;
  }
});

controls.addEventListener("unlock", () => {
  isLocked = false;
  lockRetryAt = performance.now() + 1200;
  hud.classList.remove("hidden");
});

function tryLockControls() {
  if (isLocked || useDebugCamera) return;
  if (performance.now() < lockRetryAt) return;
  controls.lock();
}

document.addEventListener("pointerdown", tryLockControls);

document.addEventListener("pointerlockerror", () => {
  lockRetryAt = performance.now() + 1200;
});

// ─── DEBUG CAMERA ──────────────────────────────────────────────────────────
const debugCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
debugCamera.position.set(5, 5, 5);
const debugControls = new OrbitControls(debugCamera, renderer.domElement);
debugControls.enabled = false;
let useDebugCamera = false;

// ─── LUCES ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x5f5a37, 0.18);
scene.add(ambient);

const flashlight = new THREE.SpotLight(0xfff1b5, 4.2, 28, Math.PI / 6, 0.55, 1.1);
flashlight.position.set(0, 0, 0);
flashlight.target.position.set(0, 0, -1);
flashlight.castShadow = false;
camera.add(flashlight);
camera.add(flashlight.target);

let flashlightBaseIntensity = 2.6;
let flashlightPulseAmplitude = 0.12;

const fill = new THREE.PointLight(0xfff5c7, 0.18, 7.5);
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
  model.position.set(0.15, -0.10, -0.10);
  model.rotation.y = Math.PI;
  camera.add(model);
});

// ─── TEXTURAS Y MATERIALES ─────────────────────────────────────────────────
const textureLoader = new THREE.TextureLoader();
const wallTexture = textureLoader.load(wallUrl);
const brownWallTexture = textureLoader.load(brownWallUrl);
const whiteWallTexture = textureLoader.load(whiteWallUrl);
wallTexture.colorSpace = THREE.SRGBColorSpace;
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
brownWallTexture.colorSpace = THREE.SRGBColorSpace;
brownWallTexture.wrapS = THREE.RepeatWrapping;
brownWallTexture.wrapT = THREE.RepeatWrapping;
brownWallTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
whiteWallTexture.colorSpace = THREE.SRGBColorSpace;
whiteWallTexture.wrapS = THREE.RepeatWrapping;
whiteWallTexture.wrapT = THREE.RepeatWrapping;
whiteWallTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const floorMaterial   = new THREE.MeshStandardMaterial({ color: 0x7a6c2b, roughness: 0.9, metalness: 0.05 });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x5a542b, roughness: 0.95, metalness: 0.02 });
const wallMaterial    = new THREE.MeshStandardMaterial({ map: wallTexture, color: 0xffffff, roughness: 0.9, metalness: 0.02 });

// ─── VARIABLES GLOBALES DE NIVEL ────────────────────────────────────────────
let currentLevel = 1;
let grid, mapHeight, mapWidth, cellSize = 3, wallHeight = 3.2, wallThickness = 0.25, halfWidth, halfHeight;
let cellToWorld, isWalkableCell, worldToCell, isWalkableAt, canMoveTo;
let mapData, exitCell;
let floorMesh, ceilingMesh, horizontalWallMesh, verticalWallMesh, exitMesh, exitLight;
let darkZoneMeshes = [];
let bloodMeshes = [];
let level3Lights = [];
let level3Ambience = { osc: null, gain: null, pulseId: null };
let level3WallTexture = null;
let level3FloorTexture = null;
let level3CeilingTexture = null;
let level4Lights = [];
let level4Panels = [];
let level4MistMeshes = [];
let level4GooMeshes = [];
let level4Ambience = { osc: null, gain: null, pulseId: null };
let level4WallTexture = null;
let level4FloorTexture = null;
let level4CeilingTexture = null;
let currentFloorMaterial = floorMaterial;
let currentCeilingMaterial = ceilingMaterial;

// Función que carga un nivel específico
// Parámetros: levelNum = número del nivel, mapWidth/Height = tamaño del mapa, walkLength = complejidad
function setupLevel(levelNum) {
  // Remover meshes del nivel anterior
  if (floorMesh) { scene.remove(floorMesh); floorMesh.dispose(); }
  if (ceilingMesh) { scene.remove(ceilingMesh); ceilingMesh.dispose(); }
  if (horizontalWallMesh) { scene.remove(horizontalWallMesh); horizontalWallMesh.dispose(); }
  if (verticalWallMesh) { scene.remove(verticalWallMesh); verticalWallMesh.dispose(); }
  if (exitMesh) { scene.remove(exitMesh); exitMesh.geometry.dispose(); exitMesh.material.dispose(); }
  if (exitLight) { scene.remove(exitLight); }
  for (const darkZone of darkZoneMeshes) {
    scene.remove(darkZone);
    darkZone.geometry.dispose();
    darkZone.material.dispose();
  }
  darkZoneMeshes = [];
  // remover sangre y luces del nivel 3
  for (const b of bloodMeshes) { scene.remove(b); if (b.geometry) b.geometry.dispose(); if (b.material) b.material.dispose(); }
  bloodMeshes = [];
  for (const l of level3Lights) scene.remove(l);
  level3Lights = [];
  stopLevel3Ambience();
  for (const p of level4Panels) { scene.remove(p); if (p.geometry) p.geometry.dispose(); if (p.material) p.material.dispose(); }
  level4Panels = [];
  for (const m of level4MistMeshes) { scene.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }
  level4MistMeshes = [];
  for (const g of level4GooMeshes) { scene.remove(g); if (g.geometry) g.geometry.dispose(); if (g.material) g.material.dispose(); }
  level4GooMeshes = [];
  for (const l of level4Lights) scene.remove(l);
  level4Lights = [];
  stopLevel4Ambience();

  // Configurar parámetros según el nivel
  const levelConfig = {
    1: { width: 25, height: 25, walkLength: 320, texColor: 0xff0000, groundColor: 0xccaa00, ceilingColor: 0x5a542b, background: 0x6b5a24, fog: 0xcccccc, fogDensity: 0.002, ambientColor: 0x5f5a37, ambientIntensity: 0.18, flashlightColor: 0xfff1b5, flashlightIntensity: 3.2, flashlightDistance: 28, flashlightAngle: Math.PI / 6, flashlightPulse: 0.18, fillColor: 0xfff5c7, fillIntensity: 0.18, floorColor: 0x7a6c2b, ceilingTint: 0x5a542b, wallTexture: wallTexture },
    2: { width: 35, height: 35, walkLength: 450, texColor: 0xff6600, groundColor: 0xaa8844, ceilingColor: 0xE8E4C9, background: 0x4e3f22, fog: 0xd0c8b7, fogDensity: 0.002, ambientColor: 0x6b5d3c, ambientIntensity: 0.14, flashlightColor: 0xffe3b0, flashlightIntensity: 3.0, flashlightDistance: 28, flashlightAngle: Math.PI / 6, flashlightPulse: 0.16, fillColor: 0xfff1d4, fillIntensity: 0.16, floorColor: 0x8f7a52, ceilingTint: 0xe8e4c9, wallTexture: brownWallTexture },
    3: { width: 25, height: 25, walkLength: 520, texColor: 0xbfd8ff, groundColor: 0x1d1816, ceilingColor: 0x252a2e, background: 0x0b0d0f, fog: 0x0f1114, fogDensity: 0.013, ambientColor: 0x1b1e21, ambientIntensity: 0.06, flashlightColor: 0xfff1d6, flashlightIntensity: 4.6, flashlightDistance: 36, flashlightAngle: Math.PI / 5, flashlightPulse: 0.35, fillColor: 0x3a2f2b, fillIntensity: 0.3, floorColor: 0x1d1816, ceilingTint: 0x252a2e, wallColor: 0x2b2f33, wallTexture: null },
    4: { width: 27, height: 27, walkLength: 620, texColor: 0x7cffea, groundColor: 0x1a2124, ceilingColor: 0x29363d, background: 0x0a1214, fog: 0x0e1619, fogDensity: 0.007, ambientColor: 0x223038, ambientIntensity: 0.1, flashlightColor: 0xe3fff9, flashlightIntensity: 5.8, flashlightDistance: 46, flashlightAngle: Math.PI / 4.6, flashlightPulse: 0.22, fillColor: 0x4b5f6b, fillIntensity: 0.35, floorColor: 0x1a2124, ceilingTint: 0x29363d, wallColor: 0x2a3b42, wallTexture: null, panelColor: 0xa9fff1, panelIntensity: 0.45, mistColor: 0x8fd6d1, mistOpacity: 0.16, gooColor: 0x2eeaa6 }
  };
  const config = levelConfig[levelNum];

  // Generar mapa proceduralmente
  mapData = levelNum === 4
    ? generateMapLevel4({ width: config.width, height: config.height, walkLength: config.walkLength })
    : levelNum === 3
    ? generateMapLevel3({ width: config.width, height: config.height, walkLength: config.walkLength })
    : levelNum === 2
    ? generateMapLevel2({ width: config.width, height: config.height, walkLength: config.walkLength })
    : generateMap({ width: config.width, height: config.height, walkLength: config.walkLength });

  // Aplicar tema del nivel si viene desde el generador
  if (mapData && mapData.theme) {
    const theme = mapData.theme;
    config.background = theme.background ?? config.background;
    config.fog = theme.fog ?? config.fog;
    config.fogDensity = theme.fogDensity ?? config.fogDensity;
    config.ambientColor = theme.ambientColor ?? config.ambientColor;
    config.ambientIntensity = theme.ambientIntensity ?? config.ambientIntensity;
    config.flashlightColor = theme.flashlightColor ?? config.flashlightColor;
    config.flashlightIntensity = theme.flashlightIntensity ?? config.flashlightIntensity;
    config.flashlightDistance = theme.flashlightDistance ?? config.flashlightDistance;
    config.flashlightAngle = theme.flashlightAngle ?? config.flashlightAngle;
    config.flashlightPulse = theme.flashlightPulse ?? config.flashlightPulse;
    config.fillColor = theme.fillColor ?? config.fillColor;
    config.fillIntensity = theme.fillIntensity ?? config.fillIntensity;
    config.floorColor = theme.floorColor ?? config.floorColor;
    config.ceilingTint = theme.ceilingColor ?? config.ceilingTint;
    config.wallColor = theme.wallColor ?? config.wallColor;
    config.panelColor = theme.panelColor ?? config.panelColor;
    config.panelIntensity = theme.panelIntensity ?? config.panelIntensity;
    config.mistColor = theme.mistColor ?? config.mistColor;
    config.mistOpacity = theme.mistOpacity ?? config.mistOpacity;
    config.gooColor = theme.gooColor ?? config.gooColor;
  }

  if (levelNum === 3) ensureLevel3Textures(config);
  if (levelNum === 4) ensureLevel4Textures(config);

  scene.background = new THREE.Color(config.background);
  const fogDensity = config.fogDensity ?? (levelNum === 3 ? 0.018 : 0.002);
  scene.fog = new THREE.FogExp2(config.fog, fogDensity);
  ambient.color.set(config.ambientColor);
  ambient.intensity = config.ambientIntensity;
  flashlight.color.set(config.flashlightColor);
  flashlightBaseIntensity = config.flashlightIntensity ?? 2.6;
  flashlightPulseAmplitude = config.flashlightPulse ?? 0.12;
  flashlight.intensity = flashlightBaseIntensity;
  flashlight.distance = config.flashlightDistance ?? 28;
  flashlight.angle = config.flashlightAngle ?? Math.PI / 6;
  fill.color.set(config.fillColor);
  fill.intensity = config.fillIntensity ?? 0.18;

  if (config.floorTexture) {
    currentFloorMaterial = new THREE.MeshStandardMaterial({ map: config.floorTexture, color: 0xffffff, roughness: 0.98, metalness: 0.02 });
  } else {
    floorMaterial.color.set(config.floorColor);
    currentFloorMaterial = floorMaterial;
  }

  if (config.ceilingTexture) {
    currentCeilingMaterial = new THREE.MeshStandardMaterial({ map: config.ceilingTexture, color: 0xffffff, roughness: 0.95, metalness: 0.02 });
  } else {
    currentCeilingMaterial = new THREE.MeshStandardMaterial({ color: config.ceilingTint, roughness: 0.95, metalness: 0.02 });
  }
  grid = mapData.grid;
  mapHeight = grid.length;
  mapWidth = grid[0].length;
  halfWidth = (mapWidth * cellSize) / 2;
  halfHeight = (mapHeight * cellSize) / 2;

  // Usar una textura distinta en cada nivel (o color si no hay textura)
  const levelTexture = config.wallTexture;
  const levelWallMaterial = levelTexture
    ? new THREE.MeshStandardMaterial({ map: levelTexture, color: 0xffffff, roughness: 0.95, metalness: 0.02 })
    : new THREE.MeshStandardMaterial({ color: config.wallColor ?? 0xffffff, roughness: 0.96, metalness: 0.02 });

  if (levelTexture) {
    levelTexture.colorSpace = THREE.SRGBColorSpace;
    levelTexture.wrapS = THREE.RepeatWrapping;
    levelTexture.wrapT = THREE.RepeatWrapping;
    levelTexture.repeat.set(cellSize, wallHeight);
  }

  // Redefinir funciones de utilidad basadas en el nuevo grid
  cellToWorld = (x, y) => ({ x: x * cellSize - halfWidth + cellSize / 2, z: y * cellSize - halfHeight + cellSize / 2 });
  isWalkableCell = (x, y) => grid[y] && grid[y][x] !== 1;
  worldToCell = (pos) => ({ x: Math.floor((pos.x + halfWidth) / cellSize), y: Math.floor((pos.z + halfHeight) / cellSize) });
  isWalkableAt = (pos) => { const c = worldToCell(pos); return isWalkableCell(c.x, c.y); };
  canMoveTo = (pos) => { for (const o of collisionSamples) { tempSample.copy(pos).add(o); if (!isWalkableAt(tempSample)) return false; } return true; };

  const findMarkerCell = (marker) => {
    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        if (grid[y][x] === marker) return { x, y };
      }
    }
    return null;
  };
  const startMarkerCell = findMarkerCell(2) ?? mapData.start;
  const exitMarkerCell = findMarkerCell(3) ?? mapData.exit;

  // Calcular celdas transitables
  const walkableCells = [];
  for (let y = 0; y < mapHeight; y++)
    for (let x = 0; x < mapWidth; x++)
      if (isWalkableCell(x, y)) walkableCells.push({ x, y });

  // Crear geometrías instanciadas para suelo, techo y paredes
  const floorGeometry = new THREE.PlaneGeometry(1, 1);
  const ceilingGeometry = new THREE.PlaneGeometry(1, 1);
  floorMesh = new THREE.InstancedMesh(floorGeometry, currentFloorMaterial, walkableCells.length);
  ceilingMesh = new THREE.InstancedMesh(ceilingGeometry, currentCeilingMaterial, walkableCells.length);
  scene.add(floorMesh);
  scene.add(ceilingMesh);

  const horizontalWallGeometry = new THREE.BoxGeometry(cellSize, wallHeight, wallThickness);
  const verticalWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, cellSize);
  const horizontalWalls = [], verticalWalls = [];
  for (const cell of walkableCells) {
    const center = cellToWorld(cell.x, cell.y);
    if (!isWalkableCell(cell.x, cell.y - 1)) horizontalWalls.push({ x: center.x, z: center.z - cellSize / 2 });
    if (!isWalkableCell(cell.x, cell.y + 1)) horizontalWalls.push({ x: center.x, z: center.z + cellSize / 2 });
    if (!isWalkableCell(cell.x - 1, cell.y)) verticalWalls.push({ x: center.x - cellSize / 2, z: center.z });
    if (!isWalkableCell(cell.x + 1, cell.y)) verticalWalls.push({ x: center.x + cellSize / 2, z: center.z });
  }

  horizontalWallMesh = new THREE.InstancedMesh(horizontalWallGeometry, levelWallMaterial, horizontalWalls.length);
  verticalWallMesh = new THREE.InstancedMesh(verticalWallGeometry, levelWallMaterial, verticalWalls.length);
  scene.add(horizontalWallMesh);
  scene.add(verticalWallMesh);

  // Posicionar instancias en el espacio 3D
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const floorRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI / 2);
  const ceilingRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI / 2);

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

  // Crear punto de salida
  exitCell = cellToWorld(exitMarkerCell.x, exitMarkerCell.y);
  exitLight = new THREE.PointLight(config.texColor, 2, 8);
  exitLight.position.set(exitCell.x, 1.6, exitCell.z);
  scene.add(exitLight);

  const exitGeo = new THREE.BoxGeometry(1.5, 3.2, 1.5);
  const exitMat = new THREE.MeshStandardMaterial({ color: config.texColor, emissive: config.texColor, emissiveIntensity: 0.3 });
  exitMesh = new THREE.Mesh(exitGeo, exitMat);
  exitMesh.position.set(exitCell.x, 1.6, exitCell.z);
  scene.add(exitMesh);

  if (levelNum === 3) {
    const darkZoneGeometry = new THREE.BoxGeometry(cellSize * 1.6, wallHeight + 0.1, cellSize * 1.6);
    const darkZoneMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.94, depthWrite: false });
    const darkZoneCenters = (mapData && mapData.darkZones) ? mapData.darkZones : [
      { x: 4, y: 4 }, { x: 9, y: 7 }, { x: 15, y: 5 }, { x: 19, y: 11 }, { x: 7, y: 15 }, { x: 13, y: 18 }, { x: 18, y: 20 }
    ];

    for (const cell of darkZoneCenters) {
      if (!isWalkableCell(cell.x, cell.y)) continue;
      const center = cellToWorld(cell.x, cell.y);
      const darkZone = new THREE.Mesh(darkZoneGeometry, darkZoneMaterial.clone());
      darkZone.position.set(center.x, wallHeight / 2, center.z);
      darkZone.renderOrder = 999;
      scene.add(darkZone);
      darkZoneMeshes.push(darkZone);
    }

    // Usar bloodSpots provistos por el generador del nivel si existen
    const bloodSpots = (mapData && mapData.bloodSpots) ? mapData.bloodSpots : [];
    if (bloodSpots.length) {
      for (const c of bloodSpots) {
        if (!isWalkableCell(c.x, c.y)) continue;
        const w = cellToWorld(c.x, c.y);
        addBloodDecal(w.x + (Math.random()-0.5)*0.4, w.z + (Math.random()-0.5)*0.4, Math.random() > 0.2, 0.8 + Math.random()*1.6);
      }
    } else {
      const bloodCount = Math.min(12, Math.floor(walkableCells.length * 0.06));
      for (let i = 0; i < bloodCount; i++) {
        const c = walkableCells[Math.floor(Math.random() * walkableCells.length)];
        const w = cellToWorld(c.x, c.y);
        addBloodDecal(w.x + (Math.random()-0.5)*0.6, w.z + (Math.random()-0.5)*0.6, true, 1 + Math.random()*1.4);
      }
    }

    // Luces tenues y parpadeantes cerca de zonas oscuras
    for (let i = 0; i < darkZoneCenters.length; i++) {
      const cell = darkZoneCenters[i];
      if (!isWalkableCell(cell.x, cell.y)) continue;
      const center = cellToWorld(cell.x, cell.y);
      const color = new THREE.Color(0x6b0000).lerp(new THREE.Color(0xff7a00), Math.random()*0.6);
      const p = new THREE.PointLight(color, 0.18 + Math.random()*0.5, 6 + Math.random()*4, 2);
      p.position.set(center.x + (Math.random()-0.5)*1.2, 1.2 + Math.random()*0.6, center.z + (Math.random()-0.5)*1.2);
      p.userData = { base: p.intensity, freq: 6 + Math.random()*6 };
      scene.add(p);
      level3Lights.push(p);
    }

    // iniciar ambiente sonoro para nivel 3
    startLevel3Ambience();
  }

  if (levelNum === 4) {
    const panelColor = config.panelColor ?? 0xa9fff1;
    const panelIntensity = config.panelIntensity ?? 0.45;
    const mistColor = config.mistColor ?? 0x8fd6d1;
    const mistOpacity = config.mistOpacity ?? 0.16;
    const gooColor = config.gooColor ?? 0x2eeaa6;

    const panelGeo = new THREE.PlaneGeometry(cellSize * 0.9, cellSize * 0.35);
    const panelMat = new THREE.MeshBasicMaterial({ color: panelColor, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const mistTex = makeMistTexture(128, intToHexColor(mistColor));
    const mistMat = new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: mistOpacity, depthWrite: false, side: THREE.DoubleSide });

    const panels = (mapData && mapData.lightPanels) ? mapData.lightPanels : [];
    for (const cell of panels) {
      if (!isWalkableCell(cell.x, cell.y)) continue;
      const center = cellToWorld(cell.x, cell.y);
      const panel = new THREE.Mesh(panelGeo, panelMat.clone());
      panel.position.set(center.x, wallHeight - 0.05, center.z);
      panel.rotation.x = Math.PI / 2;
      scene.add(panel);
      level4Panels.push(panel);

      const light = new THREE.PointLight(panelColor, panelIntensity, 7, 2);
      light.position.set(center.x, wallHeight - 0.3, center.z);
      light.userData = { base: light.intensity, freq: 4 + Math.random() * 5 };
      scene.add(light);
      level4Lights.push(light);
    }

    const mists = (mapData && mapData.mistZones) ? mapData.mistZones : [];
    for (const cell of mists) {
      if (!isWalkableCell(cell.x, cell.y)) continue;
      const center = cellToWorld(cell.x, cell.y);
      const fog = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 1.8, cellSize * 1.8), mistMat.clone());
      fog.position.set(center.x, 0.2, center.z);
      fog.rotation.x = -Math.PI / 2;
      fog.renderOrder = 996;
      scene.add(fog);
      level4MistMeshes.push(fog);
    }

    const gooSpots = (mapData && mapData.gooSpots) ? mapData.gooSpots : [];
    for (const cell of gooSpots) {
      if (!isWalkableCell(cell.x, cell.y)) continue;
      const center = cellToWorld(cell.x, cell.y);
      addGooDecal(center.x + (Math.random() - 0.5) * 0.5, center.z + (Math.random() - 0.5) * 0.5, intToHexColor(gooColor), 1.1 + Math.random() * 0.9);
    }

    startLevel4Ambience();
  }

  // Posicionar al jugador en la salida del nivel anterior o en el inicio
  const startCell = cellToWorld(startMarkerCell.x, startMarkerCell.y);
  playerRig.position.set(startCell.x, 0, startCell.z);
  playerRig.position.y = 0;
  verticalVelocity = 0;
  isGrounded = true;
  isCrouching = false;
  isRunning = false;
  currentEyeHeight = STAND_EYE_HEIGHT;
  camera.position.y = STAND_EYE_HEIGHT;
}

// Cargar el primer nivel
setupLevel(1);

// ---- Helpers para nivel 3: manchas, luces y ambiente ----
function intToHexColor(value) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function makeGrimeTexture(size, base, grime, accent, streak) {
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // manchas grandes
  ctx.fillStyle = grime;
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.06 + Math.random() * 0.18;
    const w = 8 + Math.random() * 50;
    const h = 8 + Math.random() * 50;
    ctx.fillRect(Math.random() * size, Math.random() * size, w, h);
  }

  // vetas / streaks
  ctx.strokeStyle = streak;
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    ctx.globalAlpha = 0.08 + Math.random() * 0.2;
    const x = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() * 12 - 6), size);
    ctx.stroke();
  }

  // specks
  ctx.fillStyle = accent;
  for (let i = 0; i < 240; i++) {
    ctx.globalAlpha = 0.12 + Math.random() * 0.35;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ensureLevel3Textures(config) {
  if (!level3WallTexture) {
    const base = intToHexColor(config.wallColor ?? 0x2b2f33);
    level3WallTexture = makeGrimeTexture(512, base, "#181a1c", "#3b4046", "#0f1114");
  }
  if (!level3FloorTexture) {
    const base = intToHexColor(config.floorColor ?? 0x1d1816);
    level3FloorTexture = makeGrimeTexture(512, base, "#0f0b0a", "#2a1f1c", "#14100f");
  }
  if (!level3CeilingTexture) {
    const base = intToHexColor(config.ceilingTint ?? 0x252a2e);
    level3CeilingTexture = makeGrimeTexture(512, base, "#14181b", "#2d3338", "#0f1214");
  }

  const setupRepeat = (tex, repX, repY) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX, repY);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  };

  setupRepeat(level3WallTexture, cellSize * 0.8, wallHeight * 0.7);
  setupRepeat(level3FloorTexture, 2.5, 2.5);
  setupRepeat(level3CeilingTexture, 2.8, 2.8);

  config.wallTexture = level3WallTexture;
  config.floorTexture = level3FloorTexture;
  config.ceilingTexture = level3CeilingTexture;
}

function makeGridTexture(size, base, line, grime) {
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  for (let i = 0; i <= size; i += 32) {
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  ctx.fillStyle = grime;
  for (let i = 0; i < 200; i++) {
    ctx.globalAlpha = 0.08 + Math.random() * 0.2;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMistTexture(size, color) {
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ensureLevel4Textures(config) {
  if (!level4WallTexture) {
    const base = intToHexColor(config.wallColor ?? 0x2a3b42);
    level4WallTexture = makeGrimeTexture(512, base, "#0f1417", "#3a515c", "#10181c");
  }
  if (!level4FloorTexture) {
    const base = intToHexColor(config.floorColor ?? 0x1a2124);
    level4FloorTexture = makeGridTexture(512, base, "#2b3a41", "#0d1214");
  }
  if (!level4CeilingTexture) {
    const base = intToHexColor(config.ceilingTint ?? 0x29363d);
    level4CeilingTexture = makeGridTexture(512, base, "#3a4a52", "#151c20");
  }

  const setupRepeat = (tex, repX, repY) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX, repY);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  };

  setupRepeat(level4WallTexture, cellSize * 0.9, wallHeight * 0.8);
  setupRepeat(level4FloorTexture, 3.2, 3.2);
  setupRepeat(level4CeilingTexture, 3.4, 3.4);

  config.wallTexture = level4WallTexture;
  config.floorTexture = level4FloorTexture;
  config.ceilingTexture = level4CeilingTexture;
}

function makeSplatterTexture(size = 256, color = "#8a0000") {
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  // fondo transparente
  // base mancha
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(size/2, size/2, size*0.42, size*0.28, Math.PI/6, 0, Math.PI*2);
  ctx.fill();
  // salpicaduras aleatorias
  for (let i = 0; i < 18; i++) {
    const r = Math.random() * (size * 0.06);
    const x = size * (0.2 + Math.random() * 0.6);
    const y = size * (0.2 + Math.random() * 0.6);
    ctx.globalAlpha = 0.6 * Math.random();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function addBloodDecal(worldX, worldZ, onFloor = true, size = 1.6) {
  const tex = makeSplatterTexture(256, "#7a0000");
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const geo = new THREE.PlaneGeometry(size, size);
  const mesh = new THREE.Mesh(geo, mat);
  if (onFloor) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(worldX, 0.01, worldZ);
  } else {
    mesh.position.set(worldX, wallHeight * 0.9, worldZ);
  }
  mesh.renderOrder = 998;
  scene.add(mesh);
  bloodMeshes.push(mesh);
}

function addGooDecal(worldX, worldZ, color, size = 1.3) {
  const tex = makeSplatterTexture(256, color);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 });
  const geo = new THREE.PlaneGeometry(size, size);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(worldX, 0.02, worldZ);
  mesh.renderOrder = 997;
  scene.add(mesh);
  level4GooMeshes.push(mesh);
}

function startLevel3Ambience() {
  if (!listener || !listener.context) return;
  stopLevel3Ambience();
  try {
    const ctx = listener.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 36;
    gain.gain.value = 0.0012;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    level3Ambience.osc = osc; level3Ambience.gain = gain;
    // Pulsos aleatorios distantes
    level3Ambience.pulseId = setInterval(() => {
      const pulse = ctx.createOscillator();
      const pg = ctx.createGain();
      pulse.type = "sawtooth";
      pulse.frequency.value = 230 + Math.random() * 600;
      pg.gain.value = 0.0006 + Math.random() * 0.0012;
      pulse.connect(pg); pg.connect(ctx.destination);
      pulse.start();
      setTimeout(() => { try { pulse.stop(); pulse.disconnect(); pg.disconnect(); } catch(e){} }, 220 + Math.random()*600);
    }, 3800 + Math.random()*2600);
  } catch (e) {
    // fallbacks silenciosos
  }
}

function stopLevel3Ambience() {
  try {
    if (level3Ambience.pulseId) { clearInterval(level3Ambience.pulseId); level3Ambience.pulseId = null; }
    if (level3Ambience.osc) { try { level3Ambience.osc.stop(); } catch (e) {} level3Ambience.osc.disconnect(); level3Ambience.osc = null; }
    if (level3Ambience.gain) { level3Ambience.gain.disconnect(); level3Ambience.gain = null; }
  } catch (e) {}
}

function startLevel4Ambience() {
  if (!listener || !listener.context) return;
  stopLevel4Ambience();
  try {
    const ctx = listener.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 55;
    gain.gain.value = 0.0011;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    level4Ambience.osc = osc; level4Ambience.gain = gain;
    level4Ambience.pulseId = setInterval(() => {
      const click = ctx.createOscillator();
      const cg = ctx.createGain();
      click.type = "square";
      click.frequency.value = 1200 + Math.random() * 800;
      cg.gain.value = 0.0005 + Math.random() * 0.001;
      click.connect(cg); cg.connect(ctx.destination);
      click.start();
      setTimeout(() => { try { click.stop(); click.disconnect(); cg.disconnect(); } catch(e){} }, 80 + Math.random() * 120);
    }, 2600 + Math.random() * 2200);
  } catch (e) {
    // silent fallback
  }
}

function stopLevel4Ambience() {
  try {
    if (level4Ambience.pulseId) { clearInterval(level4Ambience.pulseId); level4Ambience.pulseId = null; }
    if (level4Ambience.osc) { try { level4Ambience.osc.stop(); } catch (e) {} level4Ambience.osc.disconnect(); level4Ambience.osc = null; }
    if (level4Ambience.gain) { level4Ambience.gain.disconnect(); level4Ambience.gain = null; }
  } catch (e) {}
}


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
    case "ShiftLeft":
    case "ShiftRight":
      isRunning = pressed && !isCrouching;
      break;
    case "ControlLeft":
    case "ControlRight":
      isCrouching = pressed;
      if (pressed) isRunning = false;
      break;
    case "Space":
      if (pressed && isGrounded) {
        verticalVelocity = JUMP_VELOCITY;
        isGrounded = false;
      }
      break;
  }
}
document.addEventListener("keydown", (e) => {
  onKey(e, true);
  if (e.code === "KeyC") {
    useDebugCamera = !useDebugCamera;
    if (useDebugCamera) {
      controls.unlock();
      debugControls.enabled = true;
      debugCamera.position.set(playerRig.position.x + 2, playerRig.position.y + 2, playerRig.position.z + 2);
      debugControls.target.copy(playerRig.position);
      debugControls.update();
    } else {
      debugControls.enabled = false;
    }
  }
});
document.addEventListener("keyup", (e) => onKey(e, false));

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


// ─── MOVIMIENTO ────────────────────────────────────────────────────────────
const direction = new THREE.Vector3();
const forward   = new THREE.Vector3();
const right     = new THREE.Vector3();
const up        = new THREE.Vector3(0, 1, 0);
const inputDir  = new THREE.Vector3();

function attemptMove(delta) {
  if (useDebugCamera) return;

  direction.z = Number(keys.forward) - Number(keys.back);
  direction.x = Number(keys.right)   - Number(keys.left);
  direction.normalize();

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, up).normalize();

  inputDir.set(0, 0, 0);
  inputDir.addScaledVector(forward, direction.z);
  inputDir.addScaledVector(right,   direction.x);
  if (inputDir.lengthSq() > 0) inputDir.normalize();

  const moveSpeed = isCrouching ? CROUCH_SPEED : isRunning ? RUN_SPEED : WALK_SPEED;
  const dist = moveSpeed * delta;
  const prevX = playerRig.position.x;
  const prevZ = playerRig.position.z;

  playerRig.position.x += inputDir.x * dist;
  if (!canMoveTo(playerRig.position)) playerRig.position.x = prevX;

  playerRig.position.z += inputDir.z * dist;
  if (!canMoveTo(playerRig.position)) playerRig.position.z = prevZ;

  const distToExit = Math.hypot(playerRig.position.x - exitCell.x, playerRig.position.z - exitCell.z);
  if (distToExit < 1.5) {
    // Si completó el nivel 1, cargar nivel 2
    if (currentLevel === 1) {
      currentLevel = 2;
      setupLevel(2);
    } else if (currentLevel === 2) {
      currentLevel = 3;
      setupLevel(3);
    } else if (currentLevel === 3) {
      currentLevel = 4;
      setupLevel(4);
    } else {
      // Si completó el nivel 4, mostrar victoria final
      console.log("¡HAS ESCAPADO! Encontraste la salida de los Backrooms.");
      controls.unlock();
    }
  }
}

// ─── LOOP ──────────────────────────────────────────────────────────────────
let lastTime    = performance.now();
let elapsed     = 0;
let currentSpeed = 0;
const bobAmplitude = 0.045;
const bobFrequency = 9.5;

function updateFlashlight(t) {
  flashlight.intensity = flashlightBaseIntensity + Math.sin(t * 18) * flashlightPulseAmplitude;
}

function animate(time) {
  const delta = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  elapsed += delta;

  attemptMove(delta);
  updateFlashlight(elapsed);

  // Flicker de luces y efectos específicos del nivel 3
  if (currentLevel === 3) {
    for (let i = 0; i < level3Lights.length; i++) {
      const l = level3Lights[i];
      const base = (l.userData && l.userData.base) ? l.userData.base : 0.25;
      const freq = (l.userData && l.userData.freq) ? l.userData.freq : 6;
      l.intensity = Math.max(0, base + Math.sin(elapsed * freq + i) * base * (0.4 + Math.random() * 0.4));
    }
  }

  if (currentLevel === 4) {
    for (let i = 0; i < level4Lights.length; i++) {
      const l = level4Lights[i];
      const base = (l.userData && l.userData.base) ? l.userData.base : 0.35;
      const freq = (l.userData && l.userData.freq) ? l.userData.freq : 4.5;
      const jitter = Math.sin(elapsed * freq + i) * 0.5 + Math.sin(elapsed * (freq * 0.6) + i * 2) * 0.25;
      l.intensity = Math.max(0, base + jitter * base);
    }
  }

  if (!useDebugCamera) {
    verticalVelocity -= GRAVITY * delta;
    playerRig.position.y += verticalVelocity * delta;
    if (playerRig.position.y <= 0) {
      playerRig.position.y = 0;
      verticalVelocity = 0;
      isGrounded = true;
    }
  }

  const targetSpeed = inputDir.length() * (isCrouching ? CROUCH_SPEED : isRunning ? RUN_SPEED : WALK_SPEED);
  currentSpeed += (targetSpeed - currentSpeed) * 15 * delta;
  const speedFactor = Math.min(currentSpeed / RUN_SPEED, 1);
  const bobOffset = isGrounded ? Math.sin(elapsed * bobFrequency) * bobAmplitude * speedFactor : 0;
  const targetEyeHeight = isCrouching ? CROUCH_EYE_HEIGHT : STAND_EYE_HEIGHT;
  currentEyeHeight += (targetEyeHeight - currentEyeHeight) * 12 * delta;
  camera.position.y = currentEyeHeight + bobOffset;

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

requestAnimationFrame(animate);