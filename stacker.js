const stackerPlayersRef = db.ref("stacker/players");
const loginGate = document.getElementById("loginGate");
const stackerView = document.getElementById("stackerView");
const playerNameEl = document.getElementById("stackerPlayerName");
const levelEl = document.getElementById("stackerLevel");
const bestEl = document.getElementById("stackerBest");
const speedEl = document.getElementById("stackerSpeed");
const machineEl = document.getElementById("stackerMachine");
const statusEl = document.getElementById("stackerStatus");
const controlEl = document.getElementById("stackerControl");
const controlIconEl = document.getElementById("controlIcon");
const controlTextEl = document.getElementById("controlText");
const leadersEl = document.getElementById("stackerLeaders");
const seasonalLogos = document.querySelectorAll(".seasonal-phone-logo");

const ROWS = 12;
const COLS = 7;
const previewMode = new URLSearchParams(window.location.search).get("preview") === "1";
const sessionGuest = sessionStorage.getItem("grumpysTriviaIsGuest") === "true";
const playerId = previewMode ? "preview_player" : sessionGuest ? sessionStorage.getItem("grumpysTriviaPlayerId") : localStorage.getItem("grumpysTriviaPlayerId");
const playerName = previewMode ? "Trivia King" : sessionGuest ? sessionStorage.getItem("grumpysTriviaPlayerName") : localStorage.getItem("grumpysTriviaPlayerName");
const isGuest = previewMode || sessionGuest;
const bestKey = `stackerBest_${playerId || "guest"}`;

let bestLevel = Number(localStorage.getItem(bestKey)) || 0;
let lockedRows = [];
let activeRow = 0;
let movingStart = 0;
let movingWidth = 3;
let direction = 1;
let gameState = "idle";
let stepMs = 250;
let lastStepAt = 0;
let animationFrame = null;
let failedCells = [];
let lastControlAt = 0;

const cells = [];
for (let displayRow = 0; displayRow < ROWS; displayRow += 1) {
  for (let column = 0; column < COLS; column += 1) {
    const cell = document.createElement("div");
    cell.className = "stacker-cell";
    cell.dataset.row = String(ROWS - 1 - displayRow);
    cell.dataset.column = String(column);
    cell.style.setProperty("--block-hue",String((ROWS - 1 - displayRow) * 24 + 178));
    machineEl.appendChild(cell);
    cells.push(cell);
  }
}

function setSeasonalBranding(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  const christmas = month === 11 || (month === 0 && day === 1);
  const patriotic = (month === 6 && day >= 1 && day <= 7) || (month === 4 && day >= 23) || (month === 10 && day >= 8 && day <= 12);
  const source = christmas ? "assets/grumpys-logo-christmas.png" : patriotic ? "assets/grumpys-logo-usa.png" : "assets/grumpys-logo.png";
  seasonalLogos.forEach(logo => { logo.src = source; });
}

function positions(start, width) {
  return Array.from({length:width},(_,index) => start + index);
}

function speedLabel() {
  return `${(250 / stepMs).toFixed(1).replace(".0","")}×`;
}

function renderBoard() {
  const moving = gameState === "playing" ? positions(movingStart,movingWidth) : [];
  cells.forEach(cell => {
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    const locked = lockedRows[row]?.includes(column);
    const isMoving = row === activeRow && moving.includes(column);
    const failed = row === activeRow && failedCells.includes(column);
    cell.className = "stacker-cell";
    if (locked) cell.classList.add("locked");
    if (isMoving) cell.classList.add("moving");
    if (failed) cell.classList.add("failed");
    if (gameState === "won" && locked) cell.classList.add("top-win");
  });
}

function updateScoreboard() {
  levelEl.textContent = Math.min(activeRow,ROWS);
  bestEl.textContent = bestLevel;
  speedEl.textContent = speedLabel();
}

function updateControl(icon,text,isDrop = false) {
  controlIconEl.textContent = icon;
  controlTextEl.textContent = text;
  controlEl.classList.toggle("is-drop",isDrop);
}

function animate(timestamp) {
  if (gameState !== "playing") return;
  if (!lastStepAt) lastStepAt = timestamp;
  if (timestamp - lastStepAt >= stepMs) {
    lastStepAt = timestamp;
    const maxStart = COLS - movingWidth;
    movingStart += direction;
    if (movingStart >= maxStart) { movingStart = maxStart; direction = -1; }
    if (movingStart <= 0) { movingStart = 0; direction = 1; }
    renderBoard();
  }
  animationFrame = requestAnimationFrame(animate);
}

function startMovement() {
  lastStepAt = 0;
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(animate);
}

async function saveBestLevel() {
  localStorage.setItem(bestKey,String(bestLevel));
  if (isGuest || !playerId) return;
  try {
    await stackerPlayersRef.child(playerId).transaction(profile => {
      const existing = profile || {};
      return {...existing,name:playerName || "Player",bestLevel:Math.max(Number(existing.bestLevel) || 0,bestLevel),updatedAt:Date.now()};
    });
  } catch (error) {
    console.error("Could not save Stacker best level:",error);
  }
}

