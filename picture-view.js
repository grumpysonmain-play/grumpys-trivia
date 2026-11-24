// Draws a picture question (flag, state shape or logo) on the TV, second screen and phones.
// Logos start zoomed in on one spot and slowly pull back while the clock runs, as a built-in hint.
// Every screen works the zoom out from the same server start time, so they all match.
(function () {
  const frames = new WeakMap();

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // How far through the zoom-out we are (0 = fully zoomed in, 1 = whole logo).
  // Zoom-out timing. Raise HOLD_SECONDS or END_ZOOM to make logos harder; lower them to make it easier.
  const HOLD_SECONDS = 5;    // stays fully zoomed in this long
  const END_ZOOM = 1.4;      // still this zoomed in when time runs out; the whole logo shows at the reveal
  const EASE_POWER = 1.5;    // above 1: pulls back slowly at first, faster near the end

  // How far through the zoom-out we are (0 = fully zoomed in, 1 = as far out as it goes during the question).
  function zoomProgress(st) {
    const elapsed = (st.now() - st.startedAt) / 1000;
    const span = Math.max(4, st.seconds - HOLD_SECONDS);
    const linear = clamp((elapsed - HOLD_SECONDS) / span, 0, 1);
    return Math.pow(linear, EASE_POWER);
  }

  function place(st, progress) {
    const pic = st.pic;
    const zoom = Math.max(1, Number(pic.zoom) || 1);
    if (zoom <= 1) { st.img.style.transform = "none"; return; }
    // Zoom shrinks evenly to the eye (same ratio each second), and the spot it started on slides back home.
    const endZoom = Math.min(END_ZOOM, zoom);
    const scale = Math.pow(zoom, 1 - progress) * Math.pow(endZoom, progress);
    const toward = (scale - 1) / (zoom - 1);
    const fx = clamp(Number(pic.fx) || 0.5, 0, 1);
    const fy = clamp(Number(pic.fy) || 0.5, 0, 1);
    const tx = (0.5 - fx) * scale * toward * 100;
    const ty = (0.5 - fy) * scale * toward * 100;
    st.img.style.transform = `translate(${tx.toFixed(3)}%, ${ty.toFixed(3)}%) scale(${scale.toFixed(4)})`;
  }

  // Grow (or shrink) the picture to fill the frame, keeping its shape. Small logos get scaled up too.
  function fit(st) {
    const img = st.img, frame = st.frame;
    if (!img.naturalWidth || !frame.isConnected) return;
    const cs = getComputedStyle(frame);
    const w = frame.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = frame.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (w <= 0 || h <= 0) return;
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    img.style.width = `${Math.floor(img.naturalWidth * k)}px`;
    img.style.height = `${Math.floor(img.naturalHeight * k)}px`;
  }

  function watchSize(st) {
    const refit = () => fit(st);
    st.img.addEventListener("load", refit);
    if (st.img.complete) refit();
    if (window.ResizeObserver) {
      st.observer = new ResizeObserver(refit);
      st.observer.observe(st.frame);
    } else {
      window.addEventListener("resize", refit);
      st.unwatch = () => window.removeEventListener("resize", refit);
    }
  }

  function stop(st) {
    if (st && st.raf) cancelAnimationFrame(st.raf);
    if (st) st.raf = null;
  }

  function unwatch(st) {
    if (!st) return;
    st.observer?.disconnect();
    st.unwatch?.();
  }

  function run(st) {
    let last = 0;
    const tick = time => {
      if (st.revealed || !st.img.isConnected) { st.raf = null; return; }
      if (time - last >= 33) { // about 30 frames a second is plenty, and easy on the TV player
        last = time;
        const p = zoomProgress(st);
        place(st, p);
        if (p >= 1) { st.raf = null; return; }
      }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }

  function render(frame, pic, startedAt, seconds, now) {
    if (!frame) return;
    if (!pic || typeof pic.src !== "string" || !pic.src.startsWith("data:image/")) { clear(frame); return; }
    const key = `${startedAt}|${pic.src.length}|${pic.src.slice(-48)}|${pic.fx}|${pic.fy}`;
    const old = frames.get(frame);
    if (old && old.key === key) return;
    stop(old);
    unwatch(old);

    const img = new Image();
    img.className = "qp-img";
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    img.src = pic.src;

    const st = { key, frame, img, pic, startedAt: Number(startedAt) || now(), seconds: Number(seconds) || 20, now, raf: null, revealed: false };
    frames.set(frame, st);
    frame.dataset.kind = pic.kind || "";
    frame.hidden = false;
    frame.replaceChildren(img);
    frame.classList.remove("qp-revealed");
    watchSize(st);

    if (pic.kind === "logo" && Number(pic.zoom) > 1) {
      place(st, zoomProgress(st));
      run(st);
    }
  }

  // At the answer reveal: pull all the way back so everyone sees the whole logo.
  function reveal(frame) {
    const st = frame && frames.get(frame);
    if (!st) return;
    st.revealed = true;
    stop(st);
    frame.classList.add("qp-revealed");
    st.img.style.transform = "none";
  }

  function clear(frame) {
    if (!frame) return;
    stop(frames.get(frame));
    unwatch(frames.get(frame));
    frames.delete(frame);
    frame.hidden = true;
    frame.classList.remove("qp-revealed");
    frame.removeAttribute("data-kind");
    frame.replaceChildren();
  }

  window.GrumpysPictureView = { render, reveal, clear };
})();
