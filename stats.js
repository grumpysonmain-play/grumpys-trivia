const claimedNamesRef = db.ref("claimedNames");
const savedRoundsRef = db.ref("savedRounds");
const gameRef = db.ref("games/main");

const namedPlayersCountEl = document.getElementById("namedPlayersCount");
const scoredPlayersCountEl = document.getElementById("scoredPlayersCount");
const savedRoundsCountEl = document.getElementById("savedRoundsCount");
const livePlayersCountEl = document.getElementById("livePlayersCount");

const livePhaseEl = document.getElementById("livePhase");
const liveTimerEl = document.getElementById("liveTimer");
const liveQuestionEl = document.getElementById("liveQuestion");
const liveTop5El = document.getElementById("liveTop5");
const lastUpdatedEl = document.getElementById("lastUpdated");

const leaderboardBodyEl = document.getElementById("leaderboardBody");
const leaderboardCountEl = document.getElementById("leaderboardCount");
const leaderboardSearchEl = document.getElementById("leaderboardSearch");
const refreshBtn = document.getElementById("refreshBtn");

let allPlayers = [];

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

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

function getSortedPlayers(playersObj = {}) {
  return Object.entries(playersObj)
    .map(([nameKey, profile]) => ({
      nameKey,
      name: profile.displayName || nameKey,
      totalScore: profile.totalScore || 0,
      wins: profile.wins || 0,
      gamesPlayed: profile.gamesPlayed || 0,
      lastPlayed: profile.lastPlayed || null,
      createdAt: profile.createdAt || null
    }))
    .sort((a, b) => {
      if ((b.totalScore || 0) !== (a.totalScore || 0)) {
        return (b.totalScore || 0) - (a.totalScore || 0);
      }

      if ((b.wins || 0) !== (a.wins || 0)) {
        return (b.wins || 0) - (a.wins || 0);
      }

      return (a.name || "").localeCompare(b.name || "");
    });
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

function renderLeaderboard() {
  const search = leaderboardSearchEl.value.trim().toLowerCase();

  const filteredPlayers = allPlayers.filter(player => {
    if (!search) return true;

    return (player.name || "").toLowerCase().includes(search);
  });

  leaderboardCountEl.textContent = `${filteredPlayers.length} player${filteredPlayers.length === 1 ? "" : "s"}`;

  if (filteredPlayers.length === 0) {
    leaderboardBodyEl.innerHTML = `
      <tr>
        <td colspan="6" class="empty">No players found.</td>
      </tr>
    `;
    return;
  }

  leaderboardBodyEl.innerHTML = filteredPlayers
    .map(player => {
      const trueRank = allPlayers.findIndex(p => p.nameKey === player.nameKey) + 1;

      return `
        <tr>
          <td class="rank">#${trueRank}</td>
          <td>${player.name}</td>
          <td class="score">${formatNumber(player.totalScore)}</td>
          <td>${formatNumber(player.wins)}</td>
          <td>${formatNumber(player.gamesPlayed)}</td>
          <td class="muted">${formatDate(player.lastPlayed)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderLiveGame(game = {}) {
  const phase = game.phase || "Waiting";
  const playersObj = game.players || {};
  const livePlayers = getSortedLivePlayers(playersObj);
  const liveTop5 = livePlayers.slice(0, 5);

  livePlayersCountEl.textContent = livePlayers.length;
  livePhaseEl.textContent = phase;
  liveTimerEl.textContent = formatTime(game.timer || 0);

  if (game.phase === "question" || game.phase === "reveal") {
    liveQuestionEl.textContent = game.question || "Question loading...";
  } else if (game.phase === "final") {
    liveQuestionEl.textContent = "Final scoreboard";
  } else if (game.phase === "join") {
    liveQuestionEl.textContent = "Players joining";
  } else if (game.phase === "waiting") {
    liveQuestionEl.textContent = "Waiting for next trivia slide";
  } else {
    liveQuestionEl.textContent = "—";
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

  allPlayers = getSortedPlayers(claimedObj);

  const scoredPlayers = allPlayers.filter(player => (player.totalScore || 0) > 0);

  namedPlayersCountEl.textContent = allPlayers.length;
  scoredPlayersCountEl.textContent = scoredPlayers.length;
  savedRoundsCountEl.textContent = Object.keys(savedRoundsObj).length;

  renderLiveGame(game);
  renderLeaderboard();

  lastUpdatedEl.textContent = `Updated ${new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  })}`;
}

leaderboardSearchEl.addEventListener("input", renderLeaderboard);
refreshBtn.addEventListener("click", loadStats);

gameRef.on("value", snap => {
  renderLiveGame(snap.val() || {});
});

claimedNamesRef.on("value", snap => {
  allPlayers = getSortedPlayers(snap.val() || {});

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
  savedRoundsCountEl.textContent = Object.keys(snap.val() || {}).length;
});

loadStats();