function startGame() {
  lockedRows = [];
  failedCells = [];
  activeRow = 0;
  movingWidth = 3;
  movingStart = Math.floor((COLS - movingWidth) / 2);
  direction = Math.random() > .5 ? 1 : -1;
  stepMs = 250;
  gameState = "playing";
  statusEl.className = "stacker-status";
  statusEl.textContent = "Level 1 — tap when the moving blocks are lined up.";
  updateControl("⬇","Drop Blocks",true);
  updateScoreboard();
  renderBoard();
  startMovement();
}

function finishGame(won = false) {
  cancelAnimationFrame(animationFrame);
  gameState = won ? "won" : "over";
  if (won) {
    statusEl.className = "stacker-status win";
    statusEl.textContent = "Perfect tower! You cleared all 12 levels.";
    updateControl("↻","Stack Again");
  } else {
    statusEl.className = "stacker-status bad";
    statusEl.textContent = `Tower dropped! You reached level ${activeRow}.`;
    updateControl("↻","Try Again");
  }
  renderBoard();
}

function lockCurrentRow() {
  if (gameState !== "playing") return;
  const attempted = positions(movingStart,movingWidth);
  const overlap = activeRow === 0 ? attempted : attempted.filter(column => lockedRows[activeRow - 1].includes(column));

  if (!overlap.length) {
    failedCells = attempted;
    finishGame(false);
    return;
  }

  lockedRows[activeRow] = overlap;
  const trimmed = attempted.length - overlap.length;
  activeRow += 1;
  if (activeRow > bestLevel) {
    bestLevel = activeRow;
    saveBestLevel();
  }

  if (activeRow >= ROWS) {
    updateScoreboard();
    finishGame(true);
    return;
  }

  movingWidth = overlap.length;
  movingStart = direction > 0 ? 0 : COLS - movingWidth;
  stepMs = Math.max(82,250 - activeRow * 14);
  failedCells = [];
  statusEl.className = trimmed ? "stacker-status" : "stacker-status good";
  statusEl.textContent = trimmed ? `${trimmed} block${trimmed === 1 ? "" : "s"} fell — ${movingWidth} left. Keep going!` : `Perfect stack! Level ${activeRow + 1} is faster.`;
  updateScoreboard();
  renderBoard();
  startMovement();
}

function handleControl() {
  const now = performance.now();
  if (now - lastControlAt < 180) return;
  lastControlAt = now;
  if (gameState === "playing") lockCurrentRow();
  else startGame();
}

function renderLeaderboard(playersObj = {}) {
  const players = Object.entries(playersObj).map(([id,player]) => ({id,...player})).sort((a,b) => (b.bestLevel || 0) - (a.bestLevel || 0) || (a.name || "").localeCompare(b.name || "")).slice(0,5);
  const medals = ["🥇","🥈","🥉","4","5"];
  leadersEl.replaceChildren();
  if (!players.length) {
    const row = document.createElement("div");
    row.className = "stacker-leader-row";
    row.innerHTML = "<span>—</span><b>Be the first</b><strong>0</strong>";
    leadersEl.appendChild(row);
    return;
  }
  players.forEach((player,index) => {
    const row = document.createElement("div");
    row.className = `stacker-leader-row${player.id === playerId ? " is-you" : ""}`;
    const medal = document.createElement("span");
    const name = document.createElement("b");
    const score = document.createElement("strong");
    medal.textContent = medals[index];
    name.textContent = player.name || "Player";
    score.textContent = player.bestLevel || 0;
    row.append(medal,name,score);
    leadersEl.appendChild(row);
  });
}

function openGame() {
  if (!playerId || !playerName) {
    loginGate.classList.remove("hidden");
    return;
  }
  stackerView.classList.remove("hidden");
  playerNameEl.textContent = playerName;
  bestEl.textContent = bestLevel;
  renderBoard();

  if (previewMode) {
    renderLeaderboard({one:{name:"Block Party",bestLevel:12},two:{name:"Hot Dish",bestLevel:10},preview_player:{name:playerName,bestLevel:bestLevel || 8}});
    return;
  }

  stackerPlayersRef.on("value",snapshot => {
    const players = snapshot.val() || {};
    const savedBest = Number(players[playerId]?.bestLevel) || 0;
    if (savedBest > bestLevel) {
      bestLevel = savedBest;
      localStorage.setItem(bestKey,String(bestLevel));
      bestEl.textContent = bestLevel;
    }
    renderLeaderboard(players);
  },error => {
    console.error("Could not load Stacker leaderboard:",error);
    leadersEl.innerHTML = '<div class="stacker-leader-row"><span>!</span><b>Leaderboard unavailable</b><strong>—</strong></div>';
  });
}

controlEl.addEventListener("click",handleControl);
machineEl.addEventListener("click",() => { if (gameState === "playing") lockCurrentRow(); });
document.addEventListener("keydown",event => {
  if ((event.code === "Space" || event.code === "Enter") && !event.repeat) {
    event.preventDefault();
    handleControl();
  }
});
document.addEventListener("visibilitychange",() => { if (!document.hidden && gameState === "playing") startMovement(); });

setSeasonalBranding();
openGame();
