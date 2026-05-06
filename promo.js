const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);

const promoQrCode = document.getElementById("promoQrCode");
const promoTimer = document.getElementById("promoTimer");
const promoStatus = document.getElementById("promoStatus");
const promoTop5 = document.getElementById("promoTop5");
const liveBadge = document.getElementById("liveBadge");

let currentGame = {};
let promoCountdownInterval = null;
let promoCountdownTarget = null;

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

  if (players.length === 0) {
    promoTop5.innerHTML = `<li><span>Waiting...</span><strong>0</strong></li>`;
    return;
  }

  promoTop5.innerHTML = players
    .map(player => `
      <li>
        <span>${player.name || "Player"}</span>
        <strong>${(player.score || 0).toLocaleString()}</strong>
      </li>
    `)
    .join("");
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
  setStatus(currentGame);
  renderTop5(currentGame.players || {});
}

setQrCode();

gameRef.on("value", snap => {
  renderPromo(snap.val() || {});
});
