// Grumpy's Christmas theme: schedule, holiday round colors, snow, string lights and party effects.
// Load right after round-themes.js. shared-theme.js turns the theme on and off (body.theme-christmas).
(() => {
  // ---------- When Christmas is on ----------
  // From the day after Thanksgiving through December 26 (Minnesota time). Off on December 27.
  function chicagoDate(date) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
      const get = type => Number(parts.find(p => p.type === type).value);
      return { year: get("year"), month: get("month"), day: get("day") };
    } catch {
      return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
    }
  }

  // Thanksgiving is the fourth Thursday of November.
  function thanksgivingDay(year) {
    const firstWeekday = new Date(Date.UTC(year, 10, 1)).getUTCDay();
    return 1 + ((4 - firstWeekday + 7) % 7) + 21;
  }

  function isChristmasSeason(date = new Date()) {
    const { year, month, day } = chicagoDate(date);
    if (month === 11) return day >= thanksgivingDay(year) + 1;
    if (month === 12) return day <= 26;
    return false;
  }

  window.GrumpysHoliday = { isChristmasSeason, thanksgivingDay };

  // ---------- Holiday round colors ----------
  // Same shape as round-themes.js. "special" adds candy-cane stripes or multicolor lights.
  const CHRISTMAS_THEMES = [
    { name: "Cranberry",    accent: "#ff4058", hot: "#ffb0ba", rgb: "255 64 88",   rgb2: "46 190 110", ribbon: "#ffd45e" },
    { name: "Evergreen",    accent: "#34d17c", hot: "#aaf0c9", rgb: "52 209 124",  rgb2: "255 64 88" },
    { name: "Gold Star",    accent: "#ffc94a", hot: "#ffe8a8", rgb: "255 201 74",  rgb2: "214 40 64" },
    { name: "Frost",        accent: "#86d8ff", hot: "#dff4ff", rgb: "134 216 255", rgb2: "200 225 255" },
    { name: "Candy Cane",   accent: "#ff3b52", hot: "#ffd6db", rgb: "255 59 82",   rgb2: "255 255 255", special: "candy", ribbon: "#ffd45e" },
    { name: "Tree Lights",  accent: "#ffcf3f", hot: "#fff0b0", rgb: "255 207 63",  rgb2: "60 130 255",  special: "lights" },
    { name: "Silver Bells", accent: "#cfdcea", hot: "#ffffff", rgb: "207 220 234", rgb2: "255 201 74" },
    { name: "Poinsettia",   accent: "#ff5470", hot: "#ffc1cc", rgb: "255 84 112",  rgb2: "255 201 74", ribbon: "#ffd45e" },
    { name: "Holly",        accent: "#5fe08f", hot: "#c4f7d6", rgb: "95 224 143",  rgb2: "255 70 70" },
    { name: "Snowfall",     accent: "#b8e6ff", hot: "#ffffff", rgb: "184 230 255", rgb2: "120 140 255" }
  ];
  window.GRUMPYS_CHRISTMAS_THEMES = CHRISTMAS_THEMES;

  const hash = (key, salt = "") => [...(String(key) + salt)].reduce((total, ch) => (total * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const isActive = () => Boolean(document.body && document.body.classList.contains("theme-christmas"));

  // How hard it snows changes from round to round.
  const SNOW_LEVELS = [
    { name: "Flurries", count: 45,  size: [1.2, 3.2], fall: [0.35, 0.8], wind: 0.15 },
    { name: "Light",    count: 95,  size: [1.4, 3.8], fall: [0.45, 1.0], wind: 0.25 },
    { name: "Steady",   count: 160, size: [1.6, 4.6], fall: [0.6, 1.35], wind: 0.4 },
    { name: "Heavy",    count: 260, size: [1.8, 5.6], fall: [0.8, 1.9],  wind: 0.75 }
  ];
  let snowLevel = 1;

  const basePick = window.pickGrumpysRoundTheme || (() => ({ accent: "#ff4255", hot: "#ff9eaa", rgb: "255 66 85", rgb2: "255 176 58" }));
  window.pickGrumpysRoundTheme = function pickWithChristmas(roundKey) {
    const key = String(roundKey || "grumpys");
    const root = document.documentElement;
    if (!isActive()) {
      delete root.dataset.xmasPalette;
      return basePick(key);
    }
    const theme = CHRISTMAS_THEMES[hash(key) % CHRISTMAS_THEMES.length];
    root.style.setProperty("--xmas-ribbon", theme.ribbon || "#e8192c");
    if (theme.special) root.dataset.xmasPalette = theme.special;
    else delete root.dataset.xmasPalette;
    // Heavy snow comes up most often; the lighter levels mix in now and then.
    const SNOW_ROLL = [0, 1, 2, 2, 3, 3, 3, 3];
    setSnowLevel(SNOW_ROLL[hash(key, "snow") % SNOW_ROLL.length]);
    return theme;
  };

  // ---------- Where decorations go ----------
  // TV and second screen (.screen), promo TV (.promo-screen), phones (body.pv). Arcade games only get colors.
  function decorSpot() {
    const tv = document.querySelector("main.screen");
    if (tv) return { kind: "tv", host: tv };
    const promo = document.querySelector("main.promo-screen");
    if (promo) return { kind: "promo", host: promo };
    if (document.body.classList.contains("pv")) return { kind: "phone", host: document.body };
    return null;
  }

  // ---------- Snow ----------
  let canvas = null, ctx = null, flakes = [], rafId = 0, lastTime = 0;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setSnowLevel(level) {
    snowLevel = Math.max(0, Math.min(SNOW_LEVELS.length - 1, level));
    if (canvas) canvas.dataset.level = SNOW_LEVELS[snowLevel].name;
  }

  function targetCount() {
    const spot = decorSpot();
    const base = SNOW_LEVELS[snowLevel].count;
    const area = (window.innerWidth * window.innerHeight) / (1920 * 1080);
    if (!spot) return 0;
    if (spot.kind === "phone") return Math.round(Math.min(base, 95) * 0.45);
    return Math.round(base * Math.max(0.5, Math.min(1.2, area * 1.4)) * (reduceMotion ? 0.4 : 1));
  }

  function makeFlake(spread) {
    const level = SNOW_LEVELS[snowLevel];
    const scale = Math.max(0.6, Math.min(1.6, window.innerHeight / 1080));
    const r = (level.size[0] + Math.random() * (level.size[1] - level.size[0])) * scale;
    return {
      x: Math.random() * window.innerWidth,
      y: spread ? Math.random() * window.innerHeight : -10 - Math.random() * 60,
      r,
      fall: (level.fall[0] + Math.random() * (level.fall[1] - level.fall[0])) * scale * (reduceMotion ? 0.5 : 1),
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.004 + Math.random() * 0.01,
      alpha: 0.45 + Math.random() * 0.5
    };
  }

  function sizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function tick(time) {
    rafId = requestAnimationFrame(tick);
    if (!ctx) return;
    // About 30 frames a second is plenty for snow and leaves the TV free for everything else.
    if (lastTime && time - lastTime < 30) return;
    const dt = Math.min(3, lastTime ? (time - lastTime) / 16.7 : 1);
    lastTime = time;
    const level = SNOW_LEVELS[snowLevel];
    const want = targetCount();
    if (flakes.length < want) for (let i = 0; i < Math.min(4, want - flakes.length); i++) flakes.push(makeFlake(false));
    if (flakes.length > want) flakes.splice(0, Math.min(3, flakes.length - want));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    for (const f of flakes) {
      f.sway += f.swaySpeed * dt;
      f.y += f.fall * dt;
      f.x += (Math.sin(f.sway) * 0.45 + level.wind) * dt;
      if (f.y - f.r > canvas.height) { Object.assign(f, makeFlake(false)); }
      if (f.x > canvas.width + 10) f.x = -10;
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function startSnow(spot) {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.className = "xmas-snow";
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.level = SNOW_LEVELS[snowLevel].name;
    const atmosphere = document.querySelector(".atmosphere, .pv-atmosphere");
    if (atmosphere) atmosphere.after(canvas);
    else document.body.prepend(canvas);
    ctx = canvas.getContext("2d");
    sizeCanvas();
    flakes = [];
    for (let i = 0; i < targetCount(); i++) flakes.push(makeFlake(true));
    lastTime = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stopSnow() {
    cancelAnimationFrame(rafId);
    canvas?.remove();
    canvas = null; ctx = null; flakes = [];
  }

  // ---------- String lights ----------
  const BULB_COLORS = ["#ff3b4e", "#34d17c", "#4b8bff", "#ffc94a", "#ff8a2a", "#c86bff"];
  let lightsEl = null;

  function buildLights(kind) {
    const width = kind === "phone" ? window.innerWidth : (lightsEl?.parentElement?.clientWidth || window.innerWidth);
    const u = kind === "phone" ? 0.42 : Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const span = (kind === "phone" ? 300 : 170) * u;
    const sag = (kind === "phone" ? 34 : 30) * u;
    const top = 6 * u;
    const bulbH = (kind === "phone" ? 44 : 44) * u;
    const height = Math.ceil(top + sag + bulbH + 14 * u);
    const swings = Math.max(2, Math.round(width / span));
    const step = width / swings;

    let wire = `M0 ${top}`;
    let bulbs = "";
    let n = 0;
    for (let i = 0; i < swings; i++) {
      const x0 = i * step, x1 = x0 + step;
      wire += ` Q${x0 + step / 2} ${top + sag * 2} ${x1} ${top}`;
      // Three bulbs on each swing of wire.
      [0.25, 0.5, 0.75].forEach(t => {
        const x = x0 + step * t;
        const y = top + 2 * t * (1 - t) * sag * 2;
        const slope = (1 - 2 * t) * sag * 4 / step;
        const angle = Math.atan(slope) * 180 / Math.PI * -0.6 + (hash(n, "tilt") % 16 - 8);
        const color = BULB_COLORS[n % BULB_COLORS.length];
        const delay = (hash(n, "blink") % 2400) / 1000;
        bulbs += `<g class="xmas-bulb" style="--c:${color};--d:${delay}s" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${(bulbH / 34).toFixed(3)})">
          <circle class="glow" cx="0" cy="22" r="22" fill="${color}"></circle>
          <rect x="-5" y="0" width="10" height="9" rx="2" fill="#1d3a26"></rect>
          <path class="glass" d="M-7 8 C-12 16 -9 28 0 34 C9 28 12 16 7 8 Z" fill="${color}"></path>
          <path d="M-3 12 C-6 17 -5 23 -2 26" stroke="rgba(255,255,255,.65)" stroke-width="2.2" fill="none" stroke-linecap="round"></path>
        </g>`;
        n++;
      });
    }
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <path d="${wire}" fill="none" stroke="#173322" stroke-width="${Math.max(1.5, 3 * u)}"></path>${bulbs}</svg>`;
  }

  function startLights(spot) {
    if (lightsEl) return;
    lightsEl = document.createElement("div");
    lightsEl.className = `xmas-lights xmas-lights-${spot.kind}`;
    lightsEl.setAttribute("aria-hidden", "true");
    if (spot.kind === "phone") document.body.append(lightsEl);
    else spot.host.prepend(lightsEl);
    lightsEl.innerHTML = buildLights(spot.kind);
    // Pieces for the "QUESTION 3" pop-ups (ornaments, ribbon, gift lid).
    const bumper = document.getElementById("questionBumper");
    if (bumper && !bumper.querySelector(".xmas-bumper-art")) {
      const art = document.createElement("div");
      art.className = "xmas-bumper-art";
      art.innerHTML = '<span class="o1"></span><span class="o2"></span><span class="o3"></span><span class="bow"></span><span class="sleigh">' + SLEIGH_ART + '</span>';
      bumper.prepend(art);
    }
  }

  function stopLights() {
    lightsEl?.remove();
    lightsEl = null;
  }

  // Santa's sleigh for the sixth "QUESTION" pop-up (drawn here so it needs no image file).
  const SLEIGH_ART = `<svg class="sleigh-art" viewBox="0 0 900 300" aria-hidden="true"><g stroke-linecap="round" stroke-linejoin="round"><path d="M222 233 L-130 324 M500 233 L1030 324" stroke="#e9c36a" stroke-width="5" fill="none"/><g class="trail" fill="#ffd45e"><circle cx="180" cy="150" r="6"/><circle cx="130" cy="190" r="5"/><circle cx="80" cy="140" r="4"/><circle cx="40" cy="200" r="3.5"/><circle cx="0" cy="160" r="3"/></g><g transform="translate(200 40) scale(1.15)"><ellipse cx="80" cy="60" rx="40" ry="34" fill="#2a8a4a" stroke="#123d22" stroke-width="4"/><path d="M72 28 Q80 16 90 28" stroke="#ffd45e" stroke-width="5" fill="none"/><path d="M112 70 Q114 32 150 30 Q186 32 188 70 Z" fill="#e01b33" stroke="#7a0a18" stroke-width="3"/><circle cx="150" cy="12" r="19" fill="#f4c7a1"/><path d="M131 14 Q132 46 150 50 Q168 46 169 14 Q160 26 150 26 Q140 26 131 14 Z" fill="#fff" stroke="#d9d4cc" stroke-width="2"/><path d="M131 2 Q148 -26 178 -14 Q170 -4 169 6 Z" fill="#e01b33" stroke="#7a0a18" stroke-width="3"/><rect x="128" y="-2" width="44" height="10" rx="5" fill="#fff"/><circle cx="180" cy="-14" r="7" fill="#fff"/><circle cx="143" cy="10" r="2.4" fill="#2a1a14"/><circle cx="157" cy="10" r="2.4" fill="#2a1a14"/><circle cx="150" cy="17" r="3.5" fill="#e8907a"/><path d="M186 48 Q208 30 214 8" stroke="#e01b33" stroke-width="12" fill="none"/><circle cx="215" cy="4" r="8" fill="#2a8a4a" stroke="#123d22" stroke-width="2.5"/><path d="M18 62 L252 62 Q290 62 292 34 Q294 16 312 18 Q328 22 320 38 Q306 34 304 54 Q300 132 238 142 L62 142 Q22 142 18 62 Z" fill="#d4142e" stroke="#6d0814" stroke-width="4"/><path d="M28 98 L292 98" stroke="#ffd45e" stroke-width="7"/><path d="M70 142 L70 166 M206 142 L206 166" stroke="#ffd45e" stroke-width="6"/><path d="M4 168 L250 168 Q300 168 312 138" stroke="#ffd45e" stroke-width="7" fill="none"/></g><path d="M556 66 L692 168 M556 66 L842 138" stroke="#8a5a2a" stroke-width="3.5" fill="none"/><g transform="translate(590 110)"><g class="deer"><ellipse cx="70" cy="70" rx="55" ry="24" fill="#8b5a35" stroke="#4a2c16" stroke-width="3"/><path d="M108 60 Q122 40 128 30 L142 36 Q132 54 122 72 Z" fill="#8b5a35" stroke="#4a2c16" stroke-width="3"/><ellipse cx="140" cy="30" rx="18" ry="12" fill="#8b5a35" stroke="#4a2c16" stroke-width="3"/><ellipse cx="157" cy="34" rx="9" ry="7" fill="#b07c4f"/><circle cx="165" cy="33" r="4" fill="#2b1a10"/><circle cx="141" cy="26" r="2.6" fill="#111"/><path d="M134 20 L128 2 M130 10 L121 5 M142 19 L148 0 M145 8 L154 4" stroke="#e8c58b" stroke-width="5" fill="none"/><path d="M106 84 L126 100 L134 95 M96 88 L110 108" stroke="#5e3a1e" stroke-width="7" fill="none"/><path d="M34 82 L14 96 L6 91 M46 88 L32 108" stroke="#5e3a1e" stroke-width="7" fill="none"/><ellipse cx="16" cy="60" rx="8" ry="6" fill="#f3e6d6"/><path d="M98 50 L102 92" stroke="#ffd45e" stroke-width="6"/><circle cx="102" cy="95" r="6" fill="#ffd45e"/></g></g><g transform="translate(740 80)"><g class="deer deer2"><ellipse cx="70" cy="70" rx="55" ry="24" fill="#94603a" stroke="#4a2c16" stroke-width="3"/><path d="M108 60 Q122 40 128 30 L142 36 Q132 54 122 72 Z" fill="#94603a" stroke="#4a2c16" stroke-width="3"/><ellipse cx="140" cy="30" rx="18" ry="12" fill="#94603a" stroke="#4a2c16" stroke-width="3"/><ellipse cx="157" cy="34" rx="9" ry="7" fill="#b07c4f"/><circle cx="165" cy="33" r="4" fill="#2b1a10"/><circle cx="141" cy="26" r="2.6" fill="#111"/><path d="M134 20 L128 2 M130 10 L121 5 M142 19 L148 0 M145 8 L154 4" stroke="#e8c58b" stroke-width="5" fill="none"/><path d="M106 84 L126 100 L134 95 M96 88 L110 108" stroke="#5e3a1e" stroke-width="7" fill="none"/><path d="M34 82 L14 96 L6 91 M46 88 L32 108" stroke="#5e3a1e" stroke-width="7" fill="none"/><ellipse cx="16" cy="60" rx="8" ry="6" fill="#f3e6d6"/><path d="M98 50 L102 92" stroke="#ffd45e" stroke-width="6"/><circle cx="102" cy="95" r="6" fill="#ffd45e"/></g></g></g></svg>`;

  // ---------- Christmas logo ----------
  const LOGO_SELECTOR = "#brandLogo, #promoBrandLogo, .seasonal-phone-logo";
  function swapLogos(on) {
    document.querySelectorAll(LOGO_SELECTOR).forEach(img => {
      if (on) {
        if (!img.dataset.plainSrc) { img.dataset.plainSrc = img.getAttribute("src"); img.dataset.plainAlt = img.alt; }
        img.src = "christmas-logo.png?v=1";
        img.alt = "Grumpy's Christmas logo";
      } else if (img.dataset.plainSrc) {
        img.src = img.dataset.plainSrc;
        img.alt = img.dataset.plainAlt || img.alt;
        delete img.dataset.plainSrc;
      }
    });
  }

  // ---------- Party effects ----------
  // A burst of snow from the correct answer on the TV.
  function snowBurst(el) {
    if (!isActive() || !el) return;
    const box = el.getBoundingClientRect();
    const layer = document.createElement("div");
    layer.className = "xmas-burst";
    layer.setAttribute("aria-hidden", "true");
    const u = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    for (let i = 0; i < 46; i++) {
      const piece = document.createElement("i");
      const angle = Math.random() * Math.PI * 2;
      const dist = (140 + Math.random() * 360) * u;
      piece.style.left = `${box.left + Math.random() * box.width}px`;
      piece.style.top = `${box.top + Math.random() * box.height}px`;
      piece.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      piece.style.setProperty("--dy", `${Math.sin(angle) * dist * 0.7 - 60 * u}px`);
      piece.style.setProperty("--s", `${(6 + Math.random() * 12) * u}px`);
      piece.style.animationDelay = `${Math.random() * 0.15}s`;
      if (i % 4 === 0) piece.className = "star";
      layer.append(piece);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 2200);
  }

  // A different "QUESTION 3" pop-up for each question, the same on the TV and second screen.
  const BUMPER_STYLES = ["ornament", "tag", "gift", "candycane", "marquee", "sleigh"];
  function bumperStyle(key) {
    return isActive() ? BUMPER_STYLES[hash(key, "bumper") % BUMPER_STYLES.length] : "";
  }

  // ---------- Turning it on and off ----------
  let on = false;
  function setActive(next) {
    if (next === on) return;
    on = next;
    const spot = decorSpot();
    if (on && spot) { startSnow(spot); startLights(spot); }
    if (!on) { stopSnow(); stopLights(); }
    swapLogos(on);
    // Each page re-colors its current round with the right set of colors.
    if (typeof window.grumpysReapplyRoundTheme === "function") window.grumpysReapplyRoundTheme();
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      sizeCanvas();
      const spot = decorSpot();
      if (lightsEl && spot) lightsEl.innerHTML = buildLights(spot.kind);
    }, 200);
  });

  function hookUp() {
    if (window.GrumpysAppearance) {
      window.GrumpysAppearance.subscribe(() => setActive(isActive()));
    }
    setActive(isActive());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hookUp);
  else setTimeout(hookUp, 0);

  window.GrumpysChristmas = {
    isActive,
    snowBurst,
    bumperStyle,
    setSnowLevel,
    snowLevelName: () => SNOW_LEVELS[snowLevel].name,
    // For previews and testing.
    _levels: SNOW_LEVELS
  };
})();
