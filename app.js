const JOIN_SECONDS = 30;
const QUESTION_SECONDS = 20;
const REVEAL_SECONDS = 8;
const FINAL_SECONDS = 42;
const MAX_POINTS = 1000;
const FULL_POINTS_GRACE_SECONDS = 3;

const NEXT_TRIVIA_WAIT_SECONDS = 630; // 10 minutes 30 seconds

const RECENT_QUESTION_STORAGE_KEY = "grumpysRecentlyUsedQuestions";
const RECENT_QUESTION_LIMIT = 60;

const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);
const claimedNamesRef = db.ref("claimedNames");
const savedRoundsRef = db.ref("savedRounds");

const screenEl = document.querySelector(".screen");
const phaseLabel = document.getElementById("phaseLabel");
const timerEl = document.getElementById("timer");
const categoryEl = document.getElementById("category");
const questionEl = document.getElementById("question");
const answersEl = document.getElementById("answers");
const messageEl = document.getElementById("message");
const roundProgressEl = document.getElementById("roundProgress");
const qrCodeEl = document.getElementById("qrCode");

let questions = [];
let currentQuestionIndex = 0;
let correctAnswerIndex = 0;
let roundId = Date.now().toString();
let currentQuestionStartedAt = null;
let tvPointsInterval = null;
let nextRoundExpectedAt = null;

function setPhase(phase) {
  screenEl.classList.remove("phase-join", "phase-question", "phase-reveal", "phase-final");
  screenEl.classList.add(`phase-${phase}`);
}

