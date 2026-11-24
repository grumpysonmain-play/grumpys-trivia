// Grumpy's nickname filter, shared by the phone sign-in (play.js) and the stats page (stats.js).
//
// How a name is read before checking:
//  - Number swaps are undone (5h1t -> shit, 8008 -> boob) and punctuation is ignored.
//  - Stretched letters are shortened (fuuuuck -> fuck, asss -> ass).
//  - Letters split up with spaces are joined back together ("F U C K", "Sh It", "Jack Ass").
//  - Joke names are also compared by sound (ph = f, c/ck/q = k, z = s, y = i), so
//    "Phil McKrakin", "Hugh Jazz" and "Sofa Kingg" are caught.
//  - Short words like "ass", "sus" or "pee" only count as a whole word, and a bad word has to be
//    inside one word, so real names such as Cassie, Susan, Hassan, Brian Allen (anal) or
//    Barbara Perez (rape) are still allowed.
(function () {
  const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s", "!": "i", "+": "t", "|": "i" };

  // Blocked when they appear anywhere inside a word.
  const ROOTS = [
    // Swearing and crude
    "fuck", "fuk", "fuq", "fvck", "fck", "phuck", "phuk", "phuq", "fuxk", "motherf", "mthrf", "shit", "bitch", "biatch",
    "cunt", "twat", "bollock", "bastard", "asshole", "arsehole", "dumbass", "jackass", "fatass", "phatass",
    "badass", "smartass", "kissmyass", "bigass", "hugeass", "asswipe", "asshat", "assclown", "asslick",
    "assface", "asshead", "bootyhole", "butthole", "buttplug", "buttface", "buttlick", "buttcheek", "bigbutt",
    "dickhead", "dickface", "dicksuck", "bigdick", "smalldick", "mydick", "dickweed", "cocksuck", "cockhead",
    "bigcock", "mycock", "cumshot", "cumslut", "cumdump", "cumbucket", "cumguzzl", "cumface", "jizz", "pussy",
    "vagina", "vajay", "vagene", "penis", "dildo", "clit", "porn", "hentai", "milf", "dilf", "gilf", "thicc",
    "gyat", "onlyfans", "horny", "boob", "titty", "tittie", "nipple", "slut", "whore", "skank", "sexy",
    "sexgod", "sextoy", "sexual", "orgasm", "orgy", "blowjob", "handjob", "rimjob", "jerkoff", "jerkingoff",
    "jackingoff", "jackinoff", "spank", "naked", "nudes", "nudie", "erection", "rection", "testicle",
    "scrotum", "ballsack", "nutsack", "deeznut", "deesnut", "ligma", "sugma", "bofadeez", "stepdad",
    "stepmom", "stepbro", "stepsis", "sugardaddy", "sugarbaby", "sugarmama", "daddy", "mommy", "genital",
    "jenital", "jennital", "sixtynine", "sixnine",
    // Bathroom
    "poop", "piss", "turd", "shart", "queef", "diarrh", "booger", "toilet", "vomit", "barf", "stinky",
    "smelly", "dookie", "doodoo", "peepee",
    // Slurs and hate
    "nigg", "nigga", "nygg", "niqq", "nibba", "nibber", "kneegro", "neegro", "kneeger", "nigur", "nigerr", "faggot", "fagot", "faget", "lesbo", "lezbo", "lezzie", "tranny", "shemale", "retard",
    "wetback", "towelhead", "raghead", "cameljock", "jigaboo", "porchmonk", "junglebunn", "redskin", "chink",
    "gook", "zipperhead", "jewboy", "darkie", "golliwog", "hitler", "heilhit", "siegheil", "nazis",
    "neonazi", "whitepower", "whitepride", "kkk", "molest", "pedophil", "pedobear", "terrorist", "jihad",
    "alqaeda", "taliban", "hamas", "schoolshoot", "shooter", "murder", "killyou", "suicide",
    // Pretending to be staff
    "admin", "grumpy", "moderator", "bartender", "manager", "employee", "security", "triviahost",
    "quizmaster", "official", "bouncer", "president", "guest",
    // Politics
    "biden", "obama", "kamala", "desantis", "pelosi", "schumer", "melania", "ivanka", "putin", "zelensk",
    "jongun", "jinping", "mussolini", "osama", "binladen", "saddam", "khomeini", "netanyahu", "ayatollah",
    "democrat", "republican", "liberal", "libtard", "conservative", "leftist", "rightwing", "antifa",
    "proudboy", "qanon", "wwgiwga", "maganation", "ultramaga", "magaking", "magacountry", "makeamerica",
    "palestine", "zionis", "communis", "commie", "socialis", "marxis", "fascis", "potus",
    "flotus", "senator", "congress", "governor", "abortion", "prolife", "prochoice", "buildthewall",
    "buildawall", "illegalalien", "deport", "impeach", "voteblue", "votered", "gunrights", "secondamend",
    // Troll names
    "skibidi", "rizzler", "chungus", "yeet", "imposter", "impostor", "amongus", "amogus", "yourmom",
    "yourdad", "urmom", "urdad", "yomama", "yomomma", "joemama", "joemomma", "anonymous", "undefined",
    "drunk", "crackhead", "xanax"
  ];

  // Blocked inside a word, except inside these real names.
  const ROOTS_EXCEPT = {
    ass: ["cass", "bass", "glass", "grass", "hass", "lass", "mass", "nass", "pass", "tass", "vass", "brass",
      "class", "sass", "kassandra", "kassidy", "kassie", "kassy", "assante", "asselin"],
    dick: ["dickens", "dickins", "dickers", "dickson", "dickey", "dickie"],
    cock: ["hitchcock", "hancock", "babcock", "peacock", "alcock", "cockrell", "cockburn", "cockerham",
      "adcock", "woodcock", "glasscock", "laycock", "haycock", "hiscock", "wilcock", "silcock"],
    sex: ["sexton", "essex", "sussex", "wessex"],
    anal: ["banal", "canal", "analise", "analisa", "analia", "analy"],
    rape: ["grape", "drape", "crape", "trape"],
    rapist: ["therapist"],
    nazi: ["nazir", "nazim", "nazih", "nazia"],
    butt: ["butter", "button", "butte", "butler"],
    pedo: ["torpedo"],
    fart: ["fartun", "fartuun"],
    wank: ["swank"],
    fagg: ["faggian", "faggion"],
    trump: ["trumpet", "trumpler"],
    stalin: ["stalinsk"]
  };

  // Blocked when a word in the name starts with them (they can run across the space).
  const PHRASES = [
    // Bad words and slogans typed as two or more words
    "livesmatter", "bluelivesmatter", "blacklivesmatter", "alllivesmatter", "buildthewall", "buildawall",
    "voteblue", "votered", "makeamerica", "proudboy", "whitepride", "schoolshoot", "killyou", "stepbro",
    "stepdad", "stepmom", "stepsis", "sugardaddy", "sugarbaby", "sugarmama", "sixtynine", "sixnine",
    "gunrights", "secondamend", "illegalalien", "onlyfans", "towelhead", "raghead", "zipperhead",
    "cameljock", "porchmonk", "junglebunn", "binladen", "alqaeda", "quizmaster", "jongun", "jerkoff",
    "jerkingoff", "jackingoff", "blowjob", "handjob", "rimjob", "cumshot", "cumslut", "ballsack", "nutsack",
    "prolife", "prochoice", "kissmyass", "motherf", "triviahost",
    "deesnut", "deeznut", "yourmom", "yourdad", "urmom", "urdad", "yomama", "yomomma", "joemama", "joemomma",
    "bofadeez", "cunextt", "seeyounextt", "alkahol", "alkohol", "doodoo", "poopoo", "peepee", "2ndamend",
    // Politics
    "letsgobrandon", "gobrandon", "sleepyjoe", "joebiden", "berniesanders", "feelthebern",
    "hillaryclinton", "crookedhillary", "billclinton", "nikkihaley", "jdvance", "timwalz", "elonmusk",
    "rfkjr", "kimjongun", "xijinping", "freepalestine", "freegaza", "standwithisrael",
    "trumptrain", "whitepower", "siegheil",
    // Joke names that sound dirty when read out loud
    "sofaking", "sofakin", "wetodded", "wetoddid", "wetarded",
    "mikeoxlong", "mikeoxsmall", "mikelitoris", "mikerotch",
    "bendover", "benderover", "bendova", "bendmeover", "eileendover", "ilenedover", "ileendover",
    "hugejas", "hughjanus", "hughjanis", "hughmungus", "hughmongus",
    "philmccrack", "philmcrack", "philmacrack", "philmyass", "philmybutt", "philmyhole", "phillmyass",
    "fillmyass", "philatio", "philmcavity",
    "dixienormous", "dixnormous", "dixienormus", "dixierect",
    "hugginkis", "huginkis", "hugnkis", "hugandkis", "amandahump",
    "ivanatinkle", "ivanahump", "ivanaboner",
    "harryballs", "harrypenis", "harrysack", "hairyballs", "harrynuts",
    "heywoodjab", "haywoodjab", "jablome", "jablowme", "jablomi", "jablowmi",
    "jackmehoff", "jackmeoff", "jackmehof", "jacquesmehoff", "jacquesmeoff", "jakmehoff",
    "olivercloseoff", "oliverclosoff", "oliverclozoff", "olliecloseoff", "clothesoff", "closeoff",
    "tesstickle", "tessticle",
    "cravenmoorehe", "cravenmorehe", "cravenmorhe", "cravingmorehe",
    "gabeitch", "gabeich", "gaybitch",
    "patmyass", "patmybutt", "patmycrotch",
    "alcoholic", "moelester", "sawcon", "sawkon", "sugondese", "sugondeez",
    "opheliaballs", "drewpeacock", "drewpcock", "jennatals", "jennatolls",
    "willystrok", "williestrok", "willistrok", "ericshun", "erikshun"
  ];

  // Only blocked as the whole name, because real names can start the same way
  // (Mike Hunter, Seymour Butler, Wayne Kerrigan, Harry Coxon, Anita Bathgate...).
  const JOKE_NAMES = [
    "mikehunt", "mikehunts", "mykehunt", "mikehawk", "mikehawks", "mikeroch", "mikehok", "mikecox",
    "hughjass", "hughjas", "hughjaz", "hughgass", "hughgas", "hughjazz",
    "seymourbutts", "seymourbutz", "seymourbuts", "seymorebutts", "seymorebutz", "seemorebutts",
    "seemorebutz", "seymorbutts", "seymourbutt", "seemorebutt", "seymorebutt",
    "waynekerr", "waynekur", "wayneker", "jackhoff", "jackoff", "jackhof",
    "amandahug", "amandahugg", "amandahuggin", "amandahugin",
    "jennatalls", "jennatal", "jennatols", "jennatol", "anitabath", "anitabaths",
    "harrypen", "harrybutt", "harrybutts", "harrycox", "hairybutt", "mycox", "imahoe",
    "imahore", "dicknose", "ivanalick", "opheliabutt", "opheliabutts", "benjamindover",
    "candicedick", "candisdick", "anitadick", "ivanadick", "anitapee", "anitapees", "anitapoo",
    "anitapoop", "anitapiss"
  ];

  // Only blocked as a whole word.
  const WORDS = [
    "ass", "arse", "tit", "tits", "cum", "anus", "dik", "pee", "poo", "puss", "hoe", "hoes", "thot", "bj",
    "fap", "nude", "lick", "licker", "suck", "balls", "nuts", "nut", "boner", "semen", "homo", "fag", "fags",
    "dyke", "dykes", "spic", "spick", "kike", "kikes", "coon", "coons", "beaner", "negro", "sambo", "honky",
    "jap", "klan", "isis", "kys", "kms", "nra", "woke", "gop", "dnc", "rnc", "maga", "kag", "aoc", "blm",
    "fjb", "idf", "gaza", "musk", "elon", "walz", "lenin", "deez", "bofa", "sus", "sussy", "npc", "bot",
    "mod", "dj", "ceo", "chef", "server", "staff", "host", "owner", "sugar", "baby", "mama", "papi", "mami",
    "weed", "stoner", "wasted", "coke", "meth", "crack", "trash", "loser", "none", "null", "test", "ohio",
    "rizz", "pimp", "hooker", "sexi", "fetish", "kinky", "booty", "butts", "farts", "schlong", "knob",
    "boobies", "rack", "cok", "nig", "nigs", "niga", "nigas", "nigah", "nyga", "niqa", "nigr", "nigrs", "niger", "nigers"
  ];

  // Whole names that aren't allowed.
  const EXACT = [
    "guest", "player", "winner", "nobody", "someone", "name", "nickname", "user", "username", "unknown",
    "me", "you", "grumpys", "host", "admin", "owner", "staff", "manager"
  ];

  const BAD_NUMBERS = ["69", "420", "1488"];

  function letters(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[0-9@$!+|]/g, ch => LEET[ch] || ch)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  const squash = s => s.replace(/(.)\1+/g, "$1");

  function sound(s) {
    return squash(squash(s)
      .replace(/ph/g, "f").replace(/wh/g, "w").replace(/ck/g, "k").replace(/c/g, "k")
      .replace(/q/g, "k").replace(/x/g, "ks").replace(/z/g, "s").replace(/y/g, "i"));
  }

  // "fuuuuck" -> "fuuck" and "fuck"; normal double letters (Cooke, Jenna) are left alone.
  function unstretch(s) {
    return [...new Set([s, s.replace(/(.)\1{2,}/g, "$1$1"), s.replace(/(.)\1{2,}/g, "$1")])];
  }

  // The words of the name, plus letters split up with spaces joined back together.
  function chunks(words) {
    const out = new Set(words);
    for (let i = 0; i < words.length - 1; i++) {
      const a = words[i], b = words[i + 1];
      // "Sh It", "Fu Ck", "Pu Ssy" -- but not a last initial ("Diana L").
      if ((a.length <= 2 || b.length <= 2) && !(b.length === 1 && a.length >= 3)) out.add(a + b);
    }
    let run = "";
    words.forEach((w, i) => {
      if (w.length <= 2) run += w;
      if (w.length > 2 || i === words.length - 1) { if (run.length > 2) out.add(run); run = ""; }
    });
    return [...out];
  }

  function stripExceptions(text, exceptions, transform) {
    return exceptions.reduce((t, ex) => t.split(transform(ex)).join("|"), text);
  }

  const same = s => s;

  // Worked out once, not on every check.
  const LONG_ROOTS = ROOTS.filter(r => r.length >= 6).map(r => [r, squash(r), sound(r)]);
  const PHRASE_FORMS = PHRASES.map(p => [p, [...new Set([p, squash(p), sound(p)])]]);
  const JOKE_FORMS = new Set(JOKE_NAMES.flatMap(j => [j, squash(j), sound(j)]));

  // Returns why a name is blocked, or "" if it's fine.
  function check(name) {
    const raw = String(name || "");
    const words = letters(raw).split(" ").filter(Boolean);
    const compact = words.join("");
    if (!compact) return "empty";

    const digits = raw.replace(/[^0-9]/g, "");
    if (BAD_NUMBERS.some(n => digits.includes(n))) return "number";

    const compactForms = new Set([...unstretch(compact), squash(compact), sound(compact)]);
    if (EXACT.some(e => compactForms.has(e))) return "exact";
    if ([...compactForms].some(f => JOKE_FORMS.has(f))) return "joke";

    // Bad words inside a word (or inside letters that were split up).
    const parts = chunks(words).flatMap(unstretch);
    for (const part of parts) {
      const partSquash = squash(part), partSound = sound(part);
      for (const root of ROOTS) {
        // Also with doubled letters squeezed ("shiit", "peenis").
        if (part.includes(root) || partSquash.includes(root)) return root;
      }
      // Longer words are also compared by sound ("phukker", "biiiatch").
      for (const [root, rootSquash, rootSound] of LONG_ROOTS) {
        if (partSquash.includes(rootSquash) || partSound.includes(rootSound)) return root;
      }
      for (const [root, exceptions] of Object.entries(ROOTS_EXCEPT)) {
        if (stripExceptions(part, exceptions, same).includes(root)) return root;
      }
    }

    // Phrases that start at a word ("Sofa King", "Ben Dover", "Trump2028").
    for (let i = 0; i < words.length; i++) {
      const tail = words.slice(i).join("");
      const tails = [...unstretch(tail), squash(tail), sound(tail)];
      for (const [phrase, forms] of PHRASE_FORMS) {
        if (tails.some(t => forms.some(f => t.startsWith(f)))) return phrase;
      }
    }

    // Whole words ("Big Ass", "Sus", "A S S").
    for (const part of parts) {
      if (WORDS.includes(part)) return part;
    }
    return "";
  }

  window.GrumpysNameFilter = {
    check,
    isBlocked: name => check(name) !== "",
    lists: { ROOTS, ROOTS_EXCEPT, PHRASES, JOKE_NAMES, WORDS, EXACT, BAD_NUMBERS }
  };
})();
