// Grumpy's Trivia: phone page (play.html)
// Sign in, the game menu, and the live trivia screens on each player's phone.
// The main TV (app.js) runs the game; this page follows it through Firebase.

const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);
const claimedNamesRef = db.ref("claimedNames");
const savedRoundsRef = db.ref("savedRounds");
const gatewayOrderRef = db.ref("settings/gatewayOrder");
const higherLowerPlayersRef = db.ref("higherLower/players");
const stackerPlayersRef = db.ref("stacker/players");
const emojiDecoderPlayersRef = db.ref("emojiDecoder/players");
const DEFAULT_GATEWAY_ORDER = ["trivia", "higher-lower", "stacker", "emoji-decoder"];

const $ = id => document.getElementById(id);

// Views
const joinView = $("joinView");
const menuView = $("menuView");
const gameView = $("gameView");

// Sign in
const nameInput = $("nameInput");
const pinInput = $("pinInput");
const joinBtn = $("joinBtn");
const guestBtn = $("guestBtn");
const joinError = $("joinError");
const signInLive = $("signInLive");
const signInLiveText = $("signInLiveText");
const signInLiveCount = $("signInLiveCount");

// Menu
const menuPlayerName = $("menuPlayerName");
const profileBtn = $("profileBtn");
const triviaLiveBadge = $("triviaLiveBadge");
const triviaPlayersText = $("triviaPlayersText");
const triviaMenuStatus = $("triviaMenuStatus");
const triviaPhaseText = $("triviaPhaseText");
const triviaTimerText = $("triviaTimerText");
const triviaActionText = $("triviaActionText");
const gameTilesEl = $("gameTiles");

// Live trivia: header
const playerNameText = $("playerNameText");
const scoreText = $("scoreText");

// Waiting for the round
const joinHeadline = $("joinHeadline");
const joinSubline = $("joinSubline");
const joinCountdown = $("joinCountdown");
const joinPlayerCount = $("joinPlayerCount");
const joinPlayerLabel = $("joinPlayerLabel");
const joinPlayerChips = $("joinPlayerChips");
const joinStats = $("joinStats");
const joinGuestNote = $("joinGuestNote");
const allTimeScoreText = $("allTimeScoreText");
const rankText = $("rankText");
const winsText = $("winsText");

// Question
const categoryText = $("categoryText");
const questionProgressText = $("questionProgressText");
const timerText = $("timerText");
const pointsBox = $("pointsBox");
const pointsLabel = $("pointsLabel");
const pointsText = $("pointsText");
const pointsFill = $("pointsFill");
const lockedPoints = $("lockedPoints");
const questionText = $("questionText");
const choicesEl = $("choices");
const statusText = $("statusText");
const answeredText = $("answeredText");
const answeredFill = $("answeredFill");

// Reveal
const resultCard = $("resultCard");
const resultIcon = $("resultIcon");
const resultTitle = $("resultTitle");
const resultPoints = $("resultPoints");
const resultAnswer = $("resultAnswer");
const resultRank = $("resultRank");
const voteList = $("voteList");
const revealRightText = $("revealRightText");
const revealFastestText = $("revealFastestText");
const revealEncourage = $("revealEncourage");
const revealNextLabel = $("revealNextLabel");
const revealNextTimer = $("revealNextTimer");

// Round over
const placeMedal = $("placeMedal");
const placeNumber = $("placeNumber");
const placeHeadline = $("placeHeadline");
const placeSubline = $("placeSubline");
const podiumList = $("podiumList");
const savedTitle = $("savedTitle");
const savedStats = $("savedStats");
const savedAllTime = $("savedAllTime");
const savedRank = $("savedRank");
const savedGames = $("savedGames");
const finalNextTimer = $("finalNextTimer");

// Between rounds
const betweenCountdown = $("betweenCountdown");
const lastRoundLine = $("lastRoundLine");
const betweenArcade = $("betweenArcade");

// Your stats
const profileModal = $("profileModal");
const profileBackdrop = $("profileBackdrop");
const closeProfileBtn = $("closeProfileBtn");
const profilePlayerName = $("profilePlayerName");
const profileTriviaRank = $("profileTriviaRank");
const profileLoading = $("profileLoading");
const profileContent = $("profileContent");
const profileLeaderboard = $("profileLeaderboard");
const profileAvatar = $("profileAvatar");

const seasonalPhoneLogos = document.querySelectorAll(".seasonal-phone-logo");
const routeParams = new URLSearchParams(window.location.search);
const isTriviaRoute = routeParams.get("game") === "trivia";
const isPlayerPreview = routeParams.get("preview") === "1";

// Clear old guest data from the older version that used localStorage.
// Guests should only live for the current browser session.
if (localStorage.getItem("grumpysTriviaIsGuest") === "true") {
  localStorage.removeItem("grumpysTriviaPlayerId");
  localStorage.removeItem("grumpysTriviaPlayerName");
  localStorage.removeItem("grumpysTriviaNameKey");
  localStorage.removeItem("grumpysTriviaPin");
  localStorage.removeItem("grumpysTriviaIsGuest");
  localStorage.removeItem("grumpysTriviaLastRoundId");
  localStorage.removeItem("grumpysTriviaLastCompletedRoundId");
}

const sessionGuest = sessionStorage.getItem("grumpysTriviaIsGuest") === "true";

let playerId = isPlayerPreview
  ? "preview_player"
  : sessionGuest
  ? sessionStorage.getItem("grumpysTriviaPlayerId")
  : localStorage.getItem("grumpysTriviaPlayerId");

let playerName = isPlayerPreview
  ? "Trivia King"
  : sessionGuest
  ? sessionStorage.getItem("grumpysTriviaPlayerName")
  : localStorage.getItem("grumpysTriviaPlayerName");

let playerNameKey = isPlayerPreview
  ? "previewplayer"
  : sessionGuest
  ? ""
  : localStorage.getItem("grumpysTriviaNameKey");

let savedPin = isPlayerPreview
  ? "0000"
  : sessionGuest
  ? ""
  : localStorage.getItem("grumpysTriviaPin");

let isGuest = isPlayerPreview || sessionGuest;

let currentGame = null;
let currentPlayer = null;
let lastSeenRoundId = isGuest
  ? sessionStorage.getItem("grumpysTriviaLastRoundId")
  : localStorage.getItem("grumpysTriviaLastRoundId");

let isAutoJoining = false;
let lastFireworkQuestion = null;
let pointsInterval = null;
let isSubmittingAnswer = false;
let localLockedAnswers = {};
let currentPhoneThemeKey = null;

const LAST_COMPLETED_ROUND_KEY = "grumpysTriviaLastCompletedRoundId";


// ---------- Round colors (shared with the TV and promo screen) ----------

function applyPhoneRoundTheme(roundKey) {
  const key = String(roundKey || "grumpys");
  if (key === currentPhoneThemeKey) return;
  currentPhoneThemeKey = key;

  const theme = window.pickGrumpysRoundTheme(key);
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--phone-accent", theme.accent);
  rootStyle.setProperty("--phone-accent-hot", theme.hot);
  rootStyle.setProperty("--phone-accent-rgb", theme.rgb);
  rootStyle.setProperty("--phone-accent2-rgb", theme.rgb2);
}

