const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);
const claimedNamesRef = db.ref("claimedNames");

const joinView = document.getElementById("joinView");
const gameView = document.getElementById("gameView");
const nameInput = document.getElementById("nameInput");
const pinInput = document.getElementById("pinInput");
const joinBtn = document.getElementById("joinBtn");
const joinError = document.getElementById("joinError");

const scoreText = document.getElementById("scoreText");
const timerText = document.getElementById("timerText");
const statusText = document.getElementById("statusText");
const categoryText = document.getElementById("categoryText");
const questionText = document.getElementById("questionText");
const choicesEl = document.getElementById("choices");

let playerId = localStorage.getItem("grumpysTriviaPlayerId");
let playerName = localStorage.getItem("grumpysTriviaPlayerName");
let playerNameKey = localStorage.getItem("grumpysTriviaNameKey");
let savedPin = localStorage.getItem("grumpysTriviaPin");
let currentGame = null;
let currentPlayer = null;

const BLOCKED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "dick", "pussy", "cunt",
  "nigger", "nigga", "fag", "faggot", "retard", "whore", "slut",
  "cum", "porn", "sex", "hitler", "nazi"
];

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function cleanName(name) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9 _.-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 18);
}

function makeNameKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isNameAllowed(name) {
  const lowered = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return !BLOCKED_WORDS.some(word => lowered.includes(word));
}

function isPinValid(pin) {
  return /^[0-9]{4}$/.test(pin);
}

function setJoinError(message) {
  joinError.textContent = message;
  joinError.style.color = message ? "#ffb3b3" : "#bbb";
}

