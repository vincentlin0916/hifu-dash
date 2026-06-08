const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const overlayPlay = overlay.querySelector(".play-button");

const ui = {
  energy: document.querySelector("#energy"),
  safety: document.querySelector("#safety"),
  hits: document.querySelector("#hits"),
  distance: document.querySelector("#distance"),
  attempt: document.querySelector("#attempt"),
  progressBar: document.querySelector("#progressBar"),
  progressText: document.querySelector("#progressText"),
  coins: document.querySelector("#coins"),
};

const sprites = loadSprites({
  focus: "assets/focus-orb.svg",
  transducer: "assets/transducer.svg",
  vessel: "assets/vessel.svg",
  nerve: "assets/nerve.svg",
  organ: "assets/organ.svg",
  chest: "assets/chest.svg",
  bone: "assets/bone.svg",
  gut: "assets/gut.svg",
  tumor: "assets/tumor.svg",
  coin: "assets/coin.svg",
  poster: "assets/level-poster.svg",
});

// Calibrated for roughly one minute at the current scrolling acceleration.
const levelLength = 1600;
const groundY = 602;
const focus = {
  x: 178,
  y: 440,
  radius: 20,
  vy: 0,
  trail: [],
};

let state = "menu";
let attempt = 1;
let speed = 4.6;
let frame = 0;
let launchFrame = 0;
let countdownFrame = 0;
let chargeLevel = 0;
let chargeDirection = 1;
let isCharging = false;
let ablationMessage = null;
let painReliefMessage = null;
let energy = 100;
let safety = 100;
let painLevel = 10;
let painTreatments = 0;
let hits = 0;
let coins = 0;
let distance = 0;
let obstacles = [];
let tumors = [];
let pickups = [];
let particles = [];

const obstacleTypes = [
  { kind: "vessel", label: "血管", color: "#ff4b45", w: 190, h: 34, damage: 18, lane: "any" },
  { kind: "nerve", label: "神經", color: "#ffd84a", w: 54, h: 145, damage: 24, lane: "top" },
  { kind: "organ", label: "器官", color: "#b5ff42", w: 88, h: 88, damage: 16, lane: "low" },
  { kind: "chest", label: "胸腔", color: "#ff7f9d", w: 112, h: 100, damage: 20, lane: "mid" },
  { kind: "bone", label: "骨痛", color: "#a9f5ff", w: 160, h: 70, damage: 0, lane: "low" },
  { kind: "gut", label: "腸胃", color: "#ff9c5b", w: 150, h: 96, damage: 18, lane: "low" },
];

function resetGame() {
  state = "playing";
  frame = 0;
  speed = 4.6;
  energy = Math.round(58 + chargeLevel * 42);
  safety = 100;
  painLevel = 10;
  painTreatments = 0;
  hits = 0;
  coins = 0;
  distance = 0;
  focus.y = 430;
  focus.vy = 0;
  focus.trail = [];
  obstacles = [];
  tumors = [];
  pickups = [];
  particles = [];
  overlay.className = "overlay hidden";
  startButton.textContent = "RETRY";
  ui.attempt.textContent = `ATTEMPT ${attempt}`;
  seedOpeningPattern();
  updateUi();
}

function startCountdown() {
  state = "countdown";
  countdownFrame = 0;
  launchFrame = 0;
  frame = 0;
  chargeLevel = 0;
  chargeDirection = 1;
  isCharging = false;
  energy = 58;
  safety = 100;
  painLevel = 10;
  painTreatments = 0;
  hits = 0;
  coins = 0;
  distance = 0;
  focus.y = 430;
  focus.vy = 0;
  focus.trail = [];
  obstacles = [];
  tumors = [];
  pickups = [];
  particles = [];
  overlay.className = "overlay hidden";
  startButton.textContent = "RETRY";
  ui.attempt.textContent = `ATTEMPT ${attempt}`;
  updateUi();
}

function startCharging() {
  state = "charging";
  launchFrame = 0;
  chargeLevel = 0.18;
  chargeDirection = 1;
  isCharging = false;
  energy = 58;
  updateUi();
}

function releaseUltrasound() {
  if (state !== "charging") return;
  isCharging = false;
  chargeLevel = Math.max(chargeLevel, 0.18);
  state = "launching";
  launchFrame = 0;
  energy = Math.round(58 + chargeLevel * 42);
  addBurst(240, 390, "#8fff29", 18, 7);
  updateUi();
}

function seedOpeningPattern() {
  obstacles.push(makeObstacle("vessel", 760, 505, -0.12));
  obstacles.push(makeObstacle("nerve", 1220, 150, 0));
  const firstBone = makeObstacle("bone", 1780, 520, 0.02);
  obstacles.push(firstBone);
  obstacles.push(makeObstacle("chest", 2380, 255, 0));
  obstacles.push(makeObstacle("gut", 2920, 468, -0.06));
  tumors.push(makeTumor(1460, 456));
  tumors.push(makeTumor(3280, 330));
  pickups.push({ x: 620, y: 350, r: 14, taken: false });
  pickups.push({ x: 2180, y: 210, r: 14, taken: false });
}

function loadSprites(paths) {
  return Object.fromEntries(
    Object.entries(paths).map(([name, src]) => {
      const image = new Image();
      image.src = src;
      return [name, image];
    }),
  );
}

