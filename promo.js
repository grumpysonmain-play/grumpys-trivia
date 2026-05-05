const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);

const promoQrCode = document.getElementById("promoQrCode");
const promoTimer = document.getElementById("promoTimer");
const promoStatus = document.getElementById("promoStatus");
const promoTop5 = document.getElementById("promoTop5");
const liveBadge = document.getElementById("liveBadge");

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

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

function setStatus(game = {}) {
  const phase = game.phase || "waiting";
  const timer = game.timer || 0;
  const questionIndex = Number.isInteger(game.questionIndex) ? game.questionIndex + 1 : null;

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

  if (phase === "final") {
    liveBadge.textContent = "Final";
    promoStatus.textContent = "Round complete. Scan to join the next round.";
    return;
  }

  liveBadge.textContent = "Trivia";
  promoStatus.textContent = "Waiting for the next trivia round...";
}

function renderPromo(game = {}) {
  setStatus(game);
  renderTop5(game.players || {});
}

setQrCode();

gameRef.on("value", snap => {
  renderPromo(snap.val() || {});
});
