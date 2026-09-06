const decoderPlayersRef = db.ref("emojiDecoder/players");
const loginGate = document.getElementById("loginGate");
const decoderView = document.getElementById("decoderView");
const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");
const leaderboardEl = document.getElementById("decoderLeaderboard");
const playerNameEl = document.getElementById("decoderPlayerName");
const modePicker = document.getElementById("modePicker");
const startBtn = document.getElementById("startDecoderBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const scoreEl = document.getElementById("decoderScore");
const streakEl = document.getElementById("decoderStreak");
const progressEl = document.getElementById("decoderProgress");
const timerFillEl = document.getElementById("decoderTimerFill");
const categoryEl = document.getElementById("decoderCategory");
const pointsEl = document.getElementById("decoderPoints");
const emojisEl = document.getElementById("decoderEmojis");
const hintTextEl = document.getElementById("decoderHintText");
const formEl = document.getElementById("decoderForm");
const answerEl = document.getElementById("decoderAnswer");
const hintBtn = document.getElementById("decoderHintBtn");
const skipBtn = document.getElementById("decoderSkipBtn");
const feedbackEl = document.getElementById("decoderFeedback");
const resultHeadlineEl = document.getElementById("resultHeadline");
const resultScoreEl = document.getElementById("resultScore");
const resultBestNoteEl = document.getElementById("resultBestNote");
const resultCorrectEl = document.getElementById("resultCorrect");
const resultStreakEl = document.getElementById("resultStreak");
const resultFastestEl = document.getElementById("resultFastest");
const leadersEl = document.getElementById("decoderLeaders");
const seasonalLogos = document.querySelectorAll(".seasonal-phone-logo");

const PUZZLE_SECONDS = 20;
const PUZZLES_PER_GAME = 10;
const PUZZLES = [
  {category:"Movie",emojis:"🚢 🧊 💔",answer:"Titanic",aliases:[],explanation:"A ship, an iceberg, and a heartbreaking romance."},
  {category:"Movie",emojis:"🦁 👑",answer:"The Lion King",aliases:["Lion King"],explanation:"A lion who becomes king."},
  {category:"Movie",emojis:"🔎 🐠",answer:"Finding Nemo",aliases:[],explanation:"Searching for a missing clownfish."},
  {category:"Movie",emojis:"🦖 🏞️",answer:"Jurassic Park",aliases:[],explanation:"Dinosaurs inside a theme park."},
  {category:"Movie",emojis:"🏠 👦 😱",answer:"Home Alone",aliases:[],explanation:"A boy is accidentally left home by himself."},
  {category:"Movie",emojis:"👻 🚫",answer:"Ghostbusters",aliases:["Ghost Busters"],explanation:"The team that catches and stops ghosts."},
  {category:"Movie",emojis:"🔙 ⏰ 🚗 ⚡",answer:"Back to the Future",aliases:[],explanation:"A time-traveling car powered by some serious electricity."},
  {category:"Movie",emojis:"🦈 🌊",answer:"Jaws",aliases:[],explanation:"A dangerous shark terrorizes the ocean."},
  {category:"Movie",emojis:"🧸 🤠 🚀",answer:"Toy Story",aliases:[],explanation:"Toys led by a cowboy and a space ranger."},
  {category:"Movie",emojis:"❄️ 👭 ⛄",answer:"Frozen",aliases:[],explanation:"Two sisters, ice powers, and a snowman."},
  {category:"Movie",emojis:"💊 🕶️ 💻",answer:"The Matrix",aliases:["Matrix"],explanation:"A mysterious pill reveals a simulated world."},
  {category:"Movie",emojis:"🏴‍☠️ 🌊 💰",answer:"Pirates of the Caribbean",aliases:["Pirates Caribbean"],explanation:"Pirates sail the Caribbean in search of treasure."},
  {category:"Movie",emojis:"🏹 🔥 🐦",answer:"The Hunger Games",aliases:["Hunger Games"],explanation:"A fiery rebellion, an archer, and the Mockingjay."},
  {category:"Movie",emojis:"🌙 🏛️ 🦖",answer:"Night at the Museum",aliases:[],explanation:"Museum exhibits come alive at night."},
  {category:"Movie",emojis:"😈 👨‍👧‍👧 🍌",answer:"Despicable Me",aliases:[],explanation:"A villain, his adopted daughters, and banana-loving Minions."},

  {category:"TV Show",emojis:"👥 ☕ 🏙️",answer:"Friends",aliases:[],explanation:"A group of friends gathers at a coffee shop in New York."},
  {category:"TV Show",emojis:"👧 🧇 🚲 👾",answer:"Stranger Things",aliases:[],explanation:"Eleven, waffles, bikes, and monsters from another dimension."},
  {category:"TV Show",emojis:"🏢 📄 ☕",answer:"The Office",aliases:["Office"],explanation:"Everyday life at a paper company office."},
  {category:"TV Show",emojis:"🧪 👨‍🏫 💰",answer:"Breaking Bad",aliases:[],explanation:"A chemistry teacher enters a dangerous business."},
  {category:"TV Show",emojis:"🐉 ⚔️ 👑",answer:"Game of Thrones",aliases:[],explanation:"Dragons and battles for the throne."},
  {category:"TV Show",emojis:"🧟 🚶",answer:"The Walking Dead",aliases:["Walking Dead"],explanation:"The dead are walking."},
  {category:"TV Show",emojis:"🐎 🏔️ 🤠",answer:"Yellowstone",aliases:[],explanation:"Cowboys defend a ranch near the mountains."},
  {category:"TV Show",emojis:"🧽 🍍 🌊",answer:"SpongeBob SquarePants",aliases:["Spongebob","Sponge Bob Square Pants"],explanation:"A sponge lives in a pineapple under the sea."},
  {category:"TV Show",emojis:"👨‍👩‍👧‍👦 🍩 📺",answer:"The Simpsons",aliases:["Simpsons"],explanation:"The famous animated family and Homer's favorite snack."},
  {category:"TV Show",emojis:"🖤 👧 🖐️",answer:"Wednesday",aliases:[],explanation:"The dark Addams daughter and her helping hand."},
  {category:"TV Show",emojis:"🐕 🔎 👻",answer:"Scooby-Doo",aliases:["Scooby Doo"],explanation:"A mystery-solving dog investigates ghosts."},
  {category:"TV Show",emojis:"🏝️ 🔥 🗳️",answer:"Survivor",aliases:[],explanation:"Island contestants, tribal fire, and voting."},
  {category:"TV Show",emojis:"🇺🇸 🎤 ⭐",answer:"American Idol",aliases:[],explanation:"American singers compete to become a star."},
  {category:"TV Show",emojis:"👨‍👩‍👧‍👦 🗣️ 😂",answer:"Family Guy",aliases:[],explanation:"An animated family comedy."},
  {category:"TV Show",emojis:"🚀 🤠 👶 🟢",answer:"The Mandalorian",aliases:["Mandalorian"],explanation:"A space gunslinger protects a mysterious green child."},

  {category:"Song",emojis:"🎆",answer:"Firework",aliases:[],explanation:"A single exploding firework says the title."},
  {category:"Song",emojis:"👁️ 🐅",answer:"Eye of the Tiger",aliases:[],explanation:"An eye and a tiger spell out the title."},
  {category:"Song",emojis:"🍉 🍬",answer:"Watermelon Sugar",aliases:[],explanation:"Watermelon plus something sweet."},
  {category:"Song",emojis:"🚶 ☀️",answer:"Walking on Sunshine",aliases:[],explanation:"Walking beneath bright sunshine."},
  {category:"Song",emojis:"💍 🔥",answer:"Ring of Fire",aliases:[],explanation:"A ring surrounded by fire."},
  {category:"Song",emojis:"💃 👑",answer:"Dancing Queen",aliases:[],explanation:"A dancing queen."},
  {category:"Song",emojis:"🟣 🌧️",answer:"Purple Rain",aliases:[],explanation:"Purple-colored rain."},
  {category:"Song",emojis:"⏰ 🙋 ⬆️",answer:"Wake Me Up",aliases:[],explanation:"An alarm asks someone to wake me up."},
  {category:"Song",emojis:"👴 🏘️ 🛣️",answer:"Old Town Road",aliases:[],explanation:"An old town and a road."},
  {category:"Song",emojis:"😎 ✨ 🚦",answer:"Blinding Lights",aliases:[],explanation:"Bright lights are strong enough to be blinding."},
  {category:"Song",emojis:"💃 🙅",answer:"Shake It Off",aliases:[],explanation:"Dance, shake, and brush it off."},
  {category:"Song",emojis:"🎉 🇺🇸",answer:"Party in the USA",aliases:["Party in USA"],explanation:"A party in the United States."},
  {category:"Song",emojis:"🔢 ⭐",answer:"Counting Stars",aliases:[],explanation:"Counting a group of stars."},
  {category:"Song",emojis:"⬆️ 🏙️ 🎶",answer:"Uptown Funk",aliases:[],explanation:"Uptown plus a funky beat."},
  {category:"Song",emojis:"🍬 🏠 🌾",answer:"Sweet Home Alabama",aliases:[],explanation:"A sweet home in the southern countryside."}
];

const previewMode = new URLSearchParams(window.location.search).get("preview") === "1";
const sessionGuest = sessionStorage.getItem("grumpysTriviaIsGuest") === "true";
const playerId = previewMode ? "preview_player" : sessionGuest ? sessionStorage.getItem("grumpysTriviaPlayerId") : localStorage.getItem("grumpysTriviaPlayerId");
const playerName = previewMode ? "Trivia King" : sessionGuest ? sessionStorage.getItem("grumpysTriviaPlayerName") : localStorage.getItem("grumpysTriviaPlayerName");
const isGuest = previewMode || sessionGuest;
const bestKey = `emojiDecoderBest_${playerId || "guest"}`;

let selectedMode = "Mixed";
let gamePuzzles = [];
let puzzleIndex = 0;
let score = 0;
let streak = 0;
let bestRunStreak = 0;
let correctCount = 0;
let fastestSeconds = null;
let personalBest = Number(localStorage.getItem(bestKey)) || 0;
let puzzleStartedAt = 0;
let timerInterval = null;
let attempts = 0;
let hintUsed = false;
let answerLocked = false;

function setSeasonalBranding(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  const christmas = month === 11 || (month === 0 && day === 1);
  const patriotic = (month === 6 && day >= 1 && day <= 7) || (month === 4 && day >= 23) || (month === 10 && day >= 8 && day <= 12);
  const source = christmas ? "assets/grumpys-logo-christmas.png" : patriotic ? "assets/grumpys-logo-usa.png" : "assets/grumpys-logo.png";
  seasonalLogos.forEach(logo => { logo.src = source; });
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index],copy[swap]] = [copy[swap],copy[index]];
  }
  return copy;
}