// ---------- Small helpers ----------

let renderToken = 0;
let statsCache = null;
let statsRoundKey = null;
let arcadeBests = null;
let arcadeBestsAt = 0;
let choicesKey = null;
let revealKey = null;
let finalKey = null;
let pointsKey = null;
let chipsKey = null;
let nextRoundTarget = 0;
let lastRoundKey = null;
const drumrollUntil = {};
const savedRoundCache = {};
const LAST_PLACE_KEY = "grumpysTriviaLastPlace";

const ICONS = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"></path></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path></svg>',
  up: '<svg viewBox="0 0 12 12" aria-hidden="true" class="up"><path d="M6 2l5 8H1z"></path></svg>',
  down: '<svg viewBox="0 0 12 12" aria-hidden="true" class="down"><path d="M6 2l5 8H1z"></path></svg>',
  saved: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>'
};

function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`;
}

function getLetter(index) {
  return String.fromCharCode(65 + index);
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// Text with one bold part, built without innerHTML so names can't inject markup.
function setRich(el, before, bold, after = "", boldClass = "") {
  el.replaceChildren();
  if (before) el.append(before);
  if (bold !== undefined && bold !== null && bold !== "") {
    const b = document.createElement("b");
    if (boldClass) b.className = boldClass;
    b.textContent = bold;
    el.append(b);
  }
  if (after) el.append(after);
}

function setWash(kind) {
  if (kind) document.body.dataset.wash = kind;
  else delete document.body.dataset.wash;
}

function setScreen(name) {
  gameView.dataset.screen = name;
  document.body.dataset.phonePhase = name;
}

function getQuestionCount(game) {
  return Number(game?.questionCount) || 6;
}

function getRankIn(sortedPlayers, id) {
  const index = sortedPlayers.findIndex(player => player.id === id);
  return index === -1 ? 0 : index + 1;
}

// Standings before question `qi` was scored: everyone's score minus what they just earned.
function getRankBefore(playersObj, id, qi) {
  const before = Object.values(playersObj).map(player => ({
    ...player,
    score: (player.score || 0) - (Number(player.answers?.[qi]?.pointsEarned) || 0)
  }));
  return getRankIn(getSortedPlayers(Object.fromEntries(before.map(p => [p.id, p]))), id);
}

function getMyAnswer(game) {
  const qi = game.questionIndex;
  return currentPlayer?.answers?.[qi] || localLockedAnswers[qi] || null;
}

// ---------- Views ----------

function setJoinError(message) {
  joinError.textContent = message;
}

function showJoinView() {
  joinView.classList.remove("hidden");
  menuView.classList.add("hidden");
  gameView.classList.add("hidden");
  document.body.dataset.phonePhase = "join";
}

function showMenuView() {
  const wasHidden = menuView.classList.contains("hidden");
  joinView.classList.add("hidden");
  gameView.classList.add("hidden");
  menuView.classList.remove("hidden");
  document.body.dataset.phonePhase = "menu";
  setWash("");
  paintMenuChip();

  if (wasHidden) {
    loadPlayerStats().then(paintMenuChip);
    loadArcadeBests();
  }
}

function showGameView() {
  joinView.classList.add("hidden");
  menuView.classList.add("hidden");
  gameView.classList.remove("hidden");
}

function paintMenuChip() {
  const rank = statsCache?.rank;
  menuPlayerName.textContent = isGuest || !rank ? (playerName || "Player") : `${playerName} · #${rank}`;
}

// ---------- Next-round countdown (menu, sign in, round over, between rounds) ----------

function getNextRoundText() {
  if (!nextRoundTarget) return "Soon";
  const seconds = Math.ceil((nextRoundTarget - serverNow()) / 1000);
  return seconds > 0 ? formatTime(seconds) : "Soon";
}

function paintNextRound() {
  const text = getNextRoundText();
  finalNextTimer.textContent = text;
  betweenCountdown.textContent = text;

  const phase = currentGame?.phase;
  if (!["join", "question", "reveal"].includes(phase)) {
    triviaTimerText.textContent = text;
    if (!signInLive.classList.contains("hidden")) setRich(signInLiveText, "Next trivia round in ", text);
  }
}

setInterval(paintNextRound, 1000);

// ---------- Sign-in live strip ----------

function renderSignInStrip(game = {}) {
  const players = Object.keys(game.players || {}).length;
  const phase = game.phase;
  signInLive.classList.remove("hidden");

  if (phase === "join") {
    setRich(signInLiveText, "Live trivia starts in ", formatTime(game.timer));
    signInLiveCount.textContent = players ? `${players} playing` : "";
    return;
  }

  if (phase === "question" || phase === "reveal") {
    const current = (Number.isInteger(game.questionIndex) ? game.questionIndex : 0) + 1;
    setRich(signInLiveText, "Trivia is live · ", `Q${current} of ${getQuestionCount(game)}`);
    signInLiveCount.textContent = players ? `${players} playing` : "";
    return;
  }

  if (nextRoundTarget && nextRoundTarget > serverNow()) {
    setRich(signInLiveText, "Next trivia round in ", getNextRoundText());
    signInLiveCount.textContent = "";
    return;
  }

  signInLive.classList.add("hidden");
}

// ---------- Game menu: the Live Trivia tile ----------

function updateGameMenu(game = {}) {
  const phase = game.phase || "waiting";
  const players = Object.keys(game.players || {}).length;
  const live = ["join", "question", "reveal"].includes(phase);

  triviaLiveBadge.classList.toggle("is-live", live);

  if (phase === "join") {
    triviaLiveBadge.textContent = "LIVE NOW";
    triviaPlayersText.textContent = players ? `${players} ${players === 1 ? "player" : "players"} in` : "Be the first in";
    triviaMenuStatus.textContent = "On the big screen. 6 questions, up to 1,000 points each.";
    triviaPhaseText.textContent = "ROUND STARTS IN";
    triviaTimerText.textContent = formatTime(game.timer);
    triviaActionText.textContent = "Join this round";
    return;
  }

  if (phase === "question" || phase === "reveal") {
    const current = (Number.isInteger(game.questionIndex) ? game.questionIndex : 0) + 1;
    triviaLiveBadge.textContent = "LIVE NOW";
    triviaPlayersText.textContent = players ? `${players} playing` : "";
    triviaMenuStatus.textContent = "A round is on now. Jump in for the questions that are left.";
    triviaPhaseText.textContent = `QUESTION ${current} OF ${getQuestionCount(game)}`;
    triviaTimerText.textContent = formatTime(game.timer);
    triviaActionText.textContent = "Jump in";
    return;
  }

  triviaLiveBadge.textContent = "BETWEEN ROUNDS";
  triviaPlayersText.textContent = "";
  triviaMenuStatus.textContent = "Trivia runs on the big screen. Keep your phone handy for the next round.";
  triviaPhaseText.textContent = "NEXT ROUND IN";
  triviaTimerText.textContent = getNextRoundText();
  triviaActionText.textContent = "Open trivia";
}

