// Makes the picture question for each round (main TV only): a flag, a state shape or a zoomed-in logo.
// The pictures themselves live in picture-pack.js.
(function () {
  const RECENT_KEY = "grumpysRecentPictures";
  const RECENT_LIMIT = 120;
  // How often each kind comes up.
  const KIND_WEIGHTS = [["logo", 0.5], ["flag", 0.25], ["state", 0.25]];

  const pack = () => window.GRUMPYS_PICTURE_PACK || null;

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function recent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
  }

  function remember(id) {
    const list = recent().filter(x => x !== id);
    list.push(id);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(-RECENT_LIMIT))); } catch { /* fine without it */ }
  }

  // A picture that hasn't been used lately (or any, once they've all been used).
  function pickFresh(list, kind) {
    const used = new Set(recent());
    const fresh = list.filter(entry => !used.has(`${kind}:${entry[0]}`));
    const from = fresh.length ? fresh : list;
    return from[Math.floor(Math.random() * from.length)];
  }

  // Three wrong answers, taken from each pool in turn (look-alikes first, then anything).
  function wrongAnswers(answer, pools, clash = () => false) {
    const out = [];
    for (const [pool, max] of pools) {
      let taken = 0;
      for (const name of shuffle(pool)) {
        if (out.length >= 3 || taken >= max) break;
        if (name === answer || out.includes(name) || clash(name, [answer, ...out])) continue;
        out.push(name);
        taken++;
      }
    }
    return out;
  }

  function flagQuestion(p) {
    const entry = pickFresh(p.flags, "flag");
    const [name, group] = entry;
    const lookAlikes = p.flags.filter(f => f[1] === group).map(f => f[0]);
    const all = p.flags.map(f => f[0]);
    return {
      category: "Name That Flag",
      question: "Whose flag is this?",
      correct_answer: name,
      incorrect_answers: wrongAnswers(name, [[lookAlikes, 2], [all, 3]]),
      picture: { id: `flag:${name}`, kind: "flag", src: entry[2] }
    };
  }

  function stateQuestion(p) {
    const entry = pickFresh(p.states, "state");
    const [name, region] = entry;
    const near = p.states.filter(s => s[1] === region).map(s => s[0]);
    const all = p.states.map(s => s[0]);
    const tooAlike = (p.statesTooAlike || []).map(pair => new Set(pair));
    const clash = (candidate, chosen) => chosen.some(c => tooAlike.some(pair => pair.has(c) && pair.has(candidate)));
    return {
      category: "Name That State",
      question: "Which state is this?",
      correct_answer: name,
      incorrect_answers: wrongAnswers(name, [[near, 1], [all, 3]], clash),
      picture: { id: `state:${name}`, kind: "state", src: entry[2] }
    };
  }

  function logoQuestion(p) {
    const entry = pickFresh(p.logos, "logo");
    const [name, kind, src, zoom, spots] = entry;
    let question, pools;
    if (kind.startsWith("brand-")) {
      const type = kind.slice(6);
      const sameType = p.logos.filter(l => l[1] === kind).map(l => l[0]);
      question = "Which company's logo is this?";
      pools = [[[...sameType, ...(p.brandExtra[type] || [])], 3], [p.logos.filter(l => l[1].startsWith("brand-")).map(l => l[0]), 3]];
    } else {
      const league = kind.toUpperCase();
      question = `Which ${league} team's logo is this?`;
      pools = [[p.teams[league] || [], 3]];
    }
    const spot = (spots && spots.length ? spots : [[0.5, 0.5]])[Math.floor(Math.random() * (spots?.length || 1))];
    return {
      category: "Logo Zoom",
      question,
      correct_answer: name,
      incorrect_answers: wrongAnswers(name, pools),
      picture: { id: `logo:${name}`, kind: "logo", src, zoom, fx: spot[0], fy: spot[1] }
    };
  }

  function pickKind() {
    let r = Math.random();
    for (const [kind, weight] of KIND_WEIGHTS) {
      if ((r -= weight) < 0) return kind;
    }
    return KIND_WEIGHTS[0][0];
  }

  // One picture question, ready to drop into the round. Null if the pictures didn't load.
  function makeQuestion(kind = pickKind()) {
    const p = pack();
    if (!p) return null;
    const make = { flag: flagQuestion, state: stateQuestion, logo: logoQuestion }[kind];
    const lists = { flag: p.flags, state: p.states, logo: p.logos }[kind];
    if (!make || !lists || !lists.length) return null;
    const q = make(p);
    if (q.incorrect_answers.length < 3) return null;
    remember(q.picture.id);
    return q;
  }

  // What goes into the game for the other screens: the picture and how to zoom it, never its name.
  function gameState(question) {
    const pic = question && question.picture;
    if (!pic) return null;
    return {
      kind: pic.kind,
      src: pic.src,
      zoom: pic.kind === "logo" ? pic.zoom : 1,
      fx: pic.kind === "logo" ? pic.fx : 0.5,
      fy: pic.kind === "logo" ? pic.fy : 0.5
    };
  }

  window.GrumpysPictureQuestions = { makeQuestion, gameState };
})();
