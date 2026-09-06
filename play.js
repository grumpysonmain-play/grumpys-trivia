const GAME_ID = "main";
const gameRef = db.ref(`games/${GAME_ID}`);
const claimedNamesRef = db.ref("claimedNames");
const gatewayOrderRef = db.ref("settings/gatewayOrder");
const DEFAULT_GATEWAY_ORDER = ["trivia", "higher-lower", "stacker", "emoji-decoder"];

const joinView = document.getElementById("joinView");
const menuView = document.getElementById("menuView");
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
const playerNameText = document.getElementById("playerNameText");
const questionProgressText = document.getElementById("questionProgressText");
const seasonalPhoneLogos = document.querySelectorAll(".seasonal-phone-logo");
const menuPlayerName = document.getElementById("menuPlayerName");
const triviaLiveBadge = document.getElementById("triviaLiveBadge");
const triviaPhaseText = document.getElementById("triviaPhaseText");
const triviaMenuStatus = document.getElementById("triviaMenuStatus");
const triviaActionText = document.getElementById("triviaActionText");
const gameTilesEl = document.getElementById("gameTiles");
const routeParams = new URLSearchParams(window.location.search);
const isTriviaRoute = routeParams.get("game") === "trivia";
const isPlayerPreview = routeParams.get("preview") === "1";

const PHONE_ROUND_THEMES = [
  { accent: "#ff4255", hot: "#ff9eaa", rgb: "255 66 85" },
  { accent: "#4aa8ff", hot: "#a7d7ff", rgb: "74 168 255" },
  { accent: "#42d987", hot: "#a5f3c8", rgb: "66 217 135" },
  { accent: "#ff8a35", hot: "#ffc28f", rgb: "255 138 53" },
  { accent: "#9d73ff", hot: "#d5c3ff", rgb: "157 115 255" }
];

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
let nextRoundCountdownInterval = null;
let nextRoundCountdownTarget = null;
let currentPhoneThemeKey = null;

const LAST_COMPLETED_ROUND_KEY = "grumpysTriviaLastCompletedRoundId";

