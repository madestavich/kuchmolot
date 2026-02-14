// ============== SLOT GAME: КУЧМОЛОТ ==============

// Regular symbols (can win on their own with 3+ in a row)
// Helper symbols (1-5) only pay in combo with "happy" — no other symbols allowed on the line
const SYMBOLS = [
  {
    id: "happy",
    file: "symbols/happy.jpg",
    name: "Happy",
    type: "regular",
    tier: 1,
  },
  {
    id: "angry",
    file: "symbols/angry.png",
    name: "Angry",
    type: "regular",
    tier: 2,
  },
  { id: "sex", file: "symbols/sex.jpg", name: "Sex", type: "regular", tier: 2 },
  {
    id: "smoking",
    file: "symbols/smoking.jpg",
    name: "Smoking",
    type: "regular",
    tier: 2,
  },
  { id: "h1", file: "symbols/1.webp", name: "1", type: "helper", comboNum: 1 },
  { id: "h2", file: "symbols/2.jpg", name: "2", type: "helper", comboNum: 2 },
  { id: "h3", file: "symbols/3.jpg", name: "3", type: "helper", comboNum: 3 },
  { id: "h4", file: "symbols/4.jpg", name: "4", type: "helper", comboNum: 4 },
  { id: "h5", file: "symbols/5.jpg", name: "5", type: "helper", comboNum: 5 },
];

// Symbol indices for quick lookup
const HAPPY_INDEX = 0;
const ANGRY_INDEX = 1;
const SEX_INDEX = 2;
const SMOKING_INDEX = 3;

// Combo result images (shown in win message)
const COMBO_IMAGES = {
  1: "symbols/combo1.jpeg",
  2: "symbols/combo2.jpg",
  3: "symbols/combo3.jpg",
  4: "symbols/combo4.jpg",
  5: "symbols/combo5.jpg",
};

// Payout multipliers for regular symbols: tier -> { matchCount -> multiplier }
const PAYOUTS = {
  1: { 3: 20, 4: 60, 5: 200 }, // Rare (happy)
  2: { 3: 10, 4: 30, 5: 100 }, // Medium (angry, sex, smoking)
};

// Combo payouts: comboNum -> { matchCount -> multiplier }
const COMBO_PAYOUTS = {
  1: { 3: 15, 4: 50, 5: 150 },
  2: { 3: 25, 4: 80, 5: 250 },
  3: { 3: 40, 4: 120, 5: 400 },
  4: { 3: 60, 4: 180, 5: 600 },
  5: { 3: 100, 4: 300, 5: 1000 },
};

// Helper consecutive payouts: helperNum -> { matchCount -> multiplier }
const HELPER_PAYOUTS = {
  1: { 3: 15, 4: 40, 5: 120 },   // good win
  2: { 3: 0, 4: 0, 5: 0 },       // no win — cells become angry, then re-evaluate
  3: { 3: 5, 4: 15, 5: 50 },     // small win
  4: { 3: 10, 4: 30, 5: 100 },   // + matched become random ("ЯНУКОВИЧ ТІКАЄ")
  5: { 3: 25, 4: 75, 5: 250 },   // significant win + "ПОТУЖНО"
};

// 9 paylines — row indices (0=top, 1=mid, 2=bottom) for each of 5 reels
const PAYLINES = [
  [1, 1, 1, 1, 1], // 1: Middle straight
  [0, 0, 0, 0, 0], // 2: Top straight
  [2, 2, 2, 2, 2], // 3: Bottom straight
  [0, 1, 2, 1, 0], // 4: Diagonal ↘ then ↗ (V shape inverted — actually let me use true diagonals)
  [2, 1, 0, 1, 2], // 5: Diagonal ↗ then ↘ (V shape)
  [0, 0, 1, 2, 2], // 6: Diagonal ↘
  [2, 2, 1, 0, 0], // 7: Diagonal ↗
  [1, 0, 1, 2, 1], // 8: Zigzag ↗↘
  [1, 2, 1, 0, 1], // 9: Zigzag ↘↗
  [1, 0, 0, 0, 1], // 10: Shallow ∧ (mid→top→top→top→mid)
  [1, 2, 2, 2, 1], // 11: Shallow ∨ (mid→bot→bot→bot→mid)
  [1, 0, 0, 1, 1], // 12: Half-diag ↗ + straight (mid→top→top→mid→mid)
  [1, 2, 2, 1, 1], // 13: Half-diag ↘ + straight (mid→bot→bot→mid→mid)
  [1, 1, 0, 0, 1], // 14: Straight + half-diag ↗ (mid→mid→top→top→mid)
  [1, 1, 2, 2, 1], // 15: Straight + half-diag ↘ (mid→mid→bot→bot→mid)
  [0, 1, 1, 1, 0], // 16: Wide top bump (top→mid→mid→mid→top)
  [2, 1, 1, 1, 2], // 17: Wide bottom bump (bot→mid→mid→mid→bot)
];

const PAYLINE_COLORS = [
  "#ff0000",
  "#00ff00",
  "#0066ff",
  "#ff00ff",
  "#ffff00",
  "#00ffff",
  "#ff8800",
  "#88ff00",
  "#ff0088",
  "#ffffff",
  "#ff4444",
  "#44ff44",
  "#4488ff",
  "#ff44ff",
  "#ffff44",
  "#44ffff",
  "#ffaa44",
];

const NUM_REELS = 5;
const VISIBLE_ROWS = 3;
let SYMBOL_HEIGHT = 110;
const EXTRA_SYMBOLS = 20; // extra symbols above and below for spinning animation
const SPIN_DURATION_BASE = 1500; // ms
const SPIN_STAGGER = 300; // ms between reels stopping

let balance = 1000;
let bet = 100;
let spinning = false;

// Win cycling state
let cycleInterval = null;
let cycleLines = [];
let cycleIndex = 0;

// ---- SOUND SYSTEM (Web Audio API) ----
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, type = 'square', volume = 0.15, detune = 0) {
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration, volume = 0.08) {
  const ctx = ensureAudio();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  src.buffer = buffer;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}

function sndClick() {
  playTone(800, 0.08, 'square', 0.12);
  setTimeout(() => playTone(1000, 0.06, 'square', 0.08), 30);
}

function sndSpinStart() {
  // Soft whoosh
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(250, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
  playNoise(0.2, 0.03);
}

let spinLoopNode = null;
let spinLoopGain = null;

function sndSpinLoop() {
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  osc.type = 'sine';
  osc.frequency.value = 80;
  gain.gain.value = 0.025;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  spinLoopNode = osc;
  spinLoopGain = gain;
}

function sndSpinStop() {
  if (spinLoopNode) {
    spinLoopGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    spinLoopNode.stop(audioCtx.currentTime + 0.2);
    spinLoopNode = null;
    spinLoopGain = null;
  }
}

function sndReelStop(index) {
  // Soft click-thud
  playTone(200 - index * 15, 0.1, 'sine', 0.1);
}

function sndWin() {
  // Happy ascending arpeggio
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.2, 'square', 0.1), i * 80);
  });
}

