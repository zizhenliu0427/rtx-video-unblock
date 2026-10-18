// NVIDIA RTX Video (VSR / HDR) only reaches a video that Chromium shows as a
// DirectComposition overlay. Chromium skips the overlay when the frame holds a
// second video (GPU.DirectComposition.DCLayerResult 8) or a backdrop-filter quad
// sits above the video (11). This script clears the two cases nobody can see -
// tiny helper videos and backdrop-filters clipped out of view next to the video -
// and reports visible ones, which it leaves to the site.
(() => {
  if (window.__rtxVideoUnblock) return;
  const TAG = '[RTX Video Unblock]';
  const hiddenVideos = new Map(), droppedBackdrops = new Map(); // el -> saved inline value
  let candidates = [], scanAt = 0, lastReport = '', reportAt = 0;

  const save = (el, prop) => ({ value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop) });
  const restore = (el, prop, { value, priority }) => {
    if (value) el.style.setProperty(prop, value, priority); else el.style.removeProperty(prop);
  };
  const describe = el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`
    + `${el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''}`;
  const onScreen = r => Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0))
    * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));

  function mainVideo() {
    let best = null, score = 0;
    for (const v of document.getElementsByTagName('video')) {
      if (v.readyState < 2) continue;
      const r = v.getBoundingClientRect();
      if (r.width < 200 || r.height < 112) continue;
      const s = onScreen(r) * (v.paused ? 0.5 : 1);
      if (s > score) { score = s; best = v; }
    }
    return best;
  }
  // el's border box, and that box cut by the viewport and by the overflow clips of
  // its containing-block chain (a static ancestor never clips an absolute child)
  function visibleBox(el) {
    const box = el.getBoundingClientRect();
    let { left, top, right, bottom } = box;
    let position = getComputedStyle(el).position;
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement
      && left < right && top < bottom; a = a.parentElement) {
      const s = getComputedStyle(a);
      const contains = s.transform !== 'none'
        || (position !== 'fixed' && (position !== 'absolute' || s.position !== 'static'));
      if (!contains) continue;
      position = s.position;
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const c = a.getBoundingClientRect();
      if (s.overflowX !== 'visible') { left = Math.max(left, c.left); right = Math.min(right, c.right); }
      if (s.overflowY !== 'visible') { top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); }
    }
    return { box, left: Math.max(left, 0), top: Math.max(top, 0),
      right: Math.min(right, innerWidth), bottom: Math.min(bottom, innerHeight) };
  }
  // 'unseen': within a device pixel of the video but less than one device pixel of
  // it can be seen. 'visible': it really covers part of the picture.
  function backdropOver(el, r, px) {
    if (!el.isConnected) return null;
    const v = visibleBox(el), b = v.box;
    if (!(b.right > r.left - px && b.left < r.right + px && b.bottom > r.top - px && b.top < r.bottom + px)) return null;
    if (v.right - v.left < px || v.bottom - v.top < px) return 'unseen';
    const ox = Math.min(v.right, r.right) - Math.max(v.left, r.left);
    const oy = Math.min(v.bottom, r.bottom) - Math.max(v.top, r.top);
    if (ox < px || oy < px) return null;
    const s = getComputedStyle(el);
    return s.visibility === 'visible' && s.display !== 'none' ? 'visible' : null;
  }

  function tick() {
    const video = mainVideo();
    if (!video) { release(); report(null); return; }
    const otherVideos = [];
    for (const v of document.getElementsByTagName('video')) {
      if (v === video) continue;
      const r = v.getBoundingClientRect();
      const tiny = r.width > 0 && r.height > 0 && r.width * r.height <= 16;
      if (tiny && !hiddenVideos.has(v)) {
        hiddenVideos.set(v, save(v, 'visibility'));
        v.style.setProperty('visibility', 'hidden', 'important');
        console.info(TAG, 'hid a tiny video', describe(v), v.currentSrc || '');
      } else if (!tiny && hiddenVideos.has(v)) {
        restore(v, 'visibility', hiddenVideos.get(v));
        hiddenVideos.delete(v);
      }
      if (!tiny && v.readyState >= 2 && onScreen(r) > 0 && getComputedStyle(v).visibility === 'visible') otherVideos.push(describe(v));
    }
    for (const v of hiddenVideos.keys()) if (!v.isConnected) hiddenVideos.delete(v);

    const now = performance.now();
    if (now - scanAt > 2000) { // a few ms on a large page
      scanAt = now;
      candidates = [];
      for (const el of document.getElementsByTagName('*')) {
        if (!droppedBackdrops.has(el) && getComputedStyle(el).backdropFilter !== 'none') candidates.push(el);
      }
    }
    const r = video.getBoundingClientRect(), px = 1 / devicePixelRatio;
    const visibleBlockers = [];
    for (const el of candidates) {
      if (droppedBackdrops.has(el)) continue;
      const over = backdropOver(el, r, px);
      if (over === 'visible') visibleBlockers.push(describe(el));
      if (over !== 'unseen') continue;
      droppedBackdrops.set(el, save(el, 'backdrop-filter'));
      el.style.setProperty('backdrop-filter', 'none', 'important');
      console.info(TAG, 'dropped an unseen backdrop-filter on', describe(el));
    }
    for (const [el, saved] of droppedBackdrops) {
      if (backdropOver(el, r, px) === 'unseen') continue;
      restore(el, 'backdrop-filter', saved);
      droppedBackdrops.delete(el);
      if (el.isConnected) candidates.push(el); // a drawer slides out again
    }
    report({
      fixed: [...[...hiddenVideos.keys()].map(v => 'tiny video ' + describe(v)),
        ...[...droppedBackdrops.keys()].map(el => 'unseen blur ' + describe(el))],
      visibleBlockers, otherVideos,
    });
  }
  function release() {
    for (const [v, saved] of hiddenVideos) restore(v, 'visibility', saved);
    for (const [el, saved] of droppedBackdrops) restore(el, 'backdrop-filter', saved);
    hiddenVideos.clear();
    droppedBackdrops.clear();
  }
  function report(state) {
    const text = JSON.stringify(state);
    const now = performance.now();
    // unchanged states are re-sent now and then, for a service worker that restarted
    if (text === lastReport && (!state || now - reportAt < 5000)) return;
    if (text !== lastReport && state && (state.visibleBlockers.length || state.otherVideos.length)) {
      console.info(TAG, 'left alone (visible):', [...state.visibleBlockers.map(d => 'blur ' + d), ...state.otherVideos.map(d => 'video ' + d)]);
    }
    lastReport = text;
    reportAt = now;
    try {
      chrome.runtime.sendMessage({ kind: 'rtx-unblock', state }).catch(() => {});
    } catch { // the extension was reloaded or removed: hand the page back and stop
      clearInterval(timer);
      release();
    }
  }

  const timer = setInterval(tick, 250);
  tick();
  window.__rtxVideoUnblock = true;
})();
