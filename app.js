const TRIVIA_URLS = [
  "https://opentdb.com/api.php?amount=2&type=multiple&difficulty=easy&category=9",
  "https://opentdb.com/api.php?amount=2&type=multiple&difficulty=easy&category=21",
  "https://opentdb.com/api.php?amount=2&type=multiple&difficulty=easy&category=23"
];

const JOIN_SECONDS = 30;
const QUESTION_SECONDS = 20;
const REVEAL_SECONDS = 8;
const FINAL_SECONDS = 42;
const MAX_POINTS = 1000;
const FULL_POINTS_GRACE_SECONDS = 3;

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

    if (!player.nameKey) continue;

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

function showJoinScreen() {
  setPhase("join");
  hideTvPointsBar();

  phaseLabel.textContent = "Join Now";
  categoryEl.textContent = "Grumpy's Trivia";
  questionEl.textContent = "Scan the QR code and get ready to play!";
  messageEl.textContent = "A new 6-question round is starting.";
  roundProgressEl.textContent = "Round starts soon";

  answersEl.innerHTML = `
    <div class="answer">Fast answers score more</div>
    <div class="answer">Up to 1000 points per question</div>
    <div class="answer">6 questions per round</div>
    <div class="answer">Winner shown at the end</div>
  `;

  renderLeaderboard({});
}

async function showQuestion(questionData, index) {
  setPhase("question");

  phaseLabel.textContent = "Question";
  currentQuestionIndex = index;
  currentQuestionStartedAt = Date.now();

  categoryEl.textContent = decodeHtml(questionData.category);
  questionEl.textContent = decodeHtml(questionData.question);
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
    category: decodeHtml(questionData.category),
    question: decodeHtml(questionData.question),
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

    if (questions.length < 6) {
      throw new Error("Not enough trivia questions returned.");
    }

    questions = shuffle(questions).slice(0, 6);
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
      },
      {
        category: "History",
        question: "What document begins with the words 'We the People'?",
        correct_answer: "The Constitution",
        incorrect_answers: ["The Declaration of Independence", "The Bill of Rights", "The Gettysburg Address"]
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
  hideTvPointsBar();
  setQrCode();
  await loadQuestions();
  runRound();
}

init();
