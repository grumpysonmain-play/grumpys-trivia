// Promo screen for the smaller TV in another room.
// It follows the main TV's game and shows one message at a time:
//   starting  (join phase)            -> big countdown, players in
//   live      (question / reveal)     -> question number, who's leading
//   between   (final / waiting / off) -> countdown to the next round, last champion
// It never shows the questions and never writes to Firebase.

const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);
const savedRoundsRef = db.ref("savedRounds");

const promoBrandLogo = document.getElementById("promoBrandLogo");
const stageEls = [...document.querySelectorAll(".stage")];
const startTimerEl = document.getElementById("startTimer");
const startLineEl = document.getElementById("startLine");
const liveQuestionEl = document.getElementById("liveQuestion");
const liveSegmentsEl = document.getElementById("liveSegments");
const liveLineEl = document.getElementById("liveLine");
const betweenTimerEl = document.getElementById("betweenTimer");
const champCardEl = document.getElementById("champCard");
const champNameEl = document.getElementById("champName");
const champScoreEl = document.getElementById("champScore");
const qrTitleEl = document.getElementById("qrTitle");
const qrSubEl = document.getElementById("qrSub");
const qrFootEl = document.getElementById("qrFoot");

let currentThemeKey = null;
let currentStage = null;
let betweenInterval = null;
let championRoundId = null;
let championTimer = null;
let championPendingFor = null;
// The main TV takes about 7 seconds to reveal the podium; don't spoil it here.
const CHAMPION_DELAY_MS = 8000;

// Round colors are shared with the TV and phones (round-themes.js).
// christmas.js calls this when the theme switches, so the round picks up the right colors.
window.grumpysReapplyRoundTheme = () => {
  const key = currentThemeKey;
  currentThemeKey = null;
  applyRoundTheme(key);
};

function applyRoundTheme(roundKey) {
  const key = String(roundKey || "grumpys");
  if (key === currentThemeKey) return;
  currentThemeKey = key;

  const theme = window.pickGrumpysRoundTheme(key);
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--accent", theme.accent);
  rootStyle.setProperty("--accent-hot", theme.hot);
  rootStyle.setProperty("--accent-rgb", theme.rgb);
  rootStyle.setProperty("--accent2-rgb", theme.rgb2);
}

function setSeasonalBranding(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  // The Christmas logo comes and goes with the Christmas theme (christmas.js).
  const isChristmasSeason = false;
  const isPatrioticSeason =
    (month === 6 && day >= 1 && day <= 7) ||
    (month === 4 && day >= 23) ||
    (month === 10 && day >= 8 && day <= 12);

  promoBrandLogo.src = isChristmasSeason
    ? "assets/grumpys-logo-christmas.png"
    : isPatrioticSeason
      ? "assets/grumpys-logo-usa.png"
      : "assets/grumpys-logo.png";

  promoBrandLogo.alt = isChristmasSeason
    ? "Grumpy's Christmas logo"
    : isPatrioticSeason
      ? "Grumpy's USA logo"
      : "Grumpy's St. Boni logo";
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function getSortedPlayers(playersObj = {}) {
  return Object.values(playersObj).sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return (a.name || "").localeCompare(b.name || "");
  });
}

function showStage(name) {
  if (name === currentStage) return;
  currentStage = name;
  stageEls.forEach(stage => stage.classList.toggle("is-active", stage.dataset.stage === name));

  if (name !== "between") stopBetweenCountdown();

  const qrCopy = {
    starting: ["Scan to play", "", "No app needed"],
    live: ["Scan to jump in", "", "No app needed"],
    between: ["Scan to play", "in the next round", "Arcade games are open now"]
  }[name];

  qrTitleEl.textContent = qrCopy[0];
  qrSubEl.textContent = qrCopy[1];
  qrSubEl.hidden = !qrCopy[1];
  qrFootEl.textContent = qrCopy[2];
}

function stopBetweenCountdown() {
  if (betweenInterval) clearInterval(betweenInterval);
  betweenInterval = null;
}

