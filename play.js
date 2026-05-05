const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);
const claimedNamesRef = db.ref("claimedNames");

const joinView = document.getElementById("joinView");
const gameView = document.getElementById("gameView");
const nameInput = document.getElementById("nameInput");
const pinInput = document.getElementById("pinInput");
const joinBtn = document.getElementById("joinBtn");
const guestBtn = document.getElementById("guestBtn");
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
let isGuest = localStorage.getItem("grumpysTriviaIsGuest") === "true";

let currentGame = null;
let currentPlayer = null;
let lastSeenRoundId = localStorage.getItem("grumpysTriviaLastRoundId");
let isAutoJoining = false;
let lastFireworkQuestion = null;
let pointsInterval = null;
let isSubmittingAnswer = false;
let localLockedAnswers = {};
let nextRoundCountdownInterval = null;
let nextRoundCountdownTarget = null;

const LAST_COMPLETED_ROUND_KEY = "grumpysTriviaLastCompletedRoundId";

const BLOCKED_WORDS = [
  "fuck", "fucker", "fucking", "shit", "shitty", "bitch", "asshole", "ass",
  "dick", "cock", "pussy", "cunt", "cum", "jizz", "porn", "sex", "slut",
  "whore", "rape", "rapist", "molest", "pedo", "pedophile",
  "nigger", "nigga", "fag", "faggot", "retard", "spic", "chink", "kike",
  "hitler", "nazi", "kkk", "isis", "terrorist",
  "admin", "administrator", "owner", "staff", "employee", "manager",
  "grumpysowner", "grumpysstaff", "grumpysmanager"
];

const BLOCKED_EXACT_NAMES = [
  "admin",
  "administrator",
  "owner",
  "staff",
  "manager",
  "employee",
  "grumpys",
  "grumpysowner",
  "grumpysstaff",
  "grumpysmanager",
  "triviahost",
  "host"
];

function normalizeNameForFilter(name) {
  return name
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/!/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/@/g, "a")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/7/g, "t")
    .replace(/\+/g, "t")
    .replace(/8/g, "b")
    .replace(/9/g, "g")
    .replace(/[^a-z0-9]/g, "");
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatCountdownFromMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

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
  const cleaned = cleanName(name);
  const key = makeNameKey(cleaned);
  const normalized = normalizeNameForFilter(cleaned);

  if (!cleaned || key.length < 3) {
    return false;
  }

  if (BLOCKED_EXACT_NAMES.includes(normalized)) {
    return false;
  }

  if (normalized.includes("guest") && normalized.length <= 9) {
    return false;
  }

  return !BLOCKED_WORDS.some(word => normalized.includes(normalizeNameForFilter(word)));
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
  if (isGuest) {
    hidePlayerStats();
    return;
  }

  playerStats.classList.remove("hidden");
}

function hidePlayerStats() {
  playerStats.classList.add("hidden");
}

function setPhoneQuestionText(text) {
  const cleanText = text || "";

  questionText.textContent = cleanText;
  questionText.classList.remove(
    "phone-long-question",
    "phone-extra-long-question",
    "phone-super-long-question"
  );

  if (cleanText.length > 90) {
    questionText.classList.add("phone-long-question");
  }

  if (cleanText.length > 140) {
    questionText.classList.add("phone-extra-long-question");
  }

  if (cleanText.length > 200) {
    questionText.classList.add("phone-super-long-question");
  }
}

function updatePlayerStats(profile, rank) {
  allTimeScoreText.textContent = (profile?.totalScore || 0).toLocaleString();
  rankText.textContent = rank ? `#${rank}` : "—";
  winsText.textContent = profile?.wins || 0;
  gamesText.textContent = profile?.gamesPlayed || 0;
}

