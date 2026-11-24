// Trivia alerts inside the arcade games (Higher or Lower, Stacker, Emoji Decoder).
// When a trivia round starts, a banner slides down with Join trivia / Keep playing.
// Keep playing shrinks it to a small pill that stays at the top for the round.
// It never takes anyone out of their game on its own, and never writes to Firebase.
//
// Load it after firebase-config.js and round-themes.js:
//   <script src="trivia-alert.js?v=1" data-game="Stacker"></script>
(() => {
  if (typeof db === "undefined") return;

  const gameName = (document.currentScript && document.currentScript.dataset.game) || "this game";
  const triviaUrl = "play.html?game=trivia";
  const dismissKey = "grumpysTriviaAlertDismissed";

  const style = document.createElement("style");
  style.textContent = `
    .ta-shade{position:fixed;inset:0;z-index:9998;background:rgba(4,4,6,.74);opacity:0;pointer-events:none;transition:opacity .35s ease}
    .ta-shade.is-on{opacity:1;pointer-events:auto}
    .ta-banner{position:fixed;z-index:9999;left:50%;top:14px;width:min(calc(100% - 24px),440px);box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:18px;border-radius:24px;
      border:2px solid var(--ta-accent);background:linear-gradient(160deg,rgb(var(--ta-rgb) / .24),rgb(var(--ta-rgb) / 0) 65%),#100e0e;
      box-shadow:0 18px 60px rgba(0,0,0,.6),0 0 40px rgb(var(--ta-rgb) / .4);color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
      transform:translate(-50%,-130%);transition:transform .55s cubic-bezier(.2,1.25,.4,1)}
    .ta-banner.is-on{transform:translate(-50%,0)}
    .ta-top{display:flex;align-items:center;justify-content:space-between}
    .ta-live{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:#ff4255;font-size:12px;font-weight:900;letter-spacing:.14em}
    .ta-live i,.ta-pill i{width:8px;height:8px;border-radius:50%;background:#fff;animation:taBlink 1.4s ease-in-out infinite}
    .ta-logo{width:36px;height:36px;border-radius:8px;background:#fff8ee;padding:2px;box-sizing:border-box;object-fit:contain}
    .ta-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .ta-title{margin:0;font-size:25px;font-weight:900;line-height:1.1}
    .ta-sub{margin-top:4px;font-size:14px;font-weight:700;color:#d6d0c7}
    .ta-count{font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;font-size:56px;font-weight:900;line-height:.9;color:var(--ta-accent);font-variant-numeric:tabular-nums}
    .ta-count.hurry{animation:taHurry 1s ease-in-out infinite}
    .ta-join,.ta-keep{display:flex;align-items:center;justify-content:center;border-radius:16px;font-family:inherit;cursor:pointer;text-decoration:none}
    .ta-join{height:56px;border:0;background:var(--ta-accent);color:#0b0909;font-size:18px;font-weight:900}
    .ta-keep{height:46px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.05);color:#fff;font-size:15px;font-weight:800;border-radius:14px}
    .ta-note{font-size:12px;font-weight:600;color:#b9b3aa;text-align:center}
    .ta-pill{position:fixed;z-index:9997;left:50%;top:12px;display:flex;align-items:center;gap:10px;height:44px;padding:0 8px 0 14px;box-sizing:border-box;border-radius:999px;
      border:2px solid var(--ta-accent);background:rgba(12,10,10,.92);box-shadow:0 6px 24px rgba(0,0,0,.5),0 0 24px rgb(var(--ta-rgb) / .4);color:#fff;white-space:nowrap;
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;font-weight:900;text-decoration:none;
      transform:translate(-50%,-90px);transition:transform .5s cubic-bezier(.2,1.3,.4,1)}
    .ta-pill.is-on{transform:translate(-50%,0)}
    .ta-pill i{background:#ff4255;box-shadow:0 0 10px #ff4255}
    .ta-pill b{display:flex;align-items:center;height:30px;padding:0 12px;border-radius:999px;background:var(--ta-accent);color:#0b0909;font-size:13px}
    body{transition:padding-top .4s ease}
    body.ta-has-pill{padding-top:62px}
    @keyframes taBlink{50%{opacity:.35}}
    @keyframes taHurry{50%{transform:scale(1.08)}}
    @media(prefers-reduced-motion:reduce){.ta-banner,.ta-pill,.ta-shade{transition:none}.ta-count.hurry,.ta-live i,.ta-pill i{animation:none}}
  `;
  document.head.appendChild(style);

  const shade = document.createElement("div");
  shade.className = "ta-shade";
  shade.setAttribute("aria-hidden", "true");

  const banner = document.createElement("section");
  banner.className = "ta-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-labelledby", "taTitle");
  banner.innerHTML = `
    <div class="ta-top"><div class="ta-live"><i></i>LIVE TRIVIA</div><img class="ta-logo" src="assets/grumpys-logo.png" alt="Grumpy's St. Boni logo"></div>
    <div class="ta-row">
      <div><h2 id="taTitle" class="ta-title">Trivia is starting!</h2><div class="ta-sub"></div></div>
      <div class="ta-count">0:30</div>
    </div>
    <a class="ta-join" href="${triviaUrl}">Join trivia</a>
    <button type="button" class="ta-keep"></button>
    <div class="ta-note"></div>
  `;
  banner.querySelector(".ta-keep").textContent = `Keep playing ${gameName}`;
  banner.querySelector(".ta-note").textContent = `Your ${gameName} score saves when this run ends.`;

  const pill = document.createElement("a");
  pill.className = "ta-pill";
  pill.href = triviaUrl;
  pill.innerHTML = '<i></i><span></span><b>Join ›</b>';

  const subEl = banner.querySelector(".ta-sub");
  const countEl = banner.querySelector(".ta-count");
  const pillText = pill.querySelector("span");

  let themeKey = null;

  function applyTheme(roundId) {
    if (!roundId || roundId === themeKey || !window.pickGrumpysRoundTheme) return;
    themeKey = roundId;
    const theme = window.pickGrumpysRoundTheme(roundId);
    document.documentElement.style.setProperty("--ta-accent", theme.accent);
    document.documentElement.style.setProperty("--ta-rgb", theme.rgb);
  }
  document.documentElement.style.setProperty("--ta-accent", "#4aa8ff");
  document.documentElement.style.setProperty("--ta-rgb", "74 168 255");

  function dismissedFor(roundId) {
    try { return sessionStorage.getItem(dismissKey) === String(roundId); } catch { return false; }
  }

  function dismiss(roundId) {
    try { sessionStorage.setItem(dismissKey, String(roundId)); } catch {}
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  function showBanner(on) {
    banner.classList.toggle("is-on", on);
    shade.classList.toggle("is-on", on);
  }

  let currentRound = null;

  banner.querySelector(".ta-keep").addEventListener("click", () => {
    dismiss(currentRound);
    showBanner(false);
    render(lastGame);
  });

  let lastGame = {};

  function render(game = {}) {
    lastGame = game;
    currentRound = game.roundId;
    applyTheme(game.roundId);

    const phase = game.phase;
    const live = phase === "join" || phase === "question" || phase === "reveal";
    const players = Object.keys(game.players || {}).length;

    if (!live) {
      showBanner(false);
      pill.classList.remove("is-on");
      document.body.classList.remove("ta-has-pill");
      return;
    }

    if (phase === "join") {
      subEl.textContent = players > 0 ? `${players} ${players === 1 ? "player" : "players"} in · starts in` : "Round starts in";
      countEl.textContent = formatTime(game.timer);
      countEl.classList.toggle("hurry", Number(game.timer) <= 10);
      pillText.textContent = `Trivia starts in ${formatTime(game.timer)}`;
    } else {
      const total = Number(game.questionCount) || 6;
      const current = (Number.isInteger(game.questionIndex) ? game.questionIndex : 0) + 1;
      pillText.textContent = `Trivia live · Q${current} of ${total}`;
    }

    // The banner only pops when a round is starting; mid-round it is just the pill.
    const wantsBanner = phase === "join" && !dismissedFor(game.roundId);
    showBanner(wantsBanner);
    pill.classList.toggle("is-on", !wantsBanner);
    // Make room for the pill so it never covers the top of the game.
    document.body.classList.toggle("ta-has-pill", !wantsBanner);
  }

  function mount() {
    document.body.append(shade, banner, pill);
    db.ref("games/main").on("value", snap => render(snap.val() || {}));
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