// ---------- Stats and arcade bests ----------

async function loadPlayerStats(force = false) {
  if (isGuest || !playerNameKey) {
    statsCache = null;
    return null;
  }
  if (statsCache && !force) return statsCache;

  try {
    const snap = await claimedNamesRef.once("value");
    const profiles = Object.entries(snap.val() || {})
      .map(([key, profile]) => ({ key, ...profile }))
      .filter(profile => !isHardBlockedName(profile.displayName || profile.key))
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

    const index = profiles.findIndex(profile => profile.key === playerNameKey);
    const profile = index >= 0 ? profiles[index] : null;
    const rank = index >= 0 && (profile?.totalScore || 0) > 0 ? index + 1 : null;

    statsCache = { profile, rank };
  } catch (error) {
    console.warn("Your stats could not be loaded:", error);
  }

  return statsCache;
}

function paintJoinStats() {
  const profile = statsCache?.profile;
  allTimeScoreText.textContent = (profile?.totalScore || 0).toLocaleString();
  rankText.textContent = statsCache?.rank ? `#${statsCache.rank}` : "—";
  winsText.textContent = (profile?.wins || 0).toLocaleString();
}

async function loadArcadeBests() {
  if (arcadeBests && Date.now() - arcadeBestsAt < 60000) {
    paintArcadeBests();
    return;
  }

  try {
    if (isGuest || !playerId) {
      arcadeBests = {
        higher: getLocalArcadeScore("higherLowerBest"),
        stacker: getLocalArcadeScore("stackerBest"),
        emoji: getLocalArcadeScore("emojiDecoderBest")
      };
    } else {
      const [higher, stacker, emoji] = await Promise.all([
        higherLowerPlayersRef.child(playerId).once("value"),
        stackerPlayersRef.child(playerId).once("value"),
        emojiDecoderPlayersRef.child(playerId).once("value")
      ]);
      arcadeBests = {
        higher: Number(higher.val()?.bestStreak) || getLocalArcadeScore("higherLowerBest"),
        stacker: Number(stacker.val()?.bestLevel) || getLocalArcadeScore("stackerBest"),
        emoji: Number(emoji.val()?.bestScore) || getLocalArcadeScore("emojiDecoderBest")
      };
    }
    arcadeBestsAt = Date.now();
  } catch (error) {
    console.warn("Arcade bests could not be loaded:", error);
  }

  paintArcadeBests();
}

function paintArcadeBests() {
  if (!arcadeBests) return;
  const copy = {
    higher: ["Your best streak: ", arcadeBests.higher, "Build the longest streak"],
    stacker: ["Your best: ", arcadeBests.stacker ? `level ${arcadeBests.stacker}` : 0, "Stop the blocks, build high"],
    emoji: ["Your best: ", arcadeBests.emoji ? arcadeBests.emoji.toLocaleString() : 0, "Name the movie, show or song"]
  };

  document.querySelectorAll("[data-best]").forEach(el => {
    const [label, value, fallback] = copy[el.dataset.best] || [];
    if (!label) return;
    if (value) setRich(el, label, String(value));
    else el.textContent = fallback;
  });
}

// ---------- Live trivia: header ----------

function updateHeaderChip(game, playersObj) {
  const sorted = getSortedPlayers(playersObj);
  const rank = getRankIn(sorted, playerId);
  const anyPoints = sorted.some(player => (player.score || 0) > 0);
  const name = (playerName || "Player").toUpperCase();

  playerNameText.textContent = rank && anyPoints && game.phase !== "join" ? `${name} · #${rank} OF ${sorted.length}` : name;

  // Between rounds there is no round score, so show the all-time rank instead.
  if (!currentPlayer && !["join", "question", "reveal", "final"].includes(game.phase)) {
    scoreText.textContent = statsCache?.rank ? `#${statsCache.rank} all-time` : "Ready";
    if (!isGuest && !statsCache) loadPlayerStats().then(() => { if (!currentPlayer) scoreText.textContent = statsCache?.rank ? `#${statsCache.rank} all-time` : "Ready"; });
    return;
  }
  scoreText.textContent = `${(currentPlayer?.score || 0).toLocaleString()} pts`;
}

// ---------- Waiting for the round to start ----------

function renderJoinScreen(game, playersObj) {
  setScreen("join");
  setWash("");
  stopLivePoints();

  const name = playerName || "Player";
  joinHeadline.textContent = currentPlayer ? `You're in, ${name}${/[.!?]$/.test(name) ? "" : "!"}` : "Joining the round…";
  joinSubline.textContent = "Watch the TV. The questions show up right here too.";

  const seconds = Number(game.timer) || 0;
  joinCountdown.textContent = formatTime(seconds);
  joinCountdown.classList.toggle("hurry", seconds > 0 && seconds <= 10);

  const players = Object.values(playersObj);
  joinPlayerCount.textContent = players.length;
  joinPlayerLabel.textContent = players.length === 1 ? "player in so far" : "players in so far";

  // You first, then everyone else, newest first. At most 10 chips.
  const others = players
    .filter(player => player.id !== playerId)
    .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
  const shown = [...(currentPlayer ? [currentPlayer] : []), ...others].slice(0, 10);
  const key = shown.map(player => player.id).join("|") + `:${players.length}`;

  if (key !== chipsKey) {
    chipsKey = key;
    joinPlayerChips.replaceChildren(...shown.map(player => {
      const chip = document.createElement("span");
      chip.textContent = player.id === playerId ? `You · ${player.name || "Player"}` : (player.name || "Player");
      if (player.id === playerId) chip.className = "is-you";
      return chip;
    }));

    if (players.length > shown.length) {
      const more = document.createElement("span");
      more.className = "is-more";
      more.textContent = `+${players.length - shown.length} more`;
      joinPlayerChips.appendChild(more);
    }
  }

  joinStats.classList.toggle("hidden", isGuest);
  joinGuestNote.classList.toggle("hidden", !isGuest);

  if (!isGuest && statsRoundKey !== game.roundId) {
    statsRoundKey = game.roundId;
    loadPlayerStats(true).then(paintJoinStats);
  }
}

// ---------- Question / answer locked in ----------

function setPhoneQuestionText(text) {
  const clean = text || "";
  questionText.textContent = clean;
  questionText.classList.toggle("long", clean.length > 70);
  questionText.classList.toggle("longer", clean.length > 105);
  questionText.classList.toggle("longest", clean.length > 145);
}

function updatePointsDisplay(points, maxPoints = 1000) {
  const safe = Math.max(0, Math.min(maxPoints, Math.round(points || 0)));
  const percent = maxPoints > 0 ? (safe / maxPoints) * 100 : 0;

  pointsText.textContent = safe.toLocaleString();
  pointsFill.style.width = `${percent}%`;

  let color = "#46e58a";
  let line = "rgba(70,229,138,.5)";
  if (percent <= 25) { color = "#ff5b69"; line = "rgba(255,91,105,.55)"; }
  else if (percent <= 55) { color = "#ff8a35"; line = "rgba(255,138,53,.5)"; }
  else if (percent <= 78) { color = "#f3d04f"; line = "rgba(243,208,79,.5)"; }

  pointsBox.style.setProperty("--meter", color);
  pointsBox.style.setProperty("--meter-line", line);
}