function renderStarting(game) {
  showStage("starting");
  const seconds = Number(game.timer) || 0;
  const players = Object.keys(game.players || {}).length;

  startTimerEl.textContent = formatTime(seconds);
  startTimerEl.classList.toggle("hurry", seconds > 0 && seconds <= 10);
  startLineEl.innerHTML = "";

  if (players > 0) {
    const count = document.createElement("b");
    count.style.color = "#ffffff";
    count.textContent = `${players} ${players === 1 ? "player" : "players"} in. `;
    const rest = document.createElement("span");
    rest.textContent = "Grab your phone and join.";
    startLineEl.append(count, rest);
  } else {
    startLineEl.textContent = "Be the first to join. Grab your phone.";
  }
}

function renderLive(game) {
  showStage("live");
  const total = Number(game.questionCount) || 6;
  const current = (Number.isInteger(game.questionIndex) ? game.questionIndex : 0) + 1;

  liveQuestionEl.textContent = `Question ${current} of ${total}`;

  if (liveSegmentsEl.children.length !== total) {
    liveSegmentsEl.style.setProperty("--count", total);
    liveSegmentsEl.replaceChildren(...Array.from({ length: total }, () => document.createElement("i")));
  }
  [...liveSegmentsEl.children].forEach((segment, i) => {
    segment.classList.toggle("done", i < current - 1);
    segment.classList.toggle("now", i === current - 1);
  });

  const leader = getSortedPlayers(game.players || {})[0];
  liveLineEl.textContent = "";
  const lead = document.createElement("span");
  lead.style.color = "#ffffff";
  lead.textContent = "You can still jump in. ";
  liveLineEl.appendChild(lead);

  if (leader && (leader.score || 0) > 0) {
    const label = document.createElement("span");
    label.textContent = "Leading now: ";
    const name = document.createElement("b");
    name.textContent = leader.name || "Player";
    liveLineEl.append(label, name);
  }
}

function renderBetween(game) {
  showStage("between");

  const target = Number(game.nextRoundExpectedAt) || 0;
  const tick = () => {
    if (!target) {
      betweenTimerEl.textContent = "Soon";
      return;
    }
    const now = typeof window.grumpysServerNow === "function" ? window.grumpysServerNow() : Date.now();
    const seconds = Math.ceil((target - now) / 1000);
    betweenTimerEl.textContent = seconds > 0 ? formatTime(seconds) : "Soon";
  };

  tick();
  stopBetweenCountdown();
  betweenInterval = setInterval(tick, 1000);

  if (game.phase === "final" && game.lastCompletedRoundId !== championRoundId) {
    // Schedule once per round; the TV's timer ticks would otherwise keep resetting it.
    if (championPendingFor !== game.lastCompletedRoundId) {
      championPendingFor = game.lastCompletedRoundId;
      champCardEl.classList.add("hidden");
      clearTimeout(championTimer);
      championTimer = setTimeout(() => loadChampion(championPendingFor), CHAMPION_DELAY_MS);
    }
  } else if (game.phase !== "final") {
    loadChampion(game.lastCompletedRoundId);
  }
}

// The last round's winner comes from the saved round record, so it is right
// even if this screen was just turned on.
async function loadChampion(roundId) {
  if (!roundId) {
    champCardEl.classList.add("hidden");
    return;
  }
  if (roundId === championRoundId) return;
  championRoundId = roundId;

  try {
    const snap = await savedRoundsRef.child(roundId).once("value");
    const round = snap.val();
    if (!round || !round.winnerName || !(round.winnerScore > 0)) {
      champCardEl.classList.add("hidden");
      return;
    }
    champNameEl.textContent = round.winnerName;
    champScoreEl.textContent = `· ${Number(round.winnerScore).toLocaleString()}`;
    champCardEl.classList.remove("hidden");
  } catch (error) {
    console.warn("Could not load the last champion:", error);
    champCardEl.classList.add("hidden");
  }
}

function renderPromo(game = {}) {
  applyRoundTheme(game.roundId);
  document.body.dataset.phase = game.phase || "waiting";

  if (game.phase === "join") renderStarting(game);
  else if (game.phase === "question" || game.phase === "reveal") renderLive(game);
  else renderBetween(game);
}

setSeasonalBranding();
applyRoundTheme("grumpys");

gameRef.on("value", snap => renderPromo(snap.val() || {}));
