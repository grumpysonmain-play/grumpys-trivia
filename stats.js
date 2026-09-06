const claimedNamesRef = db.ref("claimedNames");
const savedRoundsRef = db.ref("savedRounds");
const gameRef = db.ref("games/main");
const higherPlayersRef = db.ref("higherLower/players");
const stackerPlayersRef = db.ref("stacker/players");
const emojiPlayersRef = db.ref("emojiDecoder/players");
const gatewayOrderRef = db.ref("settings/gatewayOrder");

const DEFAULT_GATEWAY_ORDER = ["trivia", "higher-lower", "stacker", "emoji-decoder"];
const GAME_DETAILS = {
  trivia: { name: "Live Trivia", detail: "Main event", icon: "?", color: "#ff4058" },
  "higher-lower": { name: "Higher or Lower", detail: "Streak game", icon: "↕", color: "#3bdb88" },
  stacker: { name: "Stacker", detail: "Arcade timing game", icon: "▤", color: "#38dff5" },
  "emoji-decoder": { name: "Emoji Decoder", detail: "Movie, TV & song clues", icon: "☺", color: "#ff9a42" }
};

const byId = id => document.getElementById(id);
const refreshBtn = byId("refreshBtn");
const lastUpdatedEl = byId("lastUpdated");
const leaderboardBodyEl = byId("leaderboardBody");
const leaderboardSearchEl = byId("leaderboardSearch");
const sortSelectEl = byId("sortSelect");
const sortDirectionEl = byId("sortDirection");
const gatewayOrderListEl = byId("gatewayOrderList");
const gatewayPreviewListEl = byId("gatewayPreviewList");
const orderSaveStatusEl = byId("orderSaveStatus");
const saveOrderBtn = byId("saveOrderBtn");
const resetOrderBtn = byId("resetOrderBtn");

let allPlayers = [];
let currentFilter = "all";
let currentLiveGame = {};
let currentSavedRounds = {};
let statsCountdownInterval = null;
let statsCountdownTarget = null;
let gatewayOrderDraft = [...DEFAULT_GATEWAY_ORDER];

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${Number(count) === 1 ? singular : plural}`;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safeSeconds / 60)}:${Math.floor(safeSeconds % 60).toString().padStart(2, "0")}`;
}

function formatCountdownFromMs(ms) {
  return formatTime(Math.max(0, Math.ceil(ms / 1000)));
}

function formatDate(timestamp, short = false) {
  if (!timestamp) return "—";
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], short
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function updateTimestamp() {
  lastUpdatedEl.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
}

