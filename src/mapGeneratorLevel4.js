const WIDTH = 27;
const HEIGHT = 27;

// Tema visual del nivel 4 (frio y clinico)
export const LEVEL_4_THEME = {
  background: 0x0a1214,
  fog: 0x0e1619,
  fogDensity: 0.007,
  ambientColor: 0x223038,
  ambientIntensity: 0.1,
  flashlightColor: 0xe3fff9,
  flashlightIntensity: 5.8,
  flashlightDistance: 46,
  flashlightAngle: Math.PI / 4.6,
  flashlightPulse: 0.22,
  fillColor: 0x4b5f6b,
  fillIntensity: 0.35,
  wallColor: 0x2a3b42,
  floorColor: 0x1a2124,
  ceilingColor: 0x29363d,
  panelColor: 0xa9fff1,
  panelIntensity: 0.45,
  mistColor: 0x8fd6d1,
  mistOpacity: 0.16,
  gooColor: 0x2eeaa6
};

function createGrid() {
  const grid = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(1));
  const carveRect = (x1, y1, x2, y2) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) grid[y][x] = 0;
    }
  };
  const carveLineX = (y, x1, x2) => {
    for (let x = x1; x <= x2; x++) grid[y][x] = 0;
  };
  const carveLineY = (x, y1, y2) => {
    for (let y = y1; y <= y2; y++) grid[y][x] = 0;
  };

  // Anillo principal
  carveLineX(1, 1, WIDTH - 2);
  carveLineX(HEIGHT - 2, 1, WIDTH - 2);
  carveLineY(1, 1, HEIGHT - 2);
  carveLineY(WIDTH - 2, 1, HEIGHT - 2);

  const cx = Math.floor(WIDTH / 2);
  const cy = Math.floor(HEIGHT / 2);

  // Ejes principales
  carveLineX(cy, 2, WIDTH - 3);
  carveLineY(cx, 2, HEIGHT - 3);

  // Salas en las esquinas
  carveRect(3, 3, 7, 7);
  carveRect(WIDTH - 8, 3, WIDTH - 4, 7);
  carveRect(3, HEIGHT - 8, 7, HEIGHT - 4);
  carveRect(WIDTH - 8, HEIGHT - 8, WIDTH - 4, HEIGHT - 4);

  // Sala central
  carveRect(cx - 3, cy - 3, cx + 3, cy + 3);

  // Salas laterales
  carveRect(3, cy - 2, 7, cy + 2);
  carveRect(WIDTH - 8, cy - 2, WIDTH - 4, cy + 2);
  carveRect(cx - 2, 3, cx + 2, 7);
  carveRect(cx - 2, HEIGHT - 8, cx + 2, HEIGHT - 4);

  // Pilares en sala central
  const pillars = [
    { x: cx - 1, y: cy - 1 }, { x: cx + 1, y: cy - 1 },
    { x: cx - 1, y: cy + 1 }, { x: cx + 1, y: cy + 1 }
  ];
  for (const p of pillars) grid[p.y][p.x] = 1;

  // Inicio y salida
  grid[1][1] = 2;
  grid[HEIGHT - 2][WIDTH - 2] = 3;

  return grid;
}

function findMarker(grid, marker) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      if (grid[y][x] === marker) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pickCells(cells, count, rng) {
  const arr = [...cells];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

export function generateMapLevel4() {
  const grid = createGrid();
  const start = findMarker(grid, 2);
  const exit = findMarker(grid, 3);

  const walkable = [];
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      if (grid[y][x] !== 1) walkable.push({ x, y });
    }
  }

  const far = (cell, target) => Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y) > 3;
  const candidates = walkable.filter((c) => far(c, start) && far(c, exit));

  const rng = makeRng(4104);
  const lightPanels = pickCells(candidates, 12, rng);
  const mistZones = pickCells(candidates.filter((c) => (c.x + c.y) % 3 === 0), 8, rng);
  const gooSpots = pickCells(candidates.filter((c) => (c.x + c.y) % 4 === 1), 10, rng);

  return { grid, start, exit, lightPanels, mistZones, gooSpots, theme: LEVEL_4_THEME };
}