function normalizeAnswer(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g,"and").replace(/\bthe\b/g,"").replace(/[^a-z0-9]/g,"");
}

function editDistance(left,right) {
  const rows = Array.from({length:left.length + 1},() => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1,rows[i][j - 1] + 1,rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
  }
  return rows[left.length][right.length];
}

function answerMatches(guess,puzzle) {
  const normalizedGuess = normalizeAnswer(guess);
  if (!normalizedGuess) return false;
  return [puzzle.answer,...puzzle.aliases].some(option => {
    const normalizedOption = normalizeAnswer(option);
    if (normalizedGuess === normalizedOption) return true;
    const allowance = normalizedOption.length >= 12 ? 2 : normalizedOption.length >= 6 ? 1 : 0;
    return editDistance(normalizedGuess,normalizedOption) <= allowance;
  });
}

function elapsedSeconds() {
  return Math.max(0,(Date.now() - puzzleStartedAt) / 1000);
}

function availablePoints() {
  const timePoints = Math.max(100,1000 - elapsedSeconds() * 45);
  const penalties = (hintUsed ? 250 : 0) + attempts * 75;
  return Math.max(0,Math.round((timePoints - penalties) / 10) * 10);
}

function updateTimer() {
  const elapsed = elapsedSeconds();
  const percent = Math.max(0,100 - elapsed / PUZZLE_SECONDS * 100);
  timerFillEl.style.width = `${percent}%`;
  pointsEl.textContent = `${availablePoints().toLocaleString()} PTS`;
  if (elapsed >= PUZZLE_SECONDS && !answerLocked) revealAnswer("time");
}

