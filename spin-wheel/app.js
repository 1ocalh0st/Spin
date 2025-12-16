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
  const spinAgain = document.getElementById("spinAgain");
  const audioToggle = document.getElementById("audioToggle");

  const optionsListEl = document.getElementById("optionsList");
  const addOptionBtn = document.getElementById("addOption");
  const openImportBtn = document.getElementById("openImport");
  const importDialog = document.getElementById("importDialog");
  const importTextEl = document.getElementById("importText");
  const pasteClipboardBtn = document.getElementById("pasteClipboard");
  const panelEl = document.querySelector(".panel");
  const panelToggle = document.getElementById("panelToggle");
  const panelSizeRow = document.getElementById("panelSizeRow");
  const panelSizeRange = document.getElementById("panelSizeRange");
  const panelSizeValue = document.getElementById("panelSizeValue");
  const panelSizeReset = document.getElementById("panelSizeReset");

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
  let lastHeartbeatMs = 0;

  let audioEnabled = true;
  let audioCtx = null;
  let masterGain = null;
  let bgmGain = null;
  let bgmNodes = [];
  let panelCollapsed = false;

  audioToggle.setAttribute("aria-pressed", audioEnabled ? "true" : "false");

  if ("serviceWorker" in navigator) {
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
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

  function syncWeights() {
    if (!Array.isArray(weights)) weights = [];
    if (weights.length < options.length) {
      weights = weights.concat(new Array(options.length - weights.length).fill(1));
    } else if (weights.length > options.length) {
      weights = weights.slice(0, options.length);
    }
    weights = weights.map((w) => coerceWeight(w, 1));
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

  function applyPanelSizeVh(vh) {
    const value = clamp(Math.round(Number(vh)), 28, 70);
    document.documentElement.style.setProperty("--panel-vh", `${value}vh`);
    if (panelSizeValue) panelSizeValue.textContent = `${value}vh`;
    if (panelSizeRange) {
      panelSizeRange.value = String(value);
      setRangeFill(panelSizeRange);
    }
    try {
      localStorage.setItem(PANEL_SIZE_KEY, String(value));
    } catch {
      // ignore
    }
    scheduleLayout();
  }

  function loadPanelSizeVh() {
    try {
      const raw = localStorage.getItem(PANEL_SIZE_KEY);
      const value = Number(raw);
      if (Number.isFinite(value)) applyPanelSizeVh(value);
      else applyPanelSizeVh(46);
    } catch {
      applyPanelSizeVh(46);
    }
  }

  function refreshWeightPercents() {
    syncWeights();
    const sum = totalWeight();
    const n = options.length;

    const els = optionsListEl.querySelectorAll("[data-weight-percent]");
    els.forEach((el) => {
      const idx = Number(el.getAttribute("data-index") ?? 0);
      const w = coerceWeight(weights[idx], 0);
      const pct = sum > 0 ? (w / sum) * 100 : n > 0 ? 100 / n : 0;
      el.textContent = `${Math.round(pct)}%`;
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

  function setPanelCollapsed(collapsed) {
    panelCollapsed = Boolean(collapsed);
    panelEl.classList.toggle("collapsed", panelCollapsed);
    panelToggle.textContent = panelCollapsed ? "展开" : "收起";
    panelToggle.setAttribute("aria-expanded", panelCollapsed ? "false" : "true");
    scheduleLayout();
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
    const durationMs = currentOmega > 10 ? 10 : currentOmega > 5 ? 14 : currentOmega > 2 ? 18 : 22;
    navigator.vibrate(durationMs);
  }

  function hapticFinal() {
    if (!navigator.vibrate) return;
    navigator.vibrate([0, 60]);
  }

  function ensureAudio() {
    if (!audioEnabled) return false;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(audioCtx.destination);

      bgmGain = audioCtx.createGain();
      bgmGain.gain.value = 0.0;
      bgmGain.connect(masterGain);
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return true;
  }

  function startBgmIfNeeded() {
    if (!ensureAudio()) return;
    if (bgmNodes.length) return;

    const now = audioCtx.currentTime;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 760;
    filter.Q.value = 0.65;
    filter.connect(bgmGain);

    const mix = audioCtx.createGain();
    mix.gain.value = 0.34;
    mix.connect(filter);

    const voices = [
      { freq: 220.0, type: "sine", gain: 0.12, pan: -0.18, detune: -6 },
      { freq: 277.18, type: "triangle", gain: 0.10, pan: 0.12, detune: 6 },
      { freq: 329.63, type: "sine", gain: 0.09, pan: 0.28, detune: 2 },
      { freq: 110.0, type: "sine", gain: 0.08, pan: 0.0, detune: 0 },
    ];

    const nodes = [filter, mix];
    for (const v of voices) {
      const osc = audioCtx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = v.freq;
      osc.detune.value = v.detune;

      const gain = audioCtx.createGain();
      gain.gain.value = v.gain;

      const pan = audioCtx.createStereoPanner();
      pan.pan.value = v.pan;

      osc.connect(gain);
      gain.connect(pan);
      pan.connect(mix);
      osc.start(now);

      nodes.push(osc, gain, pan);
    }

    const tremLfo = audioCtx.createOscillator();
    tremLfo.type = "sine";
    tremLfo.frequency.value = 0.06;

    const tremGain = audioCtx.createGain();
    tremGain.gain.value = 0.06;
    tremLfo.connect(tremGain);
    tremGain.connect(mix.gain);
    tremLfo.start(now);
    nodes.push(tremLfo, tremGain);

    const sweepLfo = audioCtx.createOscillator();
    sweepLfo.type = "sine";
    sweepLfo.frequency.value = 0.024;

    const sweepGain = audioCtx.createGain();
    sweepGain.gain.value = 160;
    sweepLfo.connect(sweepGain);
    sweepGain.connect(filter.frequency);
    sweepLfo.start(now);
    nodes.push(sweepLfo, sweepGain);

    bgmNodes = nodes;
    setBgmVolume(0.48, 0.35);
  }

  function setBgmVolume(target, rampSeconds = 0.18) {
    if (!audioEnabled) return;
    if (!ensureAudio()) return;
    startBgmIfNeeded();
    const now = audioCtx.currentTime;
    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
    bgmGain.gain.linearRampToValueAtTime(clamp(target, 0, 1), now + rampSeconds);
  }

  function playTickSound(currentOmega) {
    if (!audioEnabled) return;
    if (!ensureAudio()) return;
    const now = audioCtx.currentTime;
    const freq = currentOmega > 10 ? 820 : currentOmega > 5 ? 700 : 560;

    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  function playLockSound() {
    if (!audioEnabled) return;
    if (!ensureAudio()) return;
    const now = audioCtx.currentTime;

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

  function playHeartbeat() {
    if (!audioEnabled) return;
    if (!ensureAudio()) return;
    const now = audioCtx.currentTime;

    function thump(atTime, amp) {
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(70, atTime);
      osc.frequency.exponentialRampToValueAtTime(42, atTime + 0.14);

      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 140;
      filter.Q.value = 0.7;

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, atTime);
      gain.gain.linearRampToValueAtTime(amp, atTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.22);

      osc.connect(gain);
      gain.connect(filter);
      filter.connect(masterGain);
      osc.start(atTime);
      osc.stop(atTime + 0.26);
    }

    thump(now, 0.11);
    thump(now + 0.14, 0.075);
  }

  function stopBgm(rampSeconds = 0.12) {
    if (!audioCtx || !bgmGain) return;
    const now = audioCtx.currentTime;
    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
    bgmGain.gain.linearRampToValueAtTime(0.0, now + rampSeconds);

    const stopDelayMs = Math.round((rampSeconds + 0.08) * 1000);
    setTimeout(() => {
      for (const node of bgmNodes) {
        if (typeof node.stop === "function") {
          try {
            node.stop();
          } catch {
            // ignore
          }
        }
        if (typeof node.disconnect === "function") {
          try {
            node.disconnect();
          } catch {
            // ignore
          }
        }
      }
      bgmNodes = [];
    }, stopDelayMs);
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
    lastHeartbeatMs = 0;
    setBgmVolume(suspense ? 0.18 : 0.48, 0.25);
  }

  function showResult(text) {
    resultText.textContent = text;
    resultBackdrop.hidden = false;
    resultCard.hidden = false;
    requestAnimationFrame(() => {
      document.body.classList.add("show-result");
    });
  }

  function hideResult() {
    document.body.classList.remove("show-result");

    if (resultCard.hidden) {
      resultBackdrop.hidden = true;
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resultBackdrop.hidden = true;
      resultCard.hidden = true;
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
    renderOptionsList();
    hideResult();
    scheduleLayout();
  }

  const WHEELS_STORAGE_KEY = "spinWheel.wheels.v1";
  const MAX_SAVED_WHEELS = 40;
  const PANEL_SIZE_KEY = "spinWheel.panelSizeVh.v1";

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

    renderOptionsList();
    hideResult();
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
    wheelNameEl && (wheelNameEl.value = wheel.name);
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

      const input = document.createElement("input");
      input.className = "option-input";
      input.value = value;
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.addEventListener("input", () => {
        options[idx] = input.value;
      });

      const weightRow = document.createElement("div");
      weightRow.className = "weight-row";

      const range = document.createElement("input");
      range.className = "weight-range";
      range.type = "range";
      range.min = "0";
      range.max = "100";
      range.step = "1";
      range.value = String(Math.round(clamp(coerceWeight(weights[idx], 1), 0, 100)));
      range.setAttribute("aria-label", `“${value}” 概率权重`);
      setRangeFill(range);
      range.addEventListener("input", () => {
        weights[idx] = coerceWeight(range.value, 1);
        if (totalWeight() <= 0) {
          weights[idx] = 1;
          range.value = "1";
        }
        setRangeFill(range);
        refreshWeightPercents();
      });

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
      del.textContent = "×";
      del.addEventListener("click", () => {
        options.splice(idx, 1);
        weights.splice(idx, 1);
        if (options.length < 2) options.push("选项 2");
        if (weights.length < options.length) weights.push(1);
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
      const shade = 0.86 + 0.12 * Math.sin(idleT * 0.4 + i * 0.7);
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

    hideResult();
    startBgmIfNeeded();
    highlightIndex = null;

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

      if (suspense) {
        const intervalMs = clamp(980 - (omega - omegaStop) * 120, 640, 980);
        if (nowMs - lastHeartbeatMs >= intervalMs) {
          lastHeartbeatMs = nowMs;
          playHeartbeat();
        }
      }

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

  function installHandlers() {
    spinFab.addEventListener("click", () => startSpin());
    spinAgain.addEventListener("click", () => {
      hideResult();
      startSpin();
    });

    addOptionBtn.addEventListener("click", () => {
      options.push(`选项 ${options.length + 1}`);
      weights.push(1);
      renderOptionsList();
    });

    openImportBtn.addEventListener("click", () => {
      importTextEl.value = options.join("\n");
      if (typeof importDialog.showModal === "function") importDialog.showModal();
      else importDialog.setAttribute("open", "true");
    });

    openWheelsBtn?.addEventListener("click", () => {
      setWheelMessage("");
      const selectedId = String(wheelSelectEl?.value ?? "");
      populateWheelSelect(selectedId);
      const wheel = wheelById(String(wheelSelectEl?.value ?? ""));
      if (wheelNameEl) wheelNameEl.value = wheel?.name ?? "";
      if (typeof wheelDialog?.showModal === "function") wheelDialog.showModal();
      else wheelDialog?.setAttribute("open", "true");
    });

    wheelDialog?.addEventListener("close", () => {
      setWheelMessage("");
    });

    wheelSelectEl?.addEventListener("change", () => {
      setWheelMessage("");
      const wheel = wheelById(String(wheelSelectEl.value ?? ""));
      if (wheelNameEl) wheelNameEl.value = wheel?.name ?? "";
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
      setPanelCollapsed(!panelCollapsed);
    });

    panelSizeRange?.addEventListener("input", () => {
      applyPanelSizeVh(panelSizeRange.value);
    });

    panelSizeReset?.addEventListener("click", () => {
      applyPanelSizeVh(46);
    });

    resultBackdrop.addEventListener("click", () => hideResult());

    resultClose.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideResult();
    });

    usePresetBtn.addEventListener("click", () => {
      const key = presetSelect.value;
      if (!key || !presets[key]) return;
      applyOptions(presets[key]);
    });

    audioToggle.addEventListener("click", () => {
      const next = !audioEnabled;
      audioToggle.setAttribute("aria-pressed", next ? "true" : "false");
      if (!next) {
        stopBgm(0.12);
        audioEnabled = false;
        return;
      }
      audioEnabled = true;
      startBgmIfNeeded();
    });

    window.addEventListener("resize", () => scheduleLayout(), { passive: true });
  }

  renderOptionsList();
  installHandlers();
  loadPanelSizeVh();
  setPanelCollapsed(window.matchMedia?.("(max-height: 780px)")?.matches ?? false);
  scheduleLayout();
  requestAnimationFrame(frame);
})();