function sndBigWin() {
  // Fanfare
  const notes = [523, 659, 784, 1047, 1319, 1568];
  notes.forEach((f, i) => {
    setTimeout(() => {
      playTone(f, 0.3, 'square', 0.12);
      playTone(f * 0.5, 0.3, 'triangle', 0.08);
    }, i * 100);
  });
}

function sndAngry() {
  // Play the MP3 file
  const audio = new Audio('sound/було вже.mp3');
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

function sndCredit() {
  playTone(440, 0.15, 'sine', 0.1);
  setTimeout(() => playTone(660, 0.15, 'sine', 0.1), 100);
  setTimeout(() => playTone(880, 0.2, 'sine', 0.12), 200);
}

function sndSexFeature() {
  // Funky rising
  const notes = [330, 440, 554, 659, 880];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.15, 'triangle', 0.1), i * 60);
  });
}

function sndTransform() {
  playTone(600, 0.15, 'sine', 0.1);
  setTimeout(() => playTone(900, 0.1, 'sine', 0.08), 80);
  playNoise(0.1, 0.05);
}

// Reel state: what's currently showing (after spin)
let reelResults = []; // [reel][row] = symbol index

// DOM refs
const balanceEl = document.getElementById("balance");
const betEl = document.getElementById("bet");
const winEl = document.getElementById("win");
const spinBtn = document.getElementById("spin-btn");
const winMsg = document.getElementById("win-message");
const canvas = document.getElementById("payline-canvas");
const ctx = canvas.getContext("2d");

// ---- INITIALIZATION ----

function init() {
  // Calculate initial symbol height from reel size
  const reel0 = document.getElementById("reel-0");
  if (reel0 && reel0.clientHeight > 0) {
    SYMBOL_HEIGHT = Math.floor(reel0.clientHeight / VISIBLE_ROWS);
  }
  buildReels();
  setupControls();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
}

function buildReels() {
  for (let r = 0; r < NUM_REELS; r++) {
    const reelEl = document.getElementById(`reel-${r}`);
    reelEl.innerHTML = "";

    const strip = document.createElement("div");
    strip.className = "reel-strip";
    strip.id = `strip-${r}`;

    // Build initial symbols (VISIBLE_ROWS shown)
    const totalCells = VISIBLE_ROWS + EXTRA_SYMBOLS * 2;
    for (let i = 0; i < totalCells; i++) {
      strip.appendChild(createSymbolCell(randomSymbol()));
    }
    reelEl.appendChild(strip);

    // Position to show middle section
    strip.style.transform = `translateY(-${EXTRA_SYMBOLS * SYMBOL_HEIGHT}px)`;
  }

  // Record initial visible results
  reelResults = [];
  for (let r = 0; r < NUM_REELS; r++) {
    reelResults[r] = [];
    const cells = document.querySelectorAll(`#strip-${r} .symbol-cell`);
    for (let row = 0; row < VISIBLE_ROWS; row++) {
      const idx = EXTRA_SYMBOLS + row;
      reelResults[r][row] = parseInt(cells[idx].dataset.symbolIndex);
    }
  }
}

function createSymbolCell(symbolIdx) {
  const cell = document.createElement("div");
  cell.className = "symbol-cell";
  cell.style.height = SYMBOL_HEIGHT + "px";
  cell.dataset.symbolIndex = symbolIdx;
  const img = document.createElement("img");
  img.src = SYMBOLS[symbolIdx].file;
  img.alt = SYMBOLS[symbolIdx].name;
  img.draggable = false;
  cell.appendChild(img);
  return cell;
}

function randomSymbol() {
  // Weighted: helpers appear more often, regular rarer, angry 2x more
  const weights = SYMBOLS.map((s, i) => {
    if (i === ANGRY_INDEX) return 12; // angry very frequent
    if (s.type === "helper" && s.comboNum === 5) return 8; // helper 5 twice as often
    if (s.type === "helper" && s.comboNum === 4) return 8; // helper 4 twice as often
    if (s.type === "helper" && s.comboNum === 2) return 6; // helper 2 slightly more often
    if (s.type === "helper") return 4; // helpers common
    if (s.tier === 2) return 3; // medium regular
    return 2; // rare regular (happy)
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return i;
  }
  return SYMBOLS.length - 1;
}

function setupControls() {
  spinBtn.addEventListener("click", () => {
    if (spinBtn.dataset.mode === "credit") {
      takeCredit();
    } else {
      spin();
    }
  });

  document.getElementById("bet-up").addEventListener("click", () => {
    if (spinning) return;
    bet = Math.min(bet + 100, Math.min(balance, 500));
    betEl.textContent = bet;
  });

  document.getElementById("bet-down").addEventListener("click", () => {
    if (spinning) return;
    bet = Math.max(bet - 100, 100);
    betEl.textContent = bet;
  });

  // Space bar to spin or take credit
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !spinning) {
      e.preventDefault();
      if (spinBtn.dataset.mode === "credit") {
        takeCredit();
      } else {
        spin();
      }
    }
  });
}

function takeCredit() {
  balance += 1000;
  balanceEl.textContent = balance;
  showWinMessage("💰 КРЕДИТ +1000!");
  sndCredit();
  updateSpinButton();
}

function updateSpinButton() {
  if (balance < bet && !spinning) {
    spinBtn.textContent = "ВЗЯТИ КРЕДИТ";
    spinBtn.dataset.mode = "credit";
    spinBtn.disabled = false;
    spinBtn.classList.add("credit-mode");
  } else {
    spinBtn.textContent = "КРУТИТИ";
    spinBtn.dataset.mode = "spin";
    spinBtn.classList.remove("credit-mode");
  }
}

function resizeCanvas() {
  const container = document.querySelector(".reels-window");
  canvas.width = container.clientWidth - 20;
  canvas.height = container.clientHeight - 0;

  // Recalculate symbol height based on actual reel size
  const reel0 = document.getElementById("reel-0");
  if (reel0) {
    SYMBOL_HEIGHT = Math.floor(reel0.clientHeight / VISIBLE_ROWS);
    // Update all symbol cells
    document.querySelectorAll(".symbol-cell").forEach((cell) => {
      cell.style.height = SYMBOL_HEIGHT + "px";
    });
    // Re-position strips
    for (let r = 0; r < NUM_REELS; r++) {
      const strip = document.getElementById(`strip-${r}`);
      if (strip && !strip.classList.contains("spinning")) {
        strip.style.transform = `translateY(-${EXTRA_SYMBOLS * SYMBOL_HEIGHT}px)`;
      }
    }
  }
}

// ---- SPIN LOGIC ----

