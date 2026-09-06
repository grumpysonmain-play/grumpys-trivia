const JOIN_SECONDS = 30;
const QUESTION_SECONDS = 20;
const REVEAL_SECONDS = 8;
const FINAL_SECONDS = 42;
const MAX_POINTS = 1000;
const FULL_POINTS_GRACE_SECONDS = 3;

const ROUND_THEMES = [
  { accent: "#ff4255", accentHot: "#ff9eaa", accentRgb: "255 66 85" },
  { accent: "#4aa8ff", accentHot: "#a7d7ff", accentRgb: "74 168 255" },
  { accent: "#42d987", accentHot: "#a5f3c8", accentRgb: "66 217 135" },
  { accent: "#ff8a35", accentHot: "#ffc28f", accentRgb: "255 138 53" },
  { accent: "#9d73ff", accentHot: "#d5c3ff", accentRgb: "157 115 255" }
];

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
const questionCounterEl = document.getElementById("questionCounter");
const answersEl = document.getElementById("answers");
const messageEl = document.getElementById("message");
const roundProgressEl = document.getElementById("roundProgress");
const qrCodeEl = document.getElementById("qrCode");
const brandLogoEl = document.getElementById("brandLogo");
const joinTickerTrackEl = document.getElementById("joinTickerTrack");
const joinPlayerCountEl = document.getElementById("joinPlayerCount");

let questions = [];
let currentQuestionIndex = 0;
let correctAnswerIndex = 0;
let roundId = Date.now().toString();
let currentQuestionStartedAt = null;
let tvPointsInterval = null;
let nextRoundExpectedAt = null;
let finalStageTimeouts = [];
let finalBoardAnimations = [];

function applyRoundTheme(roundKey) {
  const key = String(roundKey || "grumpys");
  const themeIndex = [...key].reduce((total, character) => total + character.charCodeAt(0), 0) % ROUND_THEMES.length;
  const theme = ROUND_THEMES[themeIndex];
  const rootStyle = document.documentElement.style;

  rootStyle.setProperty("--accent", theme.accent);
  rootStyle.setProperty("--accent-hot", theme.accentHot);
  rootStyle.setProperty("--accent-rgb", theme.accentRgb);
}

function setSeasonalBranding(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();

  const isChristmasSeason = month === 11 || (month === 0 && day === 1);
  const isJulyFourthWeek = month === 6 && day >= 1 && day <= 7;
  const isMemorialDayWeek = month === 4 && day >= 23;
  const isVeteransDayWeek = month === 10 && day >= 8 && day <= 12;
  const isPatrioticSeason = isJulyFourthWeek || isMemorialDayWeek || isVeteransDayWeek;

  if (isChristmasSeason) {
    brandLogoEl.src = "assets/grumpys-logo-christmas.png";
    brandLogoEl.alt = "Grumpy's Christmas logo";
    return;
  }

  if (isPatrioticSeason) {
    brandLogoEl.src = "assets/grumpys-logo-usa.png";
    brandLogoEl.alt = "Grumpy's USA logo";
    return;
  }

  brandLogoEl.src = "assets/grumpys-logo.png";
  brandLogoEl.alt = "Grumpy's St. Boni logo";
}

applyRoundTheme(roundId);
setSeasonalBranding();

function setPhase(phase) {
  clearFinalStageTimeouts();
  screenEl.classList.remove("phase-join", "phase-question", "phase-reveal", "phase-final");
  screenEl.classList.remove("phase-enter");
  screenEl.classList.add(`phase-${phase}`);
  void screenEl.offsetWidth;
  screenEl.classList.add("phase-enter");
}

function clearFinalStageTimeouts() {
  finalStageTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  finalStageTimeouts = [];
  finalBoardAnimations.forEach(animation => animation.cancel());
  finalBoardAnimations = [];
}