async function joinGame() {
  setJoinError("");

  const cleanedName = cleanName(nameInput.value);
  const nameKey = makeNameKey(cleanedName);
  const pin = pinInput.value.trim();

  if (!cleanedName || nameKey.length < 3) {
    setJoinError("Enter a nickname with at least 3 letters/numbers.");
    return;
  }

  if (!isNameAllowed(cleanedName)) {
    setJoinError("Pick a different nickname.");
    return;
  }

  if (!isPinValid(pin)) {
    setJoinError("Enter a 4-digit PIN.");
    return;
  }

  const nameSnap = await claimedNamesRef.child(nameKey).once("value");
  const existingProfile = nameSnap.val();

  if (existingProfile && existingProfile.pin !== pin) {
    setJoinError("That name is already taken. Use the correct PIN or pick a different name.");
    return;
  }

  if (existingProfile) {
    playerId = existingProfile.playerId;
  } else {
    playerId = `player_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    await claimedNamesRef.child(nameKey).set({
      playerId,
      displayName: cleanedName,
      pin,
      totalScore: 0,
      gamesPlayed: 0,
      wins: 0,
      createdAt: Date.now(),
      lastPlayed: Date.now()
    });
  }

  playerName = cleanedName;
  playerNameKey = nameKey;
  savedPin = pin;

  localStorage.setItem("grumpysTriviaPlayerId", playerId);
  localStorage.setItem("grumpysTriviaPlayerName", playerName);
  localStorage.setItem("grumpysTriviaNameKey", playerNameKey);
  localStorage.setItem("grumpysTriviaPin", savedPin);

  const gameSnap = await gameRef.once("value");
  const game = gameSnap.val() || {};

  await gameRef.child(`players/${playerId}`).set({
    id: playerId,
    name: playerName,
    nameKey: playerNameKey,
    score: 0,
    joinedAt: Date.now(),
    joinedRoundId: game.roundId || null,
    joinedPhase: game.phase || "unknown",
    answers: {}
  });

  await claimedNamesRef.child(nameKey).update({
    displayName: cleanedName,
    lastPlayed: Date.now()
  });

  joinView.classList.add("hidden");
  gameView.classList.remove("hidden");
}

async function submitAnswer(choiceIndex) {
  if (!currentGame || currentGame.phase !== "question" || !playerId) return;

  const questionIndex = currentGame.questionIndex;
  const existingAnswer = currentPlayer?.answers?.[questionIndex];

  if (existingAnswer) {
    statusText.textContent = "Answer already submitted. You cannot change it.";
    return;
  }

  await gameRef.child(`players/${playerId}/answers/${questionIndex}`).set({
    choiceIndex,
    answeredAt: Date.now(),
    scored: false
  });

  document.querySelectorAll(".choice").forEach((btn, index) => {
    btn.disabled = true;

    if (index === choiceIndex) {
      btn.classList.add("selected");
    }
  });

  statusText.textContent = "Answer submitted. Waiting for reveal...";
}

function renderChoices(game) {
  choicesEl.innerHTML = "";

  if (!game.choices) return;

  const questionIndex = game.questionIndex;
  const existingAnswer = currentPlayer?.answers?.[questionIndex];
  const selectedIndex = existingAnswer?.choiceIndex;

  game.choices.forEach((choice, index) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = `${String.fromCharCode(65 + index)}. ${choice}`;

    if (selectedIndex === index) {
      btn.classList.add("selected");
    }

    if (existingAnswer || game.phase !== "question") {
      btn.disabled = true;
    }

    if (game.phase === "reveal") {
      if (index === game.correctAnswerIndex) {
        btn.classList.add("correct");
      } else if (selectedIndex === index && selectedIndex !== game.correctAnswerIndex) {
        btn.classList.add("wrong");
      }
    }

    btn.onclick = () => submitAnswer(index);
    choicesEl.appendChild(btn);
  });
}

function getJoinStatusMessage(game, player) {
  if (!game || !game.phase) {
    return "Waiting for the TV screen to start the game.";
  }

  if (!player) {
    return "Joining game...";
  }

  if (game.phase === "join") {
    return "You are in. Get ready — the round is about to start.";
  }

  if (game.phase === "question") {
    return "You joined during the round. Answer this question now!";
  }

  if (game.phase === "reveal") {
    return "You joined between questions. Wait for the next question to answer.";
  }

  if (game.phase === "final") {
    return "This round just ended. Stay here for the next round.";
  }

  return "Waiting for the next question...";
}

async function renderGame(game) {
  currentGame = game || {};
  timerText.textContent = formatTime(currentGame.timer || 0);

  if (!playerId) return;

  const playerSnap = await gameRef.child(`players/${playerId}`).once("value");
  currentPlayer = playerSnap.val();

  scoreText.textContent = currentPlayer?.score || 0;

  if (!currentGame.phase || currentGame.phase === "join") {
    statusText.textContent = getJoinStatusMessage(currentGame, currentPlayer);
    categoryText.textContent = "Get Ready";
    questionText.textContent = "Watch the TV for the round countdown.";
    choicesEl.innerHTML = "";
    return;
  }

  if (currentGame.phase === "question") {
    const existingAnswer = currentPlayer?.answers?.[currentGame.questionIndex];

    statusText.textContent = existingAnswer
      ? "Answer submitted. Waiting for reveal..."
      : getJoinStatusMessage(currentGame, currentPlayer);

    categoryText.textContent = currentGame.category || "Trivia";
    questionText.textContent = currentGame.question || "Question loading...";
    renderChoices(currentGame);
    return;
  }

  if (currentGame.phase === "reveal") {
    statusText.textContent = getJoinStatusMessage(currentGame, currentPlayer);
    categoryText.textContent = currentGame.category || "Trivia";
    questionText.textContent = currentGame.question || "Answer revealed.";
    renderChoices(currentGame);
    return;
  }

  if (currentGame.phase === "final") {
    statusText.textContent = getJoinStatusMessage(currentGame, currentPlayer);
    categoryText.textContent = "Final";
    questionText.textContent = "Check the TV for the winner.";
    choicesEl.innerHTML = "";
  }
}

joinBtn.addEventListener("click", joinGame);

if (playerName) nameInput.value = playerName;
if (savedPin) pinInput.value = savedPin;

gameRef.on("value", snap => {
  renderGame(snap.val());
});