function startLivePoints(game) {
  const key = `${game.roundId}:${game.questionIndex}`;
  if (key === pointsKey && pointsInterval) return;

  stopLivePoints();
  pointsKey = key;
  pointsLabel.textContent = "POINTS IF YOU'RE RIGHT";
  const maxPoints = game.maxPoints || 1000;
  updatePointsDisplay(calculateLivePoints(game), maxPoints);
  pointsInterval = setInterval(() => updatePointsDisplay(calculateLivePoints(game), maxPoints), 50);
}

function stopLivePoints() {
  if (pointsInterval) clearInterval(pointsInterval);
  pointsInterval = null;
  pointsKey = null;
}

function renderChoices(game, myAnswer) {
  const picked = myAnswer ? myAnswer.choiceIndex : null;
  const key = `${game.roundId}:${game.questionIndex}:${picked}`;
  if (key === choicesKey) return;
  choicesKey = key;

  choicesEl.replaceChildren(...(game.choices || []).map((choice, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pv-choice";

    const letter = document.createElement("span");
    letter.className = "pv-choice-letter";
    letter.textContent = getLetter(index);

    const copy = document.createElement("span");
    copy.className = "pv-choice-copy";
    copy.textContent = choice;

    btn.append(letter, copy);

    if (picked !== null) {
      btn.disabled = true;
      if (index === picked) {
        btn.classList.add("is-pick");
        const tag = document.createElement("span");
        tag.className = "pv-choice-tag";
        tag.textContent = "YOUR PICK";
        btn.appendChild(tag);
      } else {
        btn.classList.add("is-other");
      }
    } else {
      // pointerdown answers on the first touch, without waiting for the finger to lift.
      btn.addEventListener("pointerdown", event => {
        event.preventDefault();
        if (!btn.disabled) submitAnswer(index);
      }, { once: true });
    }

    return btn;
  }));
}

function renderQuestionScreen(game, playersObj) {
  const myAnswer = getMyAnswer(game);
  setScreen(myAnswer ? "locked" : "question");
  setWash("");

  categoryText.textContent = game.category || "Trivia";
  questionProgressText.textContent = `QUESTION ${(game.questionIndex || 0) + 1} OF ${getQuestionCount(game)}`;

  const seconds = Number(game.timer) || 0;
  timerText.textContent = formatTime(seconds);
  timerText.classList.toggle("urgent", seconds > 0 && seconds <= 5);

  setPhoneQuestionText(game.question || "Question loading…");
  renderChoices(game, myAnswer);

  if (myAnswer) {
    stopLivePoints();
    lockedPoints.textContent = (myAnswer.pointsPossible || 0).toLocaleString();
  } else {
    startLivePoints(game);
    statusText.textContent = "Tap fast: your points drop every second.";
  }

  const players = Object.values(playersObj);
  const answered = players.filter(player => player.answers?.[game.questionIndex]).length;
  answeredText.textContent = `${answered} of ${players.length} answered`;
  answeredFill.style.width = players.length ? `${Math.round((answered / players.length) * 100)}%` : "0%";
}

// ---------- Answer reveal ----------

function renderRevealScreen(game, playersObj) {
  setScreen("reveal");
  stopLivePoints();

  const qi = game.questionIndex || 0;
  const total = getQuestionCount(game);
  const isLast = qi >= total - 1;
  revealNextLabel.textContent = isLast ? "Results in" : "Next question in";
  revealNextTimer.textContent = formatTime(game.timer);

  const key = `${game.roundId}:${qi}`;
  if (key === revealKey) return;
  revealKey = key;

  const choices = game.choices || [];
  const right = game.correctAnswerIndex;
  const answer = getMyAnswer(game);
  const players = Object.values(playersObj);
  const sorted = getSortedPlayers(playersObj);
  const rankNow = getRankIn(sorted, playerId);
  const rankBefore = qi > 0 ? getRankBefore(playersObj, playerId, qi) : 0;
  const rightText = typeof right === "number" && choices[right] !== undefined ? `${getLetter(right)} · ${choices[right]}` : "";

  resultCard.classList.remove("good", "miss", "none", "pv-pop");
  void resultCard.offsetWidth;
  resultCard.classList.add("pv-pop");

  const isRight = answer && answer.choiceIndex === right;

  if (isRight) {
    const earned = Number(answer.pointsEarned ?? answer.pointsPossible) || 0;
    resultCard.classList.add("good");
    resultIcon.innerHTML = ICONS.check;
    resultTitle.textContent = "Correct!";
    resultPoints.textContent = `+${earned.toLocaleString()}`;
    resultAnswer.textContent = "";
    setWash("good");

    if (lastFireworkQuestion !== key) {
      lastFireworkQuestion = key;
      launchFireworks();
    }
  } else {
    resultCard.classList.add(answer ? "miss" : "none");
    resultIcon.innerHTML = answer ? ICONS.cross : ICONS.clock;
    resultTitle.textContent = answer ? "Not this time" : "Time's up";
    resultPoints.textContent = "";
    setRich(resultAnswer, "The answer was ", rightText);
    setWash("miss");
  }

  // Rank change since the last question.
  resultRank.replaceChildren();
  if (rankNow) {
    const prefix = isRight ? "" : "+0 · ";
    if (!rankBefore) {
      resultRank.append(`${prefix}You're `);
      const b = document.createElement("b");
      b.textContent = `#${rankNow}`;
      resultRank.append(b, ` of ${sorted.length}`);
    } else if (rankNow < rankBefore) {
      resultRank.insertAdjacentHTML("afterbegin", ICONS.up);
      resultRank.append(`${prefix}You moved up to `);
      const b = document.createElement("b");
      b.className = "up-text";
      b.textContent = `#${rankNow}`;
      resultRank.append(b);
    } else if (rankNow > rankBefore) {
      resultRank.insertAdjacentHTML("afterbegin", ICONS.down);
      resultRank.append(`${prefix}You're now `);
      const b = document.createElement("b");
      b.className = "down-text";
      b.textContent = `#${rankNow}`;
      resultRank.append(b);
    } else {
      resultRank.append(`${prefix}You're still `);
      const b = document.createElement("b");
      b.textContent = `#${rankNow}`;
      resultRank.append(b);
    }
  }

  // How the room voted.
  const votes = new Array(choices.length).fill(0);
  let answered = 0;
  let correct = 0;
  let fastest = null;

  players.forEach(player => {
    const a = player.answers?.[qi];
    if (!a || typeof a.choiceIndex !== "number") return;
    answered++;
    if (a.choiceIndex >= 0 && a.choiceIndex < votes.length) votes[a.choiceIndex]++;
    if (a.choiceIndex === right) {
      correct++;
      const seconds = Math.max(0, ((a.answeredAt || 0) - (game.questionStartedAt || 0)) / 1000);
      if (!fastest || seconds < fastest.seconds) fastest = { name: player.name || "Player", seconds };
    }
  });

  voteList.replaceChildren(...choices.map((choice, index) => {
    const pct = answered ? Math.round((votes[index] / answered) * 100) : 0;
    const row = document.createElement("div");
    row.className = "pv-vote";
    if (index === right) row.classList.add("is-right");
    else if (answer && answer.choiceIndex === index) row.classList.add("is-mine");

    const fill = document.createElement("span");
    fill.className = "pv-vote-fill";
    fill.dataset.pct = pct;

    const letter = document.createElement("span");
    letter.className = "pv-vote-letter";
    letter.textContent = getLetter(index);

    const text = document.createElement("span");
    text.className = "pv-vote-text";
    text.textContent = choice;

    row.append(fill, letter, text);

    if (answer && answer.choiceIndex === index) {
      const you = document.createElement("span");
      you.className = "pv-vote-you";
      you.textContent = "YOU";
      row.appendChild(you);
    }

    const pctEl = document.createElement("span");
    pctEl.className = "pv-vote-pct";
    pctEl.textContent = `${pct}%`;
    row.appendChild(pctEl);
    return row;
  }));

  requestAnimationFrame(() => requestAnimationFrame(() => {
    voteList.querySelectorAll(".pv-vote-fill").forEach(fill => { fill.style.width = `${fill.dataset.pct}%`; });
  }));

  revealRightText.replaceChildren(`${correct} of ${players.length}`);
  if (fastest) setRich(revealFastestText, `${fastest.name} · `, `${fastest.seconds.toFixed(1)} s`);
  else revealFastestText.textContent = "Nobody";
  revealFastestText.querySelector("b")?.style.setProperty("color", "var(--green)");

  const remaining = total - (qi + 1);
  const showEncourage = !isRight && remaining > 0;
  revealEncourage.classList.toggle("hidden", !showEncourage);
  if (showEncourage) {
    revealEncourage.textContent = `${plural(remaining, "question")} left. Plenty of time to catch up.`;
  }
}