function drawSprite(name, x, y, w, h, rotation = 0, alpha = 1) {
  const image = sprites[name];
  if (!image || !image.complete || image.naturalWidth === 0) return false;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

function makeObstacle(kind, x, y, angle = 0) {
  const type = obstacleTypes.find((item) => item.kind === kind);
  return {
    ...type,
    x,
    y,
    angle,
    phase: Math.random() * Math.PI * 2,
  };
}

function makeTumor(x, y) {
  return {
    x,
    y,
    r: 34 + Math.random() * 10,
    pulse: Math.random() * Math.PI,
    hit: false,
  };
}

function jump() {
  if (state === "menu" || state === "dead" || state === "complete") {
    attempt = state === "menu" ? 1 : attempt + 1;
    startCountdown();
    return;
  }

  if (state === "countdown") return;
  if (state === "charging") {
    isCharging = true;
    return;
  }
  if (state === "launching") return;

  if (state === "paused") {
    resumeGame();
    return;
  }

  if (focus.y > 150) {
    focus.vy = -14.6;
    energy = Math.max(0, energy - 1.4);
    addBurst(focus.x - 8, focus.y + 8, "#5afcff", 8, 4);
  }
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
    showOverlay("PAUSED", "RESUME / RETRY", "Space / Click 繼續，P 取消暫停", "menu");
  } else if (state === "paused") {
    resumeGame();
  }
}

function resumeGame() {
  state = "playing";
  overlay.className = "overlay hidden";
}

function spawnObstacle() {
  const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
  const topLane = 110 + Math.random() * 150;
  const midLane = 245 + Math.random() * 120;
  const lowLane = groundY - 70 - Math.random() * 140;
  let y = lowLane;
  if (type.lane === "top") y = topLane;
  if (type.lane === "mid") y = midLane;
  if (type.lane === "any") y = Math.random() > 0.44 ? lowLane : topLane + 120;
  const angle = type.kind === "vessel" ? (Math.random() - 0.5) * 0.65 : 0;
  const obstacle = makeObstacle(type.kind, canvas.width + 100, y, angle);
  obstacles.push(obstacle);
}

function spawnTumor() {
  tumors.push(makeTumor(canvas.width + 130, 255 + Math.random() * 245));
}

function spawnPainSpot() {
  const bone = makeObstacle("bone", canvas.width + 240, groundY - 92 - Math.random() * 58, (Math.random() - 0.5) * 0.08);
  obstacles.push(bone);
}

function spawnPickup() {
  pickups.push({ x: canvas.width + 90, y: 210 + Math.random() * 280, r: 13, taken: false });
}

function circleRect(circle, rect) {
  const closeX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closeY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  return Math.hypot(circle.x - closeX, circle.y - closeY) < circle.radius;
}

function circleCircle(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.r;
}

function addBurst(x, y, color, count = 24, force = 7) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * force,
      vy: (Math.random() - 0.5) * force,
      life: 28 + Math.random() * 20,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

function damagePlayer(amount, color) {
  safety = Math.max(0, safety - amount);
  energy = Math.max(0, energy - amount * 0.45);
  focus.vy = -8;
  addBurst(focus.x, focus.y, color, 22, 9);
}

function update() {
  if (state === "countdown") {
    updateCountdown();
    return;
  }

  if (state === "charging") {
    updateCharging();
    return;
  }

  if (state === "launching") {
    updateLaunch();
    return;
  }

  if (state !== "playing") return;

  frame += 1;
  speed += 0.0009;
  distance += speed / 14;
  energy = Math.min(100, energy + 0.04);
  focus.vy += 0.68;
  focus.y += focus.vy;

  if (focus.y + focus.radius > groundY) {
    focus.y = groundY - focus.radius;
    focus.vy = 0;
  }

  if (focus.y - focus.radius < 78) {
    focus.y = 78 + focus.radius;
    focus.vy *= -0.28;
  }

  focus.trail.unshift({ x: focus.x, y: focus.y, life: 1 });
  focus.trail = focus.trail.slice(0, 18).map((dot) => ({ ...dot, life: dot.life - 0.045 }));

  if (frame % 142 === 0) spawnObstacle();
  if (frame % 230 === 0) spawnTumor();
  if (frame % 190 === 0) spawnPickup();
  if (frame % 360 === 0) spawnPainSpot();

  obstacles.forEach((obstacle) => {
    obstacle.x -= speed;
    obstacle.phase += 0.06;
    const hitbox = {
      x: obstacle.x,
      y: obstacle.y,
      w: obstacle.w,
      h: obstacle.h,
    };
    if (!obstacle.hit && circleRect(focus, hitbox)) {
      if (obstacle.kind === "bone") {
        treatBonePain(obstacle);
      } else {
        obstacle.hit = true;
        damagePlayer(obstacle.damage, obstacle.color);
      }
    }
  });

  tumors.forEach((tumor) => {
    tumor.x -= speed;
    tumor.pulse += 0.1;
    if (!tumor.hit && circleCircle(focus, tumor)) {
      tumor.hit = true;
      hits += 1;
      energy = Math.min(100, energy + 13);
      ablationMessage = { x: tumor.x, y: tumor.y, life: 86 };
      addBurst(tumor.x, tumor.y, "#8fff29", 42, 11);
    }
  });

  pickups.forEach((pickup) => {
    pickup.x -= speed;
    if (!pickup.taken && circleCircle(focus, pickup)) {
      pickup.taken = true;
      coins += 1;
      addBurst(pickup.x, pickup.y, "#ffd84a", 18, 8);
    }
  });

  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.04;
    particle.life -= 1;
  });
  if (ablationMessage) {
    ablationMessage.x -= speed;
    ablationMessage.life -= 1;
    if (ablationMessage.life <= 0) ablationMessage = null;
  }
  if (painReliefMessage) {
    painReliefMessage.x -= speed;
    painReliefMessage.life -= 1;
    if (painReliefMessage.life <= 0) painReliefMessage = null;
  }

  obstacles = obstacles.filter((obstacle) => obstacle.x > -260);
  tumors = tumors.filter((tumor) => tumor.x > -140 && !tumor.hit);
  pickups = pickups.filter((pickup) => pickup.x > -80 && !pickup.taken);
  particles = particles.filter((particle) => particle.life > 0);

  if (safety <= 0 || energy <= 0) {
    state = "dead";
    showOverlay("YOU DIED!", "不能碰血管、神經、器官、胸腔或腸胃。重新規劃路徑再試一次。", "Space / Click / Tap RETRY");
  } else if (distance >= levelLength) {
    state = "complete";
    showOverlay("LEVEL COMPLETE!", `腫瘤命中 ${hits} 次，骨痛等級降到 ${painLevel}/10，安全率 ${Math.round(safety)}%。`, "Space / Click / Tap NEXT LEVEL", "complete");
  }

  updateUi();
}