function showPanel(panelName) {
  document.querySelectorAll(".dashboard-tab").forEach(button => button.classList.toggle("active", button.dataset.panel === panelName));
  document.querySelectorAll(".dashboard-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panelContent === panelName));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cleanDisplayName(name) {
  return String(name || "").trim().replace(/[^a-zA-Z0-9 '\-.]/g, "").replace(/\s+/g, " ").slice(0, 15);
}

function getTriviaPlayers(playersObj = {}) {
  return Object.entries(playersObj).map(([nameKey, profile]) => ({
    nameKey,
    playerId: profile.playerId || null,
    name: profile.displayName || nameKey,
    totalScore: Number(profile.totalScore) || 0,
    wins: Number(profile.wins) || 0,
    gamesPlayed: Number(profile.gamesPlayed) || 0,
    lastPlayed: profile.lastPlayed || null
  }));
}

function getAvgScore(player) {
  return player.gamesPlayed ? Math.round(player.totalScore / player.gamesPlayed) : 0;
}

function getRankedTrivia(players = allPlayers) {
  return [...players].sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins || a.name.localeCompare(b.name));
}

function sortTriviaPlayers(players) {
  const sortBy = sortSelectEl.value;
  const direction = sortDirectionEl.value === "asc" ? 1 : -1;
  return [...players].sort((a, b) => {
    if (sortBy === "name") return direction * a.name.localeCompare(b.name);
    const values = {
      score: [a.totalScore, b.totalScore], wins: [a.wins, b.wins], games: [a.gamesPlayed, b.gamesPlayed],
      average: [getAvgScore(a), getAvgScore(b)], recent: [a.lastPlayed || 0, b.lastPlayed || 0]
    }[sortBy] || [a.totalScore, b.totalScore];
    return values[0] === values[1] ? a.name.localeCompare(b.name) : direction * (values[0] - values[1]);
  });
}

function renderTriviaLeaderboard() {
  const search = leaderboardSearchEl.value.trim().toLowerCase();
  const ranked = getRankedTrivia();
  let players = allPlayers.filter(player => {
    if (currentFilter === "recent" && !player.lastPlayed) return false;
    if (currentFilter === "inactive" && player.gamesPlayed && player.totalScore) return false;
    return !search || player.name.toLowerCase().includes(search);
  });
  players = sortTriviaPlayers(players);
  byId("leaderboardCount").textContent = pluralize(players.length, "player");
  if (!players.length) {
    leaderboardBodyEl.innerHTML = '<tr><td colspan="8" class="empty-state">No players found.</td></tr>';
    return;
  }
  leaderboardBodyEl.innerHTML = players.map(player => {
    const rank = ranked.findIndex(item => item.nameKey === player.nameKey) + 1;
    return `<tr><td class="rank-cell">#${rank}</td><td>${escapeHtml(player.name)}</td><td class="score-cell">${formatNumber(player.totalScore)}</td><td>${formatNumber(player.wins)}</td><td>${formatNumber(player.gamesPlayed)}</td><td>${formatNumber(getAvgScore(player))}</td><td class="muted">${formatDate(player.lastPlayed)}</td><td><button class="rename-btn" data-name-key="${escapeHtml(player.nameKey)}" data-current-name="${escapeHtml(player.name)}" type="button">Rename</button></td></tr>`;
  }).join("");
}

function renderTriviaPlayers(playersObj = {}) {
  allPlayers = getTriviaPlayers(playersObj);
  byId("namedPlayersCount").textContent = formatNumber(allPlayers.length);
  byId("scoredPlayersCount").textContent = formatNumber(allPlayers.filter(player => player.totalScore > 0).length);
  byId("overviewTriviaPlayers").textContent = pluralize(allPlayers.length, "player");
  renderTriviaLeaderboard();
  updateTimestamp();
}

function getSortedLivePlayers(playersObj = {}) {
  return Object.values(playersObj).sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || String(a.name || "").localeCompare(String(b.name || "")));
}

function stopStatsCountdown() {
  if (statsCountdownInterval) clearInterval(statsCountdownInterval);
  statsCountdownInterval = null;
  statsCountdownTarget = null;
}

function startStatsCountdown(targetTime) {
  if (!targetTime) return stopStatsCountdown();
  const render = () => {
    const remaining = Number(targetTime) - Date.now();
    const text = formatCountdownFromMs(remaining);
    byId("liveTimer").textContent = text;
    byId("liveQuestion").textContent = remaining <= 0 ? "Next round should be returning soon." : `Next round expected in ${text}`;
  };
  render();
  if (statsCountdownTarget === targetTime && statsCountdownInterval) return;
  stopStatsCountdown();
  statsCountdownTarget = targetTime;
  statsCountdownInterval = setInterval(render, 1000);
}

function renderLiveGame(game = {}) {
  currentLiveGame = game;
  const phase = game.phase || "waiting";
  const livePlayers = getSortedLivePlayers(game.players || {});
  byId("livePhase").textContent = phase;
  byId("livePlayersCount").textContent = formatNumber(livePlayers.length);
  byId("triviaLivePlayersCount").textContent = formatNumber(livePlayers.length);
  if ((phase === "waiting" || phase === "final") && game.nextRoundExpectedAt) {
    startStatsCountdown(Number(game.nextRoundExpectedAt));
  } else {
    stopStatsCountdown();
    byId("liveTimer").textContent = formatTime(game.timer || 0);
    byId("liveQuestion").textContent = phase === "question" || phase === "reveal" ? game.question || "Question loading…" : phase === "join" ? "Players are joining the round." : "Waiting for the next round.";
  }
  byId("liveTop5").innerHTML = livePlayers.length ? livePlayers.slice(0, 5).map((player, index) => `<div class="compact-rank"><span>#${index + 1}</span><span>${escapeHtml(player.name || "Player")}</span><strong>${formatNumber(player.score)}</strong></div>`).join("") : '<div class="empty-state">No live players yet.</div>';
  updateTimestamp();
}

function renderSavedRoundStats(savedRoundsObj = {}) {
  currentSavedRounds = savedRoundsObj;
  const rounds = Object.values(savedRoundsObj);
  const guestPlays = rounds.reduce((sum, round) => sum + (Number(round.guestCount) || 0), 0);
  const namedPlays = rounds.reduce((sum, round) => sum + (Number(round.namedCount) || 0), 0);
  byId("savedRoundsCount").textContent = formatNumber(rounds.length);
  byId("guestPlaysCount").textContent = formatNumber(guestPlays);
  byId("namedPlaysCount").textContent = formatNumber(namedPlays);
  byId("overviewTriviaDetail").textContent = pluralize(rounds.length, "saved round");
  updateTimestamp();
}

function normalizeArcadePlayers(playersObj = {}, scoreField) {
  return Object.entries(playersObj).map(([id, player]) => ({ id, name: player.name || "Player", score: Number(player[scoreField]) || 0, updatedAt: player.updatedAt || null })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function renderArcadeStats(config, playersObj = {}) {
  const players = normalizeArcadePlayers(playersObj, config.scoreField);
  const topScore = players[0]?.score || 0;
  const average = players.length ? Math.round(players.reduce((sum, player) => sum + player.score, 0) / players.length) : 0;
  const latest = players.reduce((max, player) => Math.max(max, Number(player.updatedAt) || 0), 0);
  byId(`${config.prefix}PlayerCount`).textContent = formatNumber(players.length);
  byId(`${config.prefix}TopScore`).textContent = formatNumber(topScore);
  byId(`${config.prefix}Average`).textContent = formatNumber(average);
  byId(`${config.prefix}Latest`).textContent = formatDate(latest, true);
  byId(`${config.prefix}Count`).textContent = pluralize(players.length, "player");
  byId(config.overviewBest).textContent = config.overviewLabel(topScore);
  byId(config.overviewPlayers).textContent = pluralize(players.length, "player");
  const body = byId(`${config.prefix}Body`);
  body.innerHTML = players.length ? players.map((player, index) => `<tr><td class="rank-cell">#${index + 1}</td><td>${escapeHtml(player.name)}</td><td class="score-cell">${formatNumber(player.score)}</td><td class="muted">${formatDate(player.updatedAt)}</td></tr>`).join("") : '<tr><td colspan="4" class="empty-state">No saved scores yet.</td></tr>';
  updateTimestamp();
}

function sanitizeGatewayOrder(value) {
  const supplied = Array.isArray(value) ? value : [];
  const valid = supplied.filter((id, index) => GAME_DETAILS[id] && supplied.indexOf(id) === index);
  return [...valid, ...DEFAULT_GATEWAY_ORDER.filter(id => !valid.includes(id))];
}

function setOrderStatus(text, state = "") {
  orderSaveStatusEl.textContent = text;
  orderSaveStatusEl.className = `save-status${state ? ` ${state}` : ""}`;
}

function renderGatewayOrder() {
  gatewayOrderListEl.innerHTML = gatewayOrderDraft.map((id, index) => {
    const game = GAME_DETAILS[id];
    return `<div class="order-row" style="--game-color:${game.color}"><span class="order-number">${index + 1}</span><span class="order-game-icon">${game.icon}</span><span class="order-copy"><strong>${game.name}</strong><small>${game.detail.toUpperCase()}</small></span><span class="order-controls"><button class="move-button" data-move="up" data-game-id="${id}" ${index === 0 ? "disabled" : ""} type="button" aria-label="Move ${game.name} up">↑</button><button class="move-button" data-move="down" data-game-id="${id}" ${index === gatewayOrderDraft.length - 1 ? "disabled" : ""} type="button" aria-label="Move ${game.name} down">↓</button></span></div>`;
  }).join("");
  gatewayPreviewListEl.innerHTML = gatewayOrderDraft.map(id => {
    const game = GAME_DETAILS[id];
    return `<div class="preview-game" style="--game-color:${game.color}"><span>${game.icon}</span><div><strong>${game.name}</strong><small>${game.detail}</small></div></div>`;
  }).join("");
}

function moveGatewayGame(gameId, direction) {
  const from = gatewayOrderDraft.indexOf(gameId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= gatewayOrderDraft.length) return;
  [gatewayOrderDraft[from], gatewayOrderDraft[to]] = [gatewayOrderDraft[to], gatewayOrderDraft[from]];
  renderGatewayOrder();
  setOrderStatus("Unsaved changes", "changed");
}

async function saveGatewayOrder() {
  saveOrderBtn.disabled = true;
  setOrderStatus("Saving…", "changed");
  try {
    await gatewayOrderRef.set(gatewayOrderDraft);
    setOrderStatus("Saved live", "saved");
  } catch (error) {
    console.error("Gateway order save failed:", error);
    setOrderStatus("Save failed", "changed");
    alert("The order could not be saved. Add the settings/gatewayOrder permission to your Firebase rules, then try again.");
  } finally {
    saveOrderBtn.disabled = false;
  }
}

async function renamePlayer(nameKey, currentName) {
  if (!nameKey) return;
  const rawName = prompt(`Rename "${currentName}" to:`, currentName);
  if (rawName === null) return;
  const newName = cleanDisplayName(rawName);
  if (newName.length < 2) return alert("Name must be at least 2 characters.");
  if (!confirm(`Change display name from "${currentName}" to "${newName}"?`)) return;
  try {
    await claimedNamesRef.child(nameKey).update({ displayName: newName, renamedAt: Date.now() });
    const liveSnapshot = await gameRef.child("players").once("value");
    const updates = {};
    Object.entries(liveSnapshot.val() || {}).forEach(([id, player]) => { if (player.nameKey === nameKey) updates[`players/${id}/name`] = newName; });
    if (Object.keys(updates).length) await gameRef.update(updates);
  } catch (error) {
    console.error("Rename failed:", error);
    alert("Rename failed. Try again.");
  }
}

async function refreshAllStats() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  try {
    const snapshots = await Promise.all([claimedNamesRef.once("value"), savedRoundsRef.once("value"), gameRef.once("value"), higherPlayersRef.once("value"), stackerPlayersRef.once("value"), emojiPlayersRef.once("value")]);
    renderTriviaPlayers(snapshots[0].val() || {});
    renderSavedRoundStats(snapshots[1].val() || {});
    renderLiveGame(snapshots[2].val() || {});
    renderArcadeStats({ prefix: "higher", scoreField: "bestStreak", overviewBest: "overviewHigherBest", overviewPlayers: "overviewHigherPlayers", overviewLabel: score => `${formatNumber(score)} best streak` }, snapshots[3].val() || {});
    renderArcadeStats({ prefix: "stacker", scoreField: "bestLevel", overviewBest: "overviewStackerBest", overviewPlayers: "overviewStackerPlayers", overviewLabel: score => `Level ${formatNumber(score)} record` }, snapshots[4].val() || {});
    renderArcadeStats({ prefix: "emoji", scoreField: "bestScore", overviewBest: "overviewEmojiBest", overviewPlayers: "overviewEmojiPlayers", overviewLabel: score => `${formatNumber(score)} high score` }, snapshots[5].val() || {});
  } catch (error) {
    console.error("Stats refresh failed:", error);
    lastUpdatedEl.textContent = "Refresh failed";
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh";
  }
}

document.querySelectorAll(".dashboard-tab").forEach(button => button.addEventListener("click", () => showPanel(button.dataset.panel)));
document.querySelectorAll("[data-open-panel]").forEach(button => button.addEventListener("click", () => showPanel(button.dataset.openPanel)));
document.querySelectorAll(".player-filter-btn").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".player-filter-btn").forEach(item => item.classList.remove("active"));
  button.classList.add("active"); currentFilter = button.dataset.filter; renderTriviaLeaderboard();
}));
leaderboardSearchEl.addEventListener("input", renderTriviaLeaderboard);
sortSelectEl.addEventListener("change", renderTriviaLeaderboard);
sortDirectionEl.addEventListener("change", renderTriviaLeaderboard);
leaderboardBodyEl.addEventListener("click", event => { const button = event.target.closest(".rename-btn"); if (button) renamePlayer(button.dataset.nameKey, button.dataset.currentName); });
gatewayOrderListEl.addEventListener("click", event => { const button = event.target.closest(".move-button"); if (button) moveGatewayGame(button.dataset.gameId, button.dataset.move); });
resetOrderBtn.addEventListener("click", () => { gatewayOrderDraft = [...DEFAULT_GATEWAY_ORDER]; renderGatewayOrder(); setOrderStatus("Unsaved default", "changed"); });
saveOrderBtn.addEventListener("click", saveGatewayOrder);
refreshBtn.addEventListener("click", refreshAllStats);