function applyPhoneRoundTheme(roundKey) {
  const key = String(roundKey || "grumpys");

  if (key === currentPhoneThemeKey) return;

  currentPhoneThemeKey = key;

  const index = [...key].reduce((total, character) => total + character.charCodeAt(0), 0) % PHONE_ROUND_THEMES.length;
  const theme = PHONE_ROUND_THEMES[index];
  const rootStyle = document.documentElement.style;

  rootStyle.setProperty("--phone-accent", theme.accent);
  rootStyle.setProperty("--phone-accent-hot", theme.hot);
  rootStyle.setProperty("--phone-accent-rgb", theme.rgb);
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

const BLOCKED_WORDS = [
  // Profanity / crude language
  "fuck", "fucker", "fucking", "shit", "shitty", "bitch", "asshole", "ass",
  "dick", "cock", "pussy", "cunt", "cum", "jizz", "porn", "sex",
  "slut", "whore", "horny", "nude", "nudes",

  // Sexual / creepy joke names
  "daddy", "mommy", "mama", "papi", "stepdad", "stepmom",
  "milf", "dilf", "sugarbaby", "sugar", "baby",
  "suck", "sucks", "sucker", "lick", "licker", "spank",
  "sexy", "thicc", "gyatt", "onlyfans", "simp", "cougar", "hoe", "hoes",

  // Bathroom / gross names
  "fart", "farter", "farting", "poop", "pooper", "poopy",
  "pee", "piss", "butt", "booty", "balls", "nuts", "booger",
  "toilet", "diarrhea", "diarrhoea", "crap", "turd", "shart",
  "barf", "vomit", "stinky", "smelly", "boob", "boobs",

  // Hate / slurs / violent content
  "rape", "rapist", "molest", "pedo", "pedophile",
  "nigger", "nigga", "fag", "faggot", "retard", "spic", "chink", "kike",
  "hitler", "nazi", "kkk", "isis", "terrorist",

  // Admin/staff impersonation
  "admin", "administrator", "owner", "staff", "employee", "manager",
  "host", "triviahost", "grumpysowner", "grumpysstaff", "grumpysmanager",
  "ceo", "president", "mod", "moderator", "security", "bartender",
  "server", "cook", "chef", "dj", "announcer",

  // Political bait names
  "trump", "biden", "obama", "maga", "liberal", "conservative",

  // Drug / bar-inappropriate joke names
  "weed", "stoner", "drunk", "wasted",

  // Common troll / fake names
  "skibidi", "ohio", "chungus", "yeet", "sus", "imposter",
  "amongus", "npc", "bot", "trash", "loser", "anonymous",
  "unknown", "none", "null", "undefined", "test",

  // “Your mom” type names
  "yourmom", "yourdad", "urmom", "urdad", "yomama"
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
  "host",

  "daddy",
  "mommy",
  "mama",
  "papi",
  "farter",
  "fart",
  "pooper",
  "poop",
  "butt",
  "booty",

  "trump",
  "biden",
  "obama",
  "maga",

  "guest",
  "player",
  "winner",
  "loser",
  "anonymous",
  "unknown",
  "test"
];

function normalizeNameForFilter(name) {
  return String(name || "")
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

function isHardBlockedName(name) {
  const raw = String(name || "").toLowerCase();

  // Removes spaces, dots, hyphens, apostrophes, underscores, etc.
  // Example: "T-r.u m p" becomes "trump"
  const compact = raw.replace(/[^a-z0-9]/g, "");

  // Example: "6 9", "6-9", "6.9" all become "69"
  const compactNumbers = raw.replace(/[^0-9]/g, "");

  const hardBlocked = [
    "trump",
    "biden",
    "obama",
    "maga",

    "daddy",
    "mommy",
    "mama",
    "papi",

    "fart",
    "farter",
    "poop",
    "pooper",
    "pee",
    "piss",
    "butt",
    "booty",

    "admin",
    "administrator",
    "owner",
    "manager",
    "staff",
    "employee",
    "host",
    "grumpys",
    "grumpy",

    "fuck",
    "shit",
    "bitch",
    "asshole",
    "dick",
    "pussy",
    "cunt",
    "sex",
    "porn",
    "hitler",
    "nazi"
  ];

  if (compactNumbers.includes("69") || compactNumbers.includes("420")) {
    return true;
  }

  return hardBlocked.some(word => compact.includes(word));
}

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
  const normalized = normalizeNameForFilter(cleaned);

  // Reduces extra repeats for checking.
  // Example: "Dadddddy" gets checked closer to "Dadddy".
  const reducedRepeats = normalized.replace(/(.)\1{3,}/g, "$1$1$1");

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

  // Ban exact fake/admin/troll names
  if (BLOCKED_EXACT_NAMES.includes(normalized) || BLOCKED_EXACT_NAMES.includes(reducedRepeats)) {
    return false;
  }

  // Ban guest-style names for registered users
  if (normalized.includes("guest")) {
    return false;
  }

  // Ban Grumpy's impersonation names
  if (normalized.includes("grumpys") || normalized.includes("grumpy")) {
    return false;
  }

  // Ban “your mom” variants even with spaces/punctuation
  if (
    normalized.includes("yourmom") ||
    normalized.includes("yourdad") ||
    normalized.includes("urmom") ||
    normalized.includes("urdad") ||
    normalized.includes("yomama")
  ) {
    return false;
  }

  // Ban obvious bad words, including versions with spaces, periods, hyphens, or number swaps
  const blocked = BLOCKED_WORDS.some(word => {
    const badWord = normalizeNameForFilter(word);

    return normalized.includes(badWord) || reducedRepeats.includes(badWord);
  });

  if (blocked) {
    return false;
  }

  return true;
}

function isPinValid(pin) {
  return /^[0-9]{4}$/.test(pin);
}

function setJoinError(message) {
  joinError.textContent = message;
  joinError.classList.toggle("has-error", Boolean(message));
}

function showGameView() {
  joinView.classList.add("hidden");
  menuView.classList.add("hidden");
  gameView.classList.remove("hidden");
  playerNameText.textContent = playerName || "Player";
}

function showJoinView() {
  joinView.classList.remove("hidden");
  menuView.classList.add("hidden");
  gameView.classList.add("hidden");
}

function showMenuView() {
  joinView.classList.add("hidden");
  gameView.classList.add("hidden");
  menuView.classList.remove("hidden");
  menuPlayerName.textContent = playerName || "Player";
  document.body.dataset.phonePhase = "menu";
}

function updateGameMenu(game = {}) {
  const phase = game.phase || "waiting";
  const timer = formatTime(game.timer || 0);
  const questionNumber = Number.isInteger(game.questionIndex) ? game.questionIndex + 1 : null;
  const isLive = ["join", "question", "reveal"].includes(phase);

  triviaLiveBadge.classList.toggle("is-live", isLive);

  if (phase === "join") {
    triviaLiveBadge.textContent = "JOIN NOW";
    triviaPhaseText.textContent = `${timer} LEFT`;
    triviaMenuStatus.textContent = "A new trivia round is starting. Join from your phone now.";
    triviaActionText.innerHTML = "Join Live Trivia <span>›</span>";
    return;
  }

  if (phase === "question") {
    triviaLiveBadge.textContent = "LIVE";
    triviaPhaseText.textContent = questionNumber ? `QUESTION ${questionNumber} OF 6` : "QUESTION LIVE";
    triviaMenuStatus.textContent = "Trivia is in progress. You can still open the live game screen.";
    triviaActionText.innerHTML = "Open Live Trivia <span>›</span>";
    return;
  }

  if (phase === "reveal") {
    triviaLiveBadge.textContent = "LIVE";
    triviaPhaseText.textContent = "ANSWER REVEAL";
    triviaMenuStatus.textContent = "Scores are updating before the next question.";
    triviaActionText.innerHTML = "Return to Trivia <span>›</span>";
    return;
  }

  triviaLiveBadge.textContent = "TRIVIA";
  triviaPhaseText.textContent = phase === "final" ? "ROUND COMPLETE" : "BETWEEN ROUNDS";
  triviaMenuStatus.textContent = "The next trivia round has not started yet. You can keep this page open.";
  triviaActionText.innerHTML = "Open Trivia Screen <span>›</span>";
}

function setPhonePhase(phase) {
  gameView.dataset.phase = phase || "waiting";
  document.body.dataset.phonePhase = phase || "waiting";
}

function setNextRoundLayout(isOn) {
  if (isOn) {
    gameView.classList.add("next-round-mode");
  } else {
    gameView.classList.remove("next-round-mode");
  }
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

  if (cleanText.length > 70) {
    questionText.classList.add("phone-long-question");
  }

  if (cleanText.length > 105) {
    questionText.classList.add("phone-extra-long-question");
  }

  if (cleanText.length > 145) {
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

  let meterColor = "#46e58a";
  let meterDark = "#168b4d";
  let meterGlow = "rgba(70,229,138,.42)";

  if (percent <= 25) {
    meterColor = "#ff5b69";
    meterDark = "#8d1723";
    meterGlow = "rgba(255,91,105,.43)";
  } else if (percent <= 55) {
    meterColor = "#ff8a35";
    meterDark = "#a84313";
    meterGlow = "rgba(255,138,53,.4)";
  } else if (percent <= 78) {
    meterColor = "#f3d04f";
    meterDark = "#9b7411";
    meterGlow = "rgba(243,208,79,.38)";
  }

  pointsBox.style.setProperty("--meter-color", meterColor);
  pointsBox.style.setProperty("--meter-dark", meterDark);
  pointsBox.style.setProperty("--meter-glow", meterGlow);

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
            <span class="mini-name"><span class="mini-medal" aria-label="${index + 1 === 1 ? "First" : index + 1 === 2 ? "Second" : "Third"} place">${["🥇", "🥈", "🥉"][index]}</span><span>${player.name || "Player"}</span>${player.id === playerId ? '<span class="you-pill">YOU</span>' : ""}</span>
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

  setNextRoundLayout(false);
}

function showNextRoundCountdown(targetTime) {
  const box = getNextRoundBox();

  if (!targetTime) {
    hideNextRoundCountdown();
    return;
  }

  box.classList.remove("hidden");
  setNextRoundLayout(true);

  function render() {
    const remainingMs = targetTime - Date.now();

    box.innerHTML = `
      <div class="next-round-label">Next Round Expected In</div>
      <div class="next-round-time">${formatCountdownFromMs(remainingMs)}</div>
      <div class="next-round-note">
        Keep this page open. You’ll auto-join when trivia returns.
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

function shouldShowNextRoundCountdown(game, player) {
  if (!game || !["final", "waiting"].includes(game.phase)) return false;
  if (!game.nextRoundExpectedAt) return false;

  const completedRoundId = game.lastCompletedRoundId || game.roundId;
  if (!completedRoundId) return false;

  const locallyCompletedRound = isGuest
    ? sessionStorage.getItem(LAST_COMPLETED_ROUND_KEY)
    : localStorage.getItem(LAST_COMPLETED_ROUND_KEY);

  const playerJoinedCompletedRound = player?.joinedRoundId === completedRoundId;

  return playerJoinedCompletedRound || locallyCompletedRound === completedRoundId;
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

  if (isTriviaRoute) {
    await addPlayerToCurrentRound(game);
    await loadPlayerStats();
    showGameView();
  } else {
    showMenuView();
  }
}

async function joinAsGuest() {
  setJoinError("");

  const guestName = makeGuestName();
  const guestId = makeGuestId();

  saveGuestLocally(guestId, guestName);

  const gameSnap = await gameRef.once("value");
  const game = gameSnap.val() || {};

  if (isTriviaRoute) {
    await addPlayerToCurrentRound(game);
    hidePlayerStats();
    hideMiniLeaderboard();
    hideNextRoundCountdown();
    showGameView();
    statusText.textContent = `Playing as ${guestName}. Guest scores do not save all-time.`;
    categoryText.textContent = "Guest Mode";
    setPhoneQuestionText("Watch the TV for the next question.");
  } else {
    showMenuView();
  }
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
    const letter = document.createElement("span");
    const copy = document.createElement("span");

    btn.className = "choice";
    btn.type = "button";
    letter.className = "choice-letter";
    letter.textContent = getLetter(index);
    copy.className = "choice-copy";
    copy.textContent = choice;
    btn.append(letter, copy);

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
  applyPhoneRoundTheme(currentGame.roundId);
  updateGameMenu(currentGame);
  setPhonePhase(currentGame.phase || "waiting");
  timerText.textContent = formatTime(currentGame.timer || 0);
  playerNameText.textContent = playerName || "Player";

  if (!playerId || !playerName) {
    document.body.dataset.phonePhase = "join";
    hidePointsBox();
    hideMiniLeaderboard();
    hideNextRoundCountdown();
    showJoinView();
    return;
  }

  if (!isGuest && (!playerNameKey || !savedPin)) {
    document.body.dataset.phonePhase = "join";
    hidePointsBox();
    hideMiniLeaderboard();
    hideNextRoundCountdown();
    showJoinView();
    return;
  }

  if (!isTriviaRoute) {
    hidePointsBox();
    hideMiniLeaderboard();
    hideNextRoundCountdown();
    showMenuView();
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

  scoreText.textContent = (currentPlayer?.score || 0).toLocaleString();

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
      questionProgressText.textContent = "ROUND COMPLETE";
      setPhoneQuestionText("Keep this page open. You’ll automatically join when the next trivia round starts.");

      choicesEl.innerHTML = "";
      return;
    }

    hideNextRoundCountdown();

    statusText.className = "status";
    statusText.textContent = "Waiting for trivia to return on the TV.";

    categoryText.textContent = "Waiting";
    questionProgressText.textContent = "STAY READY";
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
    questionProgressText.textContent = "GET READY";
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
    questionProgressText.textContent = `QUESTION ${(currentGame.questionIndex || 0) + 1} / 6`;
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
    questionProgressText.textContent = `ANSWER ${(currentGame.questionIndex || 0) + 1} / 6`;
    setPhoneQuestionText(currentGame.question || "Answer revealed.");

    renderChoices(currentGame);
    updateMiniLeaderboard(playersObj);
    return;
  }

  if (currentGame.phase === "final") {
    if (isGuest) {
      hidePlayerStats();
    } else {
      showPlayerStats();
      await loadPlayerStats();
    }

    hidePointsBox();
    updateMiniLeaderboard(playersObj);

    if (shouldShowNextRoundCountdown(currentGame, currentPlayer)) {
      showNextRoundCountdown(currentGame.nextRoundExpectedAt);
    } else {
      hideNextRoundCountdown();
    }

    statusText.className = "status";
    statusText.textContent = `${currentRankText ? `${currentRankText}. ` : ""}${getJoinStatusMessage(currentGame, currentPlayer)}`;

    categoryText.textContent = isGuest ? "Guest Round Complete" : "Round Complete";
    questionProgressText.textContent = "FINAL SCORE";
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
[nameInput, pinInput].forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") joinGame();
  });
});

if (playerName && !isGuest) {
  nameInput.value = playerName;
}

if (savedPin && !isGuest) {
  pinInput.value = savedPin;
}

if (playerId && playerName && (isGuest || (playerNameKey && savedPin))) {
  if (isTriviaRoute) {
    showGameView();
    setPhonePhase("waiting");
  } else {
    showMenuView();
  }

  if (isTriviaRoute && isGuest) {
    hidePlayerStats();
    statusText.textContent = `Waiting as ${playerName}. Guest scores do not save all-time.`;
    categoryText.textContent = "Guest Mode";
    setPhoneQuestionText("Keep this page open. You will automatically join the next round as a guest.");
  } else if (isTriviaRoute) {
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
