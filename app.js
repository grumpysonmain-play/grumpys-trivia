const JOIN_SECONDS = 30;
const QUESTION_SECONDS = 20;
const REVEAL_SECONDS = 8;
const FINAL_SECONDS = 42;
const MAX_POINTS = 1000;
const FULL_POINTS_GRACE_SECONDS = 3;

// The ten round colors live in round-themes.js, shared with the phones and promo screen.
const ROUND_THEMES = window.GRUMPYS_ROUND_THEMES;

const NEXT_TRIVIA_WAIT_SECONDS = 630; // 10 minutes 30 seconds

const RECENT_QUESTION_STORAGE_KEY = "grumpysRecentlyUsedQuestions";
const RECENT_QUESTION_LIMIT = 60;

const GAME_ID = "main";

// view.html sets this: the second screen follows the game instead of running it.
const IS_VIEWER = window.GRUMPYS_VIEWER === true;
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
let roundQuestionCount = 6;
let currentQuestionIndex = 0;
let correctAnswerIndex = 0;
let roundId = Date.now().toString();
let currentQuestionStartedAt = null;
let tvPointsInterval = null;
let nextRoundExpectedAt = null;
let finalStageTimeouts = [];
let finalBoardAnimations = [];
let revealTimeouts = [];
let currentPhase = "join";
let revealBoardActive = false;
let knownPlayerIds = null;
let latestPlayers = {};
let toastQueue = [];
let toastTimer = null;

const timerCaptionEl = document.getElementById("timerCaption");
const answeredCountEl = document.getElementById("answeredCount");
const revealStatsEl = document.getElementById("revealStats");
const qrKickerEl = document.getElementById("qrKicker");
const leaderboardTitleEl = document.getElementById("leaderboardTitle");
const toastsEl = document.getElementById("tvToasts");
const bumperEl = document.getElementById("questionBumper");

const TIMER_CAPTIONS = {
  join: "UNTIL THE ROUND STARTS",
  question: "SECONDS LEFT",
  reveal: "NEXT QUESTION",
  final: "ROUND WRAP-UP"
};
const REVEAL_BOARD_SIZE = 8;
const MOVE_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2l5 8H1z" fill="currentColor"/></svg>';

