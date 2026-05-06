const claimedNamesRef = db.ref("claimedNames");
const savedRoundsRef = db.ref("savedRounds");
const gameRef = db.ref("games/main");

const namedPlayersCountEl = document.getElementById("namedPlayersCount");
const scoredPlayersCountEl = document.getElementById("scoredPlayersCount");
const savedRoundsCountEl = document.getElementById("savedRoundsCount");
const livePlayersCountEl = document.getElementById("livePlayersCount");
const guestPlaysCountEl = document.getElementById("guestPlaysCount");
const namedPlaysCountEl = document.getElementById("namedPlaysCount");

const livePhaseEl = document.getElementById("livePhase");
const liveTimerEl = document.getElementById("liveTimer");
const liveQuestionEl = document.getElementById("liveQuestion");
const liveTop5El = document.getElementById("liveTop5");
const lastUpdatedEl = document.getElementById("lastUpdated");

const leaderboardBodyEl = document.getElementById("leaderboardBody");
const leaderboardCountEl = document.getElementById("leaderboardCount");
const leaderboardSearchEl = document.getElementById("leaderboardSearch");
const sortSelectEl = document.getElementById("sortSelect");
const sortDirectionEl = document.getElementById("sortDirection");
const refreshBtn = document.getElementById("refreshBtn");
const tabButtons = document.querySelectorAll(".tab-btn");

let allPlayers = [];
let currentTab = "all";
let currentLiveGame = {};
let statsCountdownInterval = null;
let statsCountdownTarget = null;

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
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

function formatDate(timestamp) {
  if (!timestamp) return "—";

  try {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function getAvgScore(player) {
  if (!player.gamesPlayed) return 0;
  return Math.round((player.totalScore || 0) / player.gamesPlayed);
}

function getPlayers(playersObj = {}) {
  return Object.entries(playersObj)
    .map(([nameKey, profile]) => ({
      nameKey,
      name: profile.displayName || nameKey,
      totalScore: profile.totalScore || 0,
      wins: profile.wins || 0,
      gamesPlayed: profile.gamesPlayed || 0,
      lastPlayed: profile.lastPlayed || null,
      createdAt: profile.createdAt || null
    }));
}

function getDefaultRankedPlayers(players) {
  return [...players].sort((a, b) => {
    if ((b.totalScore || 0) !== (a.totalScore || 0)) {
      return (b.totalScore || 0) - (a.totalScore || 0);
    }

    if ((b.wins || 0) !== (a.wins || 0)) {
      return (b.wins || 0) - (a.wins || 0);
    }

    return (a.name || "").localeCompare(b.name || "");
  });
}

function sortPlayers(players) {
  const sortBy = sortSelectEl.value;
  const direction = sortDirectionEl.value;
  const multiplier = direction === "asc" ? 1 : -1;

  return [...players].sort((a, b) => {
    let aVal;
    let bVal;

    if (sortBy === "score") {
      aVal = a.totalScore || 0;
      bVal = b.totalScore || 0;
    } else if (sortBy === "wins") {
      aVal = a.wins || 0;
      bVal = b.wins || 0;
    } else if (sortBy === "games") {
      aVal = a.gamesPlayed || 0;
      bVal = b.gamesPlayed || 0;
    } else if (sortBy === "average") {
      aVal = getAvgScore(a);
      bVal = getAvgScore(b);
    } else if (sortBy === "recent") {
      aVal = a.lastPlayed || 0;
      bVal = b.lastPlayed || 0;
    } else if (sortBy === "name") {
      return direction === "asc"
        ? (a.name || "").localeCompare(b.name || "")
        : (b.name || "").localeCompare(a.name || "");
    }

    if (aVal === bVal) {
      return (a.name || "").localeCompare(b.name || "");
    }

    return aVal > bVal ? multiplier : -multiplier;
  });
}

function getTabPlayers() {
  if (currentTab === "recent") {
    return allPlayers.filter(player => player.lastPlayed);
  }

  if (currentTab === "inactive") {
    return allPlayers.filter(player => !player.gamesPlayed || !player.totalScore);
  }

  return allPlayers;
}

function renderLeaderboard() {
  const search = leaderboardSearchEl.value.trim().toLowerCase();
  const rankedPlayers = getDefaultRankedPlayers(allPlayers);

  let players = getTabPlayers();

  players = players.filter(player => {
    if (!search) return true;
    return (player.name || "").toLowerCase().includes(search);
  });

  players = sortPlayers(players);

  leaderboardCountEl.textContent = `${players.length} player${players.length === 1 ? "" : "s"}`;

  if (players.length === 0) {
    leaderboardBodyEl.innerHTML = `
      <tr>
        <td colspan="7" class="empty">No players found.</td>
      </tr>
    `;
    return;
  }

  leaderboardBodyEl.innerHTML = players
    .map(player => {
      const trueRank = rankedPlayers.findIndex(p => p.nameKey === player.nameKey) + 1;

      return `
        <tr>
          <td class="rank">#${trueRank}</td>
          <td>${player.name}</td>
          <td class="score">${formatNumber(player.totalScore)}</td>
          <td>${formatNumber(player.wins)}</td>
          <td>${formatNumber(player.gamesPlayed)}</td>
          <td>${formatNumber(getAvgScore(player))}</td>
          <td class="muted">${formatDate(player.lastPlayed)}</td>
        </tr>
      `;
    })
    .join("");
}

function getSortedLivePlayers(playersObj = {}) {
  return Object.values(playersObj)
    .sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) {
        return (b.score || 0) - (a.score || 0);
      }

      return (a.name || "").localeCompare(b.name || "");
    });
}

