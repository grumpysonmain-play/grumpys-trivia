const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);

const phaseLabel = document.getElementById("phaseLabel");
const timerEl = document.getElementById("timer");
const categoryEl = document.getElementById("category");
const questionEl = document.getElementById("question");
const answersEl = document.getElementById("answers");
const messageEl = document.getElementById("message");
const qrCodeEl = document.getElementById("qrCode");
const leaderboardList = document.getElementById("leaderboardList");
const waitingBox = document.getElementById("waitingBox");
const waitingTime = document.getElementById("waitingTime");

let countdownInterval = null;
let countdownTarget = null;

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
  return `${window.location.origin}${window.location.pathname.replace("view.html", "")}play.html`;
}

function setQrCode() {
  const playUrl = getPlayUrl();
  const encodedPlayUrl = encodeURIComponent(playUrl);

  qrCodeEl.innerHTML = `
    <img 
      alt="Scan to play Grumpy's Trivia" 
      src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodedPlayUrl}"
    >
  `;
}

function setQuestionText(text) {
  const cleanText = text || "";

  questionEl.textContent = cleanText;
  questionEl.classList.remove("long-question", "extra-long-question", "super-long-question");

  if (cleanText.length > 85) {
    questionEl.classList.add("long-question");
  }

  if (cleanText.length > 125) {
    questionEl.classList.add("extra-long-question");
  }

  if (cleanText.length > 165) {
    questionEl.classList.add("super-long-question");
  }
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

function renderLeaderboard(playersObj = {}) {
  const players = getSortedPlayers(playersObj).slice(0, 5);

  if (players.length === 0) {
    leaderboardList.innerHTML = `<li><span>Waiting...</span><strong>0</strong></li>`;
    return;
  }

  leaderboardList.innerHTML = players
    .map(player => `
      <li>
        <span>${player.name || "Player"}</span>
        <strong>${(player.score || 0).toLocaleString()}</strong>
      </li>
    `)
    .join("");
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  countdownTarget = null;
}

function startCountdown(targetTime) {
  if (!targetTime) {
    stopCountdown();
    waitingBox.classList.add("hidden");
    return;
  }

  waitingBox.classList.remove("hidden");

  function render() {
    const remainingMs = targetTime - Date.now();
    const text = formatCountdownFromMs(remainingMs);

    timerEl.textContent = text;
    waitingTime.textContent = text;

    if (remainingMs <= 0) {
      timerEl.textContent = "Soon";
      waitingTime.textContent = "Soon";
    }
  }

  render();

  if (countdownTarget === targetTime && countdownInterval) {
    return;
  }

  stopCountdown();

  countdownTarget = targetTime;
  countdownInterval = setInterval(render, 1000);
}

function renderAnswers(game = {}) {
  const choices = game.choices || [];

  if (!choices.length) {
    answersEl.innerHTML = "";
    return;
  }

  answersEl.innerHTML = choices
    .map((choice, index) => {
      let className = "answer";

      if (game.phase === "reveal") {
        if (index === game.correctAnswerIndex) {
          className += " correct";
        } else {
          className += " dim";
        }
      }

      return `
        <div class="${className}">
          ${String.fromCharCode(65 + index)}. ${choice}
        </div>
      `;
    })
    .join("");
}

function renderGame(game = {}) {
  const phase = game.phase || "waiting";

  renderLeaderboard(game.players || {});

  if ((phase === "waiting" || phase === "final") && game.nextRoundExpectedAt) {
    startCountdown(Number(game.nextRoundExpectedAt));
  } else {
    stopCountdown();
    waitingBox.classList.add("hidden");
    timerEl.textContent = formatTime(game.timer || 0);
  }

  if (phase === "join") {
    phaseLabel.textContent = "Join Now";
    categoryEl.textContent = "Grumpy's Trivia";
    setQuestionText("Scan the QR code to play!");
    messageEl.textContent = "Name + PIN saves your all-time score. Or play as a guest.";
    answersEl.innerHTML = `
      <div class="answer">Name + PIN saves your all-time score</div>
      <div class="answer">Play as Guest for this round only</div>
      <div class="answer">6 questions per round</div>
      <div class="answer">Fast answers score up to 1000 points</div>
    `;
    return;
  }

  if (phase === "question") {
    phaseLabel.textContent = "Question";
    categoryEl.textContent = game.category || "Trivia";
    setQuestionText(game.question || "Question loading...");
    messageEl.textContent = "Answer fast — your point value is dropping.";
    renderAnswers(game);
    return;
  }

  if (phase === "reveal") {
    phaseLabel.textContent = "Answer";
    categoryEl.textContent = game.category || "Trivia";
    setQuestionText(game.question || "Answer revealed.");
    messageEl.textContent = "Correct answer revealed • Current Top 5 updated.";
    renderAnswers(game);
    return;
  }

  if (phase === "final") {
    phaseLabel.textContent = "Final";
    categoryEl.textContent = "Round Complete";
    setQuestionText("Final scoreboard is showing on the host screen.");
    messageEl.textContent = "Next round starts soon. Keep your phone ready.";
    answersEl.innerHTML = "";
    return;
  }

  if (phase === "waiting") {
    phaseLabel.textContent = "Next Round";
    categoryEl.textContent = "Waiting";
    setQuestionText("Next round is coming soon.");
    messageEl.textContent = "This viewer page will update automatically when the host starts the next round.";
    answersEl.innerHTML = "";
    return;
  }

  phaseLabel.textContent = "Viewer";
  categoryEl.textContent = "Grumpy's Trivia";
  setQuestionText("Waiting for the host screen...");
  messageEl.textContent = "This page only watches the game. It does not control anything.";
  answersEl.innerHTML = "";
}

setQrCode();

gameRef.on("value", snap => {
  renderGame(snap.val() || {});
});
