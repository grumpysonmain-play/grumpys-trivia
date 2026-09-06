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
const currentImageEl = document.getElementById("currentImage");
const nextNameEl = document.getElementById("nextName");
const nextValueEl = document.getElementById("nextValue");
const nextImageEl = document.getElementById("nextImage");
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
    {name:"Statue of Liberty",value:305,image:"statue-of-liberty.jpg"},{name:"Space Needle",value:605,image:"space-needle.jpg"},{name:"Gateway Arch",value:630,image:"gateway-arch.jpg"},{name:"Eiffel Tower",value:1083,image:"eiffel-tower.jpg"},{name:"Empire State Building",value:1454,image:"empire-state-building.jpg"},{name:"Willis Tower",value:1451,image:"willis-tower.jpg"},{name:"CN Tower",value:1815,image:"cn-tower.jpg"},{name:"Burj Khalifa",value:2717,image:"burj-khalifa.jpg"}
  ]},
  { name:"Animal Top Speeds", unit:"mph", facts:[
    {name:"Giant Tortoise",value:1,image:"giant-tortoise.jpg"},{name:"Elephant",value:25,image:"elephant.jpg"},{name:"Grizzly Bear",value:35,image:"grizzly-bear.jpg"},{name:"Racehorse",value:44,image:"racehorse.jpg"},{name:"Lion",value:50,image:"lion.jpg"},{name:"Pronghorn",value:55,image:"pronghorn.jpg"},{name:"Cheetah",value:70,image:"cheetah.jpg"},{name:"Peregrine Falcon (Dive)",value:240,image:"peregrine-falcon.jpg"}
  ]},
  { name:"Approx. Food Calories", unit:"calories", facts:[
    {name:"Large Egg",value:78,image:"large-egg.jpg"},{name:"Banana",value:105,image:"banana.jpg"},{name:"Glazed Donut",value:190,image:"glazed-donut.jpg"},{name:"Cheeseburger",value:300,image:"cheeseburger.jpg"},{name:"Slice of Pepperoni Pizza",value:313,image:"pepperoni-pizza.jpg"},{name:"Basket of French Fries",value:365,image:"french-fries.jpg"},{name:"Chicken Burrito",value:650,image:"chicken-burrito.jpg"},{name:"Large Milkshake",value:800,image:"milkshake.jpg"}
  ]},
  { name:"U.S. Stadium Capacity", unit:"seats", facts:[
    {name:"MetLife Stadium",value:82500,image:"metlife-stadium.jpg"},{name:"Lambeau Field",value:81441,image:"lambeau-field.jpg"},{name:"AT&T Stadium",value:80000,image:"att-stadium.jpg"},{name:"Empower Field",value:76125,image:"empower-field.jpg"},{name:"Bank of America Stadium",value:75037,image:"bank-of-america-stadium.jpg"},{name:"Arrowhead Stadium",value:73426,image:"arrowhead-stadium.jpg"},{name:"Caesars Superdome",value:73208,image:"caesars-superdome.jpg"},{name:"SoFi Stadium",value:70000,image:"sofi-stadium.jpg"}
  ]},
  { name:"Mountain Elevations", unit:"feet", facts:[
    {name:"Mount Everest",value:29032,image:"mount-everest.jpg"},{name:"K2",value:28251,image:"k2.jpg"},{name:"Denali",value:20310,image:"denali.jpg"},{name:"Mount Kilimanjaro",value:19341,image:"kilimanjaro.jpg"},{name:"Mont Blanc",value:15774,image:"mont-blanc.jpg"},{name:"Matterhorn",value:14692,image:"matterhorn.jpg"},{name:"Mount Rainier",value:14410,image:"mount-rainier.jpg"},{name:"Mount Fuji",value:12389,image:"mount-fuji.jpg"}
  ]},
  { name:"Maximum Lake Depths", unit:"feet", facts:[
    {name:"Lake Baikal",value:5387,image:"lake-baikal.jpg"},{name:"Lake Tanganyika",value:4823,image:"lake-tanganyika.jpg"},{name:"Caspian Sea",value:3363,image:"caspian-sea.jpg"},{name:"Great Slave Lake",value:2015,image:"great-slave-lake.jpg"},{name:"Crater Lake",value:1943,image:"crater-lake.jpg"},{name:"Lake Tahoe",value:1645,image:"lake-tahoe.jpg"},{name:"Lake Superior",value:1332,image:"lake-superior.jpg"},{name:"Lake Michigan",value:923,image:"lake-michigan.jpg"}
  ]},
  { name:"Spotify Streams · Sep. 2026", unit:"million streams", facts:[
    {name:"“Blinding Lights” · The Weeknd",value:5569,image:"blinding-lights.jpg"},{name:"“Shape of You” · Ed Sheeran",value:5073,image:"shape-of-you.jpg"},{name:"“Sweater Weather” · The Neighbourhood",value:4842,image:"sweater-weather.jpg"},{name:"“As It Was” · Harry Styles",value:4599,image:"as-it-was.jpg"},{name:"“One Dance” · Drake",value:4440,image:"one-dance.jpg"},{name:"“Sunflower” · Post Malone & Swae Lee",value:4426,image:"sunflower-song.jpg"},{name:"“Someone You Loved” · Lewis Capaldi",value:4422,image:"someone-you-loved.jpg"},{name:"“Stay” · The Kid LAROI & Justin Bieber",value:4058,image:"stay-song.jpg"}
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
  const formattedValue = String(unit).toLowerCase() === "year"
    ? String(Math.trunc(Number(value)))
    : Number(value).toLocaleString();

  return `${formattedValue} <small>${unit}</small>`;
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
  currentImageEl.src = `assets/higher-lower/${currentFact.image}`;
  currentImageEl.alt = currentFact.name;
  currentValueEl.innerHTML = formatFactValue(currentFact.value, currentDeck.unit);
  nextNameEl.textContent = nextFact.name;
  nextImageEl.src = `assets/higher-lower/${nextFact.image}`;
  nextImageEl.alt = nextFact.name;
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