function decodeHtml(text) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function shuffle(array) {
  return array
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

function getQuestionKey(question) {
  return `${question.category || ""}::${question.question || ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getRecentlyUsedQuestions() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_QUESTION_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecentlyUsedQuestions(questionKeys) {
  const trimmed = questionKeys.slice(-RECENT_QUESTION_LIMIT);
  localStorage.setItem(RECENT_QUESTION_STORAGE_KEY, JSON.stringify(trimmed));
}

function markQuestionsUsed(selectedQuestions) {
  const recent = getRecentlyUsedQuestions();
  const newKeys = selectedQuestions.map(getQuestionKey);
  const combined = [...recent, ...newKeys];

  saveRecentlyUsedQuestions(combined);
}

function pickRandomQuestionsAvoidingRecent(bank, amount) {
  const recent = getRecentlyUsedQuestions();
  const recentSet = new Set(recent);

  const freshQuestions = bank.filter(question => !recentSet.has(getQuestionKey(question)));

  if (freshQuestions.length >= amount) {
    return shuffle([...freshQuestions]).slice(0, amount);
  }

  return shuffle([...bank]).slice(0, amount);
}

function setTvQuestionText(text) {
  const cleanText = text || "";

  questionEl.textContent = cleanText;
  questionEl.classList.remove("long-question", "extra-long-question", "super-long-question");

  if (cleanText.length > 100) {
    questionEl.classList.add("long-question");
  }

  if (cleanText.length > 150) {
    questionEl.classList.add("extra-long-question");
  }

  if (cleanText.length > 210) {
    questionEl.classList.add("super-long-question");
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getPlayUrl() {
  return `${window.location.origin}${window.location.pathname.replace("index.html", "")}play.html`;
}

function setQrCode() {
  const playUrl = getPlayUrl();
  const encodedPlayUrl = encodeURIComponent(playUrl);

  qrCodeEl.innerHTML = `
    <img 
      alt="Scan to play" 
      src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodedPlayUrl}"
      style="width:100%;height:100%;object-fit:contain;border-radius:14px;"
    >
  `;
}

function startCountdown(seconds) {
  let remaining = seconds;
  timerEl.textContent = formatTime(remaining);

  return new Promise(resolve => {
    const interval = setInterval(async () => {
      remaining--;
      timerEl.textContent = formatTime(Math.max(remaining, 0));

      await gameRef.update({
        timer: Math.max(remaining, 0)
      });

      if (remaining <= 0) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
}

function getTvPointsEls() {
  return {
    box: document.getElementById("tvPointsBox"),
    text: document.getElementById("tvPointsText"),
    fill: document.getElementById("tvPointsFill")
  };
}

function calculateLivePoints(startedAt = currentQuestionStartedAt) {
  if (!startedAt) return 0;

  const elapsedMs = Date.now() - startedAt;
  const graceMs = FULL_POINTS_GRACE_SECONDS * 1000;
  const scoringMs = Math.max(1, (QUESTION_SECONDS - FULL_POINTS_GRACE_SECONDS) * 1000);

  if (elapsedMs <= graceMs) {
    return MAX_POINTS;
  }

  const scoringElapsedMs = elapsedMs - graceMs;
  const remainingRatio = Math.max(0, Math.min(1, 1 - scoringElapsedMs / scoringMs));

  return Math.ceil(MAX_POINTS * remainingRatio);
}

function updateTvPointsBar(points) {
  const { box, text, fill } = getTvPointsEls();

  if (!box || !text || !fill) return;

  const safePoints = Math.max(0, Math.min(MAX_POINTS, Math.round(points || 0)));
  const percent = (safePoints / MAX_POINTS) * 100;

  text.textContent = safePoints.toLocaleString();
  fill.style.width = `${percent}%`;

  box.classList.remove("hidden", "tv-points-low");

  if (safePoints <= MAX_POINTS * 0.25) {
    box.classList.add("tv-points-low");
  }
}

function startTvPointsBar() {
  stopTvPointsBar();

  updateTvPointsBar(MAX_POINTS);

  tvPointsInterval = setInterval(() => {
    updateTvPointsBar(calculateLivePoints());
  }, 50);
}

function stopTvPointsBar() {
  if (tvPointsInterval) {
    clearInterval(tvPointsInterval);
    tvPointsInterval = null;
  }
}

function hideTvPointsBar() {
  stopTvPointsBar();

  const { box } = getTvPointsEls();

  if (box) {
    box.classList.add("hidden");
  }
}

function getPointsFromAnswer(answer) {
  if (!answer || !answer.answeredAt || !currentQuestionStartedAt) return 0;

  const elapsedMs = answer.answeredAt - currentQuestionStartedAt;
  const graceMs = FULL_POINTS_GRACE_SECONDS * 1000;
  const scoringMs = Math.max(1, (QUESTION_SECONDS - FULL_POINTS_GRACE_SECONDS) * 1000);

  if (elapsedMs <= graceMs) {
    return MAX_POINTS;
  }

  const scoringElapsedMs = elapsedMs - graceMs;
  const remainingRatio = Math.max(0, Math.min(1, 1 - scoringElapsedMs / scoringMs));

  return Math.ceil(MAX_POINTS * remainingRatio);
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
  const leaderboardList = document.getElementById("leaderboardList");

  if (players.length === 0) {
    leaderboardList.innerHTML = `<li><span>Waiting...</span><strong>0</strong></li>`;
    return;
  }

  leaderboardList.innerHTML = players
    .map(player => `<li><span>${player.name}</span><strong>${player.score || 0}</strong></li>`)
    .join("");
}

function makeBoardList(players) {
  if (!players || players.length === 0) {
    return `<li><span>No scores yet</span><strong>0</strong></li>`;
  }

  return players
    .map(player => {
      const name = player.name || player.displayName || "Player";
      const score = player.score ?? player.totalScore ?? 0;

      return `<li><span>${name}</span><strong>${score.toLocaleString()}</strong></li>`;
    })
    .join("");
}

async function getAllTimeLeaders() {
  const snap = await claimedNamesRef.once("value");
  const profilesObj = snap.val() || {};

  const profiles = Object.entries(profilesObj).map(([nameKey, profile]) => ({
    nameKey,
    name: profile.displayName || nameKey,
    score: profile.totalScore || 0,
    totalScore: profile.totalScore || 0,
    gamesPlayed: profile.gamesPlayed || 0,
    wins: profile.wins || 0
  }));

  return profiles
    .filter(profile => profile.totalScore > 0)
    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
    .slice(0, 15);
}

async function addRoundScoresToAllTime(roundLeaders) {
  const savedRoundSnap = await savedRoundsRef.child(roundId).once("value");

  if (savedRoundSnap.exists()) {
    console.warn("This round was already saved. Skipping all-time update.");
    return;
  }

  for (let i = 0; i < roundLeaders.length; i++) {
    const player = roundLeaders[i];

    if (!player.nameKey) continue;
    if (player.isGuest) continue;

    const profileRef = claimedNamesRef.child(player.nameKey);
    const profileSnap = await profileRef.once("value");
    const profile = profileSnap.val();

    if (!profile) continue;

    await profileRef.update({
      displayName: player.name,
      totalScore: (profile.totalScore || 0) + (player.score || 0),
      gamesPlayed: (profile.gamesPlayed || 0) + 1,
      wins: (profile.wins || 0) + (i === 0 ? 1 : 0),
      lastPlayed: Date.now()
    });
  }

  await savedRoundsRef.child(roundId).set({
    savedAt: Date.now(),
    playerCount: roundLeaders.length
  });
}

async function cleanupGuestPlayers() {
  const snap = await gameRef.child("players").once("value");
  const players = snap.val() || {};
  const updates = {};

  Object.entries(players).forEach(([playerId, player]) => {
    if (player.isGuest || !player.nameKey || playerId.startsWith("guest_")) {
      updates[`players/${playerId}`] = null;
    }
  });

  if (Object.keys(updates).length > 0) {
    await gameRef.update(updates);
  }
}

async function scoreQuestion() {
  const snap = await gameRef.child("players").once("value");
  const players = snap.val() || {};
  const updates = {};

  Object.entries(players).forEach(([playerId, player]) => {
    const answer = player.answers?.[currentQuestionIndex];

    if (answer && answer.choiceIndex === correctAnswerIndex && !answer.scored) {
      const pointsEarned = getPointsFromAnswer(answer);

      updates[`players/${playerId}/score`] = (player.score || 0) + pointsEarned;
      updates[`players/${playerId}/answers/${currentQuestionIndex}/scored`] = true;
      updates[`players/${playerId}/answers/${currentQuestionIndex}/pointsEarned`] = pointsEarned;
      updates[`players/${playerId}/answers/${currentQuestionIndex}/wasCorrect`] = true;
    } else if (answer && !answer.scored) {
      updates[`players/${playerId}/answers/${currentQuestionIndex}/scored`] = true;
      updates[`players/${playerId}/answers/${currentQuestionIndex}/pointsEarned`] = 0;
      updates[`players/${playerId}/answers/${currentQuestionIndex}/wasCorrect`] = false;
    }
  });

  if (Object.keys(updates).length > 0) {
    await gameRef.update(updates);
  }

  const updatedSnap = await gameRef.child("players").once("value");
  renderLeaderboard(updatedSnap.val() || {});
}

function makeFinalConfetti() {
  let pieces = "";

  for (let i = 0; i < 42; i++) {
    const left = Math.floor(Math.random() * 100);
    const delay = (Math.random() * 2).toFixed(2);
    const duration = (2.8 + Math.random() * 2.4).toFixed(2);
    const drift = Math.floor(Math.random() * 220 - 110);

    pieces += `<span style="left:${left}%; animation-delay:${delay}s; animation-duration:${duration}s; --drift:${drift}px;"></span>`;
  }

  return `<div class="final-confetti">${pieces}</div>`;
}

function showJoinScreen() {
  setPhase("join");
  hideTvPointsBar();

  phaseLabel.textContent = "Join Now";
  categoryEl.textContent = "Grumpy's Trivia";
  setTvQuestionText("Scan the QR code to play!");
  messageEl.textContent = "Returning players: use the same name + PIN. New players: create a nickname + 4-digit PIN. Just trying it? Tap Play as Guest.";
  roundProgressEl.textContent = "Round starts soon";

  answersEl.innerHTML = `
    <div class="answer">Name + PIN saves your all-time score</div>
    <div class="answer">Play as Guest for this round only</div>
    <div class="answer">6 questions per round</div>
    <div class="answer">Fast answers score up to 1000 points</div>
  `;

  renderLeaderboard({});
}

async function showQuestion(questionData, index) {
  setPhase("question");

  phaseLabel.textContent = "Question";
  currentQuestionIndex = index;
  currentQuestionStartedAt = Date.now();

  const decodedCategory = decodeHtml(questionData.category);
  const decodedQuestion = decodeHtml(questionData.question);

  categoryEl.textContent = decodedCategory;
  setTvQuestionText(decodedQuestion);

  messageEl.textContent = "Answer fast — your point value is dropping.";
  roundProgressEl.textContent = `Question ${index + 1} of ${questions.length}`;

  const choices = shuffle([
    ...questionData.incorrect_answers,
    questionData.correct_answer
  ]).map(decodeHtml);

  correctAnswerIndex = choices.indexOf(decodeHtml(questionData.correct_answer));

  answersEl.innerHTML = choices
    .map((choice, i) => `<div class="answer" data-index="${i}">${String.fromCharCode(65 + i)}. ${choice}</div>`)
    .join("");

  await gameRef.update({
    roundId,
    phase: "question",
    questionIndex: index,
    category: decodedCategory,
    question: decodedQuestion,
    choices,
    correctAnswerIndex: null,
    timer: QUESTION_SECONDS,
    questionStartedAt: currentQuestionStartedAt,
    questionSeconds: QUESTION_SECONDS,
    maxPoints: MAX_POINTS,
    fullPointsGraceSeconds: FULL_POINTS_GRACE_SECONDS,
    finalSaved: false
  });

  startTvPointsBar();
}

async function showAnswerReveal(index) {
  setPhase("reveal");
  stopTvPointsBar();
  hideTvPointsBar();

  phaseLabel.textContent = "Answer";
  messageEl.textContent = "Correct answer revealed • Current Top 5 updated";
  roundProgressEl.textContent = `Top 5 after Question ${index + 1}`;

  document.querySelectorAll(".answer").forEach((answer, i) => {
    if (i === correctAnswerIndex) {
      answer.classList.add("correct");
    } else {
      answer.classList.add("dim");
    }
  });

  await scoreQuestion();

  await gameRef.update({
    roundId,
    phase: "reveal",
    correctAnswerIndex,
    timer: REVEAL_SECONDS
  });
}

async function showFinalScreen() {
  setPhase("final");
  hideTvPointsBar();

  const snap = await gameRef.child("players").once("value");
  const roundLeaders = getSortedPlayers(snap.val() || {}).slice(0, 5);

  await addRoundScoresToAllTime(roundLeaders);

  const allTimeLeaders = await getAllTimeLeaders();
  const winnerName = roundLeaders[0]?.name || "Nobody yet";

  // The host trivia slide still has FINAL_SECONDS left before it leaves,
  // then the rest of the VXT slideshow takes about 10:30 before trivia returns.
  nextRoundExpectedAt = Date.now() + ((FINAL_SECONDS + NEXT_TRIVIA_WAIT_SECONDS) * 1000);

  phaseLabel.textContent = "Final";
  categoryEl.textContent = "Final Scoreboard";
  setTvQuestionText(`${winnerName} wins this round!`);
  messageEl.textContent = "All-time leaderboard saves by nickname + PIN.";
  roundProgressEl.textContent = "Round complete";

  answersEl.innerHTML = `
    ${makeFinalConfetti()}

    <div class="final-board round-board">
      <div class="winner-banner">🏆 This Round Winner: ${winnerName}</div>
      <h3>Final Top 5</h3>
      <ol>
        ${makeBoardList(roundLeaders)}
      </ol>
    </div>

    <div class="final-board all-time-board scrolling-board">
      <h3>All-Time Leaderboard</h3>
      <div class="scroll-window">
        <ol class="scroll-list">
          ${makeBoardList(allTimeLeaders)}
        </ol>
      </div>
    </div>
  `;

  await gameRef.update({
    roundId,
    phase: "final",
    timer: FINAL_SECONDS,
    finalSaved: true,
    lastCompletedRoundId: roundId,
    nextRoundExpectedAt
  });
}

function getQuestionsByCategory(category) {
  return CUSTOM_QUESTIONS.filter(q => q.category === category);
}

function getSportsQuestions() {
  return CUSTOM_QUESTIONS.filter(q => ["NHL", "NFL", "NBA", "MLB"].includes(q.category));
}

async function loadQuestions() {
  const general = pickRandomQuestionsAvoidingRecent(getQuestionsByCategory("General Knowledge"), 2);
  const history = pickRandomQuestionsAvoidingRecent(getQuestionsByCategory("US History"), 2);
  const sports = pickRandomQuestionsAvoidingRecent(getSportsQuestions(), 2);

  questions = shuffle([
    ...general,
    ...history,
    ...sports
  ]).slice(0, 6);

  if (questions.length < 6) {
    console.error("Not enough custom questions found. Check questions.js and category names.");
  }

  markQuestionsUsed(questions);
}

async function runRound() {
  roundId = Date.now().toString();
  nextRoundExpectedAt = null;

  await gameRef.set({
    roundId,
    phase: "join",
    timer: JOIN_SECONDS,
    players: {},
    finalSaved: false,
    lastCompletedRoundId: null,
    nextRoundExpectedAt: null,
    waitingMessage: null
  });

  showJoinScreen();
  await startCountdown(JOIN_SECONDS);

  for (let i = 0; i < questions.length; i++) {
    await showQuestion(questions[i], i);
    await startCountdown(QUESTION_SECONDS);

    await showAnswerReveal(i);
    await startCountdown(REVEAL_SECONDS);
  }

  await showFinalScreen();
  await startCountdown(FINAL_SECONDS);

  const waitSeconds = nextRoundExpectedAt
    ? Math.max(0, Math.ceil((nextRoundExpectedAt - Date.now()) / 1000))
    : NEXT_TRIVIA_WAIT_SECONDS;

  await gameRef.update({
    phase: "waiting",
    timer: waitSeconds,
    lastCompletedRoundId: roundId,
    nextRoundExpectedAt,
    waitingMessage: "Next round expected soon. Keep this page open."
  });

  await cleanupGuestPlayers();

  phaseLabel.textContent = "Next Round";
  timerEl.textContent = "0:00";
}

gameRef.child("players").on("value", snap => {
  renderLeaderboard(snap.val() || {});
});

async function init() {
  hideTvPointsBar();
  setQrCode();

  if (typeof CUSTOM_QUESTIONS === "undefined") {
    console.error("questions.js did not load. Make sure questions.js is included before app.js in index.html.");
    setTvQuestionText("Question bank failed to load.");
    return;
  }

  await loadQuestions();
  runRound();
}

init();
