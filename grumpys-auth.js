// Shared sign-in for Grumpy's pages.
// Load after firebase-config.js (and firebase-auth-compat.js on pages that write).
//
//  - Signs each browser in anonymously, so the Firebase rules can tell players apart.
//  - Keeps Firebase's clock offset, so timing uses the server's clock, not the device's.
//  - ?host=KEY in the address makes this screen the game host (the main TV, the stats page).
//  - Links a returning player's nickname to this browser once their PIN checks out.
//
// Everything here also works with the old open rules, so it is safe to upload first.
(() => {
  const params = new URLSearchParams(window.location.search);
  const hostKey = (params.get("host") || "").trim();

  // ---------- Server clock ----------
  let serverOffset = 0;
  try {
    db.ref(".info/serverTimeOffset").on("value", snap => { serverOffset = Number(snap.val()) || 0; });
  } catch (error) {
    console.warn("Server clock offset unavailable:", error);
  }
  window.grumpysServerNow = () => Date.now() + serverOffset;

  // ---------- Anonymous sign-in ----------
  const auth = typeof firebase !== "undefined" && typeof firebase.auth === "function" ? firebase.auth() : null;

  window.grumpysAuthReady = new Promise(resolve => {
    if (!auth) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = uid => {
      if (settled) return;
      settled = true;
      resolve(uid || null);
    };

    auth.onAuthStateChanged(user => { if (user) finish(user.uid); });
    auth.signInAnonymously().catch(error => {
      // Anonymous sign-in is not switched on yet in Firebase: carry on without it.
      console.warn("Anonymous sign-in unavailable:", error.code || error);
      finish(null);
    });
    setTimeout(() => finish(auth.currentUser && auth.currentUser.uid), 10000);
  });

  window.grumpysUid = () => (auth && auth.currentUser ? auth.currentUser.uid : null);

  async function tryWrite(path, value) {
    try {
      await db.ref(path).set(value);
      return true;
    } catch {
      return false;
    }
  }

  // ---------- Host (main TV, stats page) ----------
  window.grumpysHasHostKey = Boolean(hostKey);
  window.grumpysHostReady = window.grumpysAuthReady.then(async uid => {
    if (!hostKey || !uid) return false;
    const ok = await tryWrite(`hosts/${uid}`, hostKey);
    if (!ok) console.warn("This host key was not accepted. Check secrets/hostKey in Firebase.");
    return ok;
  });

  // Moves any PINs still sitting on the public player profiles into the private list.
  window.grumpysMigratePins = async () => {
    const snap = await db.ref("claimedNames").once("value");
    const updates = {};
    let moved = 0;

    Object.entries(snap.val() || {}).forEach(([nameKey, profile]) => {
      if (!profile || profile.pin === undefined || profile.pin === null) return;
      const pin = String(profile.pin);
      if (/^[0-9]{4}$/.test(pin)) updates[`pins/${nameKey}`] = pin;
      updates[`claimedNames/${nameKey}/pin`] = null;
      moved++;
    });

    if (moved) await db.ref().update(updates);
    return moved;
  };

  // ---------- Players ----------
  // Proves this browser knows the PIN for `nameKey`, then links the player id to it.
  // Returns true when the secure rules are on and the PIN checked out.
  window.grumpysClaimPlayer = async (nameKey, pin, playerId) => {
    const uid = await window.grumpysAuthReady;
    if (!uid || !nameKey || !pin) return false;

    let profile = null;
    try {
      profile = (await db.ref(`claimedNames/${nameKey}`).once("value")).val();
    } catch {}

    const legacyPin = profile && profile.pin !== undefined && profile.pin !== null ? String(profile.pin) : null;
    if (legacyPin !== null && legacyPin !== pin) return false;
    // A brand-new name, or an old profile whose PIN is still public: its PIN can be stored privately now.
    const canStorePin = legacyPin === pin || !profile;

    let ok = false;
    let privatePin;
    try {
      privatePin = (await db.ref(`pins/${nameKey}`).once("value")).val();
    } catch {
      privatePin = undefined; // Hidden by the secure rules.
    }

    if (privatePin === undefined) {
      // Secure rules: Firebase only accepts this write when the PIN matches the private copy.
      ok = await tryWrite(`claims/${nameKey}/${uid}`, pin);
      if (!ok && canStorePin && (await tryWrite(`pins/${nameKey}`, pin))) {
        ok = await tryWrite(`claims/${nameKey}/${uid}`, pin);
      }
    } else {
      // The old open rules are still up, so check the PIN here.
      if (privatePin !== null && String(privatePin) !== pin) return false;
      if (privatePin === null && !(canStorePin && (await tryWrite(`pins/${nameKey}`, pin)))) return false;
      ok = await tryWrite(`claims/${nameKey}/${uid}`, pin);
    }

    if (!ok) return false;

    const id = playerId || (profile && profile.playerId);
    if (id && profile) await tryWrite(`owners/${id}/${uid}`, nameKey);
    if (legacyPin !== null) await tryWrite(`claimedNames/${nameKey}/pin`, null);
    return true;
  };

  // A returning player is re-linked on every page load (trivia and arcade games).
  window.grumpysPlayerReady = (async () => {
    try {
      if (sessionStorage.getItem("grumpysTriviaIsGuest") === "true") return false;
      const nameKey = localStorage.getItem("grumpysTriviaNameKey");
      const pin = localStorage.getItem("grumpysTriviaPin");
      const playerId = localStorage.getItem("grumpysTriviaPlayerId");
      if (!nameKey || !pin || !playerId) return false;
      return await window.grumpysClaimPlayer(nameKey, pin, playerId);
    } catch {
      return false;
    }
  })();
})();
