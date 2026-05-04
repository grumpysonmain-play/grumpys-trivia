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

const allTimeScoreText = document.getElementById("allTimeScoreText");
const rankText = document.getElementById("rankText");
const winsText = document.getElementById("winsText");
const gamesText = document.getElementById("gamesText");

const playerStats = document.getElementById("playerStats");
const pointsBox = document.getElementById("pointsBox");
const pointsLabel = document.getElementById("pointsLabel");
const pointsText = document.getElementById("pointsText");
const pointsFill = document.getElementById("pointsFill");

let playerId = localStorage.getItem("grumpysTriviaPlayerId");
let playerName = localStorage.getItem("grumpysTriviaPlayerName");
let playerNameKey = localStorage.getItem("grumpysTriviaNameKey");
let savedPin = localStorage.getItem("grumpysTriviaPin");

let currentGame = null;
let currentPlayer = null;
let lastSeenRoundId = localStorage.getItem("grumpysTriviaLastRoundId");
let isAutoJoining = false;
let lastFireworkQuestion = null;
let pointsInterval = null;
let isSubmittingAnswer = false;
let localLockedAnswers = {};

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

function showGameView() {
  joinView.classList.add("hidden");
  gameView.classList.remove("hidden");
}

function showJoinView() {
  joinView.classList.remove("hidden");
  gameView.classList.add("hidden");
}

function showPlayerStats() {
  playerStats.classList.remove("hidden");
}

function hidePlayerStats() {
  playerStats.classList.add("hidden");
}

function updatePlayerStats(profile, rank) {
  allTimeScoreText.textContent = (profile?.totalScore || 0).toLocaleString();
  rankText.textContent = rank ? `#${rank}` : "—";
  winsText.textContent = profile?.wins || 0;
  gamesText.textContent = profile?.gamesPlayed || 0;
}

async function loadPlayerStats() {
  if (!playerNameKey) {
    updatePlayerStats(null, null);
    return;
  }

  const snap = await claimedNamesRef.once("value");
  const profilesObj = snap.val() || {};

  const profiles = Object.entries(profilesObj)
    .map(([key, profile]) => ({
      key,
      ...profile
    }))
    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

  const index = profiles.findIndex(profile => profile.key === playerNameKey);
  const profile = index >= 0 ? profiles[index] : null;
  const rank = index >= 0 && (profile?.totalScore || 0) > 0 ? index + 1 : null;

  updatePlayerStats(profile, rank);
}

function calculateLivePoints(game) {
  if (!game || !game.questionStartedAt) return 0;

  const maxPoints = game.maxPoints || 1000;
  const questionMs = (game.questionSeconds || 20) * 1000;
  const elapsedMs = Date.now() - game.questionStartedAt;
  const remainingRatio = Math.max(0, Math.min(1, 1 - elapsedMs / questionMs));

  return Math.ceil(maxPoints * remainingRatio);
}

function updatePointsDisplay(points, maxPoints = 1000, label = "Points Available") {
  const safePoints = Math.max(0, Math.min(maxPoints, Math.round(points || 0)));
  const percent = maxPoints > 0 ? (safePoints / maxPoints) * 100 : 0;

  pointsLabel.textContent = label;
  pointsText.textContent = safePoints.toLocaleString();
  pointsFill.style.width = `${percent}%`;

  pointsBox.classList.remove("points-low", "points-locked");

  if (safePoints <= maxPoints * 0.25) {
    pointsBox.classList.add("points-low");
  }
}

function startLivePoints(game) {
  stopLivePoints();

  pointsBox.classList.remove("hidden");

  const maxPoints = game.maxPoints || 1000;
  updatePointsDisplay(calculateLivePoints(game), maxPoints, "Points Available");

  pointsInterval = setInterval(() => {
    updatePointsDisplay(calculateLivePoints(game), maxPoints, "Points Available");
  }, 50);
}

function stopLivePoints() {
  if (pointsInterval) {
    clearInterval(pointsInterval);
    pointsInterval = null;
  }
}

function lockPoints(points, maxPoints = 1000) {
  stopLivePoints();

  const lockedPoints = Math.max(0, Math.min(maxPoints, Math.round(points || 0)));

  updatePointsDisplay(lockedPoints, maxPoints, "Locked In");
  pointsBox.classList.add("points-locked");
}

function hidePointsBox() {
  stopLivePoints();
  pointsBox.classList.add("hidden");
}

function launchFireworks() {
  const oldFireworks = document.querySelector(".fireworks");

  if (oldFireworks) {
    oldFireworks.remove();
  }

  const fireworks = document.createElement("div");
  fireworks.className = "fireworks";

  for (let i = 0; i < 18; i++) {
    const spark = document.createElement("span");

    spark.style.setProperty("--x", `${Math.random() * 220 - 110}px`);
    spark.style.setProperty("--y", `${Math.random() * 220 - 110}px`);
    spark.style.left = `${20 + Math.random() * 60}%`;
    spark.style.top = `${18 + Math.random() * 45}%`;
    spark.style.animationDelay = `${Math.random() * 0.25}s`;

    fireworks.appendChild(spark);
  }

  document.body.appendChild(fireworks);

  setTimeout(() => {
    fireworks.remove();
  }, 1400);
}

