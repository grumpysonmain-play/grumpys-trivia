// Player of the Month / Player of the Year and answer streaks.
// Shared by the main TV, second screen, phones and promo TV so they all agree.
(function () {
  const TIME_ZONE = "America/Chicago";
  const FIRST_MONTH = "2026-12"; // first month that crowns a Player of the Month
  const FIRST_YEAR = "2027";     // first year that crowns a Player of the Year

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Streaks: 3 right in a row earns 🔥 and +50; each one after adds 50 more, up to +300 a question.
  const STREAK_START = 3;
  const STREAK_STEP = 50;
  const STREAK_MAX_BONUS = 300;

  function now() {
    return typeof window.grumpysServerNow === "function" ? window.grumpysServerNow() : Date.now();
  }

  // Year, month and day in Central time (the bar's clock, whatever the device is set to).
  function parts(time = now()) {
    const out = {};
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(time))
      .forEach(p => { out[p.type] = p.value; });
    return { year: out.year, month: out.month, day: Number(out.day) };
  }

  function monthKey(time = now()) {
    const p = parts(time);
    return `${p.year}-${p.month}`;
  }

  function yearKey(time = now()) {
    return parts(time).year;
  }

  function previousMonthKey(key) {
    let [y, m] = key.split("-").map(Number);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
    return `${y}-${String(m).padStart(2, "0")}`;
  }

  function monthName(key) {
    return MONTH_NAMES[Number(key.split("-")[1]) - 1] || key;
  }

  function monthLabel(key) {
    return `${monthName(key)} ${key.split("-")[0]}`;
  }

  // Everyone's points for one month ("months") or one year ("years"), best first.
  function board(profiles, kind, key, isBlocked = () => false) {
    return Object.entries(profiles || {})
      .map(([nameKey, profile]) => {
        const period = profile?.[kind]?.[key] || {};
        return {
          nameKey,
          name: profile?.displayName || nameKey,
          score: Number(period.score) || 0,
          games: Number(period.games) || 0,
          wins: Number(period.wins) || 0
        };
      })
      .filter(row => row.score > 0 && !isBlocked(row.name))
      .sort((a, b) => b.score - a.score || b.wins - a.wins || a.name.localeCompare(b.name));
  }

  // The reigning champions: last month's and last year's top scorers.
  function champions(profiles, isBlocked = () => false, time = now()) {
    const lastMonth = previousMonthKey(monthKey(time));
    const lastYear = String(Number(yearKey(time)) - 1);
    const month = lastMonth >= FIRST_MONTH ? board(profiles, "months", lastMonth, isBlocked)[0] || null : null;
    const year = lastYear >= FIRST_YEAR ? board(profiles, "years", lastYear, isBlocked)[0] || null : null;
    return {
      month: month && { ...month, key: lastMonth, label: monthLabel(lastMonth), title: `${monthName(lastMonth)} Player of the Month` },
      year: year && { ...year, key: lastYear, label: lastYear, title: `${lastYear} Player of the Year` }
    };
  }

  // Every month and year this player came out on top: badges they keep for good.
  function earnedBadges(nameKey, profiles, isBlocked = () => false, time = now()) {
    if (!nameKey) return [];
    const out = [];
    const thisYear = Number(yearKey(time));
    for (let y = Number(FIRST_YEAR); y < thisYear; y++) {
      if (board(profiles, "years", String(y), isBlocked)[0]?.nameKey === nameKey) out.push({ kind: "year", key: String(y), label: `${y} Player of the Year` });
    }
    const thisMonth = monthKey(time);
    for (let key = previousMonthKey(thisMonth); key >= FIRST_MONTH; key = previousMonthKey(key)) {
      if (board(profiles, "months", key, isBlocked)[0]?.nameKey === nameKey) {
        out.push({ kind: "month", key, label: `${monthLabel(key)} Player of the Month` });
      }
    }
    return out;
  }

  // The badge picture (from badges.js) for one month ("2026-12") or year ("2027").
  function badgeSvg(kind, key) {
    const art = window.GrumpysBadges;
    if (!art) return kind === "year" ? "🏆" : "👑";
    return kind === "year" ? art.yearBadge(key) : art.monthBadge(key);
  }

  // One small badge after a reigning champion's name on the leaderboards (all of them live on the stats page).
  // Someone holding both titles shows the Player of the Year medal.
  function badges(nameKey, champs) {
    if (!nameKey || !champs) return "";
    if (champs.year?.nameKey === nameKey) return badgeSvg("year", champs.year.key);
    if (champs.month?.nameKey === nameKey) return badgeSvg("month", champs.month.key);
    return "";
  }

  function streakBonus(streak) {
    if (!(streak >= STREAK_START)) return 0;
    return Math.min(STREAK_MAX_BONUS, STREAK_STEP * (streak - STREAK_START + 1));
  }

  window.GrumpysAwards = {
    TIME_ZONE, FIRST_MONTH, FIRST_YEAR, STREAK_START,
    monthKey, yearKey, previousMonthKey, monthName, monthLabel,
    board, champions, badges, badgeSvg, earnedBadges, streakBonus
  };
})();
