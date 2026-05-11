export let playerHealth = 100;
export let isDeadFromHealth = false;
let healthRegenTimer = 0;
const healthRegenDelay = 2.0;

const healthBarFill = document.getElementById('health-fill');

export let stamina = 100;
export let battery = 100;

const staminaBarFill = document.getElementById('stamina-fill');
const batteryBarFill = document.getElementById('battery-fill');

export function takeDamage(amount) {
  if (isDeadFromHealth) return;
  playerHealth = Math.max(0, playerHealth - amount);
  healthRegenTimer = 0;
  updateHealthBar();
  if (playerHealth <= 0) {
    isDeadFromHealth = true;
  }
}

export function resetHealth() {
  playerHealth = 100;
  isDeadFromHealth = false;
  healthRegenTimer = 0;
  stamina = 100;
  battery = 100;
  updateHealthBar();
  updateStaminaBar();
  updateBatteryBar();
}

function updateHealthBar() {
  if (healthBarFill) {
    const pct = Math.max(0, Math.min(1, playerHealth / 100));
    healthBarFill.style.width = (pct * 100) + '%';
    if (pct > 0.6) healthBarFill.style.background = '#4a4';
    else if (pct > 0.3) healthBarFill.style.background = '#ca4';
    else healthBarFill.style.background = '#c44';
    const ht = document.getElementById('health-text');
    if (ht) ht.textContent = Math.ceil(playerHealth);
  }
}

function updateStaminaBar() {
  if (staminaBarFill) {
    const pct = Math.max(0, Math.min(1, stamina / 100));
    staminaBarFill.style.width = (pct * 100) + '%';
  }
}

function updateBatteryBar() {
  if (batteryBarFill) {
    const pct = Math.max(0, Math.min(1, battery / 100));
    batteryBarFill.style.width = (pct * 100) + '%';
    if (pct > 0.3) batteryBarFill.style.background = '#4ac';
    else batteryBarFill.style.background = '#c44';
  }
}

export function updateHealth(delta) {
  if (isDeadFromHealth) return;
  if (playerHealth < 100) {
    healthRegenTimer += delta;
    if (healthRegenTimer >= healthRegenDelay) {
      playerHealth = Math.min(100, playerHealth + 8 * delta);
      updateHealthBar();
    }
  }
}

export function updateStamina(delta, isRunning) {
  if (isRunning && stamina > 0) {
    stamina = Math.max(0, stamina - 30 * delta);
    updateStaminaBar();
  } else if (stamina < 100) {
    stamina = Math.min(100, stamina + 20 * delta);
    updateStaminaBar();
  }
}

export function updateBattery(delta, flashlightOn = true) {
  if (flashlightOn) {
    battery = Math.max(0, battery - 2 * delta);
  }
  updateBatteryBar();
}

export function getBatteryFactor() {
  if (battery <= 0) return 0.05;
  if (battery < 20) return 0.15 + (battery / 20) * 0.85;
  return 1;
}