// Player names come from phones, so never put them into the page as HTML.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Firebase's clock (from grumpys-auth.js), so every screen and phone agrees on the time.
function serverNow() {
  return typeof window.grumpysServerNow === "function" ? window.grumpysServerNow() : Date.now();
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastRoundThemeKey = null;
function applyRoundTheme(roundKey) {
  lastRoundThemeKey = roundKey;
  applyTheme(window.pickGrumpysRoundTheme(roundKey));
}
// christmas.js calls this when the theme switches, so the round picks up the right colors.
window.grumpysReapplyRoundTheme = () => applyRoundTheme(lastRoundThemeKey);

function applyTheme(theme) {
  const rootStyle = document.documentElement.style;

  rootStyle.setProperty("--accent", theme.accent);
  rootStyle.setProperty("--accent-hot", theme.hot);
  rootStyle.setProperty("--accent-rgb", theme.rgb);
  rootStyle.setProperty("--accent2-rgb", theme.rgb2);
}

// A one-off wash of color across the background (green for the answer, gold for the winner).
function backgroundBurst(rgb) {
  const burst = document.getElementById("bgBurst");
  if (!burst) return;
  burst.style.setProperty("--burst-rgb", rgb);
  burst.classList.remove("is-bursting");
  void burst.offsetWidth;
  burst.classList.add("is-bursting");
}

// During a question the background warms toward red as the points drain away.
function setBackgroundHeat(amount) {
  const heat = document.getElementById("heatGlow");
  if (heat) heat.style.opacity = Math.max(0, Math.min(1, amount)).toFixed(3);
}

function setSeasonalBranding(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();

  // The Christmas logo is handled by christmas.js, together with the Christmas theme.
  const isJulyFourthWeek = month === 6 && day >= 1 && day <= 7;
  const isMemorialDayWeek = month === 4 && day >= 23;
  const isVeteransDayWeek = month === 10 && day >= 8 && day <= 12;
  const isPatrioticSeason = isJulyFourthWeek || isMemorialDayWeek || isVeteransDayWeek;

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
  clearRevealTimeouts();
  currentPhase = phase;
  revealBoardActive = false;
  document.body.dataset.phase = phase;
  screenEl.classList.remove("phase-join", "phase-question", "phase-reveal", "phase-final");
  screenEl.classList.remove("final-board-active", "final-seconds", "hof-mode");
  screenEl.classList.remove("phase-enter");
  screenEl.classList.add(`phase-${phase}`);
  void screenEl.offsetWidth;
  screenEl.classList.add("phase-enter");

  timerCaptionEl.textContent = TIMER_CAPTIONS[phase] || "TIME REMAINING";
  qrKickerEl.textContent = phase === "question" ? "LATE? SCAN TO JOIN" : "JOIN THE GAME";
  leaderboardTitleEl.textContent = phase === "reveal" ? "Leaderboard" : "Top 5";
  if (phase !== "join") {
    toastQueue = [];
    toastsEl.replaceChildren();
  }

  answersEl.classList.remove("reveal-votes");
  revealStatsEl.classList.remove("is-in");
  revealStatsEl.innerHTML = "";
  updateAnsweredCount();
}

function clearRevealTimeouts() {
  revealTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  revealTimeouts = [];
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

    const duration = stageName === "round" ? 15000 : 13000;
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

// Grumpy's tracked QR code (https://grumpysonmain.com/qr/trivia), so scans are counted.
function getQrImageUrl() {
  return "assets/trivia-qr.png";
}

function setQrCode() {
  qrCodeEl.innerHTML = `
    <img 
      alt="Scan to play" 
      src="${getQrImageUrl()}"
      style="width:100%;height:100%;object-fit:contain;border-radius:14px;"
    >
  `;
}

function startCountdown(seconds) {
  let remaining = seconds;
  timerEl.textContent = formatTime(remaining);
  timerEl.classList.toggle("is-urgent", remaining <= 5);
  updateFinalSeconds(remaining);

  return new Promise(resolve => {
    const interval = setInterval(async () => {
      remaining--;
      timerEl.textContent = formatTime(Math.max(remaining, 0));
      timerEl.classList.toggle("is-urgent", remaining <= 5);
      updateFinalSeconds(remaining);

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

// The last five seconds of a question make the whole screen edge pulse.
function updateFinalSeconds(remaining) {
  screenEl.classList.toggle("final-seconds", currentPhase === "question" && remaining > 0 && remaining <= 5);
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

  const elapsedMs = serverNow() - startedAt;
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
  setBackgroundHeat(currentPhase === "question" ? 1 - safePoints / MAX_POINTS : 0);

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
  setBackgroundHeat(0);

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
  // During the answer reveal the leaderboard animates on its own schedule.
  if (revealBoardActive) return;

  const players = getSortedPlayers(playersObj).slice(0, 5);
  const leaderboardList = document.getElementById("leaderboardList");

  if (players.length === 0) {
    leaderboardList.innerHTML = `<li><span>Waiting...</span><strong>0</strong></li>`;
    leaderboardList.dataset.html = "";
    return;
  }

  const html = players
    .map(player => `<li><span>${escapeHtml(player.name)}</span><strong>${(player.score || 0).toLocaleString()}</strong></li>`)
    .join("");

  // Answers arrive constantly during a question; only redraw when the Top 5 changes.
  if (leaderboardList.dataset.html === html) return;
  leaderboardList.dataset.html = html;
  leaderboardList.innerHTML = html;
}

function renderJoinTicker(playersObj = {}, newIds = new Set()) {
  const players = getSortedPlayers(playersObj);
  const names = players.map(player => player.name || "Player");
  const newNames = new Set(players.filter(player => newIds.has(player.id)).map(player => player.name || "Player"));

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
    if (newNames.has(name)) item.classList.add("is-new");
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

      return `<li><span>${escapeHtml(name)}</span><strong>${Number(score || 0).toLocaleString()}</strong></li>`;
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

  // Names that break the nickname rules stay off the TV until they're renamed on the stats page.
  const nameIsBlocked = name => Boolean(window.GrumpysNameFilter && window.GrumpysNameFilter.isBlocked(name));

  return profiles
    .filter(profile => profile.totalScore > 0 && !nameIsBlocked(profile.name))
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
    <div class="join-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  `;

  renderLeaderboard({});
  renderJoinTicker({});
}

// Draws a question. Used by the main TV and, from Firebase, by the second screen.
function renderQuestion(category, question, choices, index, startedAt) {
  setPhase("question");
  questionEl.classList.remove("join-phrase");
  questionEl.removeAttribute("aria-label");

  phaseLabel.textContent = "Question";
  currentQuestionIndex = index;
  currentQuestionStartedAt = startedAt;

  categoryEl.textContent = category;
  questionCounterEl.textContent = `QUESTION ${index + 1} / ${roundQuestionCount}`;
  setTvQuestionText(question);

  messageEl.textContent = "Answer fast — your point value is dropping.";
  roundProgressEl.textContent = `Question ${index + 1} of ${roundQuestionCount}`;

  answersEl.innerHTML = choices
    .map((choice, i) => `<div class="answer" data-index="${i}"><span class="answer-letter">${String.fromCharCode(65 + i)}</span><span class="answer-copy">${escapeHtml(choice)}</span></div>`)
    .join("");

  startTvPointsBar();
  updateAnsweredCount();
}

async function showQuestion(questionData, index) {
  const decodedCategory = decodeHtml(questionData.category);
  const decodedQuestion = decodeHtml(questionData.question);
  const choices = shuffle([
    ...questionData.incorrect_answers,
    questionData.correct_answer
  ]).map(decodeHtml);

  correctAnswerIndex = choices.indexOf(decodeHtml(questionData.correct_answer));
  // The real start time is stamped by Firebase's server, the same clock that stamps answers.
  renderQuestion(decodedCategory, decodedQuestion, choices, index, serverNow());

  await gameRef.update({
    roundId,
    phase: "question",
    questionIndex: index,
    currentQuestionKey: String(index),
    questionCount: roundQuestionCount,
    category: decodedCategory,
    question: decodedQuestion,
    choices,
    correctAnswerIndex: null,
    timer: QUESTION_SECONDS,
    questionStartedAt: firebase.database.ServerValue.TIMESTAMP,
    questionSeconds: QUESTION_SECONDS,
    maxPoints: MAX_POINTS,
    fullPointsGraceSeconds: FULL_POINTS_GRACE_SECONDS,
    finalSaved: false
  });

  const stamped = (await gameRef.child("questionStartedAt").once("value")).val();
  if (typeof stamped === "number") currentQuestionStartedAt = stamped;
}

async function showAnswerReveal(index) {
  const beforeSnap = await gameRef.child("players").once("value");
  const beforePlayers = beforeSnap.val() || {};
  const previousStandings = getSortedPlayers(beforePlayers);

  renderRevealStart(index, beforePlayers, previousStandings);

  await scoreQuestion();

  const afterSnap = await gameRef.child("players").once("value");
  const afterPlayers = afterSnap.val() || {};

  await gameRef.update({
    roundId,
    phase: "reveal",
    correctAnswerIndex,
    timer: REVEAL_SECONDS
  });

  renderRevealFinish(index, previousStandings, afterPlayers);
}

// First half of the reveal: votes, stats and the standings from before this question.
function renderRevealStart(index, votePlayers, previousStandings) {
  const stats = getAnswerStats(votePlayers, index);

  setPhase("reveal");
  stopTvPointsBar();
  hideTvPointsBar();
  revealBoardActive = true;

  phaseLabel.textContent = "Answer";
  timerCaptionEl.textContent = index === roundQuestionCount - 1 ? "RESULTS IN" : "NEXT QUESTION";
  questionCounterEl.textContent = `ANSWER ${index + 1} / ${roundQuestionCount}`;
  messageEl.textContent = "Correct answer revealed • Leaderboard updated";
  roundProgressEl.textContent = `Leaderboard after Question ${index + 1}`;

  // How the room voted: a bar and a count on every answer.
  document.querySelectorAll(".answer").forEach((answer, i) => {
    const count = stats.votes[i] || 0;
    const percent = stats.answered ? Math.round((count / stats.answered) * 100) : 0;
    answer.style.setProperty("--vote-pct", `${percent}%`);
    answer.insertAdjacentHTML("afterbegin", '<span class="vote-fill"></span>');
    answer.insertAdjacentHTML("beforeend", `<span class="vote-count"><b>${count}</b><small>${count === 1 ? "vote" : "votes"}</small></span>`);
  });

  renderRevealStats(stats);
  // After the first question everyone starts from zero, so the rows simply drop in.
  if (index === 0) {
    document.getElementById("leaderboardList").replaceChildren();
  } else {
    renderRevealBoard(previousStandings);
  }
}

// Second half: the answer pops, stats slide in, and the leaderboard reshuffles.
function renderRevealFinish(index, previousStandings, afterPlayers) {
  const newStandings = getSortedPlayers(afterPlayers);

  requestAnimationFrame(() => answersEl.classList.add("reveal-votes"));

  revealTimeouts.push(setTimeout(() => {
    document.querySelectorAll(".answer").forEach((answer, i) => {
      answer.classList.add(i === correctAnswerIndex ? "correct" : "dim");
    });
    backgroundBurst("70 229 138");
    window.GrumpysChristmas?.snowBurst(document.querySelector(".answer.correct"));
  }, 1200));

  revealTimeouts.push(setTimeout(() => revealStatsEl.classList.add("is-in"), 1900));
  revealTimeouts.push(setTimeout(() => shuffleRevealBoard(previousStandings, newStandings, afterPlayers, index), 2600));
}

function getAnswerStats(playersObj, index) {
  const players = Object.values(playersObj);
  const choiceCount = answersEl.querySelectorAll(".answer").length || 4;
  const votes = new Array(choiceCount).fill(0);
  let answered = 0;
  let correct = 0;
  let fastest = null;

  players.forEach(player => {
    const answer = player.answers?.[index];
    if (!answer || typeof answer.choiceIndex !== "number") return;

    answered++;
    if (answer.choiceIndex >= 0 && answer.choiceIndex < choiceCount) votes[answer.choiceIndex]++;

    if (answer.choiceIndex === correctAnswerIndex) {
      correct++;
      const seconds = Math.max(0, ((answer.answeredAt || 0) - currentQuestionStartedAt) / 1000);
      if (!fastest || seconds < fastest.seconds) fastest = { name: player.name || "Player", seconds };
    }
  });

  return { total: players.length, answered, correct, votes, fastest };
}

function renderRevealStats(stats) {
  const percent = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
  const rightText = stats.total ? `${stats.correct} of ${stats.total} <em>· ${percent}%</em>` : "No players yet";
  const fastestText = stats.fastest
    ? `${escapeHtml(stats.fastest.name)} <em>· ${stats.fastest.seconds.toFixed(1)} s</em>`
    : "Nobody this time";

  revealStatsEl.innerHTML = `
    <div class="reveal-stat good"><span>GOT IT RIGHT</span><strong>${rightText}</strong></div>
    <div class="reveal-stat"><span>FASTEST CORRECT</span><strong>${fastestText}</strong></div>
  `;
}

function makeLeaderboardRow(player, rank) {
  const row = document.createElement("li");
  row.className = "lb-row";
  row.dataset.pid = player.id || player.name || "";
  row.innerHTML = '<span class="lb-rank"></span><span class="lb-move"></span><span class="lb-name"></span><span class="lb-gain"></span><strong class="lb-score"></strong>';
  row.querySelector(".lb-rank").textContent = rank;
  row.querySelector(".lb-name").textContent = player.name || "Player";
  row.querySelector(".lb-score").textContent = (player.score || 0).toLocaleString();
  return row;
}

// Standings as they were before this question was scored.
function renderRevealBoard(standings) {
  const list = document.getElementById("leaderboardList");
  list.classList.remove("lb-shuffled");
  delete list.dataset.html;

  if (standings.length === 0) {
    list.innerHTML = `<li><span>Waiting...</span><strong>0</strong></li>`;
    return;
  }

  list.replaceChildren(...standings.slice(0, REVEAL_BOARD_SIZE).map((player, i) => makeLeaderboardRow(player, i + 1)));
}

// Rows slide from their old place to their new one while the scores count up.
function shuffleRevealBoard(previousStandings, newStandings, afterPlayers, index) {
  const list = document.getElementById("leaderboardList");
  if (newStandings.length === 0 || currentPhase !== "reveal") return;

  const previousRank = new Map(previousStandings.map((player, i) => [player.id, i]));
  const previousScore = new Map(previousStandings.map(player => [player.id, player.score || 0]));
  const existingRows = new Map([...list.querySelectorAll(".lb-row")].map(row => [row.dataset.pid, row]));
  const firstTops = new Map([...existingRows].map(([id, row]) => [id, row.getBoundingClientRect().top]));

  const rows = newStandings.slice(0, REVEAL_BOARD_SIZE).map((player, i) => {
    const row = existingRows.get(player.id) || makeLeaderboardRow({ ...player, score: previousScore.get(player.id) || 0 }, i + 1);
    row.querySelector(".lb-rank").textContent = i + 1;
    row.classList.remove("climbed");

    const move = row.querySelector(".lb-move");
    const before = previousRank.has(player.id) ? previousRank.get(player.id) : null;
    move.className = "lb-move";
    move.innerHTML = "";

    if (index > 0 && before !== null) {
      if (before > i) {
        move.classList.add("up");
        move.innerHTML = `${MOVE_ICON}${before - i}`;
        row.classList.add("climbed");
      } else if (before < i) {
        move.classList.add("down");
        move.innerHTML = `${MOVE_ICON}${i - before}`;
      } else {
        move.classList.add("same");
        move.textContent = "–";
      }
    }

    const earned = afterPlayers[player.id]?.answers?.[index]?.pointsEarned || 0;
    const gain = row.querySelector(".lb-gain");
    gain.textContent = `+${earned.toLocaleString()}`;
    gain.classList.toggle("zero", !earned);

    return row;
  });

  list.replaceChildren(...rows);

  rows.forEach(row => {
    const firstTop = firstTops.get(row.dataset.pid);
    const lastTop = row.getBoundingClientRect().top;
    row.style.transition = "none";

    if (firstTop === undefined) {
      row.style.transform = `translateY(${row.offsetHeight * 1.5}px)`;
      row.style.opacity = "0";
    } else {
      row.style.transform = `translateY(${firstTop - lastTop}px)`;
      row.style.zIndex = firstTop > lastTop ? "2" : "1";
    }
  });

  void list.offsetWidth;

  rows.forEach((row, i) => {
    row.style.transition = `transform .95s cubic-bezier(.2,.85,.25,1) ${i * 0.04}s, opacity .5s ease ${i * 0.04}s`;
    row.style.transform = "";
    row.style.opacity = "";
  });

  list.classList.add("lb-shuffled");

  rows.forEach(row => {
    const player = newStandings.find(item => item.id === row.dataset.pid);
    countUp(row.querySelector(".lb-score"), previousScore.get(row.dataset.pid) || 0, player?.score || 0, 1200);
  });
}

function countUp(element, from, to, durationMs) {
  if (!element) return;

  if (from === to) {
    element.textContent = to.toLocaleString();
    return;
  }

  const startedAt = performance.now();

  const step = now => {
    const progress = Math.min(1, (now - startedAt) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(from + (to - from) * eased).toLocaleString();

    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

async function showFinalScreen() {
  setPhase("final");
  hideTvPointsBar();

  const snap = await gameRef.child("players").once("value");
  const allRoundPlayers = getSortedPlayers(snap.val() || {});

  await addRoundScoresToAllTime(allRoundPlayers);

  const allTimeLeaders = await getAllTimeLeaders();

  nextRoundExpectedAt = serverNow() + ((FINAL_SECONDS + NEXT_TRIVIA_WAIT_SECONDS) * 1000);

  if (allRoundPlayers.length === 0) {
    showHallOfFame(allTimeLeaders);
  } else {
    showPodium(allRoundPlayers, allTimeLeaders);
  }

  await gameRef.update({
    roundId,
    phase: "final",
    timer: FINAL_SECONDS,
    finalSaved: true,
    lastCompletedRoundId: roundId,
    nextRoundExpectedAt
  });
}

function makePodiumColumn(player, place) {
  if (!player) return `<div class="podium-col place-${place}" aria-hidden="true"></div>`;

  return `
    <div class="podium-col place-${place}" data-place="${place}">
      ${place === 1 ? '<div class="podium-trophy" aria-hidden="true">🏆</div><div class="podium-wait" aria-hidden="true">?</div><div class="podium-nice">Top of the Nice List</div>' : ""}
      <div class="podium-name">${escapeHtml(player.name || "Player")}</div>
      <div class="podium-score">${(player.score || 0).toLocaleString()} PTS</div>
      <div class="podium-block">${place}</div>
    </div>
  `;
}

function showPodium(allRoundPlayers, allTimeLeaders) {
  const [first, second, third] = allRoundPlayers;

  phaseLabel.textContent = "Winner";
  categoryEl.textContent = "Round Complete";
  questionCounterEl.textContent = "ROUND COMPLETE";
  setTvQuestionText("And the winner is…");
  messageEl.textContent = "Drumroll, please…";
  roundProgressEl.textContent = "Winner";

  answersEl.innerHTML = `
    ${makeFinalConfetti()}

    <div class="final-sequence" aria-live="polite">
      <section class="final-stage winner-stage is-active" data-final-stage="winner">
        <div class="podium">
          ${makePodiumColumn(second, 2)}
          ${makePodiumColumn(first, 1)}
          ${makePodiumColumn(third, 3)}
        </div>
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

  const podium = answersEl.querySelector(".podium");
  const raise = place => answersEl.querySelector(`.podium-col.place-${place}`)?.classList.add("is-up");

  // Third, then second, then a drumroll, then the winner.
  let at = 700;
  if (third) { finalStageTimeouts.push(setTimeout(() => raise(3), at)); at += 1500; }
  if (second) { finalStageTimeouts.push(setTimeout(() => raise(2), at)); at += 1400; }
  finalStageTimeouts.push(setTimeout(() => podium?.classList.add("drumroll"), at));
  at += 1700;
  finalStageTimeouts.push(setTimeout(() => {
    podium?.classList.remove("drumroll");
    raise(1);
    backgroundBurst("255 196 64");
    answersEl.querySelector(".final-confetti")?.classList.add("is-live");
    messageEl.textContent = window.GrumpysChristmas?.isActive()
      ? `${first?.name || "Player"} is at the top of the Nice List!`
      : `Congratulations, ${first?.name || "Player"}!`;
  }, at));

  const activateFinalStage = stageName => {
    screenEl.classList.toggle("final-board-active", stageName !== "winner");

    answersEl.querySelectorAll(".final-stage").forEach(stage => {
      stage.classList.toggle("is-active", stage.dataset.finalStage === stageName);
    });

    if (stageName === "round") {
      phaseLabel.textContent = "Final Standings";
      categoryEl.textContent = "This Round";
      setTvQuestionText("Where everyone placed");
      messageEl.textContent = "Every player from this round, in finishing order.";
      roundProgressEl.textContent = "Round scoreboard";
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

  finalStageTimeouts.push(setTimeout(() => activateFinalStage("round"), at + 7000));
  finalStageTimeouts.push(setTimeout(() => activateFinalStage("all-time"), at + 23000));
}

// Nobody played this round: show the regulars and invite people in.
function showHallOfFame(allTimeLeaders) {
  screenEl.classList.add("final-board-active", "hof-mode");

  phaseLabel.textContent = "Hall of Fame";
  categoryEl.textContent = "Hall of Fame";
  questionCounterEl.textContent = "";
  setTvQuestionText("Grumpy's Hall of Fame");
  messageEl.textContent = "";
  roundProgressEl.textContent = "Hall of Fame";

  const rows = allTimeLeaders.slice(0, 10).map((player, i) => `
    <li style="animation-delay:${(i * 0.09).toFixed(2)}s">
      <span class="hof-rank">${i + 1}</span>
      <span class="hof-name">${escapeHtml(player.name || "Player")}</span>
      <span class="hof-wins">${Number(player.wins || 0).toLocaleString()}</span>
      <span class="hof-points">${Number(player.totalScore || 0).toLocaleString()}</span>
    </li>
  `).join("");

  answersEl.innerHTML = `
    <div class="final-sequence">
      <section class="final-stage hof-stage is-active" data-final-stage="hof">
        <div class="hof-board">
          <h3>Grumpy's Hall of Fame</h3>
          ${rows ? `
            <div class="hof-head"><span>#</span><span>PLAYER</span><span>WINS</span><span>POINTS</span></div>
            <ol class="hof-list">${rows}</ol>
          ` : '<div class="hof-empty">No names yet. Be the first one up here.</div>'}
        </div>
        <div class="hof-cta">
          <div class="hof-cta-title">Get your name<br>up here</div>
          <div class="hof-qr"><img alt="Scan to play" src="${getQrImageUrl()}"></div>
          <div class="hof-cta-sub">Scan now, pick a nickname + PIN,<br>and you're in the next round.</div>
        </div>
      </section>
    </div>
  `;
}

function getQuestionsByCategory(category) {
  return CUSTOM_QUESTIONS.filter(q => q.category === category);
}

function getSportsQuestions() {
  return CUSTOM_QUESTIONS.filter(q => ["NHL", "NFL", "NBA", "MLB"].includes(q.category));
}

async function loadQuestions() {
  // During the Christmas theme, two of the six questions are Christmas questions.
  const christmasPool = window.GrumpysChristmas?.isActive() ? getQuestionsByCategory("Christmas") : [];
  const christmas = christmasPool.length >= 2 ? pickRandomQuestionsAvoidingRecent(christmasPool, 2) : [];
  const general = pickRandomQuestionsAvoidingRecent(getQuestionsByCategory("General Knowledge"), christmas.length ? 1 : 2);
  const history = pickRandomQuestionsAvoidingRecent(getQuestionsByCategory("US History"), christmas.length ? 1 : 2);
  const sports = pickRandomQuestionsAvoidingRecent(getSportsQuestions(), 2);

  questions = shuffle([
    ...christmas,
    ...general,
    ...history,
    ...sports
  ]).slice(0, 6);

  if (questions.length < 6) {
    console.error("Not enough custom questions found. Check questions.js and category names.");
  }

  markQuestionsUsed(questions);
  roundQuestionCount = questions.length;
}

// "QUESTION 3" flashes across the screen so the room looks up.
// It plays before the question's timer starts, so nobody loses answer time.
function playBumper(category, index, total) {
  document.getElementById("bumperKicker").textContent = category || "Trivia";
  document.getElementById("bumperTitle").textContent = `Question ${index + 1}`;
  document.getElementById("bumperSub").textContent = index === total - 1 ? "LAST ONE!" : `OF ${total}`;
  // Christmas: one of several pop-up styles, picked the same way on the TV and the second screen.
  bumperEl.dataset.xmas = window.GrumpysChristmas ? window.GrumpysChristmas.bumperStyle(`${lastRoundThemeKey}-${index}`) : "";

  bumperEl.classList.remove("is-showing");
  void bumperEl.offsetWidth;
  bumperEl.classList.add("is-showing");
  setTimeout(() => bumperEl.classList.remove("is-showing"), 2900);
}

async function showQuestionBumper(questionData, index) {
  const category = decodeHtml(questionData.category || "Trivia");
  playBumper(category, index, roundQuestionCount);

  // Lets the second screen play the same bumper at the same moment.
  gameRef.update({ bumperIndex: index, bumperCategory: category, bumperAt: serverNow(), questionCount: roundQuestionCount });

  await wait(2450);
}

async function runRound() {
  roundId = Date.now().toString();
  applyRoundTheme(roundId);
  nextRoundExpectedAt = null;

  try {
    await gameRef.set({
      roundId,
      phase: "join",
      timer: JOIN_SECONDS,
      players: {},
      currentQuestionKey: null,
      finalSaved: false,
      lastCompletedRoundId: null,
      nextRoundExpectedAt: null,
      waitingMessage: null
    });
  } catch (error) {
    // The secure Firebase rules only let the real host screen run the game.
    console.warn("This screen is not allowed to run trivia:", error);
    showHostSetupMessage();
    return;
  }

  showJoinScreen();
  await startCountdown(JOIN_SECONDS);

  for (let i = 0; i < questions.length; i++) {
    await showQuestionBumper(questions[i], i);
    await showQuestion(questions[i], i);
    await startCountdown(QUESTION_SECONDS);

    await showAnswerReveal(i);
    await startCountdown(REVEAL_SECONDS);
  }

  await showFinalScreen();
  await startCountdown(FINAL_SECONDS);

  const waitSeconds = nextRoundExpectedAt
    ? Math.max(0, Math.ceil((nextRoundExpectedAt - serverNow()) / 1000))
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

function updateAnsweredCount(playersObj = latestPlayers) {
  if (currentPhase !== "question") {
    answeredCountEl.textContent = "";
    delete answeredCountEl.dataset.count;
    return;
  }

  const players = Object.values(playersObj || {});
  const answered = players.filter(player => player.answers?.[currentQuestionIndex]).length;
  const previous = answeredCountEl.dataset.count;

  answeredCountEl.innerHTML = `<b>${answered} of ${players.length}</b> answered`;
  answeredCountEl.dataset.count = answered;

  if (previous !== undefined && Number(previous) !== answered) {
    answeredCountEl.classList.remove("bump");
    void answeredCountEl.offsetWidth;
    answeredCountEl.classList.add("bump");
  }
}

function queueJoinToast(name) {
  if (!name) return;
  toastQueue.push(name);
  if (!toastTimer) showNextToast();
}

function showNextToast() {
  const name = toastQueue.shift();

  if (!name || currentPhase !== "join") {
    toastQueue = [];
    toastTimer = null;
    return;
  }

  while (toastsEl.children.length >= 2) toastsEl.firstElementChild.remove();

  const toast = document.createElement("div");
  const dot = document.createElement("i");
  const who = document.createElement("b");
  toast.className = "tv-toast";
  who.textContent = name;
  toast.append(dot, who, document.createTextNode(" joined!"));
  toastsEl.appendChild(toast);
  setTimeout(() => toast.remove(), 2700);

  toastTimer = setTimeout(showNextToast, toastQueue.length > 3 ? 350 : 800);
}

gameRef.child("players").on("value", snap => {
  const players = snap.val() || {};
  const ids = Object.keys(players);
  const newIds = new Set();

  if (knownPlayerIds) {
    ids.forEach(id => {
      if (!knownPlayerIds.has(id)) newIds.add(id);
    });
  }

  knownPlayerIds = new Set(ids);
  latestPlayers = players;

  if (currentPhase === "join") {
    newIds.forEach(id => queueJoinToast(players[id]?.name));
  }

  renderLeaderboard(players);
  renderJoinTicker(players, newIds);
  updateAnsweredCount(players);
});

// ---------- Second screen (view.html) -------------------------------------
// Follows the main TV through Firebase and draws the same screens. Never writes.
const viewerState = { key: null, roundId: null, bumperKey: null, standingsAtQuestion: [], waitingInterval: null };

function stopViewerWaitingCountdown() {
  if (viewerState.waitingInterval) clearInterval(viewerState.waitingInterval);
  viewerState.waitingInterval = null;
}

function startViewer() {
  gameRef.on("value", snap => onViewerGame(snap.val() || {}));
}

function onViewerGame(game) {
  if (game.roundId && game.roundId !== viewerState.roundId) {
    viewerState.roundId = game.roundId;
    roundId = game.roundId;
    applyRoundTheme(game.roundId);
  }

  if (game.questionCount) roundQuestionCount = game.questionCount;

  const bumperKey = game.bumperIndex !== undefined && game.bumperIndex !== null ? `${game.roundId}:${game.bumperIndex}` : null;
  if (bumperKey && bumperKey !== viewerState.bumperKey) {
    viewerState.bumperKey = bumperKey;
    if (serverNow() - (game.bumperAt || 0) < 2500) playBumper(game.bumperCategory, game.bumperIndex, roundQuestionCount);
  }

  const key = `${game.roundId}:${game.phase}:${game.questionIndex ?? ""}`;
  if (key !== viewerState.key) {
    viewerState.key = key;
    renderViewerPhase(game);
  }

  if (game.phase !== "waiting" && typeof game.timer === "number") {
    timerEl.textContent = formatTime(Math.max(0, game.timer));
    timerEl.classList.toggle("is-urgent", game.timer <= 5);
    updateFinalSeconds(game.timer);
  }
}

async function renderViewerPhase(game) {
  const players = game.players || {};
  stopViewerWaitingCountdown();

  if (game.phase === "join") {
    showJoinScreen();
    return;
  }

  if (game.phase === "question") {
    viewerState.standingsAtQuestion = getSortedPlayers(players);
    correctAnswerIndex = -1;
    renderQuestion(game.category || "Trivia", game.question || "", game.choices || [], game.questionIndex || 0, game.questionStartedAt || serverNow());
    return;
  }

  if (game.phase === "reveal") {
    const index = game.questionIndex || 0;
    if (currentPhase !== "question" || currentQuestionIndex !== index) {
      renderQuestion(game.category || "Trivia", game.question || "", game.choices || [], index, game.questionStartedAt || serverNow());
    }
    correctAnswerIndex = game.correctAnswerIndex;
    const previous = viewerState.standingsAtQuestion.length ? viewerState.standingsAtQuestion : getSortedPlayers(players);
    renderRevealStart(index, players, previous);
    renderRevealFinish(index, previous, players);
    return;
  }

  if (game.phase === "final") {
    setPhase("final");
    hideTvPointsBar();
    const roundPlayers = getSortedPlayers(players);
    const leaders = await getAllTimeLeaders();
    if (roundPlayers.length) showPodium(roundPlayers, leaders);
    else showHallOfFame(leaders);
    return;
  }

  if (game.phase === "waiting") {
    if (currentPhase !== "final") {
      setPhase("final");
      hideTvPointsBar();
      showHallOfFame(await getAllTimeLeaders());
    }
    phaseLabel.textContent = "Next Round";
    timerCaptionEl.textContent = "NEXT ROUND IN";
    const tick = () => {
      const seconds = game.nextRoundExpectedAt ? Math.max(0, Math.ceil((game.nextRoundExpectedAt - serverNow()) / 1000)) : 0;
      timerEl.textContent = formatTime(seconds);
    };
    tick();
    viewerState.waitingInterval = setInterval(tick, 1000);
  }
}

// Shown when this screen isn't the host (no host key, or the key doesn't match).
function showHostSetupMessage() {
  setPhase("join");
  hideTvPointsBar();
  phaseLabel.textContent = "Setup";
  timerEl.textContent = "--:--";
  timerCaptionEl.textContent = "NOT RUNNING";
  categoryEl.textContent = "Host setup needed";
  questionCounterEl.textContent = "";
  questionEl.classList.remove("join-phrase");
  setTvQuestionText("This screen isn't set up to run trivia.");
  answersEl.innerHTML = `
    <div class="host-setup">
      <p>Only the main trivia TV can run the game. To make this screen the host, add your host key to the end of its web address:</p>
      <code>…/index.html?host=YOUR-HOST-KEY</code>
      <p>The other screens and the phones are not affected.</p>
    </div>
  `;
  messageEl.textContent = "";
  roundProgressEl.textContent = "";
}

async function init() {
  hideTvPointsBar();
  setQrCode();

  if (!IS_VIEWER && window.grumpysHostReady) {
    const isHost = await window.grumpysHostReady;
    // Tidy-up job for the secure rules: move any PINs off the public profiles.
    if (isHost && window.grumpysMigratePins) {
      window.grumpysMigratePins()
        .then(moved => { if (moved) console.info(`Moved ${moved} PINs to private storage.`); })
        .catch(error => console.warn("PIN move failed:", error));
    }
  }

  if (IS_VIEWER) {
    startViewer();
    return;
  }

  if (typeof CUSTOM_QUESTIONS === "undefined") {
    console.error("questions.js did not load. Make sure questions.js is included before app.js in index.html.");
    setTvQuestionText("Question bank failed to load.");
    return;
  }

  await loadQuestions();
  runRound();
}

init();