// ---------- Round over ----------

function rememberLastPlace(roundId, place, total) {
  try {
    const store = isGuest ? sessionStorage : localStorage;
    store.setItem(LAST_PLACE_KEY, JSON.stringify({ roundId, place, total }));
  } catch {}
}

function getLastPlace(roundId) {
  try {
    const store = isGuest ? sessionStorage : localStorage;
    const saved = JSON.parse(store.getItem(LAST_PLACE_KEY) || "null");
    return saved && saved.roundId === roundId ? saved : null;
  } catch {
    return null;
  }
}

function renderFinalScreen(game, playersObj) {
  stopLivePoints();
  const roundId = game.roundId;

  // The TV takes a few seconds to reveal the podium; keep the phone in suspense too.
  if (!drumrollUntil[roundId]) drumrollUntil[roundId] = Date.now() + 5500;
  const wait = drumrollUntil[roundId] - Date.now();
  if (wait > 0) {
    setScreen("drumroll");
    setWash("gold");
    setTimeout(() => renderGame(currentGame), wait + 50);
    return;
  }

  setScreen("final");
  setWash("gold");

  if (finalKey === roundId) return;
  finalKey = roundId;

  const sorted = getSortedPlayers(playersObj);
  const place = getRankIn(sorted, playerId);
  const total = sorted.length;
  const myScore = currentPlayer?.score || 0;

  placeMedal.className = "pv-medal " + (["", "gold", "silver", "bronze"][place] || "plain");
  placeNumber.textContent = place || "–";

  if (!place) {
    placeHeadline.textContent = "Round complete!";
    placeSubline.textContent = "Keep this page open for the next round.";
  } else if (place === 1) {
    placeHeadline.textContent = total > 1 ? `You won the round!` : "You finished 1st!";
    placeSubline.textContent = `${myScore.toLocaleString()} points this round`;
    if (lastFireworkQuestion !== `final:${roundId}`) {
      lastFireworkQuestion = `final:${roundId}`;
      launchFireworks();
    }
  } else {
    placeHeadline.textContent = `You finished ${ordinal(place)} of ${total}!`;
    placeSubline.textContent = `${myScore.toLocaleString()} points this round`;
  }

  if (place) rememberLastPlace(roundId, place, total);

  // Top 3, plus your own row if you're further down.
  const rows = sorted.slice(0, 3).map((player, i) => ({ player, rank: i + 1 }));
  if (place > 3) rows.push({ gap: true }, { player: sorted[place - 1], rank: place });

  podiumList.replaceChildren(...rows.map(row => {
    if (row.gap) {
      const gap = document.createElement("div");
      gap.className = "pv-podium-gap";
      gap.textContent = "···";
      return gap;
    }
    const el = document.createElement("div");
    el.className = `pv-podium-row r${row.rank}`;
    if (row.player.id === playerId) el.classList.add("is-you");

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = row.rank;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = row.player.id === playerId ? `You · ${row.player.name || "Player"}` : (row.player.name || "Player");
    const score = document.createElement("span");
    score.className = "score";
    score.textContent = (row.player.score || 0).toLocaleString();

    el.append(rank, name, score);
    return el;
  }));

  if (isGuest) {
    savedTitle.className = "pv-saved-title guest";
    savedTitle.textContent = "Guest scores aren't saved. Use a nickname + PIN next time to keep them.";
    savedStats.classList.add("hidden");
  } else {
    savedTitle.className = "pv-saved-title";
    savedTitle.innerHTML = ICONS.saved;
    savedTitle.append("Saved to your all-time score");
    savedStats.classList.remove("hidden");
    savedAllTime.textContent = "…";
    savedRank.textContent = "…";
    savedGames.textContent = "…";

    loadPlayerStats(true).then(stats => {
      const profile = stats?.profile;
      savedAllTime.textContent = (profile?.totalScore || 0).toLocaleString();
      savedRank.textContent = stats?.rank ? `#${stats.rank}` : "—";
      savedGames.textContent = (profile?.gamesPlayed || 0).toLocaleString();
    });
  }
}

// ---------- Between rounds ----------

function ensureBetweenArcade() {
  if (betweenArcade.children.length) return;
  [...gameTilesEl.children].forEach(tile => betweenArcade.appendChild(tile.cloneNode(true)));
}

async function renderLastRound(roundId) {
  if (!roundId) {
    lastRoundLine.classList.add("hidden");
    return;
  }
  if (lastRoundKey === roundId) return;
  lastRoundKey = roundId;

  try {
    if (!(roundId in savedRoundCache)) {
      const snap = await savedRoundsRef.child(roundId).once("value");
      savedRoundCache[roundId] = snap.val();
    }
  } catch (error) {
    console.warn("Last round could not be loaded:", error);
    savedRoundCache[roundId] = null;
  }

  const round = savedRoundCache[roundId];
  const mine = getLastPlace(roundId);

  if (!round?.winnerName || !(round.winnerScore > 0)) {
    lastRoundLine.classList.add("hidden");
    return;
  }

  lastRoundLine.replaceChildren();
  const trophy = document.createElement("span");
  trophy.setAttribute("aria-hidden", "true");
  trophy.textContent = "🏆";
  const text = document.createElement("span");

  if (mine && mine.place === 1) {
    text.append("Last round: ");
    const b = document.createElement("b");
    b.className = "gold";
    b.textContent = "you won!";
    text.append(b);
  } else {
    text.append("Last round: ");
    const winner = document.createElement("b");
    winner.className = "gold";
    winner.textContent = round.winnerName;
    text.append(winner, " won");
    if (mine) {
      text.append(" · you were ");
      const you = document.createElement("b");
      you.textContent = ordinal(mine.place);
      text.append(you);
    }
  }

  lastRoundLine.append(trophy, text);
  lastRoundLine.classList.remove("hidden");
}

