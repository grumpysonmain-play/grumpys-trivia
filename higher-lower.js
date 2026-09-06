const higherLowerPlayersRef = db.ref("higherLower/players");
const loginGate = document.getElementById("loginGate");
const higherLowerView = document.getElementById("higherLowerView");
const hlPlayerName = document.getElementById("hlPlayerName");
const currentStreakEl = document.getElementById("currentStreak");
const bestStreakEl = document.getElementById("bestStreak");
const playModeEl = document.getElementById("playMode");
const categoryNameEl = document.getElementById("categoryName");
const roundCountEl = document.getElementById("roundCount");
const currentNameEl = document.getElementById("currentName");
const currentValueEl = document.getElementById("currentValue");
const nextNameEl = document.getElementById("nextName");
const nextValueEl = document.getElementById("nextValue");
const nextFactCard = document.getElementById("nextFactCard");
const higherBtn = document.getElementById("higherBtn");
const lowerBtn = document.getElementById("lowerBtn");
const hlFeedback = document.getElementById("hlFeedback");
const hlLeaders = document.getElementById("hlLeaders");
const seasonalLogos = document.querySelectorAll(".seasonal-phone-logo");

const previewMode = new URLSearchParams(window.location.search).get("preview") === "1";
const sessionGuest = sessionStorage.getItem("grumpysTriviaIsGuest") === "true";
const playerId = previewMode
  ? "preview_player"
  : sessionGuest
    ? sessionStorage.getItem("grumpysTriviaPlayerId")
    : localStorage.getItem("grumpysTriviaPlayerId");
const playerName = previewMode
  ? "Trivia King"
  : sessionGuest
    ? sessionStorage.getItem("grumpysTriviaPlayerName")
    : localStorage.getItem("grumpysTriviaPlayerName");
const isGuest = previewMode || sessionGuest;

const FACT_DECKS = [
  { name:"Landmark Heights", unit:"feet", facts:[
    {name:"Statue of Liberty",value:305},{name:"Space Needle",value:605},{name:"Gateway Arch",value:630},{name:"Eiffel Tower",value:1083},{name:"Empire State Building",value:1454},{name:"Willis Tower",value:1451},{name:"CN Tower",value:1815},{name:"Burj Khalifa",value:2717}
  ]},
  { name:"Movie Runtimes", unit:"minutes", facts:[
    {name:"Toy Story",value:81},{name:"The Lion King",value:88},{name:"The Wizard of Oz",value:102},{name:"Back to the Future",value:116},{name:"Jaws",value:124},{name:"Jurassic Park",value:127},{name:"The Dark Knight",value:152},{name:"Titanic",value:195}
  ]},
  { name:"TV Premiere Years", unit:"year", facts:[
    {name:"I Love Lucy",value:1951},{name:"The Brady Bunch",value:1969},{name:"Cheers",value:1982},{name:"The Simpsons",value:1989},{name:"Friends",value:1994},{name:"The Office",value:2005},{name:"Stranger Things",value:2016},{name:"Ted Lasso",value:2020}
  ]},
  { name:"Animal Top Speeds", unit:"mph", facts:[
    {name:"Giant Tortoise",value:1},{name:"Elephant",value:25},{name:"Grizzly Bear",value:35},{name:"Racehorse",value:44},{name:"Lion",value:50},{name:"Pronghorn",value:55},{name:"Cheetah",value:70},{name:"Peregrine Falcon (Dive)",value:240}
  ]},
  { name:"Approx. Food Calories", unit:"calories", facts:[
    {name:"Large Egg",value:78},{name:"Banana",value:105},{name:"Glazed Donut",value:190},{name:"Cheeseburger",value:300},{name:"Slice of Pepperoni Pizza",value:313},{name:"Basket of French Fries",value:365},{name:"Chicken Burrito",value:650},{name:"Large Milkshake",value:800}
  ]}
];

let currentStreak = 0;
let bestStreak = Number(localStorage.getItem(`higherLowerBest_${playerId || "guest"}`)) || 0;
let guessNumber = 0;
let currentDeck = null;
let currentFact = null;
let nextFact = null;
let answerLocked = false;

function setSeasonalBranding(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  const christmas = month === 11 || (month === 0 && day === 1);
  const patriotic = (month === 6 && day >= 1 && day <= 7) || (month === 4 && day >= 23) || (month === 10 && day >= 8 && day <= 12);
  const source = christmas ? "assets/grumpys-logo-christmas.png" : patriotic ? "assets/grumpys-logo-usa.png" : "assets/grumpys-logo.png";
  seasonalLogos.forEach(logo => logo.src = source);
}

