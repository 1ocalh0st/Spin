/* eslint-disable no-restricted-globals */
(() => {
  const tau = Math.PI * 2;
  const omegaStop = 0.7;
  const decayK = 0.75;
  const suspenseSeconds = 1.5;

  const wheelStage = document.getElementById("wheelStage");
  const canvas = document.getElementById("wheelCanvas");
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });

  const stageEl = document.querySelector(".stage");

  const resultCard = document.getElementById("resultCard");
  const resultBackdrop = document.getElementById("resultBackdrop");
  const resultText = document.getElementById("resultText");
  const resultClose = document.getElementById("resultClose");
  const spinFab = document.getElementById("spinFab");
  const confirmResult = document.getElementById("confirmResult");
  const spinAgain = document.getElementById("spinAgain");
  const audioToggle = document.getElementById("audioToggle");
  const audioIcon = document.getElementById("audioIcon");
  const wheelTitleEl = document.getElementById("wheelTitle");

  const optionsListEl = document.getElementById("optionsList");
  const addOptionBtn = document.getElementById("addOption");
  const openImportBtn = document.getElementById("openImport");
  const exportJsonBtn = document.getElementById("exportJson");
  const importJsonBtn = document.getElementById("importJsonBtn");
  const importJsonInput = document.getElementById("importJsonInput");
  const importDialog = document.getElementById("importDialog");
  const importTextEl = document.getElementById("importText");
  const pasteClipboardBtn = document.getElementById("pasteClipboard");
  const panelEl = document.querySelector(".panel");
  const panelToggle = document.getElementById("panelToggle");
  const panelActionsMore = document.getElementById("panelActionsMore");
  const panelActionsDialog = document.getElementById("panelActionsDialog");
  const panelSizeRow = document.getElementById("panelSizeRow");
  const panelSizeRange = document.getElementById("panelSizeRange");
  const panelSizeValue = document.getElementById("panelSizeValue");
  const panelSizeReset = document.getElementById("panelSizeReset");
  const soundModeSelect = document.getElementById("soundModeSelect");
  const panelDragHandle = document.getElementById("panelDragHandle");
  const avgWeightsBtn = document.getElementById("avgWeights");

  const presetSelect = document.getElementById("presetSelect");
  const usePresetBtn = document.getElementById("usePreset");
  const openWheelsBtn = document.getElementById("openWheels");
  const wheelDialog = document.getElementById("wheelDialog");
  const wheelNameEl = document.getElementById("wheelName");
  const saveWheelBtn = document.getElementById("saveWheel");
  const wheelSelectEl = document.getElementById("wheelSelect");
  const loadWheelBtn = document.getElementById("loadWheel");
  const deleteWheelBtn = document.getElementById("deleteWheel");
  const wheelMessageEl = document.getElementById("wheelMessage");

  const random = (() => {
    let seed = (crypto?.getRandomValues?.(new Uint32Array(1))?.[0] ?? Date.now()) >>> 0;
    return {
      next() {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return seed / 4294967296;
      },
      int(maxExclusive) {
        return Math.floor(this.next() * maxExclusive);
      },
    };
  })();

  const presets = {
    couple_movies: [
      "爱在黎明破晓前",
      "爱乐之城",
      "时空恋旅人",
      "傲慢与偏见",
      "诺丁山",
      "美丽心灵的永恒阳光",
      "她",
      "午夜巴黎",
      "恋恋笔记本",
      "你的名字",
      "天使爱美丽",
      "摘金奇缘",
    ],
    dinner_ideas: [
      "寿喜锅",
      "番茄牛腩",
      "日式咖喱",
      "照烧鸡腿饭",
      "意大利肉酱面",
      "墨西哥卷",
      "韩式拌饭",
      "三文鱼沙拉",
      "麻辣香锅",
      "烤蔬菜 + 牛排",
    ],
    date_ideas: [
      "看日落 + 走到天黑",
      "一起做饭（限定一锅到底）",
      "互选三首歌做播放列表",
      "城市漫步拍照挑战",
      "桌游/拼图之夜",
      "周边一日小旅行",
      "逛书店 + 给对方挑一本",
      "去咖啡店写明信片",
      "一起学一个新菜/新技能",
      "雨天电影马拉松",
    ],
  };

  let options = [
    "看电影",
    "吃火锅",
    "喝咖啡",
    "去爬山",
    "尝试新餐厅",
    "在家做饭",
    "去电玩城",
    "逛博物馆",
  ];
  let weights = options.map(() => 1);

  const DEFAULT_WHEEL_NAME = "转盘";
  let currentWheelName = DEFAULT_WHEEL_NAME;

  let lastWeightFocus = 0;

  let angle = 0;
  let spinning = false;
  let suspense = false;
  let selectedIndex = 0;
  let highlightIndex = null;

  let startAngle = 0;
  let targetAngle = 0;
  let omega0 = 0;
  let omega = 0;
  let duration = 0;
  let elapsed = 0;
  let lastTs = 0;
  let lastIndex = 0;
  let lastTickTs = 0;
  let idleT = 0;

  let reduceMotion = false;
  const reduceMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  reduceMotion = reduceMotionQuery?.matches ?? false;
  if (reduceMotionQuery) {
    const update = (event) => {
      reduceMotion = Boolean(event?.matches);
    };
    if (typeof reduceMotionQuery.addEventListener === "function") reduceMotionQuery.addEventListener("change", update);
    else if (typeof reduceMotionQuery.addListener === "function") reduceMotionQuery.addListener(update);
  }

  let audioEnabled = true;
  let soundMode = "default";
  let audioCtx = null;
  let masterGain = null;
  let noiseBuffer = null;
  let panelCollapsed = false;
  let restoreFocusEl = null;
  let saveCurrentWheelTimer = 0;

  if ("serviceWorker" in navigator) {
    const wasControlled = Boolean(navigator.serviceWorker.controller);
    let swReloading = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!wasControlled) return;
      if (swReloading) return;
      swReloading = true;
      window.location.reload();
    });

    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker
          .register("./sw.js")
          .then((reg) => reg.update().catch(() => { }))
          .catch(() => { });
      },
      { once: true },
    );
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function coerceWeight(value, fallback = 1) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, num);
  }

  function distributeIntegersEvenly(total, count) {
    const sum = Math.max(0, Math.floor(Number(total) || 0));
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (n <= 0) return [];
    const base = Math.floor(sum / n);
    const extra = sum - base * n;
    const out = new Array(n).fill(base);
    for (let i = 0; i < extra; i += 1) out[i] += 1;
    return out;
  }


  function circularDistance(a, b, n) {
    const d = Math.abs(a - b);
    return Math.min(d, n - d);
  }

  // Preferred balancing order when distributing rounding / empty-weight cases:
  // adjust the *previous* items first, which feels more natural when dragging sliders.
  function balanceOrderAll(n, anchor) {
    const out = [];
    const a = modPositive(Number(anchor) || 0, n);
    for (let step = 0; step < n; step += 1) out.push(modPositive(a - step, n));
    return out;
  }

  function balanceOrder(n, anchor) {
    const out = [];
    const a = modPositive(Number(anchor) || 0, n);
    for (let step = 1; step < n; step += 1) out.push(modPositive(a - step, n));
    return out;
  }

  function normalizeWeightsTo100(anchorIndex = lastWeightFocus) {
  const n = options.length;
  if (n <= 0) {
    weights = [];
    return;
  }

  const anchor = clamp(Math.floor(Number(anchorIndex) || 0), 0, n - 1);
  lastWeightFocus = anchor;

  const sanitized = new Array(n);
  let sum = 0;
  let allInts = true;

  for (let i = 0; i < n; i += 1) {
    const v = coerceWeight(weights[i], 0);
    sanitized[i] = v;
    sum += v;
    if (!Number.isInteger(v)) allInts = false;
  }

  // Fast path: already a valid 0..100 integer distribution.
  if (sum === 100 && allInts && sanitized.every((v) => v >= 0 && v <= 100)) {
    weights = sanitized;
    return;
  }

  // If everything is 0 / invalid, fall back to an even distribution,
  // but avoid always biasing toward the first items.
  if (!(sum > 0)) {
    const base = Math.floor(100 / n);
    let extra = 100 - base * n;
    const out = new Array(n).fill(base);

    const order = balanceOrderAll(n, anchor);
    for (let k = 0; k < order.length && extra > 0; k += 1) {
      out[order[k]] += 1;
      extra -= 1;
    }

    weights = out;
    return;
  }

  // Largest-remainder rounding with stable tie-breaks.
  const floors = new Array(n);
  const remainders = new Array(n);
  let floorSum = 0;

  for (let i = 0; i < n; i += 1) {
    const raw = (sanitized[i] / sum) * 100;
    const floored = Math.floor(raw);
    floors[i] = floored;
    remainders[i] = raw - floored;
    floorSum += floored;
  }

  const out = floors.slice();
  let diff = 100 - floorSum;

  if (diff > 0) {
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
      const d = remainders[b] - remainders[a];
      if (d !== 0) return d;
      const w = sanitized[b] - sanitized[a];
      if (w !== 0) return w > 0 ? -1 : 1; // bigger weight first
      const da = circularDistance(a, anchor, n);
      const db = circularDistance(b, anchor, n);
      if (da !== db) return da - db;
      return a - b;
    });

    for (let k = 0; k < order.length && diff > 0; k += 1) {
      out[order[k]] += 1;
      diff -= 1;
    }
  } else if (diff < 0) {
    // Very rare (floating edge cases): remove from the smallest fractions first.
    let remove = -diff;
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
      const d = remainders[a] - remainders[b];
      if (d !== 0) return d;
      const w = sanitized[a] - sanitized[b];
      if (w !== 0) return w < 0 ? -1 : 1; // smaller weight first
      const da = circularDistance(a, anchor, n);
      const db = circularDistance(b, anchor, n);
      if (da !== db) return da - db;
      return a - b;
    });

    for (let k = 0; k < order.length && remove > 0; k += 1) {
      const i = order[k];
      if (out[i] <= 0) continue;
      out[i] -= 1;
      remove -= 1;
    }
  }

  weights = out.map((v) => clamp(v, 0, 100));
}

  function syncWeightsLength() {
    if (!Array.isArray(weights)) weights = [];
    if (weights.length < options.length) {
      weights = weights.concat(new Array(options.length - weights.length).fill(1));
    } else if (weights.length > options.length) {
      weights = weights.slice(0, options.length);
    }
    weights = weights.map((w) => coerceWeight(w, 1));
  }

  function syncWeights() {
    syncWeightsLength();
    normalizeWeightsTo100(lastWeightFocus);
  }

  function setWeightPercent(index, nextPercent) {
  syncWeightsLength();
  const n = options.length;
  if (n <= 0) return;

  const idx = clamp(Math.floor(Number(index)), 0, n - 1);
  lastWeightFocus = idx;
  const target = clamp(Math.round(Number(nextPercent)), 0, 100);

  if (n === 1) {
    weights[0] = 100;
    return;
  }

  const out = new Array(n).fill(0);
  out[idx] = target;

  const remaining = 100 - target;
  if (!(remaining > 0)) {
    weights = out;
    return;
  }

  const others = [];
  let otherSum = 0;
  for (let i = 0; i < n; i += 1) {
    if (i === idx) continue;
    const w = coerceWeight(weights[i], 0);
    others.push({ i, w });
    otherSum += w;
  }

  // If other weights are all zero, distribute in a stable "nearby-first" order.
  if (!(otherSum > 0)) {
    const order = balanceOrder(n, idx); // excludes idx
    const base = Math.floor(remaining / (n - 1));
    let extra = remaining - base * (n - 1);

    for (const i of order) out[i] = base;
    for (let k = 0; k < order.length && extra > 0; k += 1) {
      out[order[k]] += 1;
      extra -= 1;
    }

    weights = out;
    return;
  }

  // Proportional re-balance, then largest-remainder rounding with stable tie-breaks.
  const remainders = [];
  let floorSum = 0;

  for (const { i, w } of others) {
    const raw = (w / otherSum) * remaining;
    const floored = Math.floor(raw);
    out[i] = floored;
    floorSum += floored;
    remainders.push({ i, r: raw - floored, prev: w });
  }

  let leftover = remaining - floorSum;
  remainders.sort((a, b) => {
    const d = b.r - a.r;
    if (d !== 0) return d;
    const w = b.prev - a.prev;
    if (w !== 0) return w > 0 ? -1 : 1; // bigger previous weight first
    const da = circularDistance(a.i, idx, n);
    const db = circularDistance(b.i, idx, n);
    if (da !== db) return da - db;
    return a.i - b.i;
  });

  for (let k = 0; k < remainders.length && leftover > 0; k += 1) {
    out[remainders[k].i] += 1;
    leftover -= 1;
  }

  // Safety: if floating errors keep leftover > 0, cycle in the same stable order.
  if (leftover > 0 && remainders.length) {
    for (let k = 0; leftover > 0; k = (k + 1) % remainders.length) {
      out[remainders[k].i] += 1;
      leftover -= 1;
    }
  }

    weights = out;
  }

  function averageWeights() {
    syncWeightsLength();
    weights = distributeIntegersEvenly(100, options.length);
    refreshWeightPercents();
    scheduleSaveCurrentWheel();
    scheduleLayout();
  }

  function totalWeight() {
    let sum = 0;
    for (let i = 0; i < weights.length; i += 1) sum += coerceWeight(weights[i], 0);
    return sum;
  }

  function setRangeFill(rangeEl) {
    const min = Number(rangeEl.min ?? 0);
    const max = Number(rangeEl.max ?? 100);
    const value = coerceWeight(rangeEl.value, 0);
    const denom = Math.max(1, max - min);
    const p = clamp(((value - min) / denom) * 100, 0, 100);
    rangeEl.style.setProperty("--p", `${p}%`);
  }

  const PANEL_MIN_VH = 28;
  const PANEL_MAX_VH = 70;

  function isMobilePanel() {
    return window.matchMedia?.("(max-width: 520px)")?.matches ?? false;
  }

  function applyPanelSizeVh(vh, { persist = false } = {}) {
    const value = clamp(Math.round(Number(vh)), PANEL_MIN_VH, PANEL_MAX_VH);
    document.documentElement.style.setProperty("--panel-vh", `${value}svh`);
    if (panelSizeValue) panelSizeValue.textContent = `${value}vh`;
    if (panelSizeRange) {
      panelSizeRange.value = String(value);
      setRangeFill(panelSizeRange);
    }
    if (persist) {
      try {
        localStorage.setItem(PANEL_SIZE_KEY, String(value));
      } catch {
        // ignore
      }
    }
    scheduleLayout();
  }

  function applyPanelMax() {
    if (isMobilePanel()) applyPanelSizeVh(PANEL_MAX_VH);
    else document.documentElement.style.setProperty("--panel-vh", "var(--panel-max)");
    scheduleLayout();
  }

  function applyPanelMin() {
    if (isMobilePanel()) applyPanelSizeVh(PANEL_MIN_VH);
    else document.documentElement.style.setProperty("--panel-vh", "var(--panel-min)");
    scheduleLayout();
  }

  function refreshWeightPercents() {
    syncWeights();
    const ranges = optionsListEl.querySelectorAll("[data-weight-range]");
    ranges.forEach((rangeEl) => {
      const idx = Number(rangeEl.getAttribute("data-index") ?? 0);
      const value = clamp(coerceWeight(weights[idx], 0), 0, 100);
      rangeEl.value = String(Math.round(value));
      setRangeFill(rangeEl);
    });

    const els = optionsListEl.querySelectorAll("[data-weight-percent]");
    els.forEach((el) => {
      const idx = Number(el.getAttribute("data-index") ?? 0);
      const value = clamp(coerceWeight(weights[idx], 0), 0, 100);
      el.textContent = `${Math.round(value)}%`;
    });
  }

  function weightedIndex() {
    const n = options.length;
    if (n <= 1) return 0;
    syncWeights();
    const sum = totalWeight();
    if (!(sum > 0)) return random.int(n);

    let r = random.next() * sum;
    for (let i = 0; i < n; i += 1) {
      r -= coerceWeight(weights[i], 0);
      if (r <= 0) return i;
    }
    return n - 1;
  }

  let layoutRaf = 0;
  function updateWheelSize() {
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const btnRect = spinFab.getBoundingClientRect();
    const gap = 14;
    const availableH = Math.max(120, rect.height - btnRect.height - gap);
    const base = Math.min(rect.width, availableH);
    if (!Number.isFinite(base) || base <= 0) return;
    const size = Math.min(base * 0.98, 620);
    document.documentElement.style.setProperty("--wheel-size", `${Math.floor(size)}px`);
  }

  function scheduleLayout() {
    if (layoutRaf) return;
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = 0;
      updateWheelSize();
      resizeCanvas();
    });
  }

  function setPanelCollapsed(collapsed, persist = false) {
    panelCollapsed = Boolean(collapsed);
    panelEl.classList.toggle("collapsed", panelCollapsed);
    panelToggle.setAttribute("aria-expanded", panelCollapsed ? "false" : "true");
    panelToggle.setAttribute("aria-label", panelCollapsed ? "展开面板" : "收起面板");
    panelToggle.setAttribute("title", panelCollapsed ? "展开" : "收起");
    if (persist) writeStoredBool(PANEL_COLLAPSED_KEY, panelCollapsed);
    closePanelActionsDialog(false);
    if (panelCollapsed) applyPanelMin();
    else applyPanelMax();
    scheduleLayout();
  }

  function isPanelActionsDialogOpen() {
    if (!panelActionsDialog) return false;
    if (typeof panelActionsDialog.open === "boolean") return panelActionsDialog.open;
    return panelActionsDialog.hasAttribute("open");
  }

  function openPanelActionsDialog() {
    if (!panelActionsDialog || !panelActionsMore) return;
    if (isPanelActionsDialogOpen()) return;

    panelActionsMore.setAttribute("aria-expanded", "true");
    if (typeof panelActionsDialog.showModal === "function") {
      try {
        panelActionsDialog.showModal();
        return;
      } catch {}
    }
    panelActionsDialog.setAttribute("open", "true");
  }

  function closePanelActionsDialog(restoreFocus = true) {
    if (!panelActionsDialog || !panelActionsMore) return;
    if (!isPanelActionsDialogOpen()) return;

    if (typeof panelActionsDialog.close === "function") {
      try {
        panelActionsDialog.close();
      } catch {
        panelActionsDialog.removeAttribute("open");
      }
    } else panelActionsDialog.removeAttribute("open");
    panelActionsMore.setAttribute("aria-expanded", "false");

    if (restoreFocus) panelActionsMore?.focus?.({ preventScroll: true });
  }

  function modPositive(value, modulus) {
    const r = value % modulus;
    return r < 0 ? r + modulus : r;
  }

  function normalizeAngle(value) {
    return modPositive(value, tau);
  }

  function segmentLayout(n) {
    const seg = tau / n;
    const pointerAngle = -Math.PI / 2;
    const base = pointerAngle - seg / 2;

    syncWeights();
    const raw = weights.slice(0, n).map((w) => coerceWeight(w, 0));
    while (raw.length < n) raw.push(1);

    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += raw[i];
    if (!(sum > 0)) {
      sum = n;
      for (let i = 0; i < n; i += 1) raw[i] = 1;
    }

    const spans = new Array(n);
    const offsets = new Array(n);
    let acc = 0;
    for (let i = 0; i < n; i += 1) {
      offsets[i] = acc;
      spans[i] = (raw[i] / sum) * tau;
      acc += spans[i];
    }

    if (acc > 0 && Math.abs(acc - tau) > 1e-6) {
      const scale = tau / acc;
      acc = 0;
      for (let i = 0; i < n; i += 1) {
        offsets[i] = acc;
        spans[i] *= scale;
        acc += spans[i];
      }
    }

    return { seg, base, pointerAngle, spans, offsets };
  }

  function indexFromAngle(currentAngle, n) {
    const { base, pointerAngle, spans, offsets } = segmentLayout(n);
    const relative = modPositive(pointerAngle - (base + currentAngle), tau);
    for (let i = 0; i < n; i += 1) {
      const start = offsets[i];
      const end = start + spans[i];
      if (relative >= start && relative < end) return i;
    }
    return n - 1;
  }

  function tickMinIntervalMs(currentOmega) {
    if (currentOmega > 14) return 55;
    if (currentOmega > 7) return 40;
    if (currentOmega > 3) return 28;
    return 0;
  }

  function hapticTick(currentOmega) {
    if (!navigator.vibrate) return;
    if (document.hidden) return;
    const durationMs = Math.round(clamp(22 - currentOmega * 0.7, 12, 22));
    navigator.vibrate(durationMs);
  }

  function hapticFinal() {
    if (!navigator.vibrate) return;
    if (document.hidden) return;
    navigator.vibrate(60);
  }

  function ensureAudio() {
    if (!audioEnabled) return false;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(audioCtx.destination);
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => { });
    }

    ensureNoiseBuffer();
    return true;
  }

  function ensureNoiseBuffer() {
    if (!audioCtx) return;
    if (noiseBuffer) return;

    const sampleRate = audioCtx.sampleRate || 48000;
    const length = Math.max(1, Math.floor(sampleRate * 1.0));
    const buffer = audioCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (random.next() * 2 - 1) * 0.9;
    noiseBuffer = buffer;
  }

  function randBetween(min, max) {
    return min + (max - min) * random.next();
  }

  function playTickSound(currentOmega) {
    if (!audioEnabled) return;
    if (!ensureAudio()) return;
    const now = audioCtx.currentTime;
    const jitter = randBetween(-0.015, 0.015);
    const tickDur = currentOmega > 10 ? 0.035 : currentOmega > 5 ? 0.045 : 0.055;

    if (soundMode === "mechanical") {
      // Mechanical: Short, sharp click (filtered noise simulation)
      const osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.02);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
      return;
    }

    if (soundMode === "arcade") {
      // Arcade: 8-bit blip
      const osc = audioCtx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(600 + currentOmega * 40, now);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.04);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.05);
      return;
    }

    if (soundMode === "soft") {
      const freq = (520 + clamp(currentOmega, 0, 18) * 22) * (1 + jitter);
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tickDur);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + tickDur + 0.02);
      return;
    }

    if (soundMode === "wood") {
      const noise = audioCtx.createBufferSource();
      if (noiseBuffer) noise.buffer = noiseBuffer;
      noise.loop = true;

      const bp = audioCtx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(820 * (1 + jitter), now);
      bp.Q.setValueAtTime(0.7, now);

      const nGain = audioCtx.createGain();
      nGain.gain.setValueAtTime(0.0001, now);
      nGain.gain.linearRampToValueAtTime(0.16, now + 0.003);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + tickDur);

      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220 * (1 + jitter), now);
      osc.frequency.exponentialRampToValueAtTime(120, now + tickDur + 0.01);

      const oGain = audioCtx.createGain();
      oGain.gain.setValueAtTime(0.0001, now);
      oGain.gain.linearRampToValueAtTime(0.10, now + 0.004);
      oGain.gain.exponentialRampToValueAtTime(0.0001, now + tickDur + 0.02);

      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(masterGain);

      osc.connect(oGain);
      oGain.connect(masterGain);

      noise.start(now, randBetween(0, 0.85));
      noise.stop(now + tickDur + 0.02);
      osc.start(now);
      osc.stop(now + tickDur + 0.04);
      return;
    }

    if (soundMode === "bell") {
      const base = (740 + clamp(currentOmega, 0, 18) * 14) * (1 + jitter);
      const tones = [base, base * 2.01];
      tones.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, now);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(i === 0 ? 0.06 : 0.03, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + tickDur + 0.04);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + tickDur + 0.08);
      });
      return;
    }

    if (soundMode === "scifi") {
      const osc = audioCtx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(260 + clamp(currentOmega, 0, 18) * 26, now);
      osc.detune.setValueAtTime(randBetween(-14, 14), now);

      const lp = audioCtx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.setValueAtTime(7, now);
      lp.frequency.setValueAtTime(2200, now);
      lp.frequency.exponentialRampToValueAtTime(520, now + tickDur + 0.02);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tickDur + 0.03);

      osc.connect(lp);
      lp.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + tickDur + 0.05);
      return;
    }

    // Default
    const freq = (currentOmega > 10 ? 820 : currentOmega > 5 ? 700 : 560) * (1 + jitter);
    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + tickDur + 0.01);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + tickDur + 0.03);
  }

  function playLockSound() {
    if (!audioEnabled) return;
    if (!ensureAudio()) return;
    const now = audioCtx.currentTime;

    if (soundMode === "mechanical") {
      // Mechanical: Heavy latch
      const osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
      return;
    }

    if (soundMode === "arcade") {
      // Arcade: Win jingle (faster)
      const tones = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C E G C E G
      tones.forEach((freq, i) => {
        const t = now + i * 0.06;
        const osc = audioCtx.createOscillator();
        osc.type = "square";
        osc.frequency.value = freq;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.1);
      });
      return;
    }

    if (soundMode === "soft") {
      const tones = [523.25, 659.25, 783.99]; // C E G
      tones.forEach((freq, i) => {
        const t = now + i * 0.06;
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.10, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.36);
      });
      return;
    }

    if (soundMode === "wood") {
      const times = [0, 0.08];
      times.forEach((offset, i) => {
        const t = now + offset;
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(i === 0 ? 140 : 110, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(i === 0 ? 0.18 : 0.14, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.22);
      });
      return;
    }

    if (soundMode === "bell") {
      const tones = [1046.5, 1318.51, 1567.98]; // C6 E6 G6
      tones.forEach((freq) => {
        const osc = audioCtx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.7);
      });
      return;
    }

    if (soundMode === "scifi") {
      const osc = audioCtx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.14);

      const bp = audioCtx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(900, now);
      bp.Q.setValueAtTime(3.5, now);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

      osc.connect(bp);
      bp.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
      return;
    }

    // Default
    const tones = [523.25, 659.25];
    const nodes = [];

    for (const freq of tones) {
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
      nodes.push(osc, gain);
    }

    setTimeout(() => {
      for (const node of nodes) {
        if (typeof node.disconnect === "function") {
          try {
            node.disconnect();
          } catch {
            // ignore
          }
        }
      }
    }, 420);
  }

  function toggleBodyClass(name, enabled) {
    document.body.classList.toggle(name, enabled);
  }

  function pulseTick() {
    toggleBodyClass("is-tick", true);
    setTimeout(() => toggleBodyClass("is-tick", false), 90);
  }

  function setPointerTickFx(currentOmega) {
    const slow = clamp(1 - clamp((currentOmega - omegaStop) / 10, 0, 1), 0, 1);
    const rot = -(6 + 14 * slow);
    const shift = 1 + 4 * slow;
    const glow = clamp(0.62 + 0.38 * slow, 0.62, 1);
    document.documentElement.style.setProperty("--tick-rot", `${rot.toFixed(2)}deg`);
    document.documentElement.style.setProperty("--tick-shift", `${shift.toFixed(2)}px`);
    document.documentElement.style.setProperty("--tick-glow", `${glow.toFixed(2)}`);
  }

  function setSuspense(enabled) {
    if (suspense === enabled) return;
    suspense = enabled;
    toggleBodyClass("is-suspense", suspense);
  }

  function resultFocusables() {
    return [resultClose, confirmResult, spinAgain].filter((el) => el && typeof el.focus === "function" && !el.disabled);
  }

  function focusResultPrimary() {
    const focusables = resultFocusables();
    const target = focusables.find((el) => el === confirmResult) ?? focusables.find((el) => el === spinAgain) ?? focusables[0] ?? resultCard;
    target?.focus?.({ preventScroll: true });
  }

  function restoreFocusFromResult() {
    const target = restoreFocusEl;
    restoreFocusEl = null;
    if (target && document.documentElement.contains(target) && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
      return;
    }
    spinFab?.focus?.({ preventScroll: true });
  }

  function showResult(text) {
    restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resultText.textContent = text;
    resultBackdrop.hidden = false;
    resultCard.hidden = false;
    requestAnimationFrame(() => {
      document.body.classList.add("show-result");
      focusResultPrimary();
      if (typeof window.startConfetti === "function") window.startConfetti();
    });
  }

  function hideResult(restoreFocus = true) {
    document.body.classList.remove("show-result");

    if (resultCard.hidden) {
      resultBackdrop.hidden = true;
      if (!restoreFocus) restoreFocusEl = null;
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resultBackdrop.hidden = true;
      resultCard.hidden = true;
      if (restoreFocus) restoreFocusFromResult();
      else restoreFocusEl = null;
    };

    resultCard.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 260);
  }

  function parseOptions(text) {
    const raw = String(text ?? "");
    const pieces = raw
      .split(/[\n,，]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const unique = [];
    const seen = new Set();
    for (const item of pieces) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
      if (unique.length >= 50) break;
    }
    return unique;
  }

  function applyOptions(next) {
    const sanitized = (next ?? []).map((s) => String(s).trim()).filter(Boolean);
    options = sanitized.length ? sanitized : ["选项 1", "选项 2"];
    if (options.length < 2) options.push("选项 2");
    weights = options.map(() => 1);
    scheduleSaveCurrentWheel();
    renderOptionsList();
    hideResult(false);
    scheduleLayout();
  }

  const WHEELS_STORAGE_KEY = "spinWheel.wheels.v1";
  const CURRENT_WHEEL_KEY = "spinWheel.currentWheel.v1";
  const AUDIO_ENABLED_KEY = "spinWheel.audioEnabled.v1";
  const SOUND_MODE_KEY = "spinWheel.soundMode.v1";
  const PANEL_SIZE_KEY = "spinWheel.panelSizeVh.v1";
  const PANEL_COLLAPSED_KEY = "spinWheel.panelCollapsed.v1";
  const MAX_SAVED_WHEELS = 40;

  function readStoredBool(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return null;
      if (raw === "1" || raw === "true") return true;
      if (raw === "0" || raw === "false") return false;
    } catch {
      // ignore
    }
    return null;
  }

  function writeStoredBool(key, value) {
    try {
      localStorage.setItem(key, value ? "1" : "0");
      return true;
    } catch {
      return false;
    }
  }

  function loadAudioEnabled() {
    return readStoredBool(AUDIO_ENABLED_KEY) ?? true;
  }

  function setAudioToggleUi(enabled) {
    const on = Boolean(enabled);
    audioToggle.setAttribute("aria-pressed", on ? "true" : "false");
    audioToggle.setAttribute("aria-label", on ? "关闭音效" : "开启音效");
    if (audioIcon && audioIcon.textContent !== "♪") audioIcon.textContent = "♪";
  }

  function normalizeWheelName(name) {
    const trimmed = String(name ?? "").trim();
    return trimmed || DEFAULT_WHEEL_NAME;
  }

  function applyWheelName(name, persist = false) {
    const normalized = normalizeWheelName(name);
    currentWheelName = normalized;
    if (wheelTitleEl && wheelTitleEl.value !== normalized) wheelTitleEl.value = normalized;
    if (wheelNameEl && wheelNameEl.value !== normalized) wheelNameEl.value = normalized;
    if (document.title !== normalized) document.title = normalized;
    if (persist) scheduleSaveCurrentWheel();
  }

  function saveCurrentWheelNow() {
    try {
      const items = currentWheelItems();
      localStorage.setItem(CURRENT_WHEEL_KEY, JSON.stringify({ items, name: currentWheelName, updatedAt: Date.now() }));
    } catch {
      // ignore
    }
  }

  function scheduleSaveCurrentWheel() {
    if (saveCurrentWheelTimer) clearTimeout(saveCurrentWheelTimer);
    saveCurrentWheelTimer = setTimeout(() => {
      saveCurrentWheelTimer = 0;
      saveCurrentWheelNow();
    }, 220);
  }

  function loadCurrentWheel() {
    try {
      const raw = localStorage.getItem(CURRENT_WHEEL_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : null;
      if (!items) return false;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof parsed.name === "string") {
        applyWheelName(parsed.name, false);
      }
      applyWheelItems(items);
      return true;
    } catch {
      return false;
    }
  }

  function normalizeOptionText(text, idx) {
    const value = String(text ?? "").trim();
    return value || `选项 ${idx + 1}`;
  }

  function setWheelMessage(text, kind = "") {
    if (!wheelMessageEl) return;
    wheelMessageEl.textContent = String(text ?? "");
    if (kind) wheelMessageEl.setAttribute("data-kind", kind);
    else wheelMessageEl.removeAttribute("data-kind");
  }

  function newWheelId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    const a = Math.floor(Date.now()).toString(36);
    const b = Math.floor(random.next() * 1e12).toString(36);
    return `wheel_${a}_${b}`;
  }

  function sanitizeWheel(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!id || !name) return null;

    const rawItems = Array.isArray(raw.items) ? raw.items : [];
    const items = rawItems
      .map((item, idx) => {
        const text = normalizeOptionText(item?.text, idx);
        const weight = coerceWeight(item?.weight ?? 1, 1);
        return { text, weight };
      })
      .filter((item) => item.text);

    while (items.length < 2) items.push({ text: `选项 ${items.length + 1}`, weight: 1 });

    const updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : Date.now();
    return { id, name, items: items.slice(0, 50), updatedAt };
  }

  function readWheelLibrary() {
    try {
      const raw = localStorage.getItem(WHEELS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const sanitized = parsed.map(sanitizeWheel).filter(Boolean);
      sanitized.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return sanitized.slice(0, MAX_SAVED_WHEELS);
    } catch {
      return [];
    }
  }

  function writeWheelLibrary(list) {
    try {
      localStorage.setItem(WHEELS_STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }

  function currentWheelItems() {
    syncWeights();
    const items = options.map((text, idx) => ({
      text: normalizeOptionText(text, idx),
      weight: clamp(coerceWeight(weights[idx], 1), 0, 100),
    }));
    while (items.length < 2) items.push({ text: `选项 ${items.length + 1}`, weight: 1 });
    return items;
  }

  function applyWheelItems(items) {
    const list = Array.isArray(items) ? items : [];
    const texts = list.map((item, idx) => normalizeOptionText(item?.text, idx)).filter(Boolean);
    const nextOptions = texts.length ? texts : ["选项 1", "选项 2"];
    while (nextOptions.length < 2) nextOptions.push(`选项 ${nextOptions.length + 1}`);

    const nextWeights = list.map((item) => clamp(coerceWeight(item?.weight ?? 1, 1), 0, 100));
    while (nextWeights.length < nextOptions.length) nextWeights.push(1);

    options = nextOptions;
    weights = nextWeights.slice(0, nextOptions.length);

    scheduleSaveCurrentWheel();
    renderOptionsList();
    hideResult(false);
    scheduleLayout();
  }

  function populateWheelSelect(selectedId = "") {
    if (!wheelSelectEl) return;
    const list = readWheelLibrary();
    wheelSelectEl.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "已保存的转盘…";
    wheelSelectEl.appendChild(placeholder);

    for (const wheel of list) {
      const opt = document.createElement("option");
      opt.value = wheel.id;
      opt.textContent = `${wheel.name}（${wheel.items.length}项）`;
      wheelSelectEl.appendChild(opt);
    }

    if (selectedId) wheelSelectEl.value = selectedId;
  }

  function wheelById(id) {
    if (!id) return null;
    return readWheelLibrary().find((w) => w.id === id) ?? null;
  }

  function saveWheelFromDialog() {
    const name = String(wheelNameEl?.value ?? "").trim();
    if (!name) {
      setWheelMessage("请输入转盘名称。", "error");
      wheelNameEl?.focus?.();
      return;
    }

    const items = currentWheelItems();
    const list = readWheelLibrary();
    const now = Date.now();
    const existing = list.find((w) => w.name === name);
    const id = existing?.id ?? newWheelId();

    const next = list.filter((w) => w.id !== id);
    next.unshift({ id, name, items, updatedAt: now });
    if (next.length > MAX_SAVED_WHEELS) next.length = MAX_SAVED_WHEELS;

    if (!writeWheelLibrary(next)) {
      setWheelMessage("保存失败：浏览器存储不可用。", "error");
      return;
    }

    populateWheelSelect(id);
    setWheelMessage(existing ? "已更新该转盘。" : "已保存到转盘库。", "ok");
    applyWheelName(name, true);
  }

  function loadWheelFromDialog() {
    const id = String(wheelSelectEl?.value ?? "");
    if (!id) {
      setWheelMessage("请选择要载入的转盘。", "error");
      return;
    }
    const wheel = wheelById(id);
    if (!wheel) {
      setWheelMessage("未找到该转盘。", "error");
      populateWheelSelect("");
      return;
    }
    applyWheelItems(wheel.items);
    applyWheelName(wheel.name, true);
    setWheelMessage(`已载入：${wheel.name}`, "ok");
  }

  function deleteWheelFromDialog() {
    const id = String(wheelSelectEl?.value ?? "");
    if (!id) {
      setWheelMessage("请选择要删除的转盘。", "error");
      return;
    }
    const wheel = wheelById(id);
    if (!wheel) {
      setWheelMessage("未找到该转盘。", "error");
      populateWheelSelect("");
      return;
    }
    if (!confirm(`删除转盘“${wheel.name}”？此操作不可撤销。`)) return;

    const list = readWheelLibrary().filter((w) => w.id !== id);
    if (!writeWheelLibrary(list)) {
      setWheelMessage("删除失败：浏览器存储不可用。", "error");
      return;
    }
    populateWheelSelect("");
    setWheelMessage("已删除。", "ok");
  }

  function renderOptionsList() {
    syncWeights();
    optionsListEl.innerHTML = "";
    options.forEach((value, idx) => {
      const row = document.createElement("div");
      row.className = "option-row";

      const stack = document.createElement("div");
      stack.className = "option-stack";

      const initialText = normalizeOptionText(value, idx);

      const input = document.createElement("input");
      input.className = "option-input";
      input.value = value;
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.setAttribute("aria-label", `选项 ${idx + 1}：${initialText}`);

      const weightRow = document.createElement("div");
      weightRow.className = "weight-row";

      const range = document.createElement("input");
      range.className = "weight-range";
      range.type = "range";
      range.min = "0";
      range.max = "100";
      range.step = "1";
      range.setAttribute("data-weight-range", "true");
      range.setAttribute("data-index", String(idx));
      range.value = String(Math.round(clamp(coerceWeight(weights[idx], 1), 0, 100)));
      range.setAttribute("aria-label", `“${initialText}” 概率权重`);
      setRangeFill(range);

      const percent = document.createElement("div");
      percent.className = "weight-pill";
      percent.setAttribute("data-weight-percent", "true");
      percent.setAttribute("data-index", String(idx));

      weightRow.appendChild(range);
      weightRow.appendChild(percent);

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.type = "button";
      del.title = "删除";
      del.setAttribute("aria-label", `删除“${initialText}”`);
      del.textContent = "×";

      input.addEventListener("input", () => {
        options[idx] = input.value;
        const nextText = normalizeOptionText(input.value, idx);
        input.setAttribute("aria-label", `选项 ${idx + 1}：${nextText}`);
        range.setAttribute("aria-label", `“${nextText}” 概率权重`);
        del.setAttribute("aria-label", `删除“${nextText}”`);
        scheduleSaveCurrentWheel();
      });

      range.addEventListener("input", () => {
        setWeightPercent(idx, range.value);
        refreshWeightPercents();
        scheduleSaveCurrentWheel();
      });

      del.addEventListener("click", () => {
        options.splice(idx, 1);
        weights.splice(idx, 1);
        if (options.length < 2) options.push("选项 2");
        if (weights.length < options.length) weights.push(1);
        scheduleSaveCurrentWheel();
        renderOptionsList();
      });

      stack.appendChild(input);
      stack.appendChild(weightRow);

      row.appendChild(stack);
      row.appendChild(del);
      optionsListEl.appendChild(row);
    });
    refreshWeightPercents();
    scheduleLayout();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const scaleX = w / Math.max(1, rect.width);
    const scaleY = h / Math.max(1, rect.height);
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function drawWheel() {
    resizeCanvas();
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.48;

    ctx.clearRect(0, 0, w, h);

    const bgGlow = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius * 1.15);
    bgGlow.addColorStop(0.0, "rgba(255,255,255,0.06)");
    bgGlow.addColorStop(0.35, "rgba(167,139,250,0.08)");
    bgGlow.addColorStop(0.6, "rgba(94,234,212,0.06)");
    bgGlow.addColorStop(1.0, "rgba(0,0,0,0)");
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);

    const n = Math.max(2, options.length);
    const { base, spans, offsets } = segmentLayout(n);
    const suspenseIndex = spinning && suspense ? indexFromAngle(angle, n) : -1;

    const palette = [
      [167, 139, 250],
      [94, 234, 212],
      [253, 186, 116],
      [167, 139, 250],
      [94, 234, 212],
      [253, 186, 116],
    ];

    for (let i = 0; i < n; i += 1) {
      const span = spans[i];
      if (!(span > 0)) continue;
      const start = base + angle + offsets[i];
      const end = start + span;

      const rgb = palette[i % palette.length];
      const shade = 0.86 + 0.12 * Math.sin((reduceMotion ? 0 : idleT) * 0.4 + i * 0.7);
      const r = Math.round(rgb[0] * shade);
      const g = Math.round(rgb[1] * shade);
      const b = Math.round(rgb[2] * shade);

      const grad = ctx.createRadialGradient(0, 0, radius * 0.05, 0, 0, radius * 1.05);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.46)`);
      grad.addColorStop(0.55, `rgba(${r},${g},${b},0.34)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.22)`);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const isResult = !spinning && highlightIndex === i;
      const isSuspense = spinning && suspense && suspenseIndex === i;

      if (isSuspense) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, start, end);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (isResult || isSuspense) {
        ctx.save();
        ctx.shadowColor = isResult ? "rgba(255,255,255,0.35)" : "rgba(167,139,250,0.32)";
        ctx.shadowBlur = isResult ? 16 : 22;
        ctx.strokeStyle = isResult ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.26)";
        ctx.lineWidth = isResult ? 2 : 2.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, start, end);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      const label = options[i] ?? `选项 ${i + 1}`;
      if (span < 0.16) continue;
      const mid = start + span / 2;
      const labelR = radius * 0.64;
      const x = Math.cos(mid) * labelR;
      const y = Math.sin(mid) * labelR;

      const fontSize = clamp(Math.round(radius * 0.085), 12, 18);
      const labelAlpha = spinning ? clamp(0.18 + (1 - clamp(omega / 18, 0, 1)) * 0.74, 0.18, 0.92) : 0.92;

      ctx.save();
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.globalAlpha = labelAlpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxChars = 10;
      const text = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, fontSize * 0.22);
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    const innerGrad = ctx.createRadialGradient(-radius * 0.25, -radius * 0.35, radius * 0.2, 0, 0, radius);
    innerGrad.addColorStop(0.0, "rgba(255,255,255,0.22)");
    innerGrad.addColorStop(0.5, "rgba(255,255,255,0.06)");
    innerGrad.addColorStop(1.0, "rgba(0,0,0,0.10)");

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.92, 0, tau);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    const ringGrad = ctx.createRadialGradient(0, 0, radius * 0.9, 0, 0, radius * 1.03);
    ringGrad.addColorStop(0.0, "rgba(255,255,255,0.10)");
    ringGrad.addColorStop(0.55, "rgba(255,255,255,0.28)");
    ringGrad.addColorStop(1.0, "rgba(255,255,255,0.08)");

    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = radius * 0.06;
    ctx.shadowColor = "rgba(167,139,250,0.22)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.97, 0, tau);
    ctx.stroke();

    ctx.restore();

    const spec = ctx.createLinearGradient(0, 0, w, h);
    spec.addColorStop(0.0, "rgba(255,255,255,0.10)");
    spec.addColorStop(0.25, "rgba(255,255,255,0.02)");
    spec.addColorStop(0.5, "rgba(94,234,212,0.05)");
    spec.addColorStop(0.75, "rgba(255,255,255,0.02)");
    spec.addColorStop(1.0, "rgba(255,255,255,0.10)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = spec;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  function stopSpin() {
    spinning = false;
    setSuspense(false);
    angle = targetAngle;
    const resultIndex = indexFromAngle(angle, options.length);
    highlightIndex = resultIndex;
    drawWheel();

    spinFab.disabled = false;
    panelEl.classList.remove("disabled");
    wheelStage.setAttribute("aria-busy", "false");
    hapticFinal();
    setPointerTickFx(omegaStop);
    pulseTick();
    playLockSound();
    setTimeout(() => showResult(options[resultIndex] ?? "—"), 180);
  }

  function startSpin() {
    if (spinning) return;
    if (options.length < 2) return;

    hideResult(false);
    highlightIndex = null;
    ensureAudio();

    const n = options.length;
    selectedIndex = weightedIndex();
    const { base, pointerAngle, spans, offsets, seg } = segmentLayout(n);

    const margin = 0.06;
    const u = random.next();
    const p = 1.55;
    const biased =
      u < 0.5 ? 0.5 * Math.pow(u * 2, p) : 1 - 0.5 * Math.pow((1 - u) * 2, p);
    const landingT = margin + biased * (1 - 2 * margin);
    const span = spans[selectedIndex] > 0 ? spans[selectedIndex] : seg;
    const startOffset = offsets[selectedIndex] ?? selectedIndex * seg;
    const relative = startOffset + landingT * span;
    const targetMod = normalizeAngle(pointerAngle - base - relative);
    const currentMod = normalizeAngle(angle);
    const delta = modPositive(targetMod - currentMod, tau);
    const extraTurns = 4 + random.int(3);
    const totalAngle = delta + extraTurns * tau;

    startAngle = angle;
    targetAngle = angle + totalAngle;
    omega0 = omegaStop + decayK * totalAngle;
    omega = omega0;
    duration = Math.log(omega0 / omegaStop) / decayK;
    elapsed = 0;
    lastTs = 0;

    lastIndex = indexFromAngle(angle, n);
    lastTickTs = performance.now();

    spinning = true;
    spinFab.disabled = true;
    panelEl.classList.add("disabled");
    wheelStage.setAttribute("aria-busy", "true");
  }

  function onTick(nowMs) {
    const minGap = tickMinIntervalMs(omega);
    if (nowMs - lastTickTs < minGap) return;
    lastTickTs = nowMs;
    setPointerTickFx(omega);
    hapticTick(omega);
    playTickSound(omega);
    pulseTick();
  }

  function frame(ts) {
    const nowMs = ts;
    const now = ts / 1000;
    const dt = lastTs ? clamp(now - lastTs, 0, 0.05) : 0;
    lastTs = now;
    idleT += dt;

    if (spinning) {
      elapsed += dt;
      const t = Math.min(elapsed, duration);
      const exp = Math.exp(-decayK * t);
      omega = omega0 * exp;
      angle = startAngle + (omega0 / decayK) * (1 - exp);

      const remaining = duration - t;
      setSuspense(remaining <= suspenseSeconds);

      const idx = indexFromAngle(angle, options.length);
      if (idx !== lastIndex) {
        lastIndex = idx;
        onTick(nowMs);
      }

      if (t >= duration) stopSpin();
    }

    drawWheel();
    requestAnimationFrame(frame);
  }

  function openImportDialog() {
    importTextEl.value = options.join("\n");
    if (typeof importDialog.showModal === "function") importDialog.showModal();
    else importDialog.setAttribute("open", "true");
  }

  function exportJson() {
    const data = {
      options,
      weights,
      wheelName: currentWheelName,
      panelSize: localStorage.getItem(PANEL_SIZE_KEY),
      audioEnabled: localStorage.getItem(AUDIO_ENABLED_KEY),
      soundMode: localStorage.getItem(SOUND_MODE_KEY),
      panelCollapsed: localStorage.getItem(PANEL_COLLAPSED_KEY),
      wheels: readWheelLibrary(),
      exportedAt: Date.now(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spin-wheel-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function triggerImportJson() {
    importJsonInput?.click();
  }

  function openWheelsDialog() {
    setWheelMessage("");
    const selectedId = String(wheelSelectEl?.value ?? "");
    populateWheelSelect(selectedId);
    const wheel = wheelById(String(wheelSelectEl?.value ?? ""));
    if (wheelNameEl) wheelNameEl.value = wheel?.name ?? currentWheelName;
    if (typeof wheelDialog?.showModal === "function") wheelDialog.showModal();
    else wheelDialog?.setAttribute("open", "true");
  }

  function installHandlers() {
    spinFab.addEventListener("click", () => {
      if (spinning) return;
      startSpin();
    });

    wheelTitleEl?.addEventListener("input", () => {
      const raw = wheelTitleEl.value;
      currentWheelName = normalizeWheelName(raw);
      if (document.title !== currentWheelName) document.title = currentWheelName;
      if (wheelNameEl && !wheelNameEl.matches(":focus") && wheelNameEl.value !== raw) wheelNameEl.value = raw;
      scheduleSaveCurrentWheel();
    });

    wheelTitleEl?.addEventListener("blur", () => {
      applyWheelName(wheelTitleEl.value, true);
    });

    wheelTitleEl?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      wheelTitleEl.blur();
    });

    confirmResult?.addEventListener("click", () => {
      hideResult();
    });

    spinAgain.addEventListener("click", () => {
      hideResult();
      startSpin();
    });

    addOptionBtn.addEventListener("click", () => {
      options.push(`选项 ${options.length + 1}`);
      weights.push(1);
      scheduleSaveCurrentWheel();
      renderOptionsList();
      const inputs = optionsListEl.querySelectorAll(".option-input");
      inputs[inputs.length - 1]?.focus?.({ preventScroll: true });
    });

    openImportBtn.addEventListener("click", () => {
      openImportDialog();
    });

    exportJsonBtn?.addEventListener("click", () => {
      exportJson();
    });

    importJsonBtn?.addEventListener("click", () => {
      triggerImportJson();
    });

    importJsonInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (Array.isArray(data.options) && data.options.length > 0) {
          options = data.options;
          weights = Array.isArray(data.weights) ? data.weights : options.map(() => 1);
          syncWeights();
          renderOptionsList();
          scheduleSaveCurrentWheel();
          scheduleLayout();
        }

        if (data.wheels) {
          writeWheelLibrary(data.wheels);
        }

        if (data.audioEnabled !== undefined) {
          audioEnabled = data.audioEnabled === "1" || data.audioEnabled === "true";
          setAudioToggleUi(audioEnabled);
          writeStoredBool(AUDIO_ENABLED_KEY, audioEnabled);
        }
        if (data.soundMode) {
          soundMode = data.soundMode;
          localStorage.setItem(SOUND_MODE_KEY, soundMode);
          if (soundModeSelect) soundModeSelect.value = soundMode;
        }
        if (typeof data.wheelName === "string") {
          applyWheelName(data.wheelName, true);
        }

        alert("导入成功！");
      } catch (e) {
        alert("导入失败：文件格式错误");
        console.error(e);
      }
      event.target.value = "";
    });

    openWheelsBtn?.addEventListener("click", () => {
      openWheelsDialog();
    });

    wheelDialog?.addEventListener("close", () => {
      setWheelMessage("");
    });

    wheelSelectEl?.addEventListener("change", () => {
      setWheelMessage("");
      const wheel = wheelById(String(wheelSelectEl.value ?? ""));
      if (wheelNameEl) wheelNameEl.value = wheel?.name ?? "";
    });

    wheelNameEl?.addEventListener("input", () => {
      const raw = wheelNameEl.value;
      currentWheelName = normalizeWheelName(raw);
      if (document.title !== currentWheelName) document.title = currentWheelName;
      if (wheelTitleEl && !wheelTitleEl.matches(":focus") && wheelTitleEl.value !== raw) wheelTitleEl.value = raw;
      scheduleSaveCurrentWheel();
    });

    wheelNameEl?.addEventListener("blur", () => {
      applyWheelName(wheelNameEl.value, true);
    });

    wheelNameEl?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      saveWheelFromDialog();
    });

    saveWheelBtn?.addEventListener("click", () => {
      saveWheelFromDialog();
    });

    loadWheelBtn?.addEventListener("click", () => {
      loadWheelFromDialog();
    });

    deleteWheelBtn?.addEventListener("click", () => {
      deleteWheelFromDialog();
    });

    importDialog.addEventListener("close", () => {
      if (importDialog.returnValue !== "ok") return;
      const parsed = parseOptions(importTextEl.value);
      if (parsed.length >= 1) applyOptions(parsed);
    });

    pasteClipboardBtn.addEventListener("click", async () => {
      if (!navigator.clipboard?.readText) {
        importTextEl.focus();
        return;
      }
      try {
        const text = await navigator.clipboard.readText();
        if (text) importTextEl.value = text;
        importTextEl.focus();
      } catch {
        importTextEl.focus();
      }
    });

    panelToggle.addEventListener("click", () => {
      setPanelCollapsed(!panelCollapsed, true);
    });

    const getViewportHeight = () => window.visualViewport?.height ?? window.innerHeight ?? 1;
    const getCurrentPanelVh = () => {
      const rect = panelEl?.getBoundingClientRect?.();
      if (!rect) return PANEL_MAX_VH;
      const vh = (rect.height / Math.max(1, getViewportHeight())) * 100;
      return clamp(vh, PANEL_MIN_VH, PANEL_MAX_VH);
    };

    if (panelDragHandle) {
      let dragging = false;
      let startClientY = 0;
      let startVh = PANEL_MAX_VH;

      const endDrag = () => {
        dragging = false;
        startClientY = 0;
      };

      panelDragHandle.addEventListener("pointerdown", (event) => {
        if (!isMobilePanel()) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        closePanelActionsDialog(false);
        if (panelCollapsed) setPanelCollapsed(false, false);
        dragging = true;
        startClientY = event.clientY;
        startVh = getCurrentPanelVh();
        panelDragHandle.setPointerCapture?.(event.pointerId);
      });

      panelDragHandle.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        if (!isMobilePanel()) return;
        const dy = event.clientY - startClientY;
        const next = startVh - (dy / Math.max(1, getViewportHeight())) * 100;
        applyPanelSizeVh(next);
      });

      panelDragHandle.addEventListener("pointerup", () => endDrag());
      panelDragHandle.addEventListener("pointercancel", () => endDrag());
    }

    panelActionsMore?.addEventListener("click", (event) => {
      event.preventDefault();
      if (isPanelActionsDialogOpen()) closePanelActionsDialog(false);
      else openPanelActionsDialog();
    });

    panelActionsDialog?.addEventListener("close", () => {
      panelActionsMore?.setAttribute("aria-expanded", "false");
    });

    panelActionsDialog?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const item = target?.closest?.("[data-action-target]");
      if (!item) return;

      const actionTarget = item.getAttribute("data-action-target");
      closePanelActionsDialog(false);
      setTimeout(() => {
        if (actionTarget === "openWheels") openWheelsDialog();
        else if (actionTarget === "openImport") openImportDialog();
        else if (actionTarget === "exportJson") exportJson();
        else if (actionTarget === "importJsonBtn") triggerImportJson();
        else document.getElementById(actionTarget)?.click?.();
      }, 0);
    });

    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key !== "Escape") return;
      if (!isPanelActionsDialogOpen()) return;
      event.preventDefault();
      closePanelActionsDialog();
    });

    avgWeightsBtn?.addEventListener("click", () => {
      averageWeights();
    });

    soundModeSelect?.addEventListener("change", () => {
      soundMode = soundModeSelect.value;
      localStorage.setItem(SOUND_MODE_KEY, soundMode);
      playTickSound(10); // Preview sound
    });

    resultBackdrop.addEventListener("click", () => hideResult());

    resultClose.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideResult();
    });

    document.addEventListener("keydown", (event) => {
      if (!document.body.classList.contains("show-result")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        hideResult();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = resultFocusables();
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (!resultCard.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus?.({ preventScroll: true });
        return;
      }

      if (event.shiftKey) {
        if (active === first || active === resultCard) {
          event.preventDefault();
          last?.focus?.({ preventScroll: true });
        }
      } else if (active === last) {
        event.preventDefault();
        first?.focus?.({ preventScroll: true });
      }
    });

    usePresetBtn.addEventListener("click", () => {
      const key = presetSelect.value;
      if (!key || !presets[key]) return;
      applyOptions(presets[key]);
    });

    audioToggle.addEventListener("click", () => {
      audioEnabled = !audioEnabled;
      setAudioToggleUi(audioEnabled);
      writeStoredBool(AUDIO_ENABLED_KEY, audioEnabled);
      if (audioEnabled) ensureAudio();
    });

    window.addEventListener(
      "resize",
      () => {
        closePanelActionsDialog(false);
        scheduleLayout();
      },
      { passive: true },
    );
  }

  audioEnabled = loadAudioEnabled();
  setAudioToggleUi(audioEnabled);
  soundMode = localStorage.getItem(SOUND_MODE_KEY) || "default";
  if (soundModeSelect) soundModeSelect.value = soundMode;

  applyWheelName(wheelTitleEl?.value ?? DEFAULT_WHEEL_NAME, false);

  const restored = loadCurrentWheel();
  if (!restored) renderOptionsList();

  installHandlers();
  setPanelCollapsed(false, false);
  scheduleLayout();
  requestAnimationFrame(frame);
})();