async function addPlayerToCurrentRound(game) {
  if (!playerId || !playerName || !playerNameKey) return;
  if (!game || !game.roundId) return;
  if (isAutoJoining) return;

  isAutoJoining = true;

  try {
    const playerSnap = await gameRef.child(`players/${playerId}`).once("value");
    const existingRoundPlayer = playerSnap.val();

    if (existingRoundPlayer && existingRoundPlayer.joinedRoundId === game.roundId) {
      isAutoJoining = false;
      return;
    }

    await gameRef.child(`players/${playerId}`).set({
      id: playerId,
      name: playerName,
      nameKey: playerNameKey,
      score: 0,
      joinedAt: Date.now(),
      joinedRoundId: game.roundId,
      joinedPhase: game.phase || "unknown",
      answers: {}
    });

    lastSeenRoundId = game.roundId;

    localStorage.setItem("grumpysTriviaLastRoundId", game.roundId);

    lastFireworkQuestion = null;
    localLockedAnswers = {};
  } catch (error) {
    console.error("Auto-join failed:", error);
  }

  isAutoJoining = false;
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

  await claimedNamesRef.child(nameKey).update({
    displayName: cleanedName,
    lastPlayed: Date.now()
  });

  const gameSnap = await gameRef.once("value");
  const game = gameSnap.val() || {};

  await addPlayerToCurrentRound(game);
  await loadPlayerStats();

  showGameView();
}

async function submitAnswer(choiceIndex) {
  if (isSubmittingAnswer) return;
  if (!currentGame || currentGame.phase !== "question" || !playerId) return;

  const questionIndex = currentGame.questionIndex;
  const existingAnswer = currentPlayer?.answers?.[questionIndex] || localLockedAnswers[questionIndex];

  if (existingAnswer) {
    statusText.textContent = "Answer already submitted. You cannot change it.";
    return;
  }

  isSubmittingAnswer = true;

  const pointsPossible = calculateLivePoints(currentGame);
  const answerData = {
    choiceIndex,
    answeredAt: Date.now(),
    pointsPossible,
    scored: false
  };

  localLockedAnswers[questionIndex] = answerData;

  lockPoints(pointsPossible, currentGame.maxPoints || 1000);

  document.querySelectorAll(".choice").forEach((btn, index) => {
    btn.disabled = true;
    btn.classList.add("choice-disabled");

    if (index === choiceIndex) {
      btn.classList.add("selected");
    }
  });

  statusText.textContent = `Answer locked in for ${pointsPossible.toLocaleString()} possible points.`;

  try {
    await gameRef.child(`players/${playerId}/answers/${questionIndex}`).set(answerData);
  } catch (error) {
    console.error("Answer submit failed:", error);

    statusText.textContent = "There was a problem submitting your answer. Try again.";

    delete localLockedAnswers[questionIndex];

    document.querySelectorAll(".choice").forEach(btn => {
      btn.disabled = false;
      btn.classList.remove("choice-disabled", "selected");
    });
  }

  isSubmittingAnswer = false;
}

function getLetter(index) {
  return String.fromCharCode(65 + index);
}

function renderChoices(game) {
  choicesEl.innerHTML = "";

  if (!game.choices) return;

  const questionIndex = game.questionIndex;
  const existingAnswer = currentPlayer?.answers?.[questionIndex] || localLockedAnswers[questionIndex];
  const selectedIndex = existingAnswer?.choiceIndex;

  game.choices.forEach((choice, index) => {
    const btn = document.createElement("button");

    btn.className = "choice";
    btn.textContent = `${getLetter(index)}. ${choice}`;

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

    btn.addEventListener("pointerdown", event => {
      event.preventDefault();

      if (btn.disabled) return;

      submitAnswer(index);
    }, { once: true });

    choicesEl.appendChild(btn);
  });
}

function getAnswerFeedback(game, player) {
  const answer = player?.answers?.[game.questionIndex] || localLockedAnswers[game.questionIndex];

  if (!answer) {
    return "Time's up — no answer submitted.";
  }

  if (game.correctAnswerIndex === null || game.correctAnswerIndex === undefined) {
    return "Answer submitted. Waiting for reveal...";
  }

  if (answer.choiceIndex === game.correctAnswerIndex) {
    const points = answer.pointsEarned ?? answer.pointsPossible ?? 0;

    return `Correct! +${points.toLocaleString()} points`;
  }

  return `Wrong — correct answer was ${getLetter(game.correctAnswerIndex)}.`;
}