function treatBonePain(bone) {
  if (bone.treated) return;
  bone.treated = true;
  bone.hit = false;
  painTreatments += 1;
  painLevel = Math.max(0, painLevel - 4);
  energy = Math.min(100, energy + 8);
  painReliefMessage = { x: bone.x + bone.w / 2, y: bone.y + bone.h / 2, life: 95 };
  addBurst(bone.x + bone.w / 2, bone.y + bone.h / 2, "#ffd84a", 38, 9);
}

function updateCountdown() {
  countdownFrame += 1;
  frame += 1;
  if (countdownFrame >= 120) startCharging();
  updateUi();
}

function updateCharging() {
  frame += 1;
  if (isCharging) {
    chargeLevel += 0.018 * chargeDirection;
    if (chargeLevel >= 1) {
      chargeLevel = 1;
      chargeDirection = -1;
    }
    if (chargeLevel <= 0.08) {
      chargeLevel = 0.08;
      chargeDirection = 1;
    }
  } else {
    chargeLevel = 0.18 + Math.sin(frame * 0.045) * 0.025;
  }
  energy = Math.round(58 + chargeLevel * 42);
  if (frame % 10 === 0 && isCharging) {
    addBurst(245 + chargeLevel * 220, 390, "#5afcff", 4, 3);
  }
  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.04;
    particle.life -= 1;
  });
  particles = particles.filter((particle) => particle.life > 0);
  updateUi();
}