claimedNamesRef.on("value", snapshot => renderTriviaPlayers(snapshot.val() || {}));
savedRoundsRef.on("value", snapshot => renderSavedRoundStats(snapshot.val() || {}));
gameRef.on("value", snapshot => renderLiveGame(snapshot.val() || {}));
higherPlayersRef.on("value", snapshot => renderArcadeStats({ prefix: "higher", scoreField: "bestStreak", overviewBest: "overviewHigherBest", overviewPlayers: "overviewHigherPlayers", overviewLabel: score => `${formatNumber(score)} best streak` }, snapshot.val() || {}));
stackerPlayersRef.on("value", snapshot => renderArcadeStats({ prefix: "stacker", scoreField: "bestLevel", overviewBest: "overviewStackerBest", overviewPlayers: "overviewStackerPlayers", overviewLabel: score => `Level ${formatNumber(score)} record` }, snapshot.val() || {}));
emojiPlayersRef.on("value", snapshot => renderArcadeStats({ prefix: "emoji", scoreField: "bestScore", overviewBest: "overviewEmojiBest", overviewPlayers: "overviewEmojiPlayers", overviewLabel: score => `${formatNumber(score)} high score` }, snapshot.val() || {}));
gatewayOrderRef.on("value", snapshot => { gatewayOrderDraft = sanitizeGatewayOrder(snapshot.val()); renderGatewayOrder(); setOrderStatus(snapshot.exists() ? "Saved live" : "Using default", snapshot.exists() ? "saved" : ""); }, error => { console.warn("Gateway order could not be loaded:", error); gatewayOrderDraft = [...DEFAULT_GATEWAY_ORDER]; renderGatewayOrder(); setOrderStatus("Rules needed", "changed"); });

renderGatewayOrder();
