// Round colors, shared by the TV (app.js), phones (play.js) and promo screen (promo.js).
// Every round picks one from its round ID, so all three screens always match.
// accent = the main color, hot = a light version for text, accent2 = the second
// color mixed into the background. Keep accents bright: dark text sits on them.
window.GRUMPYS_ROUND_THEMES = [
  { name: "Ruby",     accent: "#ff4255", hot: "#ff9eaa", rgb: "255 66 85",   rgb2: "255 176 58" },
  { name: "Electric", accent: "#4aa8ff", hot: "#a7d7ff", rgb: "74 168 255",  rgb2: "138 92 255" },
  { name: "Emerald",  accent: "#42d987", hot: "#a5f3c8", rgb: "66 217 135",  rgb2: "47 211 224" },
  { name: "Sunset",   accent: "#ff8a35", hot: "#ffc28f", rgb: "255 138 53",  rgb2: "255 79 154" },
  { name: "Violet",   accent: "#9d73ff", hot: "#d5c3ff", rgb: "157 115 255", rgb2: "58 214 255" },
  { name: "Gold",     accent: "#ffc43d", hot: "#ffe4a3", rgb: "255 196 61",  rgb2: "255 90 60" },
  { name: "Aqua",     accent: "#2fe0d0", hot: "#a6f5ee", rgb: "47 224 208",  rgb2: "74 125 255" },
  { name: "Magenta",  accent: "#ff4fd8", hot: "#ffb3ef", rgb: "255 79 216",  rgb2: "122 92 255" },
  { name: "Lime",     accent: "#b6f03c", hot: "#e2fbb0", rgb: "182 240 60",  rgb2: "34 199 169" },
  { name: "Coral",    accent: "#ff6f61", hot: "#ffb8b0", rgb: "255 111 97",  rgb2: "255 210 63" },
  { name: "Cobalt",   accent: "#5b8cff", hot: "#b9cdff", rgb: "91 140 255",  rgb2: "255 111 181" },
  { name: "Mint",     accent: "#5ef2b0", hot: "#bdf9df", rgb: "94 242 176",  rgb2: "122 107 255" },
  { name: "Tangerine",accent: "#ffa62b", hot: "#ffd59a", rgb: "255 166 43",  rgb2: "232 63 111" },
  { name: "Orchid",   accent: "#d77bff", hot: "#edc4ff", rgb: "215 123 255", rgb2: "255 138 91" },
  { name: "Sky",      accent: "#4fd2ff", hot: "#b3edff", rgb: "79 210 255",  rgb2: "255 216 79" },
  { name: "Cherry",   accent: "#ff3d7f", hot: "#ffa7c6", rgb: "255 61 127",  rgb2: "106 92 255" },
  { name: "Seafoam",  accent: "#3ee6a8", hot: "#aef5d9", rgb: "62 230 168",  rgb2: "255 184 74" },
  { name: "Lemon",    accent: "#ffe14f", hot: "#fff1a8", rgb: "255 225 79",  rgb2: "59 209 255" },
  { name: "Lavender", accent: "#b59cff", hot: "#ddd2ff", rgb: "181 156 255", rgb2: "255 122 168" },
  { name: "Flame",    accent: "#ff5a2e", hot: "#ffb09a", rgb: "255 90 46",   rgb2: "255 200 61" }
];

window.pickGrumpysRoundTheme = function pickGrumpysRoundTheme(roundKey) {
  const key = String(roundKey || "grumpys");
  const themes = window.GRUMPYS_ROUND_THEMES;
  const index = [...key].reduce((total, character) => total + character.charCodeAt(0), 0) % themes.length;
  return themes[index];
};