function spin() {
  if (spinning) return;
  if (balance < bet) {
    updateSpinButton();
    return;
  }

  spinning = true;
  spinBtn.disabled = true;
  stopWinCycle();
  clearHighlights();
  clearCanvas();
  winMsg.classList.add("hidden");
  winEl.textContent = "0";

  sndClick();
  setTimeout(() => { sndSpinStart(); sndSpinLoop(); }, 50);

  balance -= bet;
  balanceEl.textContent = balance;

  // Determine final results for each reel
  const finalSymbols = [];
  for (let r = 0; r < NUM_REELS; r++) {
    finalSymbols[r] = [];
    for (let row = 0; row < VISIBLE_ROWS; row++) {
      finalSymbols[r][row] = randomSymbol();
    }
  }

  // Animate each reel
  const promises = [];
  for (let r = 0; r < NUM_REELS; r++) {
    promises.push(
      animateReel(r, finalSymbols[r], SPIN_DURATION_BASE + r * SPIN_STAGGER),
    );
  }

  Promise.all(promises).then(() => {
    reelResults = finalSymbols;
    checkSexFeature();
  });
}

// ---- SEX FEATURE: 3+ sex anywhere → angry become happy (pay), then sex become smoking (pay) ----

function checkSexFeature() {
  // Count all "sex" symbols on the visible grid
  let sexCount = 0;
  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < VISIBLE_ROWS; row++) {
      if (reelResults[r][row] === SEX_INDEX) sexCount++;
    }
  }

  if (sexCount >= 3) {
    const angryCells = [];
    const sexCells = [];
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < VISIBLE_ROWS; row++) {
        if (reelResults[r][row] === ANGRY_INDEX)
          angryCells.push({ reel: r, row });
        if (reelResults[r][row] === SEX_INDEX) sexCells.push({ reel: r, row });
      }
    }

    highlightSexTrigger();
    sndSexFeature();
    let runningTotal = 0;
    let prevWinMap = {}; // tracks paylineIndex → win amount to prevent double-counting

    // Phase 0: Evaluate initial grid BEFORE any transformations
    const p0 = evaluateWinSilent();
    const p0net = p0.totalWin - p0.totalLoss;
    if (p0.totalWin > 0 || p0.totalLoss > 0) {
      runningTotal += p0net;
      balance += p0net;
      balanceEl.textContent = balance;
      winEl.textContent = Math.max(0, runningTotal);
      startWinCycle(p0.winningLines);
      const cw0 = p0.winningLines.filter((w) => w.isCombo);
      if (cw0.length > 0) animateComboTransform(cw0);
      if (p0.totalLoss > 0 && p0.totalWin > 0) {
        showWinMessage(`😡 ЗЛИЙ КУЧМА КРАДЕ ${p0.totalLoss}! 🎉 ВИГРАШ ${p0.totalWin}!`);
        sndWin();
      } else if (p0.totalLoss > 0) {
        showWinMessage(`😡 ЗЛИЙ КУЧМА КРАДЕ ${p0.totalLoss}!`);
        sndAngry();
      }
    }
    for (const w of p0.winningLines) prevWinMap[w.paylineIndex] = w.win;

    setTimeout(() => {
      // STEP 1: angry → happy
      const step1 =
        angryCells.length > 0
          ? new Promise((resolve) => {
              clearHighlights();
              clearCanvas();
              showWinMessage("🔥 КУЧМА ДОБРІШАЄ 🔥");
              sndTransform();
              animateAngryToHappy(angryCells, resolve);
            })
          : Promise.resolve();

      step1.then(() => {
        if (angryCells.length > 0) {
          for (const ac of angryCells)
            reelResults[ac.reel][ac.row] = HAPPY_INDEX;
          const p1 = evaluateWinSilent();
          const d1 = calcPhaseDelta(p1, prevWinMap);
          prevWinMap = d1.newWinMap;
          if (d1.delta > 0) {
            runningTotal += d1.delta;
            balance += d1.delta;
            balanceEl.textContent = balance;
            winEl.textContent = runningTotal;
            startWinCycle(p1.winningLines);
            const cw = d1.newLines.filter((w) => w.isCombo);
            if (cw.length > 0) animateComboTransform(cw);
            showWinMessage(`🎉 ВИГРАШ ${d1.delta}!`);
          }
        }

        // STEP 2: sex → smoking
        const delay2 = runningTotal > 0 ? 3000 : 1000;
        setTimeout(() => {
          clearHighlights();
          clearCanvas();
          showWinMessage("КУЧМА ЕЯКУЛІРУЄ!!!");
          sndTransform();
          const step2 = new Promise((resolve) =>
            animateSexToSmoking(sexCells, resolve),
          );

          step2.then(() => {
            for (const sc of sexCells)
              reelResults[sc.reel][sc.row] = SMOKING_INDEX;
            document
              .querySelectorAll(".sex-trigger")
              .forEach((el) => el.classList.remove("sex-trigger"));

            const p2 = evaluateWinSilent();
            const d2 = calcPhaseDelta(p2, prevWinMap);
            prevWinMap = d2.newWinMap;
            if (d2.delta > 0) {
              runningTotal += d2.delta;
              balance += d2.delta;
              balanceEl.textContent = balance;
              winEl.textContent = runningTotal;
              startWinCycle(p2.winningLines);
              const cw2 = d2.newLines.filter((w) => w.isCombo);
              if (cw2.length > 0) animateComboTransform(cw2);
              showWinMessage(`🎉 ВИГРАШ ${d2.delta}!`);
            }

            // STEP 3: happy → smoking
            const happyCells = [];
            for (let r = 0; r < NUM_REELS; r++) {
              for (let row = 0; row < VISIBLE_ROWS; row++) {
                if (reelResults[r][row] === HAPPY_INDEX)
                  happyCells.push({ reel: r, row });
              }
            }

            const delay3 = d2.delta > 0 ? 3000 : 1000;
            setTimeout(() => {
              if (happyCells.length > 0) {
                clearHighlights();
                clearCanvas();
                showWinMessage("😤 КУЧМА КУРИТЬ 😤");
                sndTransform();
                const step3 = new Promise((resolve) =>
                  animateHappyToSmoking(happyCells, resolve),
                );
                step3.then(() => {
                  for (const hc of happyCells)
                    reelResults[hc.reel][hc.row] = SMOKING_INDEX;

                  const p3 = evaluateWinSilent();
                  const d3 = calcPhaseDelta(p3, prevWinMap);
                  if (d3.delta > 0) {
                    runningTotal += d3.delta;
                    balance += d3.delta;
                    balanceEl.textContent = balance;
                    winEl.textContent = runningTotal;
                    startWinCycle(p3.winningLines);
                    const cw3 = d3.newLines.filter((w) => w.isCombo);
                    if (cw3.length > 0) animateComboTransform(cw3);
                    showWinMessage(`🎉 ЗАГАЛЬНИЙ ВИГРАШ ${runningTotal}!`);
                  } else if (runningTotal > 0) {
                    showWinMessage(`🎉 ЗАГАЛЬНИЙ ВИГРАШ ${runningTotal}!`);
                  }
                  spinning = false;
                  spinBtn.disabled = false;
                  updateSpinButton();
                });
              } else {
                if (runningTotal > 0)
                  showWinMessage(`🎉 ЗАГАЛЬНИЙ ВИГРАШ ${runningTotal}!`);
                spinning = false;
                spinBtn.disabled = false;
                updateSpinButton();
              }
            }, delay3);
          });
        }, delay2);
      });
    }, 1500);
  } else {
    const winResult = evaluateWin();
    processHelperPostEffects(winResult, () => {
      spinning = false;
      spinBtn.disabled = false;
      updateSpinButton();
    });
  }
}

