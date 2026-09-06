const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);

const promoQrCode = document.getElementById("promoQrCode");
const promoTimer = document.getElementById("promoTimer");
const promoStatus = document.getElementById("promoStatus");
const promoTop5 = document.getElementById("promoTop5");
const liveBadge = document.getElementById("liveBadge");
const promoBrandLogo = document.getElementById("promoBrandLogo");
const promoHeadline = document.getElementById("promoHeadline");

const PROMO_ROUND_THEMES = [
  { accent: "#ff4255", hot: "#ff9eaa", rgb: "255 66 85" },
  { accent: "#4aa8ff", hot: "#a7d7ff", rgb: "74 168 255" },
  { accent: "#42d987", hot: "#a5f3c8", rgb: "66 217 135" },
  { accent: "#ff8a35", hot: "#ffc28f", rgb: "255 138 53" },
  { accent: "#9d73ff", hot: "#d5c3ff", rgb: "157 115 255" }
];

let currentGame = {};
let promoCountdownInterval = null;
let promoCountdownTarget = null;
let currentPromoThemeKey = null;

function replayPromoHeadline() {
  promoHeadline.classList.remove("promo-animate");
  void promoHeadline.offsetWidth;
  promoHeadline.classList.add("promo-animate");
}

function applyPromoRoundTheme(roundKey) {
  const key = String(roundKey || "grumpys");

  if (key === currentPromoThemeKey) return;

  currentPromoThemeKey = key;

  const index = [...key].reduce((total, character) => total + character.charCodeAt(0), 0) % PROMO_ROUND_THEMES.length;
  const theme = PROMO_ROUND_THEMES[index];
  const rootStyle = document.documentElement.style;

  rootStyle.setProperty("--accent", theme.accent);
  rootStyle.setProperty("--accent-hot", theme.hot);
  rootStyle.setProperty("--accent-rgb", theme.rgb);
}

function setPromoSeasonalBranding(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  const isChristmasSeason = month === 11 || (month === 0 && day === 1);
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
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatCountdownFromMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getPlayUrl() {
  return `${window.location.origin}${window.location.pathname.replace("promo.html", "")}play.html`;
}

function setQrCode() {
  const playUrl = getPlayUrl();
  const encodedPlayUrl = encodeURIComponent(playUrl);

  promoQrCode.innerHTML = `
    <img 
      alt="Scan to play Grumpy's Trivia" 
      src="https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=12&data=${encodedPlayUrl}"
    >
  `;
}

function getSortedPlayers(playersObj = {}) {
  return Object.values(playersObj)
    .sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) {
        return (b.score || 0) - (a.score || 0);
      }

      return (a.name || "").localeCompare(b.name || "");
    });
}

function showTop5() {
  const top5Box = document.querySelector(".top5");

  if (top5Box) {
    top5Box.classList.remove("hidden");
  }
}

function hideTop5() {
  const top5Box = document.querySelector(".top5");

  if (top5Box) {
    top5Box.classList.add("hidden");
  }
}

function setCountdownMode(isOn) {
  const liveCard = document.querySelector(".live-card");

  if (!liveCard) return;

  if (isOn) {
    liveCard.classList.add("countdown-mode");
  } else {
    liveCard.classList.remove("countdown-mode");
  }
}

function renderTop5(playersObj = {}) {
  const players = getSortedPlayers(playersObj).slice(0, 5);

  promoTop5.replaceChildren();

  if (players.length === 0) {
    const waiting = document.createElement("li");
    waiting.innerHTML = '<span class="medal">●</span><span class="player-name">Waiting...</span><strong>0</strong>';
    promoTop5.appendChild(waiting);
    return;
  }

  const medals = ["🥇", "🥈", "🥉", "4", "5"];

  players.forEach((player, index) => {
    const row = document.createElement("li");
    const medal = document.createElement("span");
    const name = document.createElement("span");
    const score = document.createElement("strong");

    medal.className = "medal";
    medal.textContent = medals[index];
    name.className = "player-name";
    name.textContent = player.name || "Player";
    score.textContent = (player.score || 0).toLocaleString();

    row.append(medal, name, score);
    promoTop5.appendChild(row);
  });
}

function stopPromoCountdown() {
  if (promoCountdownInterval) {
    clearInterval(promoCountdownInterval);
    promoCountdownInterval = null;
  }

  promoCountdownTarget = null;
  setCountdownMode(false);
}

function startPromoCountdown(targetTime) {
  if (!targetTime) {
    stopPromoCountdown();
    return;
  }

  setCountdownMode(true);
  hideTop5();

  function render() {
    const remainingMs = targetTime - Date.now();
    const remainingText = formatCountdownFromMs(remainingMs);

    promoTimer.textContent = remainingText;

    if (remainingMs <= 0) {
      liveBadge.textContent = "Soon";
      promoStatus.textContent = "Trivia should be returning soon. Scan now and watch the main screen.";
      return;
    }

    liveBadge.textContent = "Next Round";
    promoStatus.textContent = "Scan now and keep your phone ready.";
  }

  render();

  if (promoCountdownTarget === targetTime && promoCountdownInterval) {
    return;
  }

  stopPromoCountdown();
  setCountdownMode(true);
  hideTop5();

  promoCountdownTarget = targetTime;
  promoCountdownInterval = setInterval(render, 1000);
}

function setStatus(game = {}) {
  const phase = game.phase || "waiting";
  const timer = game.timer || 0;
  const questionIndex = Number.isInteger(game.questionIndex) ? game.questionIndex + 1 : null;

  if ((phase === "waiting" || phase === "final") && game.nextRoundExpectedAt) {
    startPromoCountdown(game.nextRoundExpectedAt);
    return;
  }

  stopPromoCountdown();
  showTop5();
  promoTimer.textContent = formatTime(timer);

  if (phase === "join") {
    liveBadge.textContent = "Join Now";
    promoStatus.textContent = "A new round is starting soon. Scan the QR code to play.";
    return;
  }

  if (phase === "question") {
    liveBadge.textContent = "Question";
    promoStatus.textContent = questionIndex
      ? `Question ${questionIndex} of 6 is live now. Watch the main trivia screen in the backroom.`
      : "A question is live now. Watch the main trivia screen in the backroom.";
    return;
  }

  if (phase === "reveal") {
    liveBadge.textContent = "Answer";
    promoStatus.textContent = questionIndex
      ? `Answer reveal after Question ${questionIndex}. Current scores are updating.`
      : "Answer reveal is live. Current scores are updating.";
    return;
  }

  liveBadge.textContent = "Trivia";
  promoStatus.textContent = "Waiting for the next trivia round...";
}

function renderPromo(game = {}) {
  currentGame = game;
  applyPromoRoundTheme(currentGame.roundId);
  document.body.dataset.phase = currentGame.phase || "waiting";
  setStatus(currentGame);
  renderTop5(currentGame.players || {});
}

setPromoSeasonalBranding();
applyPromoRoundTheme("grumpys");
setQrCode();

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  setInterval(replayPromoHeadline, 10000);
}

gameRef.on("value", snap => {
  renderPromo(snap.val() || {});
});