function currentPuzzle() {
  return gamePuzzles[puzzleIndex];
}

function showPuzzle() {
  const puzzle = currentPuzzle();
  attempts = 0;
  hintUsed = false;
  answerLocked = false;
  puzzleStartedAt = Date.now();
  categoryEl.textContent = puzzle.category.toUpperCase();
  emojisEl.textContent = puzzle.emojis;
  emojisEl.setAttribute("aria-label",`${puzzle.category} emoji clue`);
  emojisEl.style.animation = "none";
  requestAnimationFrame(() => { emojisEl.style.animation = ""; });
  hintTextEl.className = "hint-text";
  hintTextEl.textContent = "What title do these emojis describe?";
  answerEl.value = "";
  answerEl.disabled = false;
  hintBtn.disabled = false;
  skipBtn.disabled = false;
  feedbackEl.className = "decoder-feedback";
  feedbackEl.textContent = "The clock is running — type your best guess.";
  progressEl.textContent = `${puzzleIndex + 1}/${PUZZLES_PER_GAME}`;
  scoreEl.textContent = score.toLocaleString();
  streakEl.textContent = streak;
  timerFillEl.style.width = "100%";
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer,80);
  updateTimer();
  window.setTimeout(() => answerEl.focus({preventScroll:true}),120);
}