function stopStatsCountdown() {
  if (statsCountdownInterval) {
    clearInterval(statsCountdownInterval);
    statsCountdownInterval = null;
  }

  statsCountdownTarget = null;
}

function startStatsCountdown(targetTime) {
  if (!targetTime) {
    stopStatsCountdown();
    return;
  }

  function render() {
    const remainingMs = targetTime - Date.now();
    const countdownText = formatCountdownFromMs(remainingMs);

    liveTimerEl.textContent = countdownText;

    if (remainingMs <= 0) {
      liveQuestionEl.textContent = "Next round should be returning soon.";
    } else {
      liveQuestionEl.textContent = `Next round expected in ${countdownText}`;
    }
  }

  render();

  if (statsCountdownTarget === targetTime && statsCountdownInterval) {
    return;
  }

  stopStatsCountdown();

  statsCountdownTarget = targetTime;
  statsCountdownInterval = setInterval(render, 1000);
}

function renderLiveGame(game = {}) {
  currentLiveGame = game;

  const phase = game.phase || "Waiting";
  const playersObj = game.players || {};
  const livePlayers = getSortedLivePlayers(playersObj);
  const liveTop5 = livePlayers.slice(0, 5);

  livePlayersCountEl.textContent = livePlayers.length;
  livePhaseEl.textContent = phase;

  if ((phase === "waiting" || phase === "final") && game.nextRoundExpectedAt) {
    startStatsCountdown(Number(game.nextRoundExpectedAt));
  } else {
    stopStatsCountdown();
    liveTimerEl.textContent = formatTime(game.timer || 0);

    if (game.phase === "question" || game.phase === "reveal") {
      liveQuestionEl.textContent = game.question || "Question loading...";
    } else if (game.phase === "join") {
      liveQuestionEl.textContent = "Players joining";
    } else {
      liveQuestionEl.textContent = "—";
    }
  }

  if (liveTop5.length === 0) {
    liveTop5El.innerHTML = `<div class="empty">No live players yet.</div>`;
    return;
  }

  liveTop5El.innerHTML = liveTop5
    .map((player, index) => `
      <div class="live-line">
        ${index + 1}. ${player.name || "Player"} — 
        <span class="score">${formatNumber(player.score || 0)}</span>
      </div>
    `)
    .join("");
}

function renderSavedRoundStats(savedRoundsObj = {}) {
  const rounds = Object.values(savedRoundsObj);

  let guestPlays = 0;
  let namedPlays = 0;

  rounds.forEach(round => {
    guestPlays += round.guestCount || 0;
    namedPlays += round.namedCount || 0;
  });

  savedRoundsCountEl.textContent = rounds.length;
  guestPlaysCountEl.textContent = formatNumber(guestPlays);
  namedPlaysCountEl.textContent = formatNumber(namedPlays);
}

async function loadStats() {
  lastUpdatedEl.textContent = "Loading...";

  const [claimedSnap, savedRoundsSnap, gameSnap] = await Promise.all([
    claimedNamesRef.once("value"),
    savedRoundsRef.once("value"),
    gameRef.once("value")
  ]);

  const claimedObj = claimedSnap.val() || {};
  const savedRoundsObj = savedRoundsSnap.val() || {};
  const game = gameSnap.val() || {};

  allPlayers = getPlayers(claimedObj);

  const scoredPlayers = allPlayers.filter(player => (player.totalScore || 0) > 0);

  namedPlayersCountEl.textContent = allPlayers.length;
  scoredPlayersCountEl.textContent = scoredPlayers.length;

  renderSavedRoundStats(savedRoundsObj);
  renderLiveGame(game);
  renderLeaderboard();

  lastUpdatedEl.textContent = `Updated ${new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  })}`;
}

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    tabButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    currentTab = button.dataset.tab;
    renderLeaderboard();
  });
});

leaderboardSearchEl.addEventListener("input", renderLeaderboard);
sortSelectEl.addEventListener("change", renderLeaderboard);
sortDirectionEl.addEventListener("change", renderLeaderboard);
refreshBtn.addEventListener("click", loadStats);

gameRef.on("value", snap => {
  renderLiveGame(snap.val() || {});
});

claimedNamesRef.on("value", snap => {
  allPlayers = getPlayers(snap.val() || {});

  const scoredPlayers = allPlayers.filter(player => (player.totalScore || 0) > 0);

  namedPlayersCountEl.textContent = allPlayers.length;
  scoredPlayersCountEl.textContent = scoredPlayers.length;

  renderLeaderboard();

  lastUpdatedEl.textContent = `Updated ${new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  })}`;
});

savedRoundsRef.on("value", snap => {
  renderSavedRoundStats(snap.val() || {});
});

loadStats();