function getJoinStatusMessage(game, player) {
  if (!game || !game.phase) {
    return "Waiting for the trivia screen to come back on the TV.";
  }

  if (!player) {
    return "Joining game...";
  }

  if (game.phase === "join") {
    return "You are in. Get ready — the round is about to start.";
  }

  if (game.phase === "question") {
    return "Answer fast — your point value is dropping!";
  }

  if (game.phase === "reveal") {
    return getAnswerFeedback(game, player);
  }

  if (game.phase === "final") {
    return "Round complete! Your all-time score was saved. Keep this page open for the next round.";
  }

  return "Waiting for the next question...";
}

async function renderGame(game) {
  currentGame = game || {};
  timerText.textContent = formatTime(currentGame.timer || 0);

  if (!playerId || !playerName || !playerNameKey || !savedPin) {
    hidePointsBox();
    showJoinView();
    return;
  }

  showGameView();

  if (currentGame.roundId) {
    await addPlayerToCurrentRound(currentGame);
  }

  const playerSnap = await gameRef.child(`players/${playerId}`).once("value");
  currentPlayer = playerSnap.val();

  scoreText.textContent = currentPlayer?.score || 0;

  if (!currentGame.phase || currentGame.phase === "join") {
    showPlayerStats();
    hidePointsBox();

    statusText.className = "status";
    statusText.textContent = getJoinStatusMessage(currentGame, currentPlayer);

    categoryText.textContent = "Get Ready";
    questionText.textContent = "Watch the TV for the round countdown.";
    choicesEl.innerHTML = "";

    await loadPlayerStats();
    return;
  }

  if (currentGame.phase === "question") {
    hidePlayerStats();

    statusText.className = "status";

    const existingAnswer = currentPlayer?.answers?.[currentGame.questionIndex] || localLockedAnswers[currentGame.questionIndex];

    if (existingAnswer) {
      lockPoints(existingAnswer.pointsPossible || 0, currentGame.maxPoints || 1000);
    } else {
      startLivePoints(currentGame);
    }

    statusText.textContent = existingAnswer
      ? `Answer locked in for ${(existingAnswer.pointsPossible || 0).toLocaleString()} possible points.`
      : getJoinStatusMessage(currentGame, currentPlayer);

    categoryText.textContent = currentGame.category || "Trivia";
    questionText.textContent = currentGame.question || "Question loading...";

    renderChoices(currentGame);
    return;
  }

  if (currentGame.phase === "reveal") {
    hidePlayerStats();
    stopLivePoints();

    const answer = currentPlayer?.answers?.[currentGame.questionIndex] || localLockedAnswers[currentGame.questionIndex];
    const isCorrect = answer && answer.choiceIndex === currentGame.correctAnswerIndex;

    if (answer) {
      const displayPoints = isCorrect ? (answer.pointsEarned ?? answer.pointsPossible ?? 0) : 0;

      updatePointsDisplay(displayPoints, currentGame.maxPoints || 1000, "Points Earned");
      pointsBox.classList.remove("hidden");
      pointsBox.classList.add("points-locked");
    } else {
      updatePointsDisplay(0, currentGame.maxPoints || 1000, "No Answer");
      pointsBox.classList.remove("hidden");
    }

    statusText.className = isCorrect ? "status status-correct" : "status status-wrong";
    statusText.textContent = getJoinStatusMessage(currentGame, currentPlayer);

    if (isCorrect && lastFireworkQuestion !== currentGame.questionIndex) {
      launchFireworks();
      lastFireworkQuestion = currentGame.questionIndex;
    }

    categoryText.textContent = currentGame.category || "Trivia";
    questionText.textContent = currentGame.question || "Answer revealed.";

    renderChoices(currentGame);
    return;
  }

  if (currentGame.phase === "final") {
    showPlayerStats();
    hidePointsBox();

    statusText.className = "status";
    statusText.textContent = getJoinStatusMessage(currentGame, currentPlayer);

    categoryText.textContent = "Round Complete";
    questionText.textContent = "Keep this page open. You will automatically join the next round when trivia comes back on the TV.";
    choicesEl.innerHTML = "";

    await loadPlayerStats();
    return;
  }
}

joinBtn.addEventListener("click", joinGame);

if (playerName) {
  nameInput.value = playerName;
}

if (savedPin) {
  pinInput.value = savedPin;
}

if (playerId && playerName && playerNameKey && savedPin) {
  showGameView();
  showPlayerStats();
  hidePointsBox();

  statusText.textContent = "Waiting for the trivia screen to come back on the TV.";
  categoryText.textContent = "Ready";
  questionText.textContent = "Keep this page open. You will automatically join the next round.";

  loadPlayerStats();
}

gameRef.on("value", snap => {
  renderGame(snap.val());
});