function nextPuzzle() {
  puzzleIndex += 1;
  if (puzzleIndex >= gamePuzzles.length) finishRun();
  else showPuzzle();
}

function lockPuzzle() {
  answerLocked = true;
  clearInterval(timerInterval);
  answerEl.disabled = true;
  hintBtn.disabled = true;
  skipBtn.disabled = true;
}

function submitGuess(event) {
  event.preventDefault();
  if (answerLocked) return;
  const guess = answerEl.value.trim();
  if (!guess) {
    feedbackEl.className = "decoder-feedback wrong";
    feedbackEl.textContent = "Type an answer first.";
    return;
  }
  const puzzle = currentPuzzle();
  if (!answerMatches(guess,puzzle)) {
    attempts += 1;
    feedbackEl.className = "decoder-feedback wrong";
    feedbackEl.textContent = `Not quite — try again. ${availablePoints().toLocaleString()} points still available.`;
    pointsEl.textContent = `${availablePoints().toLocaleString()} PTS`;
    answerEl.select();
    return;
  }

  const solveTime = elapsedSeconds();
  const earned = availablePoints();
  streak += 1;
  bestRunStreak = Math.max(bestRunStreak,streak);
  const streakBonus = Math.min(300,(streak - 1) * 75);
  score += earned + streakBonus;
  correctCount += 1;
  fastestSeconds = fastestSeconds === null ? solveTime : Math.min(fastestSeconds,solveTime);
  lockPuzzle();
  scoreEl.textContent = score.toLocaleString();
  streakEl.textContent = streak;
  feedbackEl.className = "decoder-feedback correct";
  feedbackEl.textContent = `Correct! ${puzzle.answer} — +${(earned + streakBonus).toLocaleString()} points. ${puzzle.explanation}`;
  window.setTimeout(nextPuzzle,2100);
}

function revealAnswer(reason) {
  if (answerLocked) return;
  const puzzle = currentPuzzle();
  lockPuzzle();
  streak = 0;
  streakEl.textContent = "0";
  feedbackEl.className = "decoder-feedback reveal";
  feedbackEl.textContent = `${reason === "time" ? "Time’s up" : "Skipped"}: ${puzzle.answer}. ${puzzle.explanation}`;
  window.setTimeout(nextPuzzle,2400);
}

function showHint() {
  if (hintUsed || answerLocked) return;
  hintUsed = true;
  const answer = currentPuzzle().answer;
  const words = answer.split(/\s+/);
  const letters = answer.replace(/[^a-z]/gi,"").length;
  hintTextEl.className = "hint-text revealed";
  hintTextEl.textContent = `Hint: starts with “${answer[0].toUpperCase()}” · ${words.length} word${words.length === 1 ? "" : "s"} · ${letters} letters`;
  hintBtn.disabled = true;
  pointsEl.textContent = `${availablePoints().toLocaleString()} PTS`;
}

function startRun() {
  const pool = selectedMode === "Mixed" ? PUZZLES : PUZZLES.filter(puzzle => puzzle.category === selectedMode);
  gamePuzzles = shuffle(pool).slice(0,PUZZLES_PER_GAME);
  puzzleIndex = 0;
  score = 0;
  streak = 0;
  bestRunStreak = 0;
  correctCount = 0;
  fastestSeconds = null;
  startScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  leaderboardEl.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  showPuzzle();
}