function updateLaunch() {
  launchFrame += 1;
  frame += 1;
  const launchProgress = Math.min(1, launchFrame / 82);
  energy = Math.round(58 + chargeLevel * 42);
  focus.x = 178 + easeOutCubic(launchProgress) * 26;
  focus.y = 430 - Math.sin(launchProgress * Math.PI) * (32 + chargeLevel * 30);

  if (launchFrame % 8 === 0) {
    addBurst(210 + launchProgress * 190, focus.y, "#5afcff", 4 + Math.round(chargeLevel * 6), 3 + chargeLevel * 4);
  }

  if (launchFrame >= 96) {
    focus.x = 178;
    resetGame();
  } else {
    updateUi();
  }
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function updateUi() {
  const progress = Math.min(100, Math.round((distance / levelLength) * 100));
  ui.energy.textContent = `${Math.round(energy)}%`;
  ui.safety.textContent = `${Math.round(safety)}%`;
  ui.hits.textContent = `${hits + painTreatments}`;
  ui.distance.textContent = `${Math.round(distance)} m`;
  ui.progressText.textContent = `${progress}%`;
  ui.progressBar.style.width = `${progress}%`;
  ui.coins.textContent = coins;
}

function showOverlay(title, copy, hint, mode = "") {
  overlay.className = `overlay ${mode}`.trim();
  overlay.querySelector("h2").textContent = title;
  overlay.querySelector("p").textContent = copy;
  overlay.querySelector("small").textContent = hint;
}

function countdownText() {
  if (countdownFrame < 30) return "3";
  if (countdownFrame < 60) return "2";
  if (countdownFrame < 90) return "1";
  return "FOCUS";
}

function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#06283b");
  bg.addColorStop(0.48, "#06372f");
  bg.addColorStop(1, "#031016");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (drawSprite("poster", canvas.width - 520 - ((frame * speed * 0.08) % 120), 96, 500, 300, 0, 0.16)) {
    ctx.fillStyle = "rgba(2, 16, 25, 0.48)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.globalAlpha = 0.26;
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 167 - frame * speed * 0.45) % (canvas.width + 160) - 80;
    const y = 80 + ((i * 71) % 560);
    const r = 2 + ((i * 19) % 14);
    ctx.fillStyle = i % 5 === 0 ? "#8fff29" : "#5afcff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(90, 252, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let x = -((frame * speed) % 86); x < canvas.width; x += 86) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

function drawScannerPanel(title, subtitle, progress, accent = "#5afcff") {
  ctx.save();
  ctx.fillStyle = "rgba(3, 18, 26, 0.66)";
  ctx.strokeStyle = "rgba(90, 252, 255, 0.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(32, 34, 520, 154, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(242, 253, 255, 0.96)";
  ctx.font = "900 32px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, 58, 82);

  ctx.font = "900 17px sans-serif";
  ctx.fillStyle = "rgba(201, 251, 255, 0.9)";
  ctx.fillText(subtitle, 58, 116);

  ctx.fillStyle = "rgba(90, 252, 255, 0.16)";
  ctx.fillRect(58, 142, 430, 18);
  ctx.fillStyle = accent;
  ctx.fillRect(58, 142, 430 * Math.max(0, Math.min(1, progress)), 18);
  ctx.strokeStyle = "rgba(90, 252, 255, 0.75)";
  ctx.strokeRect(58, 142, 430, 18);

  ctx.fillStyle = "rgba(242, 253, 255, 0.86)";
  ctx.font = "900 13px sans-serif";
  ctx.fillText("SCAN", 58, 177);
  ctx.fillText("LOCK", 180, 177);
  ctx.fillText("ENERGY", 302, 177);
  ctx.fillText("FOCUS", 430, 177);
  ctx.restore();
}

function drawTargetLock(x, y, radius, progress, accent = "#8fff29") {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.setLineDash([14, 12]);
  ctx.rotate(frame * 0.018);
  ctx.beginPath();
  ctx.arc(0, 0, radius + Math.sin(frame * 0.08) * 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.rotate(-frame * 0.034);
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(radius - 12, 0);
    ctx.lineTo(radius + 30 + progress * 18, 0);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(242, 253, 255, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(18, 0);
  ctx.moveTo(0, -18);
  ctx.lineTo(0, 18);
  ctx.stroke();
  ctx.restore();
}

function drawEnergyRings(x, y, radius, intensity) {
  ctx.save();
  for (let i = 0; i < 5; i += 1) {
    const pulse = ((frame * 0.018 + i * 0.18) % 1);
    ctx.strokeStyle = `rgba(90, 252, 255, ${0.38 * (1 - pulse) + intensity * 0.18})`;
    ctx.lineWidth = 2 + intensity * 5;
    ctx.beginPath();
    ctx.arc(x, y, radius + pulse * 92 + i * 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCircularProbe(x, y, radius, intensity) {
  ctx.save();
  ctx.translate(x, y);

  const outerGlow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.8);
  outerGlow.addColorStop(0, `rgba(90, 252, 255, ${0.18 + intensity * 0.18})`);
  outerGlow.addColorStop(0.48, "rgba(90, 252, 255, 0.08)");
  outerGlow.addColorStop(1, "rgba(90, 252, 255, 0)");
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.85, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 3; i += 1) {
    ctx.strokeStyle = `rgba(90, 252, 255, ${0.28 - i * 0.06 + intensity * 0.12})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius + i * 22 + Math.sin(frame * 0.06 + i) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  const body = ctx.createRadialGradient(-radius * 0.34, -radius * 0.34, 8, 0, 0, radius);
  body.addColorStop(0, "#eaffff");
  body.addColorStop(0.32, "#62ecff");
  body.addColorStop(0.68, "#126c88");
  body.addColorStop(1, "#061927");
  ctx.fillStyle = body;
  ctx.strokeStyle = "rgba(213, 255, 255, 0.95)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const aperture = ctx.createLinearGradient(-radius, 0, radius, 0);
  aperture.addColorStop(0, "rgba(242, 253, 255, 0.18)");
  aperture.addColorStop(0.5, "rgba(153, 255, 255, 0.86)");
  aperture.addColorStop(1, "rgba(242, 253, 255, 0.18)");
  ctx.strokeStyle = aperture;
  ctx.lineWidth = 12 + intensity * 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(radius * 0.42, -radius * 0.72);
  ctx.quadraticCurveTo(radius * 0.9, 0, radius * 0.42, radius * 0.72);
  ctx.stroke();

  ctx.fillStyle = "rgba(242, 253, 255, 0.86)";
  ctx.beginPath();
  ctx.arc(-radius * 0.32, -radius * 0.38, radius * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(5, 24, 34, 0.86)";
  ctx.font = "900 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HIFU", -radius * 0.05, radius * 0.12);
  ctx.restore();
}

function drawConeBeam(startX, startY, endX, endY, intensity, progress = 1) {
  const dx = endX - startX;
  const dy = endY - startY;
  const distanceToTarget = Math.hypot(dx, dy) || 1;
  const ux = dx / distanceToTarget;
  const uy = dy / distanceToTarget;
  const nx = -uy;
  const ny = ux;
  const activeDistance = distanceToTarget * Math.max(0.18, Math.min(1, progress));
  const focusX = startX + ux * activeDistance;
  const focusY = startY + uy * activeDistance;
  const baseWidth = 190 + intensity * 95;
  const baseTopX = startX + nx * baseWidth * 0.5;
  const baseTopY = startY + ny * baseWidth * 0.5;
  const baseBottomX = startX - nx * baseWidth * 0.5;
  const baseBottomY = startY - ny * baseWidth * 0.5;

  ctx.save();
  const cone = ctx.createLinearGradient(startX, startY, focusX, focusY);
  cone.addColorStop(0, `rgba(90, 252, 255, ${0.22 + intensity * 0.18})`);
  cone.addColorStop(0.68, "rgba(90, 252, 255, 0.12)");
  cone.addColorStop(1, `rgba(143, 255, 41, ${0.36 + intensity * 0.18})`);
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(baseTopX, baseTopY);
  ctx.lineTo(focusX, focusY);
  ctx.lineTo(baseBottomX, baseBottomY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(185, 255, 255, ${0.4 + intensity * 0.24})`;
  ctx.lineWidth = 3 + intensity * 4;
  ctx.beginPath();
  ctx.moveTo(baseTopX, baseTopY);
  ctx.lineTo(focusX, focusY);
  ctx.lineTo(baseBottomX, baseBottomY);
  ctx.stroke();

  ctx.lineCap = "round";
  for (let i = 0; i < 8; i += 1) {
    const t = (i + 1) / 9;
    const waveCenterX = startX + ux * activeDistance * t;
    const waveCenterY = startY + uy * activeDistance * t;
    const waveWidth = baseWidth * (1 - t) * (0.42 + intensity * 0.18);
    const phase = Math.sin(frame * 0.14 + i * 0.8) * 7;
    ctx.strokeStyle = `rgba(242, 253, 255, ${0.1 + intensity * 0.08})`;
    ctx.lineWidth = 2 + intensity * 2;
    ctx.beginPath();
    ctx.moveTo(waveCenterX + nx * waveWidth * 0.5 + ux * phase, waveCenterY + ny * waveWidth * 0.5 + uy * phase);
    ctx.lineTo(waveCenterX - nx * waveWidth * 0.5 + ux * phase, waveCenterY - ny * waveWidth * 0.5 + uy * phase);
    ctx.stroke();
  }

  const focusGlow = ctx.createRadialGradient(focusX, focusY, 4, focusX, focusY, 76 + intensity * 28);
  focusGlow.addColorStop(0, "rgba(255, 255, 255, 0.98)");
  focusGlow.addColorStop(0.24, "rgba(143, 255, 41, 0.62)");
  focusGlow.addColorStop(1, "rgba(143, 255, 41, 0)");
  ctx.fillStyle = focusGlow;
  ctx.beginPath();
  ctx.arc(focusX, focusY, 76 + intensity * 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFocusingBeam(startX, startY, endX, endY, intensity, phase = 0) {
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 7; i += 1) {
    const wave = Math.sin(frame * 0.08 + i + phase) * (10 + intensity * 18);
    const alpha = 0.08 + i * 0.055 + intensity * 0.12;
    ctx.strokeStyle = `rgba(90, 252, 255, ${alpha})`;
    ctx.lineWidth = 22 - i * 2 + intensity * 9;
    ctx.beginPath();
    ctx.moveTo(startX, startY + wave * 0.2);
    ctx.bezierCurveTo(
      startX + 170,
      startY - 86 + wave,
      endX - 170,
      endY + 72 - wave,
      endX,
      endY,
    );
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(242, 253, 255, 0.86)";
  ctx.lineWidth = 3 + intensity * 3;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(startX + 200, startY - 54, endX - 180, endY + 48, endX, endY);
  ctx.stroke();
  ctx.restore();
}

function drawLaunchScene() {
  drawBackground();
  drawTissueFloor();

  const launchProgress = Math.min(1, launchFrame / 82);
  const targetX = 870;
  const targetY = 360;
  const probeX = 190;
  const probeY = 386;
  const startX = probeX + 70;
  const startY = probeY;
  const orbX = startX + easeOutCubic(launchProgress) * (targetX - startX);
  const orbY = startY + easeOutCubic(launchProgress) * (targetY - startY) - Math.sin(launchProgress * Math.PI) * (38 + chargeLevel * 28);

  drawEnergyRings(probeX, probeY, 76, chargeLevel);
  drawConeBeam(startX, startY, targetX, targetY, chargeLevel, launchProgress);
  drawCircularProbe(probeX, probeY, 78, chargeLevel);
  drawTargetLock(targetX, targetY, 72, launchProgress);
  drawSprite("tumor", targetX - 62, targetY - 58, 124, 116);

  if (launchProgress > 0.72) {
    const shock = (launchProgress - 0.72) / 0.28;
    ctx.strokeStyle = `rgba(143, 255, 41, ${0.75 * (1 - shock)})`;
    ctx.lineWidth = 8 * (1 - shock) + 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 40 + shock * 130, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawSprite("focus", orbX - 58, orbY - 58, 116, 116);

  drawScannerPanel("超音波發射中", `能量 ${Math.round(chargeLevel * 100)}% 已釋放，焦點進入治療路徑。`, launchProgress, "rgba(143, 255, 41, 0.92)");
  ctx.fillStyle = "rgba(143, 255, 41, 0.96)";
  ctx.font = "900 16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("1. 定位  2. 聚焦  3. 發射  4. 命中腫瘤", 58, 218);
}

function drawCountdownScene() {
  drawBackground();
  drawTissueFloor();
  const progress = Math.min(1, countdownFrame / 120);
  const targetX = 872;
  const targetY = 356;
  const probeX = 190;
  const probeY = 386;

  drawEnergyRings(probeX, probeY, 58, progress);
  drawConeBeam(probeX + 70, probeY, targetX, targetY, 0.24 + progress * 0.28, 1);
  drawCircularProbe(probeX, probeY, 76, 0.28 + progress * 0.28);
  drawTargetLock(targetX, targetY, 70, progress);
  drawSprite("tumor", targetX - 64, targetY - 58, 128, 118);

  drawScannerPanel("準備聚焦治療路徑", "掃描腫瘤邊界，避開血管、神經與正常組織。", progress);

  ctx.fillStyle = countdownText() === "FOCUS" ? "rgba(143, 255, 41, 0.98)" : "rgba(90, 252, 255, 0.98)";
  ctx.font = "900 128px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = countdownText() === "FOCUS" ? "rgba(143, 255, 41, 0.95)" : "rgba(90, 252, 255, 0.95)";
  ctx.shadowBlur = 28;
  ctx.fillText(countdownText(), canvas.width / 2, 280);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(201, 251, 255, 0.92)";
  ctx.font = "900 20px sans-serif";
  ctx.fillText("倒數結束後，按住畫面或空白鍵充能，放開發射。", canvas.width / 2, 342);
}

function drawChargingScene() {
  drawBackground();
  drawTissueFloor();
  const targetX = 872;
  const targetY = 356;
  const probeX = 190;
  const probeY = 386;
  const beamIntensity = 0.24 + chargeLevel * 0.76;

  drawEnergyRings(probeX, probeY, 70, beamIntensity);
  drawConeBeam(probeX + 70, probeY, targetX, targetY, beamIntensity, 1);
  drawCircularProbe(probeX, probeY, 78, beamIntensity);
  drawTargetLock(targetX, targetY, 72, chargeLevel);
  drawSprite("tumor", targetX - 63, targetY - 58, 126, 116);
  drawParticles();

  drawSprite("focus", targetX - 45, targetY - 45, 90, 90, 0, 0.72 + chargeLevel * 0.28);

  const meterColor = chargeLevel > 0.78 ? "rgba(255, 216, 74, 0.95)" : "rgba(143, 255, 41, 0.95)";
  drawScannerPanel("按住充能，放開發射", "充能越高，焦點初始能量越高。看準節奏再放開。", chargeLevel, meterColor);

  ctx.fillStyle = "#f2fdff";
  ctx.font = "900 18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`初始能量 ${Math.round(58 + chargeLevel * 42)}%`, 58, 218);

  if (chargeLevel > 0.86) {
    ctx.fillStyle = "rgba(255, 216, 74, 0.95)";
    ctx.shadowColor = "rgba(255, 216, 74, 0.8)";
    ctx.shadowBlur = 18;
    ctx.fillText("HIGH POWER LOCK", 280, 218);
    ctx.shadowBlur = 0;
  }
}

function drawTissueFloor() {
  ctx.fillStyle = "rgba(8, 52, 47, 0.68)";
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
  ctx.strokeStyle = "rgba(90, 252, 255, 0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();

  for (let i = 0; i < 26; i += 1) {
    const x = (i * 92 - frame * speed * 0.7) % (canvas.width + 100) - 60;
    const y = groundY + 28 + Math.sin(i) * 10;
    ctx.fillStyle = "rgba(90, 252, 255, 0.1)";
    ctx.beginPath();
    ctx.ellipse(x, y, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFocus() {
  focus.trail.forEach((dot, index) => {
    ctx.globalAlpha = Math.max(0, dot.life) * 0.45;
    ctx.fillStyle = "#5afcff";
    ctx.beginPath();
    ctx.arc(dot.x - index * 2, dot.y, focus.radius * (1 - index / 24), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  const beam = ctx.createLinearGradient(0, focus.y, focus.x, focus.y);
  beam.addColorStop(0, "rgba(90, 252, 255, 0)");
  beam.addColorStop(0.72, "rgba(90, 252, 255, 0.25)");
  beam.addColorStop(1, "rgba(90, 252, 255, 0.92)");
  ctx.strokeStyle = beam;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, focus.y);
  ctx.lineTo(focus.x, focus.y);
  ctx.stroke();

  const glow = ctx.createRadialGradient(focus.x, focus.y, 2, focus.x, focus.y, 92);
  glow.addColorStop(0, "rgba(255, 255, 255, 1)");
  glow.addColorStop(0.16, "rgba(90, 252, 255, 0.92)");
  glow.addColorStop(0.48, "rgba(34, 185, 255, 0.34)");
  glow.addColorStop(1, "rgba(34, 185, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(focus.x, focus.y, 92, 0, Math.PI * 2);
  ctx.fill();

  if (!drawSprite("focus", focus.x - 58, focus.y - 58, 116, 116)) {
    ctx.fillStyle = "#f2fdff";
    ctx.strokeStyle = "#5afcff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(focus.x, focus.y, focus.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawVessel(obstacle) {
  if (drawSprite("vessel", obstacle.x - 38, obstacle.y - 58, obstacle.w + 96, obstacle.h + 98, obstacle.angle)) return;

  ctx.save();
  ctx.translate(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2);
  ctx.rotate(obstacle.angle);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(65, 5, 8, 0.72)";
  ctx.lineWidth = obstacle.h + 16;
  ctx.beginPath();
  ctx.moveTo(-obstacle.w / 2, Math.sin(obstacle.phase) * 5);
  ctx.bezierCurveTo(-50, -26, 42, 28, obstacle.w / 2, Math.sin(obstacle.phase + 1) * 7);
  ctx.stroke();
  ctx.strokeStyle = obstacle.color;
  ctx.lineWidth = obstacle.h;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 160, 150, 0.72)";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

function drawNerve(obstacle) {
  if (drawSprite("nerve", obstacle.x - 14, obstacle.y - 18, obstacle.w + 44, obstacle.h + 42)) return;

  ctx.fillStyle = obstacle.color;
  ctx.strokeStyle = "#fff3a6";
  ctx.lineWidth = 3;
  const spikes = 3;
  for (let i = 0; i < spikes; i += 1) {
    const x = obstacle.x + i * 34;
    ctx.beginPath();
    ctx.moveTo(x, obstacle.y + obstacle.h);
    ctx.lineTo(x + 27, obstacle.y);
    ctx.lineTo(x + 54, obstacle.y + obstacle.h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawOrgan(obstacle) {
  const pulse = 1 + Math.sin(obstacle.phase) * 0.08;
  if (drawSprite("organ", obstacle.x - 38, obstacle.y - 42, 164 * pulse, 150 * pulse)) return;

  ctx.fillStyle = "rgba(143, 255, 41, 0.18)";
  ctx.beginPath();
  ctx.arc(obstacle.x + 44, obstacle.y + 44, 70 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = obstacle.color;
  ctx.strokeStyle = "#efffb7";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const radius = (i % 2 === 0 ? 48 : 34) * pulse;
    const x = obstacle.x + 44 + Math.cos(angle) * radius;
    const y = obstacle.y + 44 + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawChest(obstacle) {
  const pulse = 1 + Math.sin(obstacle.phase) * 0.04;
  if (drawSprite("chest", obstacle.x - 35, obstacle.y - 42, 176 * pulse, 150 * pulse)) return;

  ctx.fillStyle = obstacle.color;
  ctx.beginPath();
  ctx.ellipse(obstacle.x + 55, obstacle.y + 50, 58, 48, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBone(obstacle) {
  if (drawSprite("bone", obstacle.x - 38, obstacle.y - 40, obstacle.w + 94, obstacle.h + 72, obstacle.angle, obstacle.treated ? 0.45 : 1)) {
    if (obstacle.treated) drawTreatedBoneOverlay(obstacle);
    return;
  }

  ctx.fillStyle = obstacle.treated ? "#8fff29" : obstacle.color;
  ctx.beginPath();
  ctx.roundRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, 30);
  ctx.fill();
  if (obstacle.treated) drawTreatedBoneOverlay(obstacle);
}

function drawTreatedBoneOverlay(obstacle) {
  const cx = obstacle.x + obstacle.w / 2;
  const cy = obstacle.y + obstacle.h / 2;
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 130);
  glow.addColorStop(0, "rgba(143, 255, 41, 0.75)");
  glow.addColorStop(0.45, "rgba(255, 216, 74, 0.35)");
  glow.addColorStop(1, "rgba(143, 255, 41, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 130, 78, obstacle.angle, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(143, 255, 41, 0.95)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 42, cy);
  ctx.lineTo(cx - 12, cy + 28);
  ctx.lineTo(cx + 52, cy - 34);
  ctx.stroke();

  ctx.fillStyle = "rgba(242, 253, 255, 0.96)";
  ctx.font = "900 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PAIN RELIEF", cx, cy - 54);
}

function drawGut(obstacle) {
  if (drawSprite("gut", obstacle.x - 36, obstacle.y - 44, obstacle.w + 80, obstacle.h + 74, obstacle.angle)) return;

  ctx.strokeStyle = obstacle.color;
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(obstacle.x, obstacle.y + 35);
  ctx.bezierCurveTo(obstacle.x + 52, obstacle.y - 18, obstacle.x + 104, obstacle.y + 90, obstacle.x + 150, obstacle.y + 35);
  ctx.stroke();
}

function drawObstacle(obstacle) {
  if (obstacle.kind === "vessel") drawVessel(obstacle);
  if (obstacle.kind === "nerve") drawNerve(obstacle);
  if (obstacle.kind === "organ") drawOrgan(obstacle);
  if (obstacle.kind === "chest") drawChest(obstacle);
  if (obstacle.kind === "bone") drawBone(obstacle);
  if (obstacle.kind === "gut") drawGut(obstacle);

  ctx.fillStyle = "#f2fdff";
  ctx.font = "900 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(obstacle.label, obstacle.x + obstacle.w / 2, obstacle.y - 12);
}

function drawTumor(tumor) {
  if (tumor.hit) return;
  const pulse = 1 + Math.sin(tumor.pulse) * 0.09;
  if (drawSprite("tumor", tumor.x - tumor.r * 1.85 * pulse, tumor.y - tumor.r * 1.7 * pulse, tumor.r * 3.7 * pulse, tumor.r * 3.4 * pulse)) {
    ctx.fillStyle = "#f2fdff";
    ctx.font = "900 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("腫瘤", tumor.x, tumor.y + tumor.r + 26);
    return;
  }

  ctx.fillStyle = "rgba(143, 255, 41, 0.2)";
  ctx.beginPath();
  ctx.arc(tumor.x, tumor.y, tumor.r * 2.1 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#baff42";
  ctx.strokeStyle = "#f6ffd0";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const radius = tumor.r * (i % 2 === 0 ? 1.2 : 0.78) * pulse;
    const x = tumor.x + Math.cos(angle) * radius;
    const y = tumor.y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#173000";
  ctx.font = "900 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("腫瘤", tumor.x, tumor.y + 5);
}

function drawPickup(pickup) {
  if (drawSprite("coin", pickup.x - 25, pickup.y - 25, 50, 50)) return;

  ctx.fillStyle = "#ffd84a";
  ctx.strokeStyle = "#fff5a8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pickup.x, pickup.y, pickup.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6f4600";
  ctx.font = "900 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("$", pickup.x, pickup.y + 5);
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life / 48);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawAblationMessage() {
  if (!ablationMessage) return;
  const alpha = Math.min(1, ablationMessage.life / 24);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.font = "900 24px sans-serif";
  ctx.fillStyle = "rgba(143, 255, 41, 0.98)";
  ctx.shadowColor = "rgba(143, 255, 41, 0.9)";
  ctx.shadowBlur = 18;
  ctx.fillText("ABLATION COMPLETE", ablationMessage.x, ablationMessage.y - 76);
  ctx.font = "900 18px sans-serif";
  ctx.fillStyle = "#f2fdff";
  ctx.fillText("治療完成", ablationMessage.x, ablationMessage.y - 48);
  ctx.restore();
}

function drawPainReliefMessage() {
  if (!painReliefMessage) return;
  const alpha = Math.min(1, painReliefMessage.life / 24);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.font = "900 24px sans-serif";
  ctx.fillStyle = "rgba(255, 216, 74, 0.98)";
  ctx.shadowColor = "rgba(255, 145, 69, 0.9)";
  ctx.shadowBlur = 18;
  ctx.fillText("PAIN RELIEF COMPLETE", painReliefMessage.x, painReliefMessage.y - 78);
  ctx.font = "900 18px sans-serif";
  ctx.fillStyle = "#f2fdff";
  ctx.fillText(`疼痛降至 ${painLevel}/10`, painReliefMessage.x, painReliefMessage.y - 50);
  ctx.restore();
}

function drawDecorations() {
  ctx.fillStyle = "rgba(255, 216, 74, 0.95)";
  ctx.font = "900 26px sans-serif";
  for (let i = 0; i < 5; i += 1) {
    const x = (canvas.width - ((frame * speed * 0.85 + i * 260) % (canvas.width + 400))) + 200;
    ctx.fillText("★", x, 104 + (i % 2) * 44);
  }

  ctx.fillStyle = "rgba(242, 253, 255, 0.82)";
  ctx.font = "900 18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("治療路徑：避開正常組織  →  腫瘤消失 / 骨頭變色止痛", 32, canvas.height - 34);
  ctx.font = "900 16px sans-serif";
  ctx.fillStyle = "rgba(143, 255, 41, 0.96)";
  ctx.fillText("可碰：腫瘤 / 骨頭疼痛區 / 金色能量幣", 32, 86);
  ctx.fillStyle = "rgba(255, 143, 133, 0.96)";
  ctx.fillText("不可碰：血管 / 神經 / 器官 / 胸腔 / 腸胃", 32, 112);
  ctx.fillStyle = "rgba(255, 216, 74, 0.96)";
  ctx.fillText(`骨痛 ${painLevel}/10   骨頭變綠 = 治療完成`, 32, 138);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state === "countdown") {
    drawCountdownScene();
    return;
  }

  if (state === "charging") {
    drawChargingScene();
    return;
  }

  if (state === "launching") {
    drawLaunchScene();
    return;
  }

  drawBackground();
  drawTissueFloor();
  drawDecorations();
  tumors.forEach(drawTumor);
  pickups.forEach(drawPickup);
  obstacles.forEach(drawObstacle);
  drawParticles();
  drawAblationMessage();
  drawPainReliefMessage();
  drawFocus();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", () => {
  attempt = state === "menu" ? 1 : attempt + 1;
  startCountdown();
});
overlayPlay.addEventListener("click", jump);
pauseButton.addEventListener("click", togglePause);
canvas.addEventListener("pointerdown", jump);
canvas.addEventListener("pointerup", releaseUltrasound);
canvas.addEventListener("pointercancel", releaseUltrasound);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    jump();
  }
  if (event.code === "KeyP") togglePause();
});
window.addEventListener("keyup", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    releaseUltrasound();
  }
});

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
    return this;
  };
}

updateUi();
loop();
