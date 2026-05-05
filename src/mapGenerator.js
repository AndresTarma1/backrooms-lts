export function generateMap({
  width = 21,
  height = 21,
  walkLength = 260,
  rng = Math.random
} = {}) {
  const grid = Array.from({ length: height }, () => Array(width).fill(0));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  let startX = Math.floor(width / 2);
  let startY = Math.floor(height / 2);
  let x = startX;
  let y = startY;
  grid[y][x] = 1;

  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  for (let i = 0; i < walkLength; i += 1) {
    const [dx, dy] = directions[Math.floor(rng() * directions.length)];
    x = clamp(x + dx, 1, width - 2);
    y = clamp(y + dy, 1, height - 2);
    grid[y][x] = 1;
  }

  return {
    grid,
    start: { x: startX, y: startY },
    exit: { x, y }
  };
}
