const TRIVIA_URLS = [
  "https://opentdb.com/api.php?amount=2&type=multiple&difficulty=easy&category=9",
  "https://opentdb.com/api.php?amount=2&type=multiple&difficulty=easy&category=21",
  "https://opentdb.com/api.php?amount=1&type=multiple&difficulty=easy&category=23"
];

const JOIN_SECONDS = 20;
const QUESTION_SECONDS = 20;
const REVEAL_SECONDS = 8;
const FINAL_SECONDS = 40;

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
    .slice(0, 5);
}

async function addRoundScoresToAllTime(roundLeaders) {
  const savedRoundSnap = await savedRoundsRef.child(roundId).once("value");

  if (savedRoundSnap.exists()) {
    console.warn("This round was already saved. Skipping all-time update.");
    return;
  }

  for (let i = 0; i < roundLeaders.length; i++) {
    const player = roundLeaders[i];

    if (!player.nameKey) {
      console.warn("Skipping all-time score because player has no nameKey:", player);
      continue;
    }

    const profileRef = claimedNamesRef.child(player.nameKey);
    const profileSnap = await profileRef.once("value");
    const profile = profileSnap.val();

    if (!profile) {
      console.warn("Skipping all-time score because claimed profile was not found:", player);
      continue;
    }

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

async function scoreQuestion() {
  const snap = await gameRef.child("players").once("value");
  const players = snap.val() || {};
  const updates = {};

  Object.entries(players).forEach(([playerId, player]) => {
    const answer = player.answers?.[currentQuestionIndex];

    if (answer && answer.choiceIndex === correctAnswerIndex && !answer.scored) {
      updates[`players/${playerId}/score`] = (player.score || 0) + 100;
      updates[`players/${playerId}/answers/${currentQuestionIndex}/scored`] = true;
    }
  });

  if (Object.keys(updates).length > 0) {
    await gameRef.update(updates);
  }

  const updatedSnap = await gameRef.child("players").once("value");
  renderLeaderboard(updatedSnap.val() || {});
}

function showJoinScreen() {
  setPhase("join");

  phaseLabel.textContent = "Join Now";
  categoryEl.textContent = "Grumpy's Trivia";
  questionEl.textContent = "Scan the QR code and get ready to play!";
  messageEl.textContent = "A new 5-question round is starting.";
  roundProgressEl.textContent = "Round starts soon";

  answersEl.innerHTML = `
    <div class="answer">Fast answers score points</div>
    <div class="answer">Top 5 shown after each question</div>
    <div class="answer">Play from your phone</div>
    <div class="answer">Winner shown at the end</div>
  `;

  renderLeaderboard({});
}

async function showQuestion(questionData, index) {
  setPhase("question");

  phaseLabel.textContent = "Question";
  currentQuestionIndex = index;

  categoryEl.textContent = decodeHtml(questionData.category);
  questionEl.textContent = decodeHtml(questionData.question);
  messageEl.textContent = "Answer now on your phone.";
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
    category: decodeHtml(questionData.category),
    question: decodeHtml(questionData.question),
    choices,
    correctAnswerIndex: null,
    timer: QUESTION_SECONDS,
    finalSaved: false
  });
}

async function showAnswerReveal(index) {
  setPhase("reveal");

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

  const snap = await gameRef.child("players").once("value");
  const roundLeaders = getSortedPlayers(snap.val() || {}).slice(0, 5);

  await addRoundScoresToAllTime(roundLeaders);

  const allTimeLeaders = await getAllTimeLeaders();
  const winnerName = roundLeaders[0]?.name || "Nobody yet";

  phaseLabel.textContent = "Final";
  categoryEl.textContent = "Final Scoreboard";
  questionEl.textContent = `${winnerName} wins this round!`;
  messageEl.textContent = "All-time leaderboard saves by nickname + PIN.";
  roundProgressEl.textContent = "Round complete";

  answersEl.innerHTML = `
    <div class="final-board round-board">
      <div class="winner-banner">🏆 This Round Winner: ${winnerName}</div>
      <h3>Final Top 5</h3>
      <ol>
        ${makeBoardList(roundLeaders)}
      </ol>
    </div>

    <div class="final-board all-time-board">
      <h3>All-Time Leaders</h3>
      <ol>
        ${makeBoardList(allTimeLeaders)}
      </ol>
    </div>
  `;

  await gameRef.update({
    roundId,
    phase: "final",
    timer: FINAL_SECONDS,
    finalSaved: true
  });
}

async function loadQuestions() {
  try {
    const questionGroups = await Promise.all(
      TRIVIA_URLS.map(url => fetch(url).then(response => response.json()))
    );

    questions = questionGroups.flatMap(group => group.results || []);

    if (questions.length < 5) {
      throw new Error("Not enough trivia questions returned.");
    }

    questions = shuffle(questions).slice(0, 5);
  } catch (error) {
    console.error(error);

    questions = [
      {
        category: "General Knowledge",
        question: "What planet is known as the Red Planet?",
        correct_answer: "Mars",
        incorrect_answers: ["Venus", "Jupiter", "Saturn"]
      },
      {
        category: "Sports",
        question: "How many points is a touchdown worth?",
        correct_answer: "6",
        incorrect_answers: ["3", "7", "10"]
      },
      {
        category: "History",
        question: "Who was the first President of the United States?",
        correct_answer: "George Washington",
        incorrect_answers: ["Abraham Lincoln", "Thomas Jefferson", "John Adams"]
      },
      {
        category: "General Knowledge",
        question: "How many days are in a leap year?",
        correct_answer: "366",
        incorrect_answers: ["365", "364", "367"]
      },
      {
        category: "Sports",
        question: "In baseball, how many strikes make an out?",
        correct_answer: "3",
        incorrect_answers: ["2", "4", "5"]
      }
    ];
  }
}

async function runRound() {
  roundId = Date.now().toString();

  await gameRef.set({
    roundId,
    phase: "join",
    timer: JOIN_SECONDS,
    players: {},
    finalSaved: false
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

  phaseLabel.textContent = "Next Round";
  timerEl.textContent = "0:00";
}

gameRef.child("players").on("value", snap => {
  renderLeaderboard(snap.val() || {});
});

async function init() {
  setQrCode();
  await loadQuestions();
  runRound();
}

init();
