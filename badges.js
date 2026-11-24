// Custom badges for Player of the Month (a ribbon rosette in that month's colors with its own picture)
// and Player of the Year (a gold medal with laurels). Drawn as SVG so they're sharp at any size.
(function () {
  const MONTHS = [
    // short name, main color, dark color, light color, picture
    ["JAN", "#4fa8e8", "#1d4f86", "#e3f3ff", "snowflake"],
    ["FEB", "#e8456b", "#8e1838", "#ffe3ea", "heart"],
    ["MAR", "#2fb35a", "#166b33", "#e2f8e7", "shamrock"],
    ["APR", "#43b9c7", "#1b6874", "#e0f7f9", "raindrop"],
    ["MAY", "#c46fd8", "#6e2a85", "#f6e6fb", "flower"],
    ["JUN", "#f5b62a", "#9a5d00", "#fff4d6", "sun"],
    ["JUL", "#e5433d", "#1f3f8f", "#ffe5e3", "star"],
    ["AUG", "#ff8a3d", "#a3420a", "#ffeedd", "wave"],
    ["SEP", "#c8892f", "#6b4310", "#fbefdc", "football"],
    ["OCT", "#ff7a1a", "#5a2a7a", "#ffeedd", "pumpkin"],
    ["NOV", "#c5642a", "#6a2f10", "#fbe9dc", "leaf"],
    ["DEC", "#2e9e5b", "#b3202f", "#e6f7ec", "tree"]
  ];

  // Small pictures drawn in a 40x40 box, centered at (20,20).
  const ART = {
    snowflake: c => `<g stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none">${[0, 60, 120].map(a => `<g transform="rotate(${a} 20 20)"><path d="M20 4v32M20 9l-5-4M20 9l5-4M20 31l-5 4M20 31l5 4"/></g>`).join("")}</g>`,
    heart: c => `<path fill="${c}" d="M20 35C8 26 3 20 3 13a8.5 8.5 0 0 1 17-2 8.5 8.5 0 0 1 17 2c0 7-5 13-17 22z"/>`,
    shamrock: c => `<g fill="${c}"><circle cx="20" cy="11" r="7.5"/><circle cx="11.5" cy="20" r="7.5"/><circle cx="28.5" cy="20" r="7.5"/><circle cx="20" cy="20" r="5"/></g><path d="M20 22q1 10 6 15" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    raindrop: c => `<path fill="${c}" d="M20 3C14 13 9 19 9 25a11 11 0 0 0 22 0c0-6-5-12-11-22z"/><path d="M15 25a5 5 0 0 0 5 5" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>`,
    flower: c => `<g fill="${c}">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="20" cy="10" rx="6" ry="8.5" transform="rotate(${a} 20 20)"/>`).join("")}</g><circle cx="20" cy="20" r="5.5" fill="#ffd34d"/>`,
    sun: c => `<g stroke="${c}" stroke-width="3.2" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M20 3v5" transform="rotate(${a} 20 20)"/>`).join("")}</g><circle cx="20" cy="20" r="9" fill="${c}"/>`,
    star: c => `<path fill="${c}" d="M20 3l4.9 10.6 11.6 1.3-8.6 7.9 2.4 11.4L20 28.4 9.7 34.2l2.4-11.4-8.6-7.9 11.6-1.3z"/>`,
    wave: c => `<path fill="${c}" d="M3 26c5 0 6-5 11-5s6 5 11 5 6-5 12-5v15H3z"/><path d="M5 19c3-9 14-13 21-8-5-1-9 2-9 7" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><circle cx="31" cy="9" r="5" fill="#ffc94a"/>`,
    football: c => `<ellipse cx="20" cy="20" rx="17" ry="10.5" transform="rotate(-35 20 20)" fill="${c}"/><g stroke="#fff" stroke-width="2.2" stroke-linecap="round" transform="rotate(-35 20 20)"><path d="M13 20h14M16 17v6M20 17v6M24 17v6"/></g>`,
    pumpkin: c => `<path d="M20 9c0-4 2-6 5-6" stroke="#3f7d2a" stroke-width="3.2" fill="none" stroke-linecap="round"/><g fill="${c}"><ellipse cx="13" cy="23" rx="9" ry="12"/><ellipse cx="27" cy="23" rx="9" ry="12"/><ellipse cx="20" cy="23" rx="8" ry="13"/></g><path d="M20 11v24M13 12q-4 11 0 22M27 12q4 11 0 22" stroke="rgba(0,0,0,.18)" stroke-width="1.6" fill="none"/>`,
    leaf: c => `<path fill="${c}" d="M20 3l3 7 6-3-1 8 7 1-5 5 4 4-8 1v7h-1.5l-.5-6-6 4 1-6-8 1 4-5-5-5 7-1-1-8 6 3z"/><path d="M20 37V14" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/>`,
    tree: c => `<path fill="${c}" d="M20 3l9 11h-4l7 9h-5l8 9H5l8-9H8l7-9h-4z"/><rect x="17" y="32" width="6" height="5" fill="#7a4a24"/><g fill="#ffd34d"><circle cx="20" cy="3.5" r="2.6"/></g><g fill="#e8384f"><circle cx="15" cy="21" r="1.9"/><circle cx="25" cy="27" r="1.9"/></g><g fill="#fff"><circle cx="23" cy="15" r="1.6"/><circle cx="13" cy="29" r="1.6"/></g>`
  };

  let uid = 0;

  // Player of the Month: rosette with ribbon tails. key is "2026-12".
  function monthBadge(key) {
    const [year, m] = key.split("-");
    const [abbr, main, dark, light, art] = MONTHS[Number(m) - 1] || MONTHS[0];
    const id = `gb${++uid}`;
    const scallops = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      return `<circle cx="${(60 + Math.cos(a) * 45).toFixed(1)}" cy="${(56 + Math.sin(a) * 45).toFixed(1)}" r="9"/>`;
    }).join("");
    return `<svg class="grumpys-badge" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Player of the Month, ${abbr} ${year}">
  <defs>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${main}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${light}"/></linearGradient>
  </defs>
  <path d="M34 92l-14 50 15-9 9 15 14-50z" fill="${dark}"/><path d="M86 92l14 50-15-9-9 15-14-50z" fill="${dark}"/>
  <path d="M36 96l-10 38 9-5 7 10 9-38z" fill="${main}" opacity=".55"/><path d="M84 96l10 38-9-5-7 10-9-38z" fill="${main}" opacity=".55"/>
  <g fill="url(#${id}r)">${scallops}<circle cx="60" cy="56" r="46"/></g>
  <circle cx="60" cy="56" r="37" fill="url(#${id}f)" stroke="#fff" stroke-width="3"/>
  <circle cx="60" cy="56" r="33" fill="none" stroke="${main}" stroke-width="1.5" stroke-dasharray="2 3" opacity=".7"/>
  <g transform="translate(44.5 22) scale(.78)">${ART[art](main)}</g>
  <text x="60" y="72" text-anchor="middle" font-family="Anton, Impact, 'Arial Black', sans-serif" font-weight="900" font-size="20" fill="${dark}" letter-spacing="1">${abbr}</text>
  <text x="60" y="84.5" text-anchor="middle" font-family="Anton, 'Arial Black', Arial, sans-serif" font-weight="900" font-size="10" fill="${dark}" letter-spacing="1.5" opacity=".85">${year}</text>
</svg>`;
  }

  // Player of the Year: gold medal in a laurel wreath, the year on a ribbon banner.
  function yearBadge(year) {
    const id = `gb${++uid}`;
    // Leaves up each side, from the bottom of the medal to near the top.
    const laurel = side => Array.from({ length: 8 }, (_, i) => {
      const deg = 100 + i * 19;
      const a = deg * Math.PI / 180;
      const x = 60 + Math.cos(a) * 49 * side, y = 64 + Math.sin(a) * 49;
      const rot = (deg + 90 + 25) * side;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.6" ry="10" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }).join("");
    return `<svg class="grumpys-badge" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Player of the Year ${year}">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".45" stop-color="#f4c430"/><stop offset="1" stop-color="#a86b00"/></linearGradient>
    <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2140"/><stop offset="1" stop-color="#120d1f"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d63445"/><stop offset="1" stop-color="#8e1424"/></linearGradient>
  </defs>
  <path d="M41 2h14l9 24-13 4z" fill="#b3202f"/><path d="M79 2H65l-9 24 13 4z" fill="#1f3f8f"/>
  <g fill="#3f9a3c">${laurel(1)}${laurel(-1)}</g>
  <circle cx="60" cy="64" r="42" fill="url(#${id}g)"/>
  <circle cx="60" cy="64" r="34" fill="url(#${id}d)" stroke="#fff6c8" stroke-width="2.5"/>
  <path fill="url(#${id}g)" d="M60 36l4.4 9 10 1.4-7.2 7 1.7 9.9L60 58.6l-8.9 4.7 1.7-9.9-7.2-7 10-1.4z"/>
  <text x="60" y="78" text-anchor="middle" font-family="Anton, 'Arial Black', Arial, sans-serif" font-weight="900" font-size="8.5" fill="#fff2a8" letter-spacing=".9">PLAYER OF</text>
  <text x="60" y="88" text-anchor="middle" font-family="Anton, 'Arial Black', Arial, sans-serif" font-weight="900" font-size="8.5" fill="#fff2a8" letter-spacing=".9">THE YEAR</text>
  <path d="M8 104h16l-6 9 6 9H8zM112 104H96l6 9-6 9h16z" fill="#8e1424"/>
  <path d="M18 98h84v26H18z" fill="url(#${id}b)" stroke="#fff6c8" stroke-width="1.5"/>
  <text x="60" y="119" text-anchor="middle" font-family="Anton, Impact, 'Arial Black', sans-serif" font-weight="900" font-size="20" fill="#fff2a8" letter-spacing="2">${year}</text>
</svg>`;
  }

  window.GrumpysBadges = { monthBadge, yearBadge };
})();
