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

const levelLength = 1500;
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
let speed = 6.2;
let frame = 0;
let energy = 100;
let safety = 100;
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
  { kind: "bone", label: "骨頭", color: "#a9f5ff", w: 160, h: 70, damage: 22, lane: "low" },
  { kind: "gut", label: "腸胃", color: "#ff9c5b", w: 150, h: 96, damage: 18, lane: "low" },
];

function resetGame() {
  state = "playing";
  frame = 0;
  speed = 6.2;
  energy = 100;
  safety = 100;
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

function seedOpeningPattern() {
  obstacles.push(makeObstacle("vessel", 760, 505, -0.12));
  obstacles.push(makeObstacle("nerve", 1080, 150, 0));
  obstacles.push(makeObstacle("bone", 1580, 520, 0.02));
  obstacles.push(makeObstacle("chest", 1970, 255, 0));
  obstacles.push(makeObstacle("gut", 2300, 468, -0.06));
  tumors.push(makeTumor(1340, 456));
  tumors.push(makeTumor(2600, 330));
  pickups.push({ x: 620, y: 350, r: 14, taken: false });
  pickups.push({ x: 1840, y: 210, r: 14, taken: false });
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
    resetGame();
    return;
  }

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
  obstacles.push(makeObstacle(type.kind, canvas.width + 100, y, angle));
}

function spawnTumor() {
  tumors.push(makeTumor(canvas.width + 130, 255 + Math.random() * 245));
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
  if (state !== "playing") return;

  frame += 1;
  speed += 0.002;
  distance += speed / 12;
  energy = Math.min(100, energy + 0.025);
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

  if (frame % 72 === 0) spawnObstacle();
  if (frame % 132 === 0) spawnTumor();
  if (frame % 118 === 0) spawnPickup();

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
      obstacle.hit = true;
      damagePlayer(obstacle.damage, obstacle.color);
    }
  });

  tumors.forEach((tumor) => {
    tumor.x -= speed;
    tumor.pulse += 0.1;
    if (!tumor.hit && circleCircle(focus, tumor)) {
      tumor.hit = true;
      hits += 1;
      energy = Math.min(100, energy + 13);
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

  obstacles = obstacles.filter((obstacle) => obstacle.x > -260);
  tumors = tumors.filter((tumor) => tumor.x > -140);
  pickups = pickups.filter((pickup) => pickup.x > -80 && !pickup.taken);
  particles = particles.filter((particle) => particle.life > 0);

  if (safety <= 0 || energy <= 0) {
    state = "dead";
    showOverlay("YOU DIED!", "不能碰正常組織：血管、神經、器官、胸腔、骨頭、腸胃都會扣安全率。", "Space / Click / Tap RETRY");
  } else if (distance >= levelLength || hits >= 6) {
    state = "complete";
    showOverlay("LEVEL COMPLETE!", `腫瘤命中 ${hits} 次，正常組織安全率 ${Math.round(safety)}%。`, "Space / Click / Tap NEXT LEVEL", "complete");
  }

  updateUi();
}

function updateUi() {
  const progress = Math.min(100, Math.round((distance / levelLength) * 100));
  ui.energy.textContent = `${Math.round(energy)}%`;
  ui.safety.textContent = `${Math.round(safety)}%`;
  ui.hits.textContent = hits;
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
  if (drawSprite("bone", obstacle.x - 38, obstacle.y - 40, obstacle.w + 94, obstacle.h + 72, obstacle.angle)) return;

  ctx.fillStyle = obstacle.color;
  ctx.beginPath();
  ctx.roundRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, 30);
  ctx.fill();
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
  ctx.fillText("治療路徑：避開正常組織  →  聚焦能量  →  命中腫瘤", 32, canvas.height - 34);
  ctx.font = "900 16px sans-serif";
  ctx.fillStyle = "rgba(143, 255, 41, 0.96)";
  ctx.fillText("可碰：腫瘤 / 金色能量幣", 32, 86);
  ctx.fillStyle = "rgba(255, 143, 133, 0.96)";
  ctx.fillText("不可碰：血管 / 神經 / 器官 / 胸腔 / 骨頭 / 腸胃", 32, 112);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawTissueFloor();
  drawDecorations();
  tumors.forEach(drawTumor);
  pickups.forEach(drawPickup);
  obstacles.forEach(drawObstacle);
  drawParticles();
  drawFocus();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", () => {
  attempt = state === "menu" ? 1 : attempt + 1;
  resetGame();
});
overlayPlay.addEventListener("click", jump);
pauseButton.addEventListener("click", togglePause);
canvas.addEventListener("pointerdown", jump);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    jump();
  }
  if (event.code === "KeyP") togglePause();
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
