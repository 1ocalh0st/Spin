(() => {
  const DEFAULT_UID = "1387638520";
  const STORAGE = {
    uid: "spinWheel.music.uid.v1",
    playlistId: "spinWheel.music.playlistId.v1",
    trackId: "spinWheel.music.trackId.v1",
    volume: "spinWheel.music.volume.v1",
    volumeLastAudible: "spinWheel.music.volumeLastAudible.v1",
    muted: "spinWheel.music.muted.v1",
    settingsOpen: "spinWheel.music.settingsOpen.v1",
    fabOffset: "spinWheel.music.fabOffset.v1",
  };

  const widgetEl = document.getElementById("musicWidget");
  const fab = document.getElementById("musicFab");
  const fabCover = document.getElementById("musicFabCover");
  const backdrop = document.getElementById("musicBackdrop");
  const panel = document.getElementById("musicPanel");
  const closeBtn = document.getElementById("musicClose");
  const openSettingsBtn = document.getElementById("musicOpenSettings");

  const nowCover = document.getElementById("musicCover");
  const nowTrack = document.getElementById("musicTrack");
  const nowArtist = document.getElementById("musicArtist");

  const prevBtn = document.getElementById("musicPrev");
  const playBtn = document.getElementById("musicPlay");
  const nextBtn = document.getElementById("musicNext");
  const muteBtn = document.getElementById("musicMute");

  const timeEl = document.getElementById("musicTime");
  const seekEl = document.getElementById("musicSeek");
  const durationEl = document.getElementById("musicDuration");

  const volumeEl = document.getElementById("musicVolume");
  const volumeResetBtn = document.getElementById("musicVolumeReset");

  const settingsEl = document.getElementById("musicSettings");
  const uidInput = document.getElementById("musicUid");
  const reloadBtn = document.getElementById("musicReload");
  const playlistSelect = document.getElementById("musicPlaylist");
  const openPlaylistBtn = document.getElementById("musicOpenPlaylist");

  const searchEl = document.getElementById("musicSearch");
  const listEl = document.getElementById("musicList");
  const toastEl = document.getElementById("musicToast");

  if (!widgetEl || !fab || !backdrop || !panel) return;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setRangeFill(rangeEl) {
    if (!rangeEl) return;
    const min = Number(rangeEl.min ?? 0);
    const max = Number(rangeEl.max ?? 100);
    const value = Number(rangeEl.value ?? 0);
    const denom = Math.max(1, max - min);
    const p = clamp(((value - min) / denom) * 100, 0, 100);
    rangeEl.style.setProperty("--p", `${p}%`);
  }

  function readText(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return null;
      return String(raw);
    } catch {
      return null;
    }
  }

  function writeText(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  }

  function readBool(key) {
    const raw = readText(key);
    if (raw == null) return null;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return null;
  }

  function writeBool(key, value) {
    return writeText(key, value ? "1" : "0");
  }

  function readNumber(key) {
    const raw = readText(key);
    if (raw == null) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function setFabOffset(x, y, { persist = false } = {}) {
    const nx = Number(x);
    const ny = Number(y);
    const safeX = Number.isFinite(nx) ? nx : 0;
    const safeY = Number.isFinite(ny) ? ny : 0;
    widgetEl.style.setProperty("--music-fab-x", `${safeX.toFixed(2)}px`);
    widgetEl.style.setProperty("--music-fab-y", `${safeY.toFixed(2)}px`);
    if (persist) writeJson(STORAGE.fabOffset, { x: safeX, y: safeY });
  }

  function getViewportBox() {
    const vv = window.visualViewport;
    if (vv) {
      return {
        left: vv.offsetLeft,
        top: vv.offsetTop,
        width: vv.width,
        height: vv.height,
      };
    }
    return { left: 0, top: 0, width: window.innerWidth || 1, height: window.innerHeight || 1 };
  }

  function clampFabOffset(nextX, nextY, widgetRect) {
    const vp = getViewportBox();
    const padding = 8;
    const minDx = (vp.left + padding) - widgetRect.left;
    const maxDx = (vp.left + vp.width - padding) - widgetRect.right;
    const minDy = (vp.top + padding) - widgetRect.top;
    const maxDy = (vp.top + vp.height - padding) - widgetRect.bottom;
    return {
      x: Math.min(maxDx, Math.max(minDx, nextX)),
      y: Math.min(maxDy, Math.max(minDy, nextY)),
    };
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function normalizeNeteaseUrl(url) {
    const raw = String(url ?? "").trim();
    if (!raw) return "";
    return raw.startsWith("http://") ? `https://${raw.slice("http://".length)}` : raw;
  }

  function sameString(a, b) {
    return String(a ?? "") === String(b ?? "");
  }

  let restoreFocusEl = null;
  let closeTimer = 0;

  function openPanel() {
    if (document.body.classList.contains("music-open")) return;
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = 0;
    }

    restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backdrop.hidden = false;
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      document.body.classList.add("music-open");
      closeBtn?.focus?.({ preventScroll: true });
    });
  }

  function closePanel({ restoreFocus = true } = {}) {
    if (!document.body.classList.contains("music-open")) return;
    document.body.classList.remove("music-open");
    fab.setAttribute("aria-expanded", "false");

    const finish = () => {
      if (document.body.classList.contains("music-open")) return;
      backdrop.hidden = true;
      panel.hidden = true;
      if (!restoreFocus) {
        restoreFocusEl = null;
        return;
      }
      const target = restoreFocusEl;
      restoreFocusEl = null;
      if (target && document.documentElement.contains(target)) target.focus?.({ preventScroll: true });
      else fab.focus?.({ preventScroll: true });
    };

    const onEnd = () => finish();
    panel.addEventListener("transitionend", onEnd, { once: true });
    closeTimer = setTimeout(finish, 260);
  }

  function togglePanel() {
    if (document.body.classList.contains("music-open")) closePanel();
    else openPanel();
  }

  let suppressFabClick = false;
  fab.addEventListener("click", () => {
    if (suppressFabClick) {
      suppressFabClick = false;
      return;
    }
    togglePanel();
  });
  backdrop.addEventListener("click", () => closePanel());
  closeBtn?.addEventListener("click", () => closePanel());

  (() => {
    const stored = readJson(STORAGE.fabOffset);
    if (stored && typeof stored === "object") setFabOffset(stored.x, stored.y, { persist: false });

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startOffsetX = 0;
    let startOffsetY = 0;
    let baseRect = null;

    const parsePx = (value) => {
      const num = Number(String(value ?? "").replace("px", ""));
      return Number.isFinite(num) ? num : 0;
    };

    const currentOffset = () => ({
      x: parsePx(getComputedStyle(widgetEl).getPropertyValue("--music-fab-x")),
      y: parsePx(getComputedStyle(widgetEl).getPropertyValue("--music-fab-y")),
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      baseRect = null;
      const { x, y } = currentOffset();
      setFabOffset(x, y, { persist: true });
    };

    fab.addEventListener("pointerdown", (event) => {
      if (document.body.classList.contains("music-open")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      fab.setPointerCapture?.(event.pointerId);
      const cur = currentOffset();
      startOffsetX = cur.x;
      startOffsetY = cur.y;
      startX = event.clientX;
      startY = event.clientY;
      baseRect = widgetEl.getBoundingClientRect();
      dragging = true;
      suppressFabClick = false;
    });

    fab.addEventListener("pointermove", (event) => {
      if (!dragging || !baseRect) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!suppressFabClick && Math.hypot(dx, dy) >= 6) suppressFabClick = true;

      const nextRawX = startOffsetX + dx;
      const nextRawY = startOffsetY + dy;
      const clamped = clampFabOffset(nextRawX, nextRawY, baseRect);
      setFabOffset(clamped.x, clamped.y, { persist: false });
    });

    fab.addEventListener("pointerup", () => endDrag());
    fab.addEventListener("pointercancel", () => endDrag());

    const clampOnResize = () => {
      const cur = currentOffset();
      const rect = widgetEl.getBoundingClientRect();
      const clamped = clampFabOffset(cur.x, cur.y, rect);
      setFabOffset(clamped.x, clamped.y, { persist: true });
    };

    window.visualViewport?.addEventListener("resize", clampOnResize, { passive: true });
    window.addEventListener("resize", clampOnResize, { passive: true });
  })();

  document.addEventListener("keydown", (event) => {
    if (!document.body.classList.contains("music-open")) return;
    if (document.body.classList.contains("show-result")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }

    if (event.key !== "Tab") return;
    const focusables = panel.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const list = Array.from(focusables).filter((el) => !el.hasAttribute("hidden"));
    if (!list.length) return;

    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;

    if (!panel.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus?.({ preventScroll: true });
      return;
    }

    if (event.shiftKey) {
      if (active === first) {
        event.preventDefault();
        last.focus?.({ preventScroll: true });
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus?.({ preventScroll: true });
    }
  });

  function setToast(text, kind = "") {
    if (!toastEl) return;
    toastEl.textContent = String(text ?? "");
    if (kind) toastEl.setAttribute("data-kind", kind);
    else toastEl.removeAttribute("data-kind");
  }

  function apiUrl(path, params = {}) {
    const url = new URL(path, window.location.origin);
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    return url;
  }

  async function apiGet(path, params) {
    const resp = await fetch(apiUrl(path, params), { headers: { Accept: "application/json" } });
    const text = await resp.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // ignore
    }
    if (!resp.ok) {
      const msg = json?.msg || json?.message || `请求失败（${resp.status}）`;
      const err = new Error(msg);
      err.status = resp.status;
      err.payload = json;
      throw err;
    }
    return json ?? {};
  }

  function trackArtists(track) {
    const list = track?.ar ?? track?.artists ?? [];
    return (Array.isArray(list) ? list : []).map((a) => a?.name).filter(Boolean).join(" / ");
  }

  function trackAlbum(track) {
    return track?.al ?? track?.album ?? null;
  }

  function trackCoverUrl(track) {
    const album = trackAlbum(track);
    return normalizeNeteaseUrl(album?.picUrl || album?.blurPicUrl || "");
  }

  function playlistWebUrl(id) {
    return `https://music.163.com/#/playlist?id=${encodeURIComponent(String(id ?? ""))}`;
  }

  function songWebUrl(id) {
    return `https://music.163.com/#/song?id=${encodeURIComponent(String(id ?? ""))}`;
  }

  function trackIdListFromResult(result) {
    const raw = Array.isArray(result?.trackIds) ? result.trackIds : [];
    return raw.map((item) => String(item?.id ?? "")).filter((id) => /^[0-9]+$/.test(id));
  }

  function orderTracksByIds(list, ids) {
    if (!Array.isArray(list) || !list.length || !ids.length) return list;
    const map = new Map();
    for (const track of list) {
      if (track?.id != null) map.set(String(track.id), track);
    }
    const ordered = [];
    for (const id of ids) {
      const track = map.get(String(id));
      if (track) ordered.push(track);
    }
    return ordered.length ? ordered : list;
  }

  let uid = readText(STORAGE.uid) || DEFAULT_UID;
  let playlists = [];
  let playlistId = readText(STORAGE.playlistId) || "";
  let tracks = [];
  let currentIndex = -1;
  let searchTerm = "";

  const audio = new Audio();
  audio.preload = "none";
  audio.crossOrigin = "anonymous";

  audio.volume = clamp(readNumber(STORAGE.volume) ?? 0.8, 0, 1);
  audio.muted = Boolean(readBool(STORAGE.muted) ?? false);

  let lastAudibleVolume = clamp(readNumber(STORAGE.volumeLastAudible) ?? (audio.volume > 0.001 ? audio.volume : 0.8), 0.05, 1);
  let lastPositionUpdate = 0;

  const songUrlCache = new Map();
  let coverToken = 0;

  function coverParamUrl(url, size) {
    const base = normalizeNeteaseUrl(url);
    if (!base) return "";
    const s = clamp(Number(size) || 0, 8, 1024);
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}param=${s}y${s}`;
  }

  function updateMediaSession(track) {
    if (!("mediaSession" in navigator) || !navigator.mediaSession) return;
    if (typeof MediaMetadata !== "function") return;

    try {
      if (!track) {
        navigator.mediaSession.metadata = null;
        return;
      }

      const album = trackAlbum(track);
      const cover = trackCoverUrl(track);
      const artwork = cover
        ? [96, 128, 192, 256, 384, 512].map((s) => ({
            src: coverParamUrl(cover, s),
            sizes: `${s}x${s}`,
            type: "image/jpeg",
          }))
        : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: String(track?.name ?? ""),
        artist: trackArtists(track),
        album: String(album?.name ?? ""),
        artwork,
      });
    } catch {
      // ignore
    }
  }

  function updateMediaPlaybackState(state) {
    if (!("mediaSession" in navigator) || !navigator.mediaSession) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {
      // ignore
    }
  }

  function updateMediaPositionState() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession) return;
    if (typeof navigator.mediaSession.setPositionState !== "function") return;

    const t = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const d = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!(d > 0)) return;

    const now = Date.now();
    if (now - lastPositionUpdate < 250) return;
    lastPositionUpdate = now;

    try {
      navigator.mediaSession.setPositionState({
        duration: d,
        playbackRate: Number.isFinite(audio.playbackRate) ? audio.playbackRate : 1,
        position: clamp(t, 0, d),
      });
    } catch {
      // ignore
    }
  }

  function setupMediaSession() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession) return;

    const safe = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // ignore
      }
    };

    safe("play", () => {
      if (!tracks.length) return;
      if (audio.src) audio.play().catch(() => setToast("无法播放：需要用户手势。", "error"));
      else playAt(currentIndex >= 0 ? currentIndex : 0, { userGesture: true }).catch(() => {});
    });
    safe("pause", () => audio.pause());
    safe("previoustrack", () => {
      if (!tracks.length) return;
      const idx = currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
      playAt(idx, { userGesture: true }).catch(() => {});
    });
    safe("nexttrack", () => {
      if (!tracks.length) return;
      const idx = currentIndex >= 0 && currentIndex < tracks.length - 1 ? currentIndex + 1 : 0;
      playAt(idx, { userGesture: true }).catch(() => {});
    });
    safe("seekto", (details) => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (!(d > 0)) return;
      const target = clamp(Number(details?.seekTime ?? 0), 0, d);
      audio.currentTime = target;
      updateTimesUi();
    });
    safe("seekbackward", (details) => {
      const offset = clamp(Number(details?.seekOffset ?? 10), 1, 60);
      audio.currentTime = Math.max(0, (Number.isFinite(audio.currentTime) ? audio.currentTime : 0) - offset);
      updateTimesUi();
    });
    safe("seekforward", (details) => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (!(d > 0)) return;
      const offset = clamp(Number(details?.seekOffset ?? 10), 1, 60);
      audio.currentTime = Math.min(d, (Number.isFinite(audio.currentTime) ? audio.currentTime : 0) + offset);
      updateTimesUi();
    });
    safe("stop", () => {
      audio.pause();
      audio.currentTime = 0;
      updateTimesUi();
    });
  }

  function syncVolumeUi() {
    if (!volumeEl) return;
    volumeEl.value = String(Math.round(clamp(audio.volume, 0, 1) * 100));
    setRangeFill(volumeEl);
  }

  function updateMuteUi() {
    const muted = audio.muted || audio.volume <= 0.001;
    muteBtn?.setAttribute("aria-pressed", muted ? "true" : "false");
    if (muteBtn) {
      muteBtn.textContent = muted ? "🔇" : "🔈";
      muteBtn.setAttribute("aria-label", muted ? "取消静音" : "静音");
    }
  }

  function updatePlayUi(isPlaying) {
    widgetEl.classList.toggle("is-playing", isPlaying);
    playBtn?.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    if (playBtn) {
      playBtn.textContent = isPlaying ? "❚❚" : "▶";
      playBtn.setAttribute("aria-label", isPlaying ? "暂停" : "播放");
    }
    updateMediaPlaybackState(isPlaying ? "playing" : "paused");
  }

  function updateTimesUi() {
    const t = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const d = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (timeEl) timeEl.textContent = formatTime(t);
    if (durationEl) durationEl.textContent = formatTime(d);
    if (seekEl) {
      const p = d > 0 ? clamp(t / d, 0, 1) : 0;
      seekEl.value = String(Math.round(p * 1000));
      setRangeFill(seekEl);
    }
    updateMediaPositionState();
  }

  function resetPlayback() {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    updatePlayUi(false);
    updateTimesUi();
  }

  function setWidgetGradient(a, b, c) {
    widgetEl.style.setProperty("--music-a", a);
    widgetEl.style.setProperty("--music-b", b);
    widgetEl.style.setProperty("--music-c", c);
  }

  function toRgba(color, alpha) {
    const [r, g, b] = color.map((n) => clamp(Math.round(n), 0, 255));
    return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(2)})`;
  }

  function luma(color) {
    const [r, g, b] = color;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function nudgeLuma(color, targetMin = 0.18, targetMax = 0.85) {
    const [r0, g0, b0] = color;
    let r = r0;
    let g = g0;
    let b = b0;
    const y = luma([r, g, b]);
    if (y < targetMin) {
      const k = clamp((targetMin - y) / 0.6, 0, 1);
      r = r + (255 - r) * k * 0.55;
      g = g + (255 - g) * k * 0.55;
      b = b + (255 - b) * k * 0.55;
    } else if (y > targetMax) {
      const k = clamp((y - targetMax) / 0.6, 0, 1);
      r = r * (1 - k * 0.55);
      g = g * (1 - k * 0.55);
      b = b * (1 - k * 0.55);
    }
    return [r, g, b];
  }

  function dist2(a, b) {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  function pickInitialCenters(pixels, k) {
    const centers = [];
    centers.push(pixels[Math.floor(Math.random() * pixels.length)]);
    while (centers.length < k) {
      let best = pixels[0];
      let bestD = -1;
      for (const p of pixels) {
        let d = Infinity;
        for (const c of centers) d = Math.min(d, dist2(p, c));
        if (d > bestD) {
          bestD = d;
          best = p;
        }
      }
      centers.push(best);
    }
    return centers.map((c) => c.slice());
  }

  function kmeans(pixels, k = 3, iters = 8) {
    const centers = pickInitialCenters(pixels, k);
    const assignments = new Array(pixels.length).fill(0);

    for (let iter = 0; iter < iters; iter += 1) {
      const sums = new Array(k).fill(0).map(() => [0, 0, 0, 0]);

      for (let i = 0; i < pixels.length; i += 1) {
        const p = pixels[i];
        let best = 0;
        let bestD = Infinity;
        for (let j = 0; j < k; j += 1) {
          const d = dist2(p, centers[j]);
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        }
        assignments[i] = best;
        sums[best][0] += p[0];
        sums[best][1] += p[1];
        sums[best][2] += p[2];
        sums[best][3] += 1;
      }

      for (let j = 0; j < k; j += 1) {
        const count = sums[j][3];
        if (count <= 0) continue;
        centers[j][0] = sums[j][0] / count;
        centers[j][1] = sums[j][1] / count;
        centers[j][2] = sums[j][2] / count;
      }
    }

    const counts = new Array(k).fill(0);
    for (const a of assignments) counts[a] += 1;
    return centers.map((c, i) => ({ color: c, count: counts[i] })).sort((a, b) => b.count - a.count);
  }

  async function extractGradientFromImageUrl(url) {
    const src = normalizeNeteaseUrl(url);
    if (!src) return null;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = src;

    try {
      if (typeof img.decode === "function") await img.decode();
      else await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
    } catch {
      return null;
    }

    const w = 36;
    const h = 36;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    let data;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch {
      return null;
    }

    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 220) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const y = luma([r, g, b]);
      if (y < 0.06 || y > 0.97) continue;
      pixels.push([r, g, b]);
    }

    if (pixels.length < 24) return null;
    const clusters = kmeans(pixels, 3, 8);
    if (clusters.length < 2) return null;

    let bestA = clusters[0].color;
    let bestB = clusters[Math.min(1, clusters.length - 1)].color;
    let bestD = dist2(bestA, bestB);

    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const d = dist2(clusters[i].color, clusters[j].color);
        if (d > bestD) {
          bestD = d;
          bestA = clusters[i].color;
          bestB = clusters[j].color;
        }
      }
    }

    const third = clusters.find((c) => c.color !== bestA && c.color !== bestB)?.color ?? clusters[0].color;

    const a = nudgeLuma(bestA, 0.16, 0.88);
    const b = nudgeLuma(bestB, 0.16, 0.88);
    const c = nudgeLuma(third, 0.16, 0.88);

    return {
      a: toRgba(a, 0.92),
      b: toRgba(b, 0.82),
      c: toRgba(c, 0.70),
    };
  }

  function setNowPlayingUi(track) {
    const title = String(track?.name ?? "—");
    const artist = trackArtists(track) || "—";
    if (nowTrack) {
      nowTrack.textContent = title;
      nowTrack.title = title;
    }
    if (nowArtist) {
      nowArtist.textContent = artist;
      nowArtist.title = artist;
    }
    updateMediaSession(track);
  }

  function setCovers(track) {
    const pic = trackCoverUrl(track);
    const token = (coverToken += 1);

    const src = pic ? `${pic}?param=200y200` : "";
    if (src) {
      widgetEl.classList.add("has-cover");
      nowCover.src = src;
      fabCover.src = src;
    } else {
      widgetEl.classList.remove("has-cover");
      nowCover.removeAttribute("src");
      fabCover.removeAttribute("src");
    }

    extractGradientFromImageUrl(src).then((colors) => {
      if (token !== coverToken) return;
      if (!colors) return;
      setWidgetGradient(colors.a, colors.b, colors.c);
    });
  }

  function currentTrack() {
    return currentIndex >= 0 && currentIndex < tracks.length ? tracks[currentIndex] : null;
  }

  function isTrackPlayable(track) {
    if (!track) return false;
    if (track.playable === true) return true;
    if (track.playable === false) return false;
    return true;
  }

  function renderTrackList() {
    if (!listEl) return;
    listEl.innerHTML = "";

    const indices = [];
    for (let i = 0; i < tracks.length; i += 1) {
      const t = tracks[i];
      if (!t) continue;
      if (!searchTerm) {
        indices.push(i);
        continue;
      }
      const hay = `${t.name} ${trackArtists(t)} ${trackAlbum(t)?.name ?? ""}`.toLowerCase();
      if (hay.includes(searchTerm)) indices.push(i);
    }

    if (!indices.length) {
      const empty = document.createElement("div");
      empty.className = "music-toast";
      empty.textContent = searchTerm ? "未找到匹配曲目。" : "暂无曲目。";
      listEl.appendChild(empty);
      return;
    }

    indices.forEach((idx, order) => {
      const t = tracks[idx];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "music-item";
      btn.setAttribute("role", "listitem");
      btn.dataset.index = String(idx);
      btn.dataset.id = String(t.id ?? "");

      if (idx === currentIndex) btn.classList.add("is-current");

      const playable = isTrackPlayable(t);
      if (!playable) btn.disabled = true;

      const num = document.createElement("div");
      num.className = "music-item-index";
      num.textContent = String(order + 1);

      const text = document.createElement("div");
      const title = document.createElement("div");
      title.className = "music-item-title";
      title.textContent = t.name ?? "—";
      const sub = document.createElement("div");
      sub.className = "music-item-sub";
      sub.textContent = `${trackArtists(t) || "—"} · ${(trackAlbum(t)?.name ?? "—") || "—"}`;
      text.appendChild(title);
      text.appendChild(sub);

      btn.appendChild(num);
      btn.appendChild(text);

      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.index);
        if (!Number.isFinite(i)) return;
        playAt(i, { userGesture: true }).catch(() => {});
      });

      btn.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (t?.id) window.open(songWebUrl(t.id), "_blank", "noopener,noreferrer");
      });

      listEl.appendChild(btn);
    });
  }

  async function fetchSongUrl(songId) {
    const id = String(songId ?? "");
    if (!/^[0-9]+$/.test(id)) return { url: null };

    const cached = songUrlCache.get(id);
    if (cached && cached.expiresAt && cached.expiresAt > Date.now()) return cached;

    const data = await apiGet("/api/netease/song/url", { ids: id, br: 320000 });
    const item = Array.isArray(data?.data) ? data.data[0] : null;
    const url = normalizeNeteaseUrl(item?.url || "");
    const expi = Number(item?.expi ?? 0);
    const expiresAt = expi > 0 ? Date.now() + expi * 1000 * 0.9 : Date.now() + 3 * 60 * 1000;
    const entry = { url: url || null, code: item?.code, fee: item?.fee, expiresAt };
    songUrlCache.set(id, entry);
    return entry;
  }

  async function fetchTrackDetails(ids) {
    const list = Array.isArray(ids) ? ids.filter((id) => /^[0-9]+$/.test(id)) : [];
    if (!list.length) return [];

    const batchSize = 100;
    const out = [];
    for (let i = 0; i < list.length; i += batchSize) {
      const chunk = list.slice(i, i + batchSize);
      setToast(`正在载入曲目… (${Math.min(i + batchSize, list.length)}/${list.length})`);
      const data = await apiGet("/api/netease/song/detail", { ids: chunk.join(",") });
      const songs = Array.isArray(data?.songs) ? data.songs : [];
      out.push(...songs);
    }
    return out;
  }

  async function playAt(index, { userGesture = false } = {}) {
    if (!tracks.length) return;
    const idx = clamp(Number(index), 0, tracks.length - 1);
    const track = tracks[idx];
    if (!track) return;

    currentIndex = idx;
    writeText(STORAGE.trackId, String(track.id ?? ""));
    renderTrackList();
    setNowPlayingUi(track);
    setCovers(track);

    let urlEntry;
    try {
      urlEntry = await fetchSongUrl(track.id);
    } catch {
      setToast("获取播放地址失败：请检查网络或稍后重试。", "error");
      updatePlayUi(false);
      return;
    }

    const { url } = urlEntry || {};
    track.playable = Boolean(url);
    if (!url) {
      setToast("该曲目暂无可播放地址（可能需要 VIP / 版权限制）。[服务器在国外，很多听不了。。求赞助]", "error");
      renderTrackList();
      updatePlayUi(false);
      return;
    }

    audio.src = url;
    try {
      await audio.play();
      if (userGesture) setToast("");
      updatePlayUi(true);
    } catch {
      updatePlayUi(false);
      setToast("无法播放：可能需要用户手势或浏览器禁止自动播放。", "error");
    }
  }

  function seekToRatio(ratio) {
    const d = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!(d > 0)) return;
    audio.currentTime = clamp(ratio, 0, 1) * d;
    updateTimesUi();
  }

  seekEl?.addEventListener("input", () => {
    setRangeFill(seekEl);
  });

  seekEl?.addEventListener("change", () => {
    const v = Number(seekEl.value ?? 0);
    const ratio = clamp(v / 1000, 0, 1);
    seekToRatio(ratio);
  });

  playBtn?.addEventListener("click", () => {
    if (!tracks.length) return;
    if (audio.src && !audio.paused) audio.pause();
    else if (audio.src) audio.play().catch(() => setToast("无法播放：需要用户手势。", "error"));
    else playAt(currentIndex >= 0 ? currentIndex : 0, { userGesture: true }).catch(() => {});
  });

  prevBtn?.addEventListener("click", () => {
    if (!tracks.length) return;
    const idx = currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
    playAt(idx, { userGesture: true }).catch(() => {});
  });

  nextBtn?.addEventListener("click", () => {
    if (!tracks.length) return;
    const idx = currentIndex >= 0 && currentIndex < tracks.length - 1 ? currentIndex + 1 : 0;
    playAt(idx, { userGesture: true }).catch(() => {});
  });

  muteBtn?.addEventListener("click", () => {
    const silentByVolume = audio.volume <= 0.001;

    if (audio.muted) {
      audio.muted = false;
      if (silentByVolume) audio.volume = clamp(lastAudibleVolume || 0.8, 0, 1);
      return;
    }

    if (silentByVolume) {
      audio.volume = clamp(lastAudibleVolume || 0.8, 0, 1);
      return;
    }

    lastAudibleVolume = clamp(audio.volume || 0.8, 0.05, 1);
    writeText(STORAGE.volumeLastAudible, String(lastAudibleVolume));
    audio.muted = true;
  });

  volumeEl?.addEventListener("input", () => {
    const v = clamp(Number(volumeEl.value ?? 0) / 100, 0, 1);
    if (v > 0.001) {
      lastAudibleVolume = clamp(v, 0.05, 1);
      writeText(STORAGE.volumeLastAudible, String(lastAudibleVolume));
    }
    audio.volume = v;
    if (audio.muted && v > 0.001) audio.muted = false;
    setRangeFill(volumeEl);
  });

  volumeResetBtn?.addEventListener("click", () => {
    lastAudibleVolume = 0.8;
    writeText(STORAGE.volumeLastAudible, String(lastAudibleVolume));
    audio.volume = lastAudibleVolume;
    audio.muted = false;
    syncVolumeUi();
  });

  audio.addEventListener("play", () => updatePlayUi(true));
  audio.addEventListener("pause", () => updatePlayUi(false));
  audio.addEventListener("volumechange", () => {
    writeText(STORAGE.volume, String(audio.volume));
    writeBool(STORAGE.muted, audio.muted);
    if (audio.volume > 0.001) {
      lastAudibleVolume = clamp(audio.volume, 0.05, 1);
      writeText(STORAGE.volumeLastAudible, String(lastAudibleVolume));
    }
    syncVolumeUi();
    updateMuteUi();
  });
  audio.addEventListener("loadedmetadata", () => updateTimesUi());
  audio.addEventListener("timeupdate", () => updateTimesUi());
  audio.addEventListener("ended", () => {
    if (!tracks.length) return;
    const idx = currentIndex >= 0 && currentIndex < tracks.length - 1 ? currentIndex + 1 : 0;
    playAt(idx).catch(() => {});
  });

  function toggleSettings() {
    if (!settingsEl) return;
    const nextHidden = !settingsEl.hidden;
    settingsEl.hidden = nextHidden;
    writeBool(STORAGE.settingsOpen, !nextHidden);
    if (openSettingsBtn) openSettingsBtn.setAttribute("aria-pressed", nextHidden ? "false" : "true");
    setToast(nextHidden ? "设置已收起" : "设置已展开", "ok");
  }

  openSettingsBtn?.addEventListener("click", () => toggleSettings());

  uidInput && (uidInput.value = uid);
  if (settingsEl) {
    settingsEl.hidden = !(readBool(STORAGE.settingsOpen) ?? false);
    if (openSettingsBtn) openSettingsBtn.setAttribute("aria-pressed", settingsEl.hidden ? "false" : "true");
  }

  openPlaylistBtn?.addEventListener("click", () => {
    if (!playlistId) return;
    window.open(playlistWebUrl(playlistId), "_blank", "noopener,noreferrer");
  });

  playlistSelect?.addEventListener("change", () => {
    const id = String(playlistSelect.value ?? "");
    if (!id) return;
    playlistId = id;
    writeText(STORAGE.playlistId, playlistId);
    loadPlaylist(playlistId).catch(() => {
      setToast("载入歌单失败：请检查网络或稍后重试。", "error");
    });
  });

  reloadBtn?.addEventListener("click", () => {
    const next = String(uidInput?.value ?? "").trim();
    if (!/^[0-9]+$/.test(next)) {
      setToast("请输入有效的 UID（纯数字）。", "error");
      uidInput?.focus?.();
      return;
    }
    uid = next;
    writeText(STORAGE.uid, uid);
    loadPlaylists().catch(() => {
      setToast("歌单载入失败：请检查网络或稍后重试。", "error");
    });
  });

  searchEl?.addEventListener("input", () => {
    searchTerm = String(searchEl.value ?? "").trim().toLowerCase();
    renderTrackList();
  });

  async function loadPlaylists() {
    setToast("正在载入歌单…");
    if (playlistSelect) {
      playlistSelect.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "载入中…";
      playlistSelect.appendChild(opt);
    }

    const data = await apiGet("/api/netease/user/playlists", { uid, offset: 0, limit: 100 });
    const list = Array.isArray(data?.playlist) ? data.playlist : [];
    playlists = list;

    if (playlistSelect) {
      playlistSelect.innerHTML = "";
      for (const pl of playlists) {
        const opt = document.createElement("option");
        opt.value = String(pl.id ?? "");
        const suffix = pl.specialType === 5 ? "（喜欢，可能不可读）" : `（${pl.trackCount ?? 0}首）`;
        opt.textContent = `${pl.name ?? "未命名"} ${suffix}`;
        playlistSelect.appendChild(opt);
      }
    }

    if (!playlistId || !playlists.some((p) => sameString(p.id, playlistId))) {
      const preferred =
        playlists.find((p) => p.specialType !== 5)?.id ?? playlists.find((p) => p.id)?.id ?? "";
      playlistId = String(preferred ?? "");
    }

    if (playlistId && playlistSelect) playlistSelect.value = playlistId;
    if (playlistId) writeText(STORAGE.playlistId, playlistId);

    setToast("");
    if (playlistId) await loadPlaylist(playlistId);
  }

  async function loadPlaylist(id) {
    const pid = String(id ?? "");
    if (!/^[0-9]+$/.test(pid)) return;

    setToast("正在载入曲目…");
    listEl && (listEl.innerHTML = "");

    const data = await apiGet("/api/netease/playlist/detail", { id: pid });
    if (data?.code && data.code !== 200) {
      if (data.code === 20001) {
        setToast("该歌单可能需要登录才能访问（例如：喜欢的音乐）。", "error");
        tracks = [];
        currentIndex = -1;
        renderTrackList();
        setNowPlayingUi(null);
        setCovers(null);
        resetPlayback();
        return;
      }
      setToast(`载入失败（code=${data.code}）。`, "error");
      tracks = [];
      currentIndex = -1;
      renderTrackList();
      setNowPlayingUi(null);
      setCovers(null);
      resetPlayback();
      return;
    }

    const result = data?.playlist ?? data?.result ?? null;
    const baseTracks = Array.isArray(result?.tracks) ? result.tracks : [];
    const trackIds = trackIdListFromResult(result);

    let list = baseTracks;
    let detailError = false;

    if (trackIds.length && trackIds.length > baseTracks.length) {
      try {
        const detailed = await fetchTrackDetails(trackIds);
        if (detailed.length) list = orderTracksByIds(detailed, trackIds);
      } catch {
        detailError = true;
      }
    } else if (trackIds.length) {
      list = orderTracksByIds(baseTracks, trackIds);
    }

    tracks = list.map((t) => ({ ...t, playable: t.playable ?? null }));

    const savedTrackId = readText(STORAGE.trackId) || "";
    const idx = tracks.findIndex((t) => sameString(t?.id, savedTrackId));
    currentIndex = idx >= 0 ? idx : tracks.length ? 0 : -1;

    searchTerm = "";
    if (searchEl) searchEl.value = "";

    resetPlayback();

    renderTrackList();
    const t = currentTrack();
    if (t) {
      setNowPlayingUi(t);
      setCovers(t);
    } else {
      setNowPlayingUi(null);
      setCovers(null);
      setToast("该歌单没有可显示的曲目。", "error");
    }

    if (detailError) setToast("曲目详情载入失败，已显示部分曲目。", "error");
    else setToast("");
  }

  updateMuteUi();
  updatePlayUi(false);
  updateTimesUi();
  setRangeFill(seekEl);
  syncVolumeUi();
  setupMediaSession();

  loadPlaylists().catch(() => {
    setToast("歌单载入失败：请检查网络或稍后重试。", "error");
  });
})();