function formatFactValue(value, unit) {
  return `${Number(value).toLocaleString()} <small>${unit}</small>`;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createComparison() {
  currentDeck = randomItem(FACT_DECKS);
  currentFact = randomItem(currentDeck.facts);
  nextFact = randomItem(currentDeck.facts.filter(fact => fact.name !== currentFact.name && fact.value !== currentFact.value));
  guessNumber += 1;
  answerLocked = false;

  categoryNameEl.textContent = currentDeck.name;
  roundCountEl.textContent = `GUESS ${guessNumber}`;
  currentNameEl.textContent = currentFact.name;
  currentValueEl.innerHTML = formatFactValue(currentFact.value, currentDeck.unit);
  nextNameEl.textContent = nextFact.name;
  nextValueEl.textContent = "?";
  nextValueEl.className = "fact-value mystery";
  nextFactCard.classList.remove("is-correct", "is-wrong");
  higherBtn.disabled = false;
  lowerBtn.disabled = false;
  hlFeedback.className = "hl-feedback";
  hlFeedback.textContent = "Will the hidden value be higher or lower?";
}

async function saveBestStreak() {
  localStorage.setItem(`higherLowerBest_${playerId || "guest"}`, String(bestStreak));

  if (isGuest || !playerId || previewMode) return;

  try {
    const playerRef = higherLowerPlayersRef.child(playerId);
    await playerRef.transaction(profile => {
      const existing = profile || {};
      return {
        ...existing,
        name: playerName || "Player",
        bestStreak: Math.max(Number(existing.bestStreak) || 0, bestStreak),
        updatedAt: Date.now()
      };
    });
  } catch (error) {
    console.error("Could not save Higher or Lower best streak:", error);
  }
}

function renderLeaderboard(playersObj = {}) {
  const players = Object.entries(playersObj).map(([id, player]) => ({id,...player})).sort((a,b) => (b.bestStreak || 0) - (a.bestStreak || 0) || (a.name || "").localeCompare(b.name || "")).slice(0,5);
  const medals = ["🥇","🥈","🥉","4","5"];
  hlLeaders.replaceChildren();

  if (!players.length) {
    const row = document.createElement("div");
    row.className = "hl-leader-row";
    row.innerHTML = "<span>—</span><b>Be the first</b><strong>0</strong>";
    hlLeaders.appendChild(row);
    return;
  }

  players.forEach((player,index) => {
    const row = document.createElement("div");
    const medal = document.createElement("span");
    const name = document.createElement("b");
    const score = document.createElement("strong");
    row.className = `hl-leader-row${player.id === playerId ? " is-you" : ""}`;
    medal.textContent = medals[index];
    name.textContent = player.name || "Player";
    score.textContent = player.bestStreak || 0;
    row.append(medal,name,score);
    hlLeaders.appendChild(row);
  });
}

async function makeGuess(direction) {
  if (answerLocked) return;
  answerLocked = true;
  higherBtn.disabled = true;
  lowerBtn.disabled = true;

  const correctDirection = nextFact.value > currentFact.value ? "higher" : "lower";
  const correct = direction === correctDirection;
  const endedStreak = currentStreak;
  nextValueEl.innerHTML = formatFactValue(nextFact.value, currentDeck.unit);
  nextValueEl.className = "fact-value";

  if (correct) {
    currentStreak += 1;
    bestStreak = Math.max(bestStreak,currentStreak);
    nextFactCard.classList.add("is-correct");
    hlFeedback.className = "hl-feedback correct";
    hlFeedback.textContent = `Correct! Your streak is now ${currentStreak}.`;
    await saveBestStreak();
  } else {
    currentStreak = 0;
    nextFactCard.classList.add("is-wrong");
    hlFeedback.className = "hl-feedback wrong";
    hlFeedback.textContent = endedStreak ? `Not this time. Your ${endedStreak}-answer streak ended.` : `Not this time — it was ${correctDirection}.`;
  }

  currentStreakEl.textContent = currentStreak;
  bestStreakEl.textContent = bestStreak;
  window.setTimeout(createComparison, 1650);
}

function startGame() {
  if (!playerId || !playerName) {
    loginGate.classList.remove("hidden");
    return;
  }

  higherLowerView.classList.remove("hidden");
  hlPlayerName.textContent = playerName;
  playModeEl.textContent = "Free Play";
  bestStreakEl.textContent = bestStreak;
  createComparison();

  if (!previewMode) {
    higherLowerPlayersRef.on(
      "value",
      snapshot => {
        const players = snapshot.val() || {};
        const savedBest = Number(players[playerId]?.bestStreak) || 0;

        if (savedBest > bestStreak) {
          bestStreak = savedBest;
          bestStreakEl.textContent = bestStreak;
          localStorage.setItem(`higherLowerBest_${playerId}`, String(bestStreak));
        }

        renderLeaderboard(players);
      },
      error => console.error("Could not load Higher or Lower leaderboard:", error)
    );
  } else {
    renderLeaderboard({one:{name:"Bar Fly",bestStreak:12},two:{name:"Hot Dish",bestStreak:9},preview_player:{name:playerName,bestStreak:bestStreak || 7}});
  }
}

higherBtn.addEventListener("click", () => makeGuess("higher"));
lowerBtn.addEventListener("click", () => makeGuess("lower"));
setSeasonalBranding();
startGame();