function renderWaitingScreen(game = {}) {
  setScreen("waiting");
  setWash("");
  stopLivePoints();
  ensureBetweenArcade();
  loadArcadeBests();
  renderLastRound(game.lastCompletedRoundId);
}

// ---------- Your stats ----------

function closePlayerProfile() {
  profileModal.classList.add("hidden");
  document.body.classList.remove("profile-open");
  profileBtn?.focus();
}

function getLocalArcadeScore(prefix, fallbackId = "guest") {
  return Number(localStorage.getItem(`${prefix}_${playerId || fallbackId}`)) || 0;
}

async function openPlayerProfile() {
  profilePlayerName.textContent = playerName || "Player";
  profileAvatar.textContent = (playerName || "P").trim().charAt(0).toUpperCase() || "P";
  profileTriviaRank.textContent = "Loading trivia rank…";
  profileLoading.textContent = "Loading your records…";
  profileLoading.classList.remove("hidden");
  profileContent.classList.add("hidden");
  profileModal.classList.remove("hidden");
  document.body.classList.add("profile-open");
  closeProfileBtn.focus();

  try {
    const [allTriviaSnap] = await Promise.all([claimedNamesRef.once("value"), loadArcadeBests()]);

    const allTriviaProfiles = allTriviaSnap.val() || {};
    const rankedTrivia = Object.entries(allTriviaProfiles).map(([nameKey, profile]) => ({
      nameKey,
      name: profile.displayName || nameKey,
      totalScore: Number(profile.totalScore) || 0,
      wins: Number(profile.wins) || 0,
      gamesPlayed: Number(profile.gamesPlayed) || 0
    })).filter(profile => !isHardBlockedName(profile.name)).sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins || a.name.localeCompare(b.name));

    const mine = !isGuest && playerNameKey ? rankedTrivia.find(profile => profile.nameKey === playerNameKey) : null;
    const triviaRank = mine && mine.totalScore > 0 ? rankedTrivia.indexOf(mine) + 1 : 0;
    const games = mine?.gamesPlayed || 0;
    const average = games ? Math.round((mine.totalScore || 0) / games) : 0;

    $("profileTriviaScore").textContent = formatProfileNumber(mine?.totalScore);
    $("profileTriviaGames").textContent = `${plural(games, "game")} · ${plural(mine?.wins || 0, "win")}${games ? ` · ${average.toLocaleString()} per game` : ""}`;
    $("profileHigherScore").textContent = formatProfileNumber(arcadeBests?.higher);
    $("profileStackerScore").textContent = formatProfileNumber(arcadeBests?.stacker);
    $("profileEmojiScore").textContent = formatProfileNumber(arcadeBests?.emoji);
    profileTriviaRank.textContent = triviaRank > 0 ? `All-time trivia rank #${triviaRank}` : isGuest ? "Guest scores stay on this phone" : "No trivia rank yet";

    const top = rankedTrivia.filter(profile => profile.totalScore > 0).slice(0, 10);
    if (top.length) {
      profileLeaderboard.replaceChildren(...top.map((profile, index) => {
        const row = document.createElement("div");
        row.className = `pv-hof-row r${index + 1}`;
        const isMe = !isGuest && profile.nameKey === playerNameKey;
        if (isMe) row.classList.add("is-you");
        const rank = document.createElement("span");
        rank.className = "rank";
        rank.textContent = index + 1;
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = isMe ? `You · ${profile.name}` : profile.name;
        const score = document.createElement("span");
        score.className = "score";
        score.textContent = formatProfileNumber(profile.totalScore);
        row.append(rank, name, score);
        return row;
      }));
    } else {
      profileLeaderboard.innerHTML = '<div class="pv-note">No all-time scores yet.</div>';
    }

    profileLoading.classList.add("hidden");
    profileContent.classList.remove("hidden");
  } catch (error) {
    console.error("Player profile could not be loaded:", error);
    profileLoading.textContent = "Your stats could not be loaded. Try again in a moment.";
  }
}

function setPhoneSeasonalBranding(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  const isChristmasSeason = month === 11 || (month === 0 && day === 1);
  const isPatrioticSeason =
    (month === 6 && day >= 1 && day <= 7) ||
    (month === 4 && day >= 23) ||
    (month === 10 && day >= 8 && day <= 12);

  const source = isChristmasSeason
    ? "assets/grumpys-logo-christmas.png"
    : isPatrioticSeason
      ? "assets/grumpys-logo-usa.png"
      : "assets/grumpys-logo.png";

  const alt = isChristmasSeason
    ? "Grumpy's Christmas logo"
    : isPatrioticSeason
      ? "Grumpy's USA logo"
      : "Grumpy's St. Boni logo";

  seasonalPhoneLogos.forEach(logo => {
    logo.src = source;
    logo.alt = alt;
  });
}

setPhoneSeasonalBranding();

function applyGatewayOrder(savedOrder) {
  if (!gameTilesEl) return;

  const availableTiles = new Map(
    [...gameTilesEl.querySelectorAll("[data-game-id]")].map(tile => [tile.dataset.gameId, tile])
  );
  const requestedOrder = Array.isArray(savedOrder) ? savedOrder : [];
  const validOrder = requestedOrder.filter((id, index) => availableTiles.has(id) && requestedOrder.indexOf(id) === index);
  const finalOrder = [...validOrder, ...DEFAULT_GATEWAY_ORDER.filter(id => !validOrder.includes(id))];

  finalOrder.forEach(id => {
    const tile = availableTiles.get(id);
    if (tile) gameTilesEl.appendChild(tile);
  });
}

gatewayOrderRef.on(
  "value",
  snapshot => applyGatewayOrder(snapshot.val()),
  error => {
    console.warn("Using the default gateway order:", error);
    applyGatewayOrder(DEFAULT_GATEWAY_ORDER);
  }
);

function formatProfileNumber(value) {
  return Number(value || 0).toLocaleString();
}