function startFinalBoardScroll(stageName) {
  finalBoardAnimations.forEach(animation => animation.cancel());
  finalBoardAnimations = [];

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const stage = answersEl.querySelector(`[data-final-stage="${stageName}"].is-active`);
    const viewport = stage?.querySelector(".scoreboard-scroll");
    const list = viewport?.querySelector(".placement-list");

    if (!viewport || !list || !screenEl.classList.contains("phase-final")) return;

    const overflow = Math.max(0, list.scrollHeight - viewport.clientHeight);

    if (overflow < 2) return;

    const duration = stageName === "round" ? 9000 : 21000;
    const animation = list.animate([
      { transform: "translateY(0)" },
      { transform: "translateY(0)", offset: .12 },
      { transform: `translateY(-${overflow}px)`, offset: .9 },
      { transform: `translateY(-${overflow}px)` }
    ], {
      duration,
      easing: "linear",
      fill: "forwards"
    });

    finalBoardAnimations.push(animation);
  }));
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
  timerEl.classList.toggle("is-urgent", remaining <= 5);

  return new Promise(resolve => {
    const interval = setInterval(async () => {
      remaining--;
      timerEl.textContent = formatTime(Math.max(remaining, 0));
      timerEl.classList.toggle("is-urgent", remaining <= 5);

      await gameRef.update({
        timer: Math.max(remaining, 0)
      });

      if (remaining <= 0) {
        clearInterval(interval);
        timerEl.classList.remove("is-urgent");
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
  const colorProgress = Math.max(0, Math.min(1, percent / 100));
  const hue = Math.round(120 * colorProgress);

  text.textContent = safePoints.toLocaleString();
  fill.style.width = `${percent}%`;
  box.style.setProperty("--points-color", `hsl(${hue} 86% 56%)`);
  box.style.setProperty("--points-color-dark", `hsl(${hue} 74% 38%)`);
  box.style.setProperty("--points-glow", `hsl(${hue} 86% 56% / 0.46)`);
  box.style.borderColor = `hsl(${hue} 86% 56% / 0.42)`;

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
    .map(player => `<li><span>${player.name}</span><strong>${(player.score || 0).toLocaleString()}</strong></li>`)
    .join("");
}

function renderJoinTicker(playersObj = {}) {
  const players = getSortedPlayers(playersObj);
  const names = players.map(player => player.name || "Player");

  joinPlayerCountEl.textContent = names.length;
  joinTickerTrackEl.replaceChildren();
  joinTickerTrackEl.classList.toggle("is-static", names.length < 2);

  if (names.length === 0) {
    const waiting = document.createElement("span");
    waiting.textContent = "Waiting for players…";
    joinTickerTrackEl.appendChild(waiting);
    return;
  }

  const tickerNames = names.length > 1 ? [...names, ...names] : names;

  tickerNames.forEach(name => {
    const item = document.createElement("span");
    item.textContent = name;
    joinTickerTrackEl.appendChild(item);
  });

  joinTickerTrackEl.style.setProperty("--ticker-duration", `${Math.max(12, names.length * 3.5)}s`);
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

async function addRoundScoresToAllTime(allRoundPlayers) {
  const savedRoundSnap = await savedRoundsRef.child(roundId).once("value");

  if (savedRoundSnap.exists()) {
    console.warn("This round was already saved. Skipping all-time update.");
    return;
  }

  const guestCount = allRoundPlayers.filter(player => player.isGuest || !player.nameKey).length;
  const namedPlayers = allRoundPlayers.filter(player => player.nameKey && !player.isGuest);
  const namedCount = namedPlayers.length;

  for (let i = 0; i < namedPlayers.length; i++) {
    const player = namedPlayers[i];

    const profileRef = claimedNamesRef.child(player.nameKey);
    const profileSnap = await profileRef.once("value");
    const profile = profileSnap.val();

    if (!profile) continue;

    const isWinner = allRoundPlayers[0]?.id === player.id;

    await profileRef.update({
      displayName: player.name,
      totalScore: (profile.totalScore || 0) + (player.score || 0),
      gamesPlayed: (profile.gamesPlayed || 0) + 1,
      wins: (profile.wins || 0) + (isWinner ? 1 : 0),
      lastPlayed: Date.now()
    });
  }

  await savedRoundsRef.child(roundId).set({
    savedAt: Date.now(),
    playerCount: allRoundPlayers.length,
    guestCount,
    namedCount,
    winnerName: allRoundPlayers[0]?.name || null,
    winnerScore: allRoundPlayers[0]?.score || 0
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
    const delay = (Math.random() * 3.5).toFixed(2);
    const duration = (5.8 + Math.random() * 4).toFixed(2);
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
  questionCounterEl.textContent = "GET READY";
  setTvQuestionText("Scan. Join. Play.");
  questionEl.classList.add("join-phrase");
  questionEl.setAttribute("aria-label", "Scan. Join. Play.");
  questionEl.innerHTML = `
    <span class="join-word join-word-scan" aria-hidden="true">Scan.</span>
    <span class="join-word join-word-join" aria-hidden="true">Join.</span>
    <span class="join-word join-word-play" aria-hidden="true">Play.</span>
  `;
  messageEl.textContent = "The next round begins automatically when the timer reaches zero.";
  roundProgressEl.textContent = "Round starts soon";

  answersEl.innerHTML = `
    <div class="join-guide">
      <div class="join-step">
        <span class="join-step-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="4"/></svg></span>
        <div><span class="join-step-kicker">STEP 1 OF 4</span><strong>Scan the QR code</strong><small>Open your phone camera and tap the link.</small></div>
      </div>
      <div class="join-step">
        <span class="join-step-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M9 6h6M10 18h4"/></svg></span>
        <div><span class="join-step-kicker">STEP 2 OF 4</span><strong>Choose how to play</strong><small>Use a nickname + 4-digit PIN, or join as a guest.</small></div>
      </div>
      <div class="join-step">
        <span class="join-step-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 7h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3l-3-3H8l-3 3a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z"/><path d="M7 11v4M5 13h4M16 12h.01M19 14h.01"/></svg></span>
        <div><span class="join-step-kicker">STEP 3 OF 4</span><strong>Answer on your phone</strong><small>Six questions appear here and on your device.</small></div>
      </div>
      <div class="join-step">
        <span class="join-step-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M13 2 5 14h6l-1 8 9-13h-6z"/></svg></span>
        <div><span class="join-step-kicker">STEP 4 OF 4</span><strong>Be quick</strong><small>Fast correct answers earn up to 1,000 points.</small></div>
      </div>
    </div>
  `;

  renderLeaderboard({});
  renderJoinTicker({});
}

async function showQuestion(questionData, index) {
  setPhase("question");
  questionEl.classList.remove("join-phrase");
  questionEl.removeAttribute("aria-label");

  phaseLabel.textContent = "Question";
  currentQuestionIndex = index;
  currentQuestionStartedAt = Date.now();

  const decodedCategory = decodeHtml(questionData.category);
  const decodedQuestion = decodeHtml(questionData.question);

  categoryEl.textContent = decodedCategory;
  questionCounterEl.textContent = `QUESTION ${index + 1} / ${questions.length}`;
  setTvQuestionText(decodedQuestion);

  messageEl.textContent = "Answer fast — your point value is dropping.";
  roundProgressEl.textContent = `Question ${index + 1} of ${questions.length}`;

  const choices = shuffle([
    ...questionData.incorrect_answers,
    questionData.correct_answer
  ]).map(decodeHtml);

  correctAnswerIndex = choices.indexOf(decodeHtml(questionData.correct_answer));

  answersEl.innerHTML = choices
    .map((choice, i) => `<div class="answer" data-index="${i}"><span class="answer-letter">${String.fromCharCode(65 + i)}</span><span class="answer-copy">${choice}</span></div>`)
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
  questionCounterEl.textContent = `ANSWER ${index + 1} / ${questions.length}`;
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
  const allRoundPlayers = getSortedPlayers(snap.val() || {});
  const roundLeaders = allRoundPlayers.slice(0, 5);

  await addRoundScoresToAllTime(allRoundPlayers);

  const allTimeLeaders = await getAllTimeLeaders();
  const winnerName = roundLeaders[0]?.name || "Nobody yet";
  const winnerScore = roundLeaders[0]?.score || 0;

  nextRoundExpectedAt = Date.now() + ((FINAL_SECONDS + NEXT_TRIVIA_WAIT_SECONDS) * 1000);

  phaseLabel.textContent = "Winner";
  categoryEl.textContent = "Round Complete";
  questionCounterEl.textContent = "ROUND COMPLETE";
  setTvQuestionText("And the winner is…");
  messageEl.textContent = "Celebrating this round's champion.";
  roundProgressEl.textContent = "Winner • 10 seconds";

  answersEl.innerHTML = `
    ${makeFinalConfetti()}

    <div class="final-sequence" aria-live="polite">
      <section class="final-stage winner-stage is-active" data-final-stage="winner">
        <div class="winner-trophy" aria-hidden="true">🏆</div>
        <div class="winner-banner">${winnerName}</div>
        <div class="winner-score">${winnerScore.toLocaleString()} POINTS</div>
        <div class="winner-kicker">THIS ROUND'S CHAMPION</div>
      </section>

      <section class="final-stage standings-stage" data-final-stage="round">
        <div class="final-board round-board full-board">
          <h3>Final Round Standings</h3>
          <div class="board-subtitle">Every player • Final placement</div>
          <div class="scoreboard-scroll">
            <ol class="placement-list${allRoundPlayers.length > 16 ? " is-long" : ""}">
              ${makeBoardList(allRoundPlayers)}
            </ol>
          </div>
        </div>
      </section>

      <section class="final-stage standings-stage" data-final-stage="all-time">
        <div class="final-board all-time-board full-board">
          <h3>All-Time Leaderboard</h3>
          <div class="board-subtitle">Career points • Returning players</div>
          <div class="scoreboard-scroll">
            <ol class="placement-list all-time-list">
              ${makeBoardList(allTimeLeaders)}
            </ol>
          </div>
        </div>
      </section>
    </div>
  `;

  const activateFinalStage = stageName => {
    answersEl.querySelectorAll(".final-stage").forEach(stage => {
      stage.classList.toggle("is-active", stage.dataset.finalStage === stageName);
    });

    if (stageName === "round") {
      phaseLabel.textContent = "Final Standings";
      categoryEl.textContent = "This Round";
      setTvQuestionText("Where everyone placed");
      messageEl.textContent = "Every player from this round, in finishing order.";
      roundProgressEl.textContent = "Round scoreboard • 10 seconds";
      answersEl.querySelector(".final-confetti")?.classList.add("is-finished");
      startFinalBoardScroll("round");
      return;
    }

    if (stageName === "all-time") {
      phaseLabel.textContent = "All-Time";
      categoryEl.textContent = "All-Time Leaderboard";
      setTvQuestionText("Grumpy's Hall of Fame");
      messageEl.textContent = "Career totals for players with a saved nickname + PIN.";
      roundProgressEl.textContent = "All-time scoreboard";
      startFinalBoardScroll("all-time");
    }
  };

  finalStageTimeouts = [
    setTimeout(() => activateFinalStage("round"), 10000),
    setTimeout(() => activateFinalStage("all-time"), 20000)
  ];

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
  applyRoundTheme(roundId);
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
  const players = snap.val() || {};
  renderLeaderboard(players);
  renderJoinTicker(players);
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