// Calculate only NEW wins compared to previous phase
function calcPhaseDelta(result, prevWinMap) {
  let delta = 0;
  let deltaLoss = 0;
  const newWinMap = {};
  const newLines = [];
  for (const w of result.winningLines) {
    newWinMap[w.paylineIndex] = w.win;
    const prev = prevWinMap[w.paylineIndex] || 0;
    if (w.win > prev) {
      if (w.isAngry) {
        deltaLoss += w.win - prev;
      } else {
        delta += w.win - prev;
      }
      newLines.push(w);
    }
  }
  return { delta, deltaLoss, newWinMap, newLines };
}

// Evaluate wins without modifying balance/UI — returns { totalWin, totalLoss, winningLines }
function evaluateWinSilent() {
  let totalWin = 0;
  let totalLoss = 0;
  const winningLines = [];

  for (let pl = 0; pl < PAYLINES.length; pl++) {
    const line = PAYLINES[pl];
    const lineSymbols = [];
    for (let r = 0; r < NUM_REELS; r++) {
      lineSymbols.push(reelResults[r][line[r]]);
    }

    const firstSym = lineSymbols[0];
    if (SYMBOLS[firstSym].type === "regular") {
      let count = 1;
      for (let r = 1; r < NUM_REELS; r++) {
        if (lineSymbols[r] === firstSym) count++;
        else break;
      }
      if (count >= 3) {
        const tier = SYMBOLS[firstSym].tier;
        const multiplier = PAYOUTS[tier][count];
        const lineWin = bet * multiplier;
        const isAngry = firstSym === ANGRY_INDEX;
        if (isAngry) {
          totalLoss += lineWin;
        } else {
          totalWin += lineWin;
        }
        winningLines.push({
          paylineIndex: pl,
          count,
          symbol: firstSym,
          win: lineWin,
          isCombo: false,
          isAngry,
        });
        continue;
      }
    }

    // --- 2) Check helper consecutive: 3+ identical helper from left ---
    if (SYMBOLS[firstSym].type === "helper") {
      let count = 1;
      for (let r = 1; r < NUM_REELS; r++) {
        if (lineSymbols[r] === firstSym) count++;
        else break;
      }
      if (count >= 3) {
        const helperNum = SYMBOLS[firstSym].comboNum;
        const multiplier = HELPER_PAYOUTS[helperNum][count];
        const lineWin = bet * multiplier;
        totalWin += lineWin;
        winningLines.push({
          paylineIndex: pl,
          count,
          symbol: firstSym,
          win: lineWin,
          isCombo: false,
          isAngry: false,
          isHelper: true,
          helperNum,
        });
        continue;
      }
    }

    // --- 3) Check combo: ALL 5 positions must be happy OR same helper ---
    let comboNum = null;
    let hasHappy = false;
    let hasHelper = false;
    let comboValid = true;

    for (let r = 0; r < NUM_REELS; r++) {
      const sym = SYMBOLS[lineSymbols[r]];
      if (lineSymbols[r] === HAPPY_INDEX) {
        hasHappy = true;
      } else if (sym.type === "helper") {
        hasHelper = true;
        if (comboNum === null) comboNum = sym.comboNum;
        else if (sym.comboNum !== comboNum) {
          comboValid = false;
          break;
        }
      } else {
        comboValid = false;
        break;
      }
    }

    if (comboValid && hasHappy && hasHelper && comboNum !== null) {
      const multiplier = COMBO_PAYOUTS[comboNum][NUM_REELS];
      const lineWin = bet * multiplier;
      totalWin += lineWin;
      winningLines.push({
        paylineIndex: pl,
        count: NUM_REELS,
        symbol: firstSym,
        win: lineWin,
        isCombo: true,
        comboNum,
      });
    }
  }

  return { totalWin, totalLoss, winningLines };
}

function formatWinNames(winningLines) {
  return winningLines
    .map((w) => {
      if (w.isCombo)
        return `COMBO ${w.comboNum}! ×${w.count} (лінія ${w.paylineIndex + 1})`;
      return `${SYMBOLS[w.symbol].name} ×${w.count} (лінія ${w.paylineIndex + 1})`;
    })
    .join(", ");
}

function highlightSexTrigger() {
  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < VISIBLE_ROWS; row++) {
      if (reelResults[r][row] === SEX_INDEX) {
        const strip = document.getElementById(`strip-${r}`);
        const cell = strip.children[EXTRA_SYMBOLS + row];
        if (cell) cell.classList.add("sex-trigger");
      }
    }
  }
  showWinMessage("🔥 ЦИЦЬКИ!!! 🔥");
}

function animateAngryToHappy(angryCells, onComplete) {
  let completed = 0;

  for (let i = 0; i < angryCells.length; i++) {
    const { reel, row } = angryCells[i];
    const strip = document.getElementById(`strip-${reel}`);
    const cell = strip.children[EXTRA_SYMBOLS + row];
    if (!cell) {
      completed++;
      continue;
    }

    const delay = i * 400;

    setTimeout(() => {
      // Phase 1: angry shake + red glow
      cell.classList.add("angry-shake");
      spawnAngryParticles(cell);

      setTimeout(() => {
        // Phase 2: shrink with spin
        cell.classList.remove("angry-shake");
        cell.classList.add("angry-to-happy-shrink");

        setTimeout(() => {
          // Swap image to happy
          const img = cell.querySelector("img");
          if (img) {
            img.src = SYMBOLS[HAPPY_INDEX].file;
            img.alt = SYMBOLS[HAPPY_INDEX].name;
          }
          cell.dataset.symbolIndex = HAPPY_INDEX;

          // Phase 3: grow with golden flash
          cell.classList.remove("angry-to-happy-shrink");
          cell.classList.add("angry-to-happy-grow");
          spawnHappyParticles(cell);

          setTimeout(() => {
            cell.classList.remove("angry-to-happy-grow");
            cell.classList.add("happy-glow");
            completed++;
            if (completed === angryCells.length) {
              setTimeout(onComplete, 600);
            }
          }, 800);
        }, 600);
      }, 700);
    }, delay);
  }
}

function spawnAngryParticles(cell) {
  const rect = cell.getBoundingClientRect();
  const containerRect = document
    .querySelector(".reels-container")
    .getBoundingClientRect();
  const cx = rect.left - containerRect.left + rect.width / 2;
  const cy = rect.top - containerRect.top + rect.height / 2;

  for (let i = 0; i < 8; i++) {
    const particle = document.createElement("div");
    particle.className = "combo-particle angry-particle";
    const angle = (Math.PI * 2 * i) / 8;
    const dist = 30 + Math.random() * 20;
    particle.style.left = cx + "px";
    particle.style.top = cy + "px";
    particle.style.setProperty("--tx", Math.cos(angle) * dist + "px");
    particle.style.setProperty("--ty", Math.sin(angle) * dist + "px");
    particle.style.background = `hsl(${Math.random() * 20}, 100%, 50%)`; // red-ish
    particle.style.width = "8px";
    particle.style.height = "8px";
    document.querySelector(".reels-container").appendChild(particle);
    setTimeout(() => particle.remove(), 600);
  }
}