// Rude, joke, political and staff names: see name-filter.js (shared with the stats page).
function isHardBlockedName(name) {
  return Boolean(window.GrumpysNameFilter && window.GrumpysNameFilter.isBlocked(name));
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function cleanName(name) {
  return String(name || "")
    .trim()
    // Only allow letters, numbers, spaces, apostrophes, hyphens, and periods
    .replace(/[^a-zA-Z0-9 '\-.]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 15);
}

function makeNameKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isNameAllowed(name) {
  const cleaned = cleanName(name);
  const key = makeNameKey(cleaned);

  const words = cleaned.split(" ").filter(Boolean);

  // Must have a real name
  if (!cleaned || key.length < 2) {
    return false;
  }

  // Max 15 visible characters
  if (cleaned.length > 15) {
    return false;
  }

  // Max 2 words
  if (words.length > 2) {
    return false;
  }

  // No word longer than 12 characters
  if (words.some(word => word.length > 12)) {
    return false;
  }

  // Only letters, numbers, spaces, apostrophes, hyphens, and periods
  if (/[^a-zA-Z0-9 '\-.]/.test(cleaned)) {
    return false;
  }

  // No repeated letters/numbers more than 3 in a row
  // Example blocked: "Saaaam", "Mikeeee", "1111"
  if (/(.)\1{3,}/i.test(cleaned)) {
    return false;
  }

  // Must include at least one letter
  if (!/[a-z]/i.test(cleaned)) {
    return false;
  }

  // Ban inappropriate number patterns, including:
  // 69, 6 9, 6-9, 6.9, 6/9, and 420
  const compactNumbers = cleaned.replace(/[^0-9]/g, "");
  if (compactNumbers.includes("69") || compactNumbers.includes("420")) {
    return false;
  }

  return !isHardBlockedName(cleaned);
}

function isPinValid(pin) {
  return /^[0-9]{4}$/.test(pin);
}

// Firebase's clock (from grumpys-auth.js): the same clock the TV and the answers use.
function serverNow() {
  return typeof window.grumpysServerNow === "function" ? window.grumpysServerNow() : Date.now();
}

function calculateLivePoints(game) {
  if (!game || !game.questionStartedAt) return 0;

  const maxPoints = game.maxPoints || 1000;
  const questionSeconds = game.questionSeconds || 20;
  const graceSeconds = game.fullPointsGraceSeconds ?? 3;

  const elapsedMs = serverNow() - game.questionStartedAt;
  const graceMs = graceSeconds * 1000;
  const scoringMs = Math.max(1, (questionSeconds - graceSeconds) * 1000);

  if (elapsedMs <= graceMs) {
    return maxPoints;
  }

  const scoringElapsedMs = elapsedMs - graceMs;
  const remainingRatio = Math.max(0, Math.min(1, 1 - scoringElapsedMs / scoringMs));

  return Math.ceil(maxPoints * remainingRatio);
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

// With sign-in switched on, a guest's id is tied to this phone so nobody else can answer for them.
function makeGuestId() {
  const uid = typeof window.grumpysUid === "function" ? window.grumpysUid() : null;
  return uid ? `guest_${uid}` : `guest_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clearGuestSession() {
  sessionStorage.removeItem("grumpysTriviaPlayerId");
  sessionStorage.removeItem("grumpysTriviaPlayerName");
  sessionStorage.removeItem("grumpysTriviaNameKey");
  sessionStorage.removeItem("grumpysTriviaPin");
  sessionStorage.removeItem("grumpysTriviaIsGuest");
  sessionStorage.removeItem("grumpysTriviaLastRoundId");
  sessionStorage.removeItem("grumpysTriviaLastCompletedRoundId");
}

function saveGuestLocally(id, name) {
  playerId = id;
  playerName = name;
  playerNameKey = "";
  savedPin = "";
  isGuest = true;

  // Guests are only remembered for this browser session/tab.
  sessionStorage.setItem("grumpysTriviaPlayerId", playerId);
  sessionStorage.setItem("grumpysTriviaPlayerName", playerName);
  sessionStorage.setItem("grumpysTriviaNameKey", "");
  sessionStorage.setItem("grumpysTriviaPin", "");
  sessionStorage.setItem("grumpysTriviaIsGuest", "true");

  // Make sure old permanent guest data is gone.
  localStorage.removeItem("grumpysTriviaIsGuest");
}

function saveRegisteredLocally(id, name, nameKey, pin) {
  clearGuestSession();

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

function rememberCompletedRoundIfNeeded(game, player) {
  if (!game) return;

  const completedRoundId = game.lastCompletedRoundId || game.roundId;

  if (!completedRoundId) return;

  if (["final", "waiting"].includes(game.phase) && player?.joinedRoundId === completedRoundId) {
    if (isGuest) {
      sessionStorage.setItem(LAST_COMPLETED_ROUND_KEY, completedRoundId);
    } else {
      localStorage.setItem(LAST_COMPLETED_ROUND_KEY, completedRoundId);
    }
  }
}

async function addPlayerToCurrentRound(game) {
  if (isPlayerPreview) return;
  if (!playerId || !playerName) return;
  if (!game || !game.roundId) return;
  if (game.phase === "waiting") return;
  if (game.lastCompletedRoundId === game.roundId) return;
  if (isAutoJoining) return;

  isAutoJoining = true;

  try {
    if (window.grumpysAuthReady) await window.grumpysAuthReady;
    if (isGuest) {
      const guestId = makeGuestId();
      if (guestId.startsWith("guest_") && window.grumpysUid?.() && playerId !== guestId) {
        saveGuestLocally(guestId, playerName);
      }
    } else if (window.grumpysPlayerReady) {
      await window.grumpysPlayerReady;
    }

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

    if (isGuest) {
      sessionStorage.setItem("grumpysTriviaLastRoundId", game.roundId);
    } else {
      localStorage.setItem("grumpysTriviaLastRoundId", game.roundId);
    }

    lastFireworkQuestion = null;
    localLockedAnswers = {};
  } catch (error) {
    console.error("Auto-join failed:", error);
  }

  isAutoJoining = false;
}

async function joinGame() {
  setJoinError("");

  const rawName = nameInput.value;
  const cleanedName = cleanName(rawName);
  const nameKey = makeNameKey(cleanedName);
  const pin = pinInput.value.trim();

  if (!cleanedName || nameKey.length < 2) {
    setJoinError("Enter a nickname with at least 2 letters/numbers.");
    return;
  }

  if (isHardBlockedName(rawName) || isHardBlockedName(cleanedName) || !isNameAllowed(cleanedName)) {
    setJoinError("Pick a different nickname. Use a normal first name or first name and last initial.");
    return;
  }

  if (!isPinValid(pin)) {
    setJoinError("Enter a 4-digit PIN.");
    return;
  }

  joinBtn.disabled = true;
  try {
    const result = await claimNickname(nameKey, cleanedName, pin);
    if (result.error) {
      setJoinError(result.error);
      return;
    }
    saveRegisteredLocally(result.playerId, cleanedName, nameKey, pin);
  } catch (error) {
    console.error("Sign in failed:", error);
    setJoinError("Couldn't sign you in just now. Check your connection and try again.");
    return;
  } finally {
    joinBtn.disabled = false;
  }

  const gameSnap = await gameRef.once("value");
  const game = gameSnap.val() || {};

  statsCache = null;
  if (isTriviaRoute) await addPlayerToCurrentRound(game);
  renderGame((await gameRef.once("value")).val() || game);
}

// Checks the PIN and returns { playerId } or { error }.
// With the secure Firebase rules the PIN is checked by Firebase and never shown to phones.
async function claimNickname(nameKey, cleanedName, pin) {
  const TAKEN = "That name is already taken. Use the correct PIN or pick a different name.";
  const uid = window.grumpysAuthReady ? await window.grumpysAuthReady : null;
  const existingProfile = (await claimedNamesRef.child(nameKey).once("value")).val();
  const publicPin = existingProfile && existingProfile.pin !== undefined && existingProfile.pin !== null
    ? String(existingProfile.pin)
    : null;

  if (existingProfile) {
    if (publicPin !== null && publicPin !== pin) return { error: TAKEN };

    if (uid) {
      const ok = await window.grumpysClaimPlayer(nameKey, pin, existingProfile.playerId);
      if (!ok) return { error: TAKEN };
    } else if (publicPin === null) {
      // The PIN lives in private storage and this phone couldn't sign in to check it.
      return { error: "Couldn't check your PIN right now. Wait a moment and try again." };
    }

    // The TV saves the name as typed (capitals and all) when the round ends.
    await claimedNamesRef.child(nameKey).update({ lastPlayed: Date.now() })
      .catch(error => console.warn("Profile update skipped:", error));

    return { playerId: existingProfile.playerId };
  }

  // With sign-in on, the id starts with this phone's sign-in id, so nobody can copy someone else's.
  const idSeed = uid ? `${uid}_${Date.now().toString(36)}` : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const newPlayerId = `player_${idSeed}`;
  const profile = {
    playerId: newPlayerId,
    displayName: cleanedName,
    totalScore: 0,
    gamesPlayed: 0,
    wins: 0,
    createdAt: Date.now(),
    lastPlayed: Date.now()
  };

  if (!uid) {
    // Sign-in isn't switched on yet: the old way, with the PIN on the profile.
    await claimedNamesRef.child(nameKey).set({ ...profile, pin });
    return { playerId: newPlayerId };
  }

  // Lock the name to this PIN first, then make the profile and link this phone to it.
  if (!(await window.grumpysClaimPlayer(nameKey, pin, null))) return { error: TAKEN };
  try {
    await claimedNamesRef.child(nameKey).set(profile);
  } catch (error) {
    // Someone made this profile a moment ago.
    return { error: TAKEN };
  }
  await db.ref(`owners/${newPlayerId}/${uid}`).set(nameKey);
  return { playerId: newPlayerId };
}

async function joinAsGuest() {
  setJoinError("");
  if (window.grumpysAuthReady) await window.grumpysAuthReady;

  saveGuestLocally(makeGuestId(), makeGuestName());

  const gameSnap = await gameRef.once("value");
  const game = gameSnap.val() || {};

  if (isTriviaRoute) await addPlayerToCurrentRound(game);
  renderGame((await gameRef.once("value")).val() || game);
}

async function submitAnswer(choiceIndex) {
  if (isSubmittingAnswer) return;
  if (!currentGame || currentGame.phase !== "question" || !playerId) return;

  const questionIndex = currentGame.questionIndex;
  if (getMyAnswer(currentGame)) return;

  isSubmittingAnswer = true;

  const answerData = {
    choiceIndex,
    // Firebase stamps the real time, so a phone's clock can't change the points.
    answeredAt: serverNow(),
    pointsPossible: calculateLivePoints(currentGame),
    scored: false
  };

  // Lock it in on screen right away, then save it.
  localLockedAnswers[questionIndex] = answerData;
  if (navigator.vibrate) navigator.vibrate(30);
  renderQuestionScreen(currentGame, currentGame.players || {});

  try {
    await gameRef.child(`players/${playerId}/answers/${questionIndex}`).set({
      ...answerData,
      answeredAt: firebase.database.ServerValue.TIMESTAMP
    });
  } catch (error) {
    console.error("Answer submit failed:", error);
    delete localLockedAnswers[questionIndex];
    choicesKey = null;
    renderQuestionScreen(currentGame, currentGame.players || {});
    statusText.textContent = "That answer didn't go through. Tap again.";
  }

  isSubmittingAnswer = false;
}

// ---------- Draw whatever the TV is doing ----------

async function renderGame(game) {
  const token = ++renderToken;
  currentGame = game || {};

  applyPhoneRoundTheme(currentGame.roundId);
  nextRoundTarget = Number(currentGame.nextRoundExpectedAt) || 0;
  updateGameMenu(currentGame);
  renderSignInStrip(currentGame);
  paintNextRound();

  const signedIn = playerId && playerName && (isGuest || (playerNameKey && savedPin));

  if (!signedIn) {
    setWash("");
    stopLivePoints();
    showJoinView();
    return;
  }

  if (!isTriviaRoute) {
    stopLivePoints();
    showMenuView();
    return;
  }

  showGameView();

  // Join this round automatically (only reads from Firebase when not in it yet).
  const inRound = currentGame.players?.[playerId]?.joinedRoundId === currentGame.roundId;
  if (currentGame.roundId && !inRound) {
    await addPlayerToCurrentRound(currentGame);
    if (token !== renderToken) return;
  }

  const playersObj = currentGame.players || {};
  currentPlayer = playersObj[playerId] || null;
  rememberCompletedRoundIfNeeded(currentGame, currentPlayer);
  updateHeaderChip(currentGame, playersObj);

  const phase = currentGame.phase;
  if (phase === "join") return renderJoinScreen(currentGame, playersObj);
  if (phase === "question") return renderQuestionScreen(currentGame, playersObj);
  if (phase === "reveal") return renderRevealScreen(currentGame, playersObj);
  if (phase === "final") return renderFinalScreen(currentGame, playersObj);
  return renderWaitingScreen(currentGame);
}

joinBtn.addEventListener("click", joinGame);
guestBtn.addEventListener("click", joinAsGuest);
profileBtn.addEventListener("click", openPlayerProfile);
profileBackdrop.addEventListener("click", closePlayerProfile);
closeProfileBtn.addEventListener("click", closePlayerProfile);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !profileModal.classList.contains("hidden")) closePlayerProfile();
});
[nameInput, pinInput].forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") joinGame();
  });
});

// A nickname saved on this phone before the name filter got stricter has to be changed.
if (!isGuest && !isPlayerPreview && playerName && isHardBlockedName(playerName)) {
  ["grumpysTriviaPlayerId", "grumpysTriviaPlayerName", "grumpysTriviaNameKey", "grumpysTriviaPin"].forEach(key => localStorage.removeItem(key));
  playerId = null;
  playerName = null;
  playerNameKey = null;
  savedPin = null;
  setJoinError("That nickname isn't allowed anymore. Please pick a new one.");
}

if (playerName && !isGuest) nameInput.value = playerName;
if (savedPin && !isGuest) pinInput.value = savedPin;

// Show something right away, before the first update from Firebase arrives.
if (playerId && playerName && (isGuest || (playerNameKey && savedPin))) {
  if (isTriviaRoute) {
    showGameView();
    setScreen("waiting");
    playerNameText.textContent = (playerName || "Player").toUpperCase();
  } else {
    showMenuView();
  }
} else {
  showJoinView();
}

gameRef.on("value", snap => {
  renderGame(snap.val());
});