async function loadPlayerStats() {
  if (isGuest || !playerNameKey) {
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
  const questionSeconds = game.questionSeconds || 20;
  const graceSeconds = game.fullPointsGraceSeconds ?? 3;

  const elapsedMs = Date.now() - game.questionStartedAt;
  const graceMs = graceSeconds * 1000;
  const scoringMs = Math.max(1, (questionSeconds - graceSeconds) * 1000);

  if (elapsedMs <= graceMs) {
    return maxPoints;
  }

  const scoringElapsedMs = elapsedMs - graceMs;
  const remainingRatio = Math.max(0, Math.min(1, 1 - scoringElapsedMs / scoringMs));

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

function makeGuestName() {
  const number = Math.floor(100 + Math.random() * 900);
  return `Guest ${number}`;
}

function makeGuestId() {
  return `guest_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function saveGuestLocally(id, name) {
  playerId = id;
  playerName = name;
  playerNameKey = "";
  savedPin = "";
  isGuest = true;

  localStorage.setItem("grumpysTriviaPlayerId", playerId);
  localStorage.setItem("grumpysTriviaPlayerName", playerName);
  localStorage.setItem("grumpysTriviaNameKey", "");
  localStorage.setItem("grumpysTriviaPin", "");
  localStorage.setItem("grumpysTriviaIsGuest", "true");
}

function saveRegisteredLocally(id, name, nameKey, pin) {
  playerId = id;
  playerName = name;
  playerNameKey = nameKey;
  savedPin = pin;
  isGuest = false;

  localStorage.setItem("grumpysTriviaPlayerId", playerId);
  localStorage.setItem("grumpysTriviaPlayerName", playerName);
  localStorage.setItem("grumpysTriviaNameKey", playerNameKey);
  localStorage.setItem("grumpysTriviaPin", savedPin);
  localStorage.setItem("grumpysTriviaIsGuest", "false");
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

function getCurrentRankText(playersObj = {}, id = playerId) {
  const sortedPlayers = getSortedPlayers(playersObj);
  const index = sortedPlayers.findIndex(player => player.id === id);

  if (index === -1 || sortedPlayers.length === 0) {
    return "";
  }

  return `You are currently #${index + 1} of ${sortedPlayers.length}`;
}

function renderMiniLeaderboard(playersObj = {}) {
  const players = getSortedPlayers(playersObj).slice(0, 3);

  if (players.length === 0) {
    return "";
  }

  return `
    <div class="mini-leaderboard">
      <div class="mini-title">Current Top 3</div>
      ${players
        .map((player, index) => `
          <div class="mini-row ${player.id === playerId ? "mini-you" : ""}">
            <span>${index + 1}. ${player.name || "Player"}</span>
            <strong>${(player.score || 0).toLocaleString()}</strong>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function updateMiniLeaderboard(playersObj = {}) {
  let mini = document.getElementById("miniLeaderboardBox");

  if (!mini) {
    mini = document.createElement("div");
    mini.id = "miniLeaderboardBox";
    choicesEl.insertAdjacentElement("afterend", mini);
  }

  mini.innerHTML = renderMiniLeaderboard(playersObj);
}

function hideMiniLeaderboard() {
  const mini = document.getElementById("miniLeaderboardBox");

  if (mini) {
    mini.innerHTML = "";
  }
}

function getNextRoundBox() {
  let box = document.getElementById("nextRoundBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "nextRoundBox";
    box.className = "next-round-box";
    statusText.insertAdjacentElement("afterend", box);
  }

  return box;
}

function hideNextRoundCountdown() {
  if (nextRoundCountdownInterval) {
    clearInterval(nextRoundCountdownInterval);
    nextRoundCountdownInterval = null;
  }

  nextRoundCountdownTarget = null;

  const box = document.getElementById("nextRoundBox");

  if (box) {
    box.classList.add("hidden");
    box.innerHTML = "";
  }
}

function showNextRoundCountdown(targetTime) {
  const box = getNextRoundBox();

  if (!targetTime) {
    hideNextRoundCountdown();
    return;
  }

  box.classList.remove("hidden");

  function render() {
    const remainingMs = targetTime - Date.now();

    box.innerHTML = `
      <div class="next-round-label">Next Round Expected In</div>
      <div class="next-round-time">${formatCountdownFromMs(remainingMs)}</div>
      <div class="next-round-note">
        Keep this page open. You’ll auto-join when trivia returns.
        <br />
        <span>Estimated from the TV slideshow.</span>
      </div>
    `;
  }

  render();

  if (nextRoundCountdownTarget === targetTime && nextRoundCountdownInterval) {
    return;
  }

  if (nextRoundCountdownInterval) {
    clearInterval(nextRoundCountdownInterval);
  }

  nextRoundCountdownTarget = targetTime;
  nextRoundCountdownInterval = setInterval(render, 1000);
}

function rememberCompletedRoundIfNeeded(game, player) {
  if (!game?.lastCompletedRoundId) return;

  if (player?.joinedRoundId === game.lastCompletedRoundId) {
    localStorage.setItem(LAST_COMPLETED_ROUND_KEY, game.lastCompletedRoundId);
  }
}

function shouldShowNextRoundCountdown(game, player) {
  if (!game || game.phase !== "waiting") return false;
  if (!game.lastCompletedRoundId || !game.nextRoundExpectedAt) return false;

  const locallyCompletedRound = localStorage.getItem(LAST_COMPLETED_ROUND_KEY);
  const playerJoinedCompletedRound = player?.joinedRoundId === game.lastCompletedRoundId;

  return playerJoinedCompletedRound || locallyCompletedRound === game.lastCompletedRoundId;
}

async function addPlayerToCurrentRound(game) {
  if (!playerId || !playerName) return;
  if (!game || !game.roundId) return;
  if (game.phase === "waiting") return;
  if (game.lastCompletedRoundId === game.roundId) return;
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
      nameKey: isGuest ? null : playerNameKey,
      isGuest,
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
    setJoinError("Pick a different nickname. That name is not allowed.");
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

  let newPlayerId;

  if (existingProfile) {
    newPlayerId = existingProfile.playerId;
  } else {
    newPlayerId = `player_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    await claimedNamesRef.child(nameKey).set({
      playerId: newPlayerId,
      displayName: cleanedName,
      pin,
      totalScore: 0,
      gamesPlayed: 0,
      wins: 0,
      createdAt: Date.now(),
      lastPlayed: Date.now()
    });
  }

  saveRegisteredLocally(newPlayerId, cleanedName, nameKey, pin);

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

async function joinAsGuest() {
  setJoinError("");

  const guestName = makeGuestName();
  const guestId = makeGuestId();

  saveGuestLocally(guestId, guestName);

  const gameSnap = await gameRef.once("value");
  const game = gameSnap.val() || {};

  await addPlayerToCurrentRound(game);

  hidePlayerStats();
  hideMiniLeaderboard();
  hideNextRoundCountdown();
  showGameView();

  statusText.textContent = `Playing as ${guestName}. Guest scores do not save all-time.`;
  categoryText.textContent = "Guest Mode";
  setPhoneQuestionText("Watch the TV for the next question.");
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
    return isGuest
      ? `You are in as ${playerName}. Guest scores do not save all-time.`
      : "You are in. Get ready — the round is about to start.";
  }

  if (game.phase === "question") {
    return "Answer fast — your point value is dropping!";
  }

  if (game.phase === "reveal") {
    return getAnswerFeedback(game, player);
  }

  if (game.phase === "final") {
    return isGuest
      ? "Round complete! Guest scores do not save all-time. Keep this page open for the next round."
      : "Round complete! Your all-time score was saved. Keep this page open for the next round.";
  }

  if (game.phase === "waiting") {
    return "Waiting for trivia to return on the TV.";
  }

  return "Waiting for the next question...";
}

async function renderGame(game) {
  currentGame = game || {};
  timerText.textContent = formatTime(currentGame.timer || 0);

  if (!playerId || !playerName) {
    hidePointsBox();
    hideMiniLeaderboard();
    hideNextRoundCountdown();
    showJoinView();
    return;
  }

  if (!isGuest && (!playerNameKey || !savedPin)) {
    hidePointsBox();
    hideMiniLeaderboard();
    hideNextRoundCountdown();
    showJoinView();
    return;
  }

  showGameView();

  if (currentGame.roundId) {
    await addPlayerToCurrentRound(currentGame);
  }

  const playerSnap = await gameRef.child(`players/${playerId}`).once("value");
  currentPlayer = playerSnap.val();

  const playersSnap = await gameRef.child("players").once("value");
  const playersObj = playersSnap.val() || {};
  const currentRankText = getCurrentRankText(playersObj);

  rememberCompletedRoundIfNeeded(currentGame, currentPlayer);

  scoreText.textContent = currentPlayer?.score || 0;

  if (currentGame.phase === "waiting") {
    hidePointsBox();
    hideMiniLeaderboard();

    if (shouldShowNextRoundCountdown(currentGame, currentPlayer)) {
      if (isGuest) {
        hidePlayerStats();
      } else {
        showPlayerStats();
        await loadPlayerStats();
      }

      showNextRoundCountdown(currentGame.nextRoundExpectedAt);

      statusText.className = "status";
      statusText.textContent = "Round complete. Waiting for trivia to return on the TV.";

      categoryText.textContent = "Next Round";
      setPhoneQuestionText("Keep this page open. You’ll automatically join when the next trivia round starts.");

      choicesEl.innerHTML = "";
      return;
    }

    hideNextRoundCountdown();

    statusText.className = "status";
    statusText.textContent = "Waiting for trivia to return on the TV.";

    categoryText.textContent = "Waiting";
    setPhoneQuestionText("Scan the QR code when the next round starts, or keep this page open.");

    choicesEl.innerHTML = "";
    return;
  }

  if (!currentGame.phase || currentGame.phase === "join") {
    hideNextRoundCountdown();

    if (isGuest) {
      hidePlayerStats();
    } else {
      showPlayerStats();
      await loadPlayerStats();
    }

    hidePointsBox();
    hideMiniLeaderboard();

    statusText.className = "status";
    statusText.textContent = getJoinStatusMessage(currentGame, currentPlayer);

    categoryText.textContent = isGuest ? "Guest Mode" : "Get Ready";
    setPhoneQuestionText(
      isGuest
        ? "You can play this round, but your score will not save to the all-time leaderboard."
        : "Watch the TV for the round countdown."
    );

    choicesEl.innerHTML = "";
    return;
  }

  if (currentGame.phase === "question") {
    hideNextRoundCountdown();
    hidePlayerStats();
    hideMiniLeaderboard();

    statusText.className = "status";

    const existingAnswer = currentPlayer?.answers?.[currentGame.questionIndex] || localLockedAnswers[currentGame.questionIndex];

    if (existingAnswer) {
      lockPoints(existingAnswer.pointsPossible || 0, currentGame.maxPoints || 1000);
    } else {
      startLivePoints(currentGame);
    }

    statusText.textContent = existingAnswer
      ? `${currentRankText ? `${currentRankText}. ` : ""}Answer locked in for ${(existingAnswer.pointsPossible || 0).toLocaleString()} possible points.`
      : `${currentRankText ? `${currentRankText}. ` : ""}${getJoinStatusMessage(currentGame, currentPlayer)}`;

    categoryText.textContent = currentGame.category || "Trivia";
    setPhoneQuestionText(currentGame.question || "Question loading...");

    renderChoices(currentGame);
    return;
  }

  if (currentGame.phase === "reveal") {
    hideNextRoundCountdown();
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
    statusText.textContent = `${currentRankText ? `${currentRankText}. ` : ""}${getJoinStatusMessage(currentGame, currentPlayer)}`;

    if (isCorrect && lastFireworkQuestion !== currentGame.questionIndex) {
      launchFireworks();
      lastFireworkQuestion = currentGame.questionIndex;
    }

    categoryText.textContent = currentGame.category || "Trivia";
    setPhoneQuestionText(currentGame.question || "Answer revealed.");

    renderChoices(currentGame);
    updateMiniLeaderboard(playersObj);
    return;
  }

  if (currentGame.phase === "final") {
    hideNextRoundCountdown();

    if (isGuest) {
      hidePlayerStats();
    } else {
      showPlayerStats();
      await loadPlayerStats();
    }

    hidePointsBox();
    updateMiniLeaderboard(playersObj);

    statusText.className = "status";
    statusText.textContent = `${currentRankText ? `${currentRankText}. ` : ""}${getJoinStatusMessage(currentGame, currentPlayer)}`;

    categoryText.textContent = isGuest ? "Guest Round Complete" : "Round Complete";
    setPhoneQuestionText(
      isGuest
        ? "Keep this page open. You will automatically join the next round as a guest."
        : "Keep this page open. You will automatically join the next round when trivia comes back on the TV."
    );

    choicesEl.innerHTML = "";
    return;
  }
}

joinBtn.addEventListener("click", joinGame);
guestBtn.addEventListener("click", joinAsGuest);

if (playerName && !isGuest) {
  nameInput.value = playerName;
}

if (savedPin && !isGuest) {
  pinInput.value = savedPin;
}

if (playerId && playerName && (isGuest || (playerNameKey && savedPin))) {
  showGameView();

  if (isGuest) {
    hidePlayerStats();
    statusText.textContent = `Waiting as ${playerName}. Guest scores do not save all-time.`;
    categoryText.textContent = "Guest Mode";
    setPhoneQuestionText("Keep this page open. You will automatically join the next round as a guest.");
  } else {
    showPlayerStats();
    statusText.textContent = "Waiting for the trivia screen to come back on the TV.";
    categoryText.textContent = "Ready";
    setPhoneQuestionText("Keep this page open. You will automatically join the next round.");
    loadPlayerStats();
  }

  hidePointsBox();
  hideMiniLeaderboard();
  hideNextRoundCountdown();
}

gameRef.on("value", snap => {
  renderGame(snap.val());
});