function spawnHappyParticles(cell) {
  const rect = cell.getBoundingClientRect();
  const containerRect = document
    .querySelector(".reels-container")
    .getBoundingClientRect();
  const cx = rect.left - containerRect.left + rect.width / 2;
  const cy = rect.top - containerRect.top + rect.height / 2;

  for (let i = 0; i < 16; i++) {
    const particle = document.createElement("div");
    particle.className = "combo-particle happy-particle";
    const angle = (Math.PI * 2 * i) / 16;
    const dist = 50 + Math.random() * 30;
    particle.style.left = cx + "px";
    particle.style.top = cy + "px";
    particle.style.setProperty("--tx", Math.cos(angle) * dist + "px");
    particle.style.setProperty("--ty", Math.sin(angle) * dist + "px");
    const hue = 40 + Math.floor(Math.random() * 30); // golden
    particle.style.background = `hsl(${hue}, 100%, 65%)`;
    particle.style.boxShadow = `0 0 6px hsl(${hue}, 100%, 65%)`;
    document.querySelector(".reels-container").appendChild(particle);
    setTimeout(() => particle.remove(), 800);
  }
}

function animateSexToSmoking(sexCells, onComplete) {
  let completed = 0;

  for (let i = 0; i < sexCells.length; i++) {
    const { reel, row } = sexCells[i];
    const strip = document.getElementById(`strip-${reel}`);
    const cell = strip.children[EXTRA_SYMBOLS + row];
    if (!cell) {
      completed++;
      if (completed === sexCells.length) setTimeout(onComplete, 300);
      continue;
    }

    const delay = i * 400;

    setTimeout(() => {
      // Phase 1: pink pulse
      cell.classList.remove("sex-trigger");
      cell.classList.add("sex-to-smoking-pulse");
      spawnSmokeParticles(cell);

      setTimeout(() => {
        // Phase 2: shrink with spin
        cell.classList.remove("sex-to-smoking-pulse");
        cell.classList.add("sex-to-smoking-shrink");

        setTimeout(() => {
          // Swap image to smoking
          const img = cell.querySelector("img");
          if (img) {
            img.src = SYMBOLS[SMOKING_INDEX].file;
            img.alt = SYMBOLS[SMOKING_INDEX].name;
          }
          cell.dataset.symbolIndex = SMOKING_INDEX;

          // Phase 3: grow with smoke effect
          cell.classList.remove("sex-to-smoking-shrink");
          cell.classList.add("sex-to-smoking-grow");
          spawnSmokeParticles(cell);

          setTimeout(() => {
            cell.classList.remove("sex-to-smoking-grow");
            cell.classList.add("smoking-glow");
            completed++;
            if (completed === sexCells.length) {
              setTimeout(onComplete, 600);
            }
          }, 800);
        }, 600);
      }, 600);
    }, delay);
  }
}

function spawnSmokeParticles(cell) {
  const rect = cell.getBoundingClientRect();
  const containerRect = document
    .querySelector(".reels-container")
    .getBoundingClientRect();
  const cx = rect.left - containerRect.left + rect.width / 2;
  const cy = rect.top - containerRect.top + rect.height / 2;

  for (let i = 0; i < 10; i++) {
    const particle = document.createElement("div");
    particle.className = "combo-particle smoke-particle";
    const angle = (Math.PI * 2 * i) / 10;
    const dist = 35 + Math.random() * 25;
    particle.style.left = cx + "px";
    particle.style.top = cy + "px";
    particle.style.setProperty("--tx", Math.cos(angle) * dist + "px");
    particle.style.setProperty("--ty", Math.sin(angle) * dist - 20 + "px"); // drift upward
    const gray = 120 + Math.floor(Math.random() * 80);
    particle.style.background = `rgb(${gray}, ${gray}, ${gray})`;
    particle.style.width = 6 + Math.random() * 6 + "px";
    particle.style.height = particle.style.width;
    particle.style.opacity = "0.7";
    document.querySelector(".reels-container").appendChild(particle);
    setTimeout(() => particle.remove(), 700);
  }
}

function animateHappyToSmoking(happyCells, onComplete) {
  let completed = 0;

  for (let i = 0; i < happyCells.length; i++) {
    const { reel, row } = happyCells[i];
    const strip = document.getElementById(`strip-${reel}`);
    const cell = strip.children[EXTRA_SYMBOLS + row];
    if (!cell) {
      completed++;
      if (completed === happyCells.length) setTimeout(onComplete, 300);
      continue;
    }

    const delay = i * 350;

    setTimeout(() => {
      // Phase 1: happy fades with green particles
      cell.classList.remove("happy-glow");
      cell.classList.add("happy-to-smoking-fade");
      spawnHappyParticles(cell);

      setTimeout(() => {
        // Phase 2: shrink
        cell.classList.remove("happy-to-smoking-fade");
        cell.classList.add("happy-to-smoking-shrink");

        setTimeout(() => {
          // Swap to smoking
          const img = cell.querySelector("img");
          if (img) {
            img.src = SYMBOLS[SMOKING_INDEX].file;
            img.alt = SYMBOLS[SMOKING_INDEX].name;
          }
          cell.dataset.symbolIndex = SMOKING_INDEX;

          // Phase 3: grow with smoke
          cell.classList.remove("happy-to-smoking-shrink");
          cell.classList.add("happy-to-smoking-grow");
          spawnSmokeParticles(cell);

          setTimeout(() => {
            cell.classList.remove("happy-to-smoking-grow");
            cell.classList.add("smoking-glow");
            completed++;
            if (completed === happyCells.length) {
              setTimeout(onComplete, 600);
            }
          }, 800);
        }, 600);
      }, 400);
    }, delay);
  }
}