async function savePersonalBest() {
  localStorage.setItem(bestKey,String(personalBest));
  if (isGuest || !playerId) return;
  try {
    await decoderPlayersRef.child(playerId).transaction(profile => {
      const existing = profile || {};
      return {...existing,name:playerName || "Player",bestScore:Math.max(Number(existing.bestScore) || 0,personalBest),updatedAt:Date.now()};
    });
  } catch (error) {
    console.error("Could not save Emoji Decoder score:",error);
  }
}

function finishRun() {
  clearInterval(timerInterval);
  gameScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");
  leaderboardEl.classList.remove("hidden");
  const newBest = score > personalBest;
  if (newBest) {
    personalBest = score;
    savePersonalBest();
  }
  resultHeadlineEl.textContent = correctCount >= 9 ? "Master decoder!" : correctCount >= 6 ? "Nicely decoded!" : "Keep cracking clues!";
  resultScoreEl.textContent = score.toLocaleString();
  resultBestNoteEl.textContent = newBest ? "NEW PERSONAL BEST" : `PERSONAL BEST · ${personalBest.toLocaleString()}`;
  resultCorrectEl.textContent = `${correctCount}/${PUZZLES_PER_GAME}`;
  resultStreakEl.textContent = bestRunStreak;
  resultFastestEl.textContent = fastestSeconds === null ? "—" : `${fastestSeconds.toFixed(1)}s`;
  window.scrollTo({top:0,behavior:"smooth"});
}

function returnToStart() {
  resultScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  leaderboardEl.classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}

function renderLeaderboard(playersObj = {}) {
  const players = Object.entries(playersObj).map(([id,player]) => ({id,...player})).sort((a,b) => (b.bestScore || 0) - (a.bestScore || 0) || (a.name || "").localeCompare(b.name || "")).slice(0,5);
  const medals = ["🥇","🥈","🥉","4","5"];
  leadersEl.replaceChildren();
  if (!players.length) {
    const row = document.createElement("div");
    row.className = "decoder-leader-row";
    row.innerHTML = "<span>—</span><b>Be the first</b><strong>0</strong>";
    leadersEl.appendChild(row);
    return;
  }
  players.forEach((player,index) => {
    const row = document.createElement("div");
    row.className = `decoder-leader-row${player.id === playerId ? " is-you" : ""}`;
    const medal = document.createElement("span");
    const name = document.createElement("b");
    const value = document.createElement("strong");
    medal.textContent = medals[index];
    name.textContent = player.name || "Player";
    value.textContent = Number(player.bestScore || 0).toLocaleString();
    row.append(medal,name,value);
    leadersEl.appendChild(row);
  });
}

function openDecoder() {
  if (!playerId || !playerName) {
    loginGate.classList.remove("hidden");
    return;
  }
  decoderView.classList.remove("hidden");
  playerNameEl.textContent = playerName;
  if (previewMode) {
    renderLeaderboard({one:{name:"Movie Buff",bestScore:9175},two:{name:"Hot Dish",bestScore:8420},preview_player:{name:playerName,bestScore:personalBest || 7890}});
    return;
  }
  decoderPlayersRef.on("value",snapshot => {
    const players = snapshot.val() || {};
    const savedBest = Number(players[playerId]?.bestScore) || 0;
    if (savedBest > personalBest) {
      personalBest = savedBest;
      localStorage.setItem(bestKey,String(personalBest));
    }
    renderLeaderboard(players);
  },error => {
    console.error("Could not load Emoji Decoder leaderboard:",error);
    leadersEl.innerHTML = '<div class="decoder-leader-row"><span>!</span><b>Leaderboard unavailable</b><strong>—</strong></div>';
  });
}

modePicker.addEventListener("click",event => {
  const button = event.target.closest(".mode-chip");
  if (!button) return;
  selectedMode = button.dataset.mode;
  modePicker.querySelectorAll(".mode-chip").forEach(chip => chip.classList.toggle("selected",chip === button));
});
formEl.addEventListener("submit",submitGuess);
hintBtn.addEventListener("click",showHint);
skipBtn.addEventListener("click",() => revealAnswer("skip"));
startBtn.addEventListener("click",startRun);
playAgainBtn.addEventListener("click",returnToStart);

setSeasonalBranding();
openDecoder();