function animateReel(reelIndex, finalRow, duration) {
  return new Promise((resolve) => {
    const strip = document.getElementById(`strip-${reelIndex}`);
    const totalCells = VISIBLE_ROWS + EXTRA_SYMBOLS * 2;

    // Rebuild strip with random symbols + final result in the visible zone
    strip.innerHTML = "";
    for (let i = 0; i < totalCells; i++) {
      let symIdx;
      if (i >= EXTRA_SYMBOLS && i < EXTRA_SYMBOLS + VISIBLE_ROWS) {
        symIdx = finalRow[i - EXTRA_SYMBOLS];
      } else {
        symIdx = randomSymbol();
      }
      strip.appendChild(createSymbolCell(symIdx));
    }

    // Start scrolled to bottom, animate strip downward to reveal final symbols
    const startOffset = EXTRA_SYMBOLS * 2 * SYMBOL_HEIGHT;
    const endOffset = EXTRA_SYMBOLS * SYMBOL_HEIGHT;

    strip.style.transition = "none";
    strip.style.transform = `translateY(-${startOffset}px)`;

    // Force reflow
    strip.offsetHeight;

    // Add spinning class for continuous animation
    strip.classList.add("spinning");

    // Animate with intervals to simulate spinning blur
    const startTime = performance.now();
    let rafId;

    function spinFrame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: fast at start, slow at end
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentOffset = startOffset + (endOffset - startOffset) * eased;

      strip.style.transform = `translateY(-${currentOffset}px)`;

      if (progress < 1) {
        rafId = requestAnimationFrame(spinFrame);
      } else {
        strip.classList.remove("spinning");
        strip.style.transform = `translateY(-${endOffset}px)`;
        sndReelStop(reelIndex);
        if (reelIndex === NUM_REELS - 1) sndSpinStop();
        resolve();
      }
    }

    rafId = requestAnimationFrame(spinFrame);
  });
}

// ---- WIN EVALUATION ----

function evaluateWin() {
  let totalWin = 0;
  let totalLoss = 0;
  const winningLines = [];

  for (let pl = 0; pl < PAYLINES.length; pl++) {
    const line = PAYLINES[pl];
    // Get symbol indices on each reel for this payline
    const lineSymbols = [];
    for (let r = 0; r < NUM_REELS; r++) {
      lineSymbols.push(reelResults[r][line[r]]);
    }

    // --- 1) Check regular wins: 3+ identical from left ---
    const firstSym = lineSymbols[0];
    if (SYMBOLS[firstSym].type === "regular") {
      let count = 1;
      for (let r = 1; r < NUM_REELS; r++) {
        if (lineSymbols[r] === firstSym) {
          count++;
        } else {
          break;
        }
      }
      if (count >= 3) {
        const tier = SYMBOLS[firstSym].tier;
        const multiplier = PAYOUTS[tier][count];
        const lineWin = bet * multiplier;
        const isAngry = firstSym === ANGRY_INDEX;
        if (isAngry) {
          totalLoss += lineWin;
        } else {
          totalWin += lineWin;
        }
        winningLines.push({
          paylineIndex: pl,
          count,
          symbol: firstSym,
          win: lineWin,
          isCombo: false,
          isAngry,
        });
        continue; // don't also check combo on this line
      }
    }

    // --- 2) Check helper consecutive: 3+ identical helper from left ---
    if (SYMBOLS[firstSym].type === "helper") {
      let count = 1;
      for (let r = 1; r < NUM_REELS; r++) {
        if (lineSymbols[r] === firstSym) count++;
        else break;
      }
      if (count >= 3) {
        const helperNum = SYMBOLS[firstSym].comboNum;
        const multiplier = HELPER_PAYOUTS[helperNum][count];
        const lineWin = bet * multiplier;
        totalWin += lineWin;
        winningLines.push({
          paylineIndex: pl,
          count,
          symbol: firstSym,
          win: lineWin,
          isCombo: false,
          isAngry: false,
          isHelper: true,
          helperNum,
        });
        continue;
      }
    }

    // --- 3) Check combo wins: ALL 5 positions must be happy OR same helper number ---
    let comboNum = null;
    let hasHappy = false;
    let hasHelper = false;
    let comboValid = true;

    for (let r = 0; r < NUM_REELS; r++) {
      const sym = SYMBOLS[lineSymbols[r]];
      if (lineSymbols[r] === HAPPY_INDEX) {
        hasHappy = true;
      } else if (sym.type === "helper") {
        hasHelper = true;
        if (comboNum === null) {
          comboNum = sym.comboNum;
        } else if (sym.comboNum !== comboNum) {
          comboValid = false;
          break;
        }
      } else {
        comboValid = false;
        break;
      }
    }

    if (comboValid && hasHappy && hasHelper && comboNum !== null) {
      const multiplier = COMBO_PAYOUTS[comboNum][NUM_REELS];
      const lineWin = bet * multiplier;
      totalWin += lineWin;
      winningLines.push({
        paylineIndex: pl,
        count: NUM_REELS,
        symbol: firstSym,
        win: lineWin,
        isCombo: true,
        comboNum,
      });
    }
  }

  if (totalWin > 0 || totalLoss > 0) {
    const net = totalWin - totalLoss;
    balance += net;
    balanceEl.textContent = balance;
    winEl.textContent = net >= 0 ? net : 0;

    // Highlight winning cells
    startWinCycle(winningLines);

    // Animate combo transformations
    const comboWins = winningLines.filter((w) => w.isCombo);
    if (comboWins.length > 0) {
      animateComboTransform(comboWins);
    }

    // Check for helper 5 special messages
    const h5wins = winningLines.filter(w => w.isHelper && w.helperNum === 5);
    let h5msg = '';
    if (h5wins.length > 0) {
      const maxCount = Math.max(...h5wins.map(w => w.count));
      if (maxCount >= 5) h5msg = '💪💪💪 ГІПЕР ПОТУЖНО!';
      else if (maxCount >= 4) h5msg = '💪💪 ДУЖЕ ПОТУЖНО!';
      else h5msg = '💪 ПОТУЖНО!';
      const potAudio = new Audio('sound/потужно.mp3');
      potAudio.volume = 0.6;
      potAudio.play().catch(() => {});
    }

    if (totalLoss > 0 && totalWin > 0) {
      showWinMessage(`😡 ЗЛИЙ КУЧМА КРАДЕ ${totalLoss}! 🎉 ВИГРАШ ${totalWin}!` + (h5msg ? ` ${h5msg}` : ''));
      sndWin();
    } else if (totalLoss > 0) {
      showWinMessage(`😡 ЗЛИЙ КУЧМА КРАДЕ ${totalLoss}!`);
      sndAngry();
    } else if (h5msg) {
      showWinMessage(`${h5msg} ВИГРАШ ${totalWin}!`);
      sndBigWin();
    } else {
      showWinMessage(`🎉 ВИГРАШ ${totalWin}!`);
      if (totalWin >= bet * 20) sndBigWin(); else sndWin();
    }
  }

  return winningLines;
}

function highlightWins(winningLines) {
  // Don't highlight all at once — cycling handles it
}

function highlightSingleWin(wl) {
  clearHighlights();
  const line = PAYLINES[wl.paylineIndex];
  for (let r = 0; r < wl.count; r++) {
    const row = line[r];
    const strip = document.getElementById(`strip-${r}`);
    const cell = strip.children[EXTRA_SYMBOLS + row];
    if (cell) {
      cell.classList.add("win-highlight");
    }
  }
}

function drawSingleWinPayline(wl) {
  clearCanvas();
  const reelWidth = canvas.width / NUM_REELS;
  const line = PAYLINES[wl.paylineIndex];
  const color = PAYLINE_COLORS[wl.paylineIndex % PAYLINE_COLORS.length];

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  for (let r = 0; r < NUM_REELS; r++) {
    const x = reelWidth * r + reelWidth / 2;
    const y = line[r] * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2;
    if (r === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = color;
  for (let r = 0; r < wl.count; r++) {
    const x = reelWidth * r + reelWidth / 2;
    const y = line[r] * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function startWinCycle(winningLines) {
  stopWinCycle();
  if (winningLines.length === 0) return;
  cycleLines = winningLines;
  cycleIndex = 0;

  // Show first one immediately
  showCycleStep();

  if (cycleLines.length > 1) {
    cycleInterval = setInterval(showCycleStep, 1500);
  }
}

function showCycleStep() {
  if (cycleLines.length === 0) return;
  const wl = cycleLines[cycleIndex];
  highlightSingleWin(wl);
  drawSingleWinPayline(wl);
  if (wl.isAngry) {
    playTone(200, 0.15, 'sawtooth', 0.08);
  } else {
    playTone(523 + cycleIndex * 50, 0.15, 'square', 0.07);
  }
  cycleIndex = (cycleIndex + 1) % cycleLines.length;
}

function stopWinCycle() {
  if (cycleInterval) {
    clearInterval(cycleInterval);
    cycleInterval = null;
  }
  cycleLines = [];
  cycleIndex = 0;
}

function clearHighlights() {
  document
    .querySelectorAll(".win-highlight")
    .forEach((el) => el.classList.remove("win-highlight"));
  document.querySelectorAll(".combo-transformed").forEach((el) => {
    el.classList.remove("combo-transformed");
  });
  document.querySelectorAll(".happy-glow").forEach((el) => {
    el.classList.remove("happy-glow");
  });
  document.querySelectorAll(".smoking-glow").forEach((el) => {
    el.classList.remove("smoking-glow");
  });
  document.querySelectorAll(".sex-trigger").forEach((el) => {
    el.classList.remove("sex-trigger");
  });
  document.querySelectorAll(".combo-particle").forEach((el) => el.remove());
}

// ---- COMBO TRANSFORM ANIMATION ----

function animateComboTransform(comboWins) {
  for (const wl of comboWins) {
    const line = PAYLINES[wl.paylineIndex];
    const comboImg = COMBO_IMAGES[wl.comboNum];

    for (let r = 0; r < wl.count; r++) {
      const row = line[r];
      const strip = document.getElementById(`strip-${r}`);
      const cell = strip.children[EXTRA_SYMBOLS + row];
      if (!cell) continue;

      // Stagger each cell
      const delay = r * 250;

      setTimeout(() => {
        // Add shrink-spin class
        cell.classList.add("combo-shrink");

        // Halfway through shrink, swap image
        setTimeout(() => {
          const img = cell.querySelector("img");
          if (img) {
            img.src = comboImg;
            img.alt = `Combo ${wl.comboNum}`;
          }
          cell.classList.remove("combo-shrink");
          cell.classList.add("combo-grow", "combo-transformed");

          // Spawn particles
          spawnComboParticles(cell);

          // Remove grow class after animation
          setTimeout(() => {
            cell.classList.remove("combo-grow");
          }, 500);
        }, 300);
      }, delay);
    }
  }
}

function spawnComboParticles(cell) {
  const rect = cell.getBoundingClientRect();
  const containerRect = document
    .querySelector(".reels-container")
    .getBoundingClientRect();
  const cx = rect.left - containerRect.left + rect.width / 2;
  const cy = rect.top - containerRect.top + rect.height / 2;

  for (let i = 0; i < 12; i++) {
    const particle = document.createElement("div");
    particle.className = "combo-particle";
    const angle = (Math.PI * 2 * i) / 12;
    const dist = 40 + Math.random() * 30;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    particle.style.left = cx + "px";
    particle.style.top = cy + "px";
    particle.style.setProperty("--tx", tx + "px");
    particle.style.setProperty("--ty", ty + "px");
    const hue = Math.floor(Math.random() * 60) + 30; // gold-ish
    particle.style.background = `hsl(${hue}, 100%, 60%)`;
    document.querySelector(".reels-container").appendChild(particle);

    setTimeout(() => particle.remove(), 700);
  }
}

function drawPaylines(winningLines) {
  clearCanvas();
  const reelWidth = canvas.width / NUM_REELS;

  for (const wl of winningLines) {
    const line = PAYLINES[wl.paylineIndex];
    const color = PAYLINE_COLORS[wl.paylineIndex % PAYLINE_COLORS.length];

    // Draw full payline across all 5 reels (so V-shapes etc. are visible)
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (let r = 0; r < NUM_REELS; r++) {
      const x = reelWidth * r + reelWidth / 2;
      const y = line[r] * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2;
      if (r === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw bright portion for matched reels
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    for (let r = 0; r < wl.count; r++) {
      const x = reelWidth * r + reelWidth / 2;
      const y = line[r] * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2;
      if (r === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw filled dots at matched positions, hollow dots at unmatched
    ctx.fillStyle = color;
    for (let r = 0; r < NUM_REELS; r++) {
      const x = reelWidth * r + reelWidth / 2;
      const y = line[r] * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      if (r < wl.count) {
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.35;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    }

    ctx.shadowBlur = 0;
  }
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function showWinMessage(msg) {
  winMsg.textContent = msg;
  winMsg.classList.remove("hidden");
}

// ---- PAYLINE BROWSER ----

let previewIndex = -1; // -1 = no preview shown
let previewTimeout = null;

function drawSinglePayline(plIndex) {
  clearCanvas();
  const reelWidth = canvas.width / NUM_REELS;
  const line = PAYLINES[plIndex];
  const color = PAYLINE_COLORS[plIndex % PAYLINE_COLORS.length];

  // Draw line
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  for (let r = 0; r < NUM_REELS; r++) {
    const x = reelWidth * r + reelWidth / 2;
    const y = line[r] * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2;
    if (r === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw dots
  ctx.fillStyle = color;
  for (let r = 0; r < NUM_REELS; r++) {
    const x = reelWidth * r + reelWidth / 2;
    const y = line[r] * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Highlight cells on the strip
  clearHighlights();
  for (let r = 0; r < NUM_REELS; r++) {
    const row = line[r];
    const strip = document.getElementById(`strip-${r}`);
    const cell = strip.children[EXTRA_SYMBOLS + row];
    if (cell) cell.classList.add("win-highlight");
  }
}

function setupPaylineBrowser() {
  const prevBtn = document.getElementById("pl-prev");
  const nextBtn = document.getElementById("pl-next");
  const label = document.getElementById("pl-label");

  function showPayline(dir) {
    if (spinning) return;
    previewIndex += dir;
    if (previewIndex >= PAYLINES.length) previewIndex = 0;
    if (previewIndex < 0) previewIndex = PAYLINES.length - 1;

    drawSinglePayline(previewIndex);
    label.textContent = `Лінія ${previewIndex + 1} / ${PAYLINES.length}`;

    // Auto-hide after 3s of inactivity
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
      clearCanvas();
      clearHighlights();
      label.textContent = "Лінії";
      previewIndex = -1;
    }, 3000);
  }

  prevBtn.addEventListener("click", () => showPayline(-1));
  nextBtn.addEventListener("click", () => showPayline(1));
}

// ---- HELPER POST-EFFECTS ----

function collectWinCells(wins) {
  const cellMap = {};
  for (const wl of wins) {
    const line = PAYLINES[wl.paylineIndex];
    for (let r = 0; r < wl.count; r++) {
      const key = `${r}_${line[r]}`;
      if (!cellMap[key]) cellMap[key] = { reel: r, row: line[r] };
    }
  }
  return Object.values(cellMap);
}

function processHelperPostEffects(winningLines, onComplete) {
  if (!winningLines || winningLines.length === 0) {
    onComplete();
    return;
  }

  const h2wins = winningLines.filter(w => w.isHelper && w.helperNum === 2);
  const h4wins = winningLines.filter(w => w.isHelper && w.helperNum === 4);

  if (h2wins.length === 0 && h4wins.length === 0) {
    onComplete();
    return;
  }

  // Delay to let the player see the win first
  setTimeout(() => {
    processHelper2(h2wins, () => {
      processHelper4(h4wins, onComplete);
    });
  }, 2000);
}

function processHelper2(h2wins, onComplete) {
  if (h2wins.length === 0) { onComplete(); return; }

  const cells = collectWinCells(h2wins);
  stopWinCycle();
  clearHighlights();
  clearCanvas();
  showWinMessage("😈 КУЧМА ЗЛІШАЄ!");
  const rozbAudio = new Audio('sound/вийди розбійник.mp3');
  rozbAudio.volume = 0.6;
  rozbAudio.play().catch(() => {});

  // Wait for audio to play a bit before starting transformations
  setTimeout(() => {
    let completed = 0;
    for (let i = 0; i < cells.length; i++) {
      const { reel, row } = cells[i];
      const strip = document.getElementById(`strip-${reel}`);
      const cell = strip.children[EXTRA_SYMBOLS + row];
      if (!cell) {
        completed++;
        if (completed === cells.length) afterHelper2Transform();
        continue;
      }

    setTimeout(() => {
      // Shake
      cell.classList.add("angry-shake");
      spawnAngryParticles(cell);

      setTimeout(() => {
        // Shrink
        cell.classList.remove("angry-shake");
        cell.classList.add("combo-shrink");

        setTimeout(() => {
          // Swap to angry
          const img = cell.querySelector("img");
          if (img) {
            img.src = SYMBOLS[ANGRY_INDEX].file;
            img.alt = SYMBOLS[ANGRY_INDEX].name;
          }
          cell.dataset.symbolIndex = ANGRY_INDEX;
          reelResults[reel][row] = ANGRY_INDEX;

          // Grow back
          cell.classList.remove("combo-shrink");
          cell.classList.add("combo-grow");
          spawnAngryParticles(cell);

          setTimeout(() => {
            cell.classList.remove("combo-grow");
            completed++;
            if (completed === cells.length) afterHelper2Transform();
          }, 500);
        }, 300);
      }, 500);
    }, i * 300);
    }
  }, 1500);

  function afterHelper2Transform() {
    // Re-evaluate the grid after angry replacement
    setTimeout(() => {
      const result = evaluateWinSilent();
      const net = result.totalWin - result.totalLoss;
      if (net !== 0) {
        balance += net;
        balanceEl.textContent = balance;
        winEl.textContent = net >= 0 ? net : 0;
        startWinCycle(result.winningLines);
        const comboWins = result.winningLines.filter(w => w.isCombo);
        if (comboWins.length > 0) animateComboTransform(comboWins);
        if (result.totalLoss > 0 && result.totalWin > 0) {
          showWinMessage(`😡 ЗЛИЙ КУЧМА КРАДЕ ${result.totalLoss}! 🎉 ВИГРАШ ${result.totalWin}!`);
          sndWin();
        } else if (result.totalLoss > 0) {
          showWinMessage(`😡 ЗЛИЙ КУЧМА КРАДЕ ${result.totalLoss}!`);
          sndAngry();
        } else {
          showWinMessage(`🎉 ВИГРАШ ${result.totalWin}!`);
          sndWin();
        }
      }
      setTimeout(onComplete, 1500);
    }, 600);
  }
}

function processHelper4(h4wins, onComplete) {
  if (h4wins.length === 0) { onComplete(); return; }

  const cells = collectWinCells(h4wins);
  stopWinCycle();
  clearHighlights();
  clearCanvas();
  showWinMessage("🏃 ЯНУКОВИЧ ТІКАЄ!");
  new Audio('sound/astanavites.mp3').play().catch(() => {});

  let completed = 0;
  for (let i = 0; i < cells.length; i++) {
    const { reel, row } = cells[i];
    const strip = document.getElementById(`strip-${reel}`);
    const cell = strip.children[EXTRA_SYMBOLS + row];
    if (!cell) {
      completed++;
      if (completed === cells.length) afterHelper4Transform();
      continue;
    }

    setTimeout(() => {
      // Shrink with spin
      cell.classList.add("combo-shrink");

      setTimeout(() => {
        // Swap to random symbol
        const newSymIdx = randomSymbol();
        const img = cell.querySelector("img");
        if (img) {
          img.src = SYMBOLS[newSymIdx].file;
          img.alt = SYMBOLS[newSymIdx].name;
        }
        cell.dataset.symbolIndex = newSymIdx;
        reelResults[reel][row] = newSymIdx;

        // Grow back
        cell.classList.remove("combo-shrink");
        cell.classList.add("combo-grow");
        spawnComboParticles(cell);

        setTimeout(() => {
          cell.classList.remove("combo-grow");
          completed++;
          if (completed === cells.length) afterHelper4Transform();
        }, 500);
      }, 300);
    }, i * 250);
  }

  function afterHelper4Transform() {
    // Re-evaluate the grid after random replacement
    setTimeout(() => {
      const result = evaluateWinSilent();
      const net = result.totalWin - result.totalLoss;
      if (net !== 0) {
        balance += net;
        balanceEl.textContent = balance;
        winEl.textContent = net >= 0 ? net : 0;
        startWinCycle(result.winningLines);
        const comboWins = result.winningLines.filter(w => w.isCombo);
        if (comboWins.length > 0) animateComboTransform(comboWins);
        if (result.totalLoss > 0 && result.totalWin > 0) {
          showWinMessage(`😡 ЗЛИЙ КУЧМА КРАДЕ ${result.totalLoss}! 🎉 ВИГРАШ ${result.totalWin}!`);
          sndWin();
        } else if (result.totalLoss > 0) {
          showWinMessage(`😡 ЗЛИЙ КУЧМА КРАДЕ ${result.totalLoss}!`);
          sndAngry();
        } else {
          showWinMessage(`🎉 ВИГРАШ ${result.totalWin}!`);
          sndWin();
        }
      }
      setTimeout(onComplete, 1500);
    }, 600);
  }
}

// ---- START ----
init();
setupPaylineBrowser();
