/**
 * 🥚 EASTER EGG — Tap-to-Earn Clicker Game
 *
 * Triggered by tapping the Ireland flag in the menu 10 times.
 * Features:
 *   - 5 vehicle levels (scooter → tufla → pea → banani → pupi)
 *   - Tap-to-earn mechanic with particle animations
 *   - Upgrade shop (tap power, auto-tap, multiplier)
 *   - Slot machine gambling mini-game with 3 prize tiers
 *
 * TO REMOVE: Delete this file, clicker.css, and the assets/clicker/ folder.
 *            Remove the import + route('clicker', ...) from main.js.
 *            Remove the easter egg listener from menu.js.
 */

import { navigate } from '../router.js';
import '../styles/clicker.css';

// ─── Assets (Vite handles these imports) ─────────────────
import level1Img from '../assets/clicker/level1.png';
import level2Img from '../assets/clicker/level2.png';
import level3Img from '../assets/clicker/level3.png';
import level4Img from '../assets/clicker/level4.png';
import level5Img from '../assets/clicker/level5.png';
import slotPrize1 from '../assets/clicker/slot_prize1.png';
import slotPrize2 from '../assets/clicker/slot_prize2.png';
import slotPrize3 from '../assets/clicker/slot_prize3.png';

// ─── Game Config ─────────────────────────────────────────
const LEVELS = [
  { name: 'Scooter',   img: level1Img, cost: 0,     coinsPerTap: 1  },
  { name: 'Tufla',     img: level2Img, cost: 500,   coinsPerTap: 3  },
  { name: 'Pea',       img: level3Img, cost: 2000,  coinsPerTap: 8  },
  { name: 'Banani',    img: level4Img, cost: 8000,  coinsPerTap: 20 },
  { name: 'Pupi',      img: level5Img, cost: 30000, coinsPerTap: 50 },
];

const SLOT_SYMBOLS = [
  { img: slotPrize1, name: 'Rusty',    weight: 45 },
  { img: slotPrize2, name: 'Botinoks', weight: 35 },
  { img: slotPrize3, name: 'Lada',     weight: 20 },
];

const SLOT_PRIZES = {
  'Rusty':    { multiplier: 2,  label: '🏆 x2 Prize!' },
  'Botinoks': { multiplier: 5,  label: '🏆 x5 Prize!' },
  'Lada':     { multiplier: 15, label: '🏆🏆🏆 JACKPOT! x15' },
};

const UPGRADES = [
  { id: 'tapPower',   name: '💪 Tap Power',   desc: '+1 per tap',   baseCost: 50,  costMult: 1.8, effect: 1 },
  { id: 'autoTap',    name: '🤖 Auto Tap',    desc: '+1/sec auto',  baseCost: 200, costMult: 2.2, effect: 1 },
  { id: 'multiplier', name: '✨ Multiplier',   desc: 'x1.5 all',    baseCost: 500, costMult: 2.5, effect: 0.5 },
];

const SAVE_KEY = 'dt_clicker_save';
const SLOT_COST_BASE = 50;

// ─── State ───────────────────────────────────────────────
let game = null;
let autoInterval = null;
let animFrame = null;

function defaultGame() {
  return {
    coins: 0,
    totalCoins: 0,
    level: 0,
    upgrades: { tapPower: 0, autoTap: 0, multiplier: 0 },
  };
}

function loadGame() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (s) return { ...defaultGame(), ...JSON.parse(s) };
  } catch (e) { /* ignore */ }
  return defaultGame();
}

function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch (e) { /* */ }
}

// ─── Computed Values ─────────────────────────────────────
function tapValue() {
  const base = LEVELS[game.level].coinsPerTap;
  const power = game.upgrades.tapPower;
  const mult = 1 + game.upgrades.multiplier * 0.5;
  return Math.floor((base + power) * mult);
}

function autoRate() {
  const mult = 1 + game.upgrades.multiplier * 0.5;
  return Math.floor(game.upgrades.autoTap * mult);
}

function upgradeCost(id) {
  const u = UPGRADES.find(u => u.id === id);
  return Math.floor(u.baseCost * Math.pow(u.costMult, game.upgrades[id]));
}

function slotCost() {
  const totalUpgrades = game.upgrades.tapPower + game.upgrades.autoTap + game.upgrades.multiplier;
  return Math.floor(SLOT_COST_BASE * (1 + game.level * 1.5 + totalUpgrades * 0.3));
}

function nextLevelCost() {
  if (game.level >= LEVELS.length - 1) return Infinity;
  return LEVELS[game.level + 1].cost;
}

// ─── Slot Machine Logic ─────────────────────────────────
function weightedRandom() {
  const total = SLOT_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
  let r = Math.random() * total;
  for (const sym of SLOT_SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return SLOT_SYMBOLS[0];
}

// ─── Render ──────────────────────────────────────────────
export async function clickerPage(app) {
  game = loadGame();

  const lv = LEVELS[game.level];

  app.innerHTML = `
    <div class="clicker-page fade-in">
      <!-- Header -->
      <div class="clicker-header">
        <button class="btn-back clicker-back" id="clicker-back">←</button>
        <div class="clicker-title">
          <span class="clicker-level-badge">Lvl ${game.level + 1}</span>
          
        </div>
        <div class="clicker-coin-display" id="coin-display">
          <span class="coin-icon">🪙</span>
          <span class="coin-amount" id="coin-amount">${game.coins}</span>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="clicker-stats">
        <div class="clicker-stat">
          <span class="stat-label">Per Tap</span>
          <span class="stat-value" id="stat-tap">${tapValue()}</span>
        </div>
        <div class="clicker-stat">
          <span class="stat-label">Auto/sec</span>
          <span class="stat-value" id="stat-auto">${autoRate()}</span>
        </div>
        <div class="clicker-stat">
          <span class="stat-label">Total</span>
          <span class="stat-value" id="stat-total">${game.totalCoins}</span>
        </div>
      </div>

      <!-- Vehicle Tap Area -->
      <div class="clicker-tap-area" id="tap-area">
        <div class="clicker-vehicle-container">
          <img src="${lv.img}" alt="${lv.name}" class="clicker-vehicle" id="vehicle-img" draggable="false" />
        </div>
        <div class="tap-particles" id="tap-particles"></div>
      </div>



      <!-- Tab Buttons -->
      <div class="clicker-tabs">
        <button class="clicker-tab active" data-tab="upgrades" id="tab-upgrades">🛒 Shop</button>
        <button class="clicker-tab" data-tab="slots" id="tab-slots">🎰 Slots</button>
      </div>

      <!-- Upgrades Panel -->
      <div class="clicker-panel" id="panel-upgrades">
        ${renderUpgrades()}
        ${game.level < LEVELS.length - 1 ? `
          <button class="clicker-upgrade-btn level-up-btn ${game.coins >= nextLevelCost() ? 'can-afford' : ''}" id="btn-level-up">
            <div class="upgrade-info">
              <div class="upgrade-name">🚗 Upgrade Vehicle</div>
              <div class="upgrade-desc">Unlock next vehicle</div>
            </div>
            <div class="upgrade-cost">🪙 ${nextLevelCost()}</div>
          </button>
        ` : ''}
      </div>

      <!-- Slot Machine Panel -->
      <div class="clicker-panel hidden" id="panel-slots">
        <div class="slot-machine">
          <div class="slot-header">
            <span class="slot-title">🎰 Lucky Slots</span>
            <span class="slot-cost">Cost: 🪙 ${slotCost()}</span>
          </div>
          <div class="slot-reels" id="slot-reels">
            <div class="slot-reel" id="reel-0">
              <img src="${SLOT_SYMBOLS[0].img}" alt="?" class="slot-img" />
            </div>
            <div class="slot-reel" id="reel-1">
              <img src="${SLOT_SYMBOLS[1].img}" alt="?" class="slot-img" />
            </div>
            <div class="slot-reel" id="reel-2">
              <img src="${SLOT_SYMBOLS[2].img}" alt="?" class="slot-img" />
            </div>
          </div>
          <div class="slot-result" id="slot-result"></div>
          <button class="btn btn-primary slot-spin-btn" id="btn-spin">🎰 SPIN</button>
        </div>
        <div class="slot-prizes-info">
          <div class="slot-prize-row">
            <img src="${slotPrize1}" class="slot-prize-thumb" /> <span>3x match = x2 bet</span>
          </div>
          <div class="slot-prize-row">
            <img src="${slotPrize2}" class="slot-prize-thumb" /> <span>3x match = x5 bet</span>
          </div>
          <div class="slot-prize-row">
            <img src="${slotPrize3}" class="slot-prize-thumb" /> <span>3x match = x15 bet 🔥</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // ─── Event Bindings ──────────────────────────────────
  const tapArea = app.querySelector('#tap-area');
  const vehicleImg = app.querySelector('#vehicle-img');
  const particlesEl = app.querySelector('#tap-particles');

  // Back
  app.querySelector('#clicker-back').onclick = () => navigate('menu');

  // Tab switching
  app.querySelectorAll('.clicker-tab').forEach(tab => {
    tab.onclick = () => {
      app.querySelectorAll('.clicker-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.dataset.tab;
      app.querySelector('#panel-upgrades').classList.toggle('hidden', id !== 'upgrades');
      app.querySelector('#panel-slots').classList.toggle('hidden', id !== 'slots');
    };
  });

  // Tap to earn
  tapArea.addEventListener('click', (e) => {
    const val = tapValue();
    game.coins += val;
    game.totalCoins += val;
    window._haptic?.('impact');
    spawnParticle(particlesEl, e, val);
    vehicleImg.classList.add('tap-bounce');
    setTimeout(() => vehicleImg.classList.remove('tap-bounce'), 150);
    updateUI(app);
    saveGame();
  });

  // Prevent double-tap zoom on mobile
  tapArea.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const clickEvt = new MouseEvent('click', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true,
    });
    tapArea.dispatchEvent(clickEvt);
  });

  // Upgrades
  app.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.upgrade;
      const cost = upgradeCost(id);
      if (game.coins >= cost) {
        game.coins -= cost;
        game.upgrades[id]++;
        window._haptic?.('success');
        saveGame();
        refreshUpgradesPanel(app);
        updateUI(app);
      } else {
        window._haptic?.('error');
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 400);
      }
    };
  });

  // Level up
  const levelUpBtn = app.querySelector('#btn-level-up');
  if (levelUpBtn) {
    levelUpBtn.onclick = () => {
      const cost = nextLevelCost();
      if (game.coins >= cost && game.level < LEVELS.length - 1) {
        game.coins -= cost;
        game.level++;
        window._haptic?.('success');
        saveGame();
        // Re-render whole page for new vehicle
        clickerPage(app);
      } else {
        window._haptic?.('error');
        levelUpBtn.classList.add('shake');
        setTimeout(() => levelUpBtn.classList.remove('shake'), 400);
      }
    };
  }

  // Slot machine
  let spinning = false;
  const spinBtn = app.querySelector('#btn-spin');
  if (spinBtn) {
    spinBtn.onclick = () => {
      if (spinning) return;
      const cost = slotCost();
      if (game.coins < cost) {
        window._haptic?.('error');
        spinBtn.classList.add('shake');
        setTimeout(() => spinBtn.classList.remove('shake'), 400);
        app.querySelector('#slot-result').textContent = '❌ Not enough coins!';
        return;
      }
      game.coins -= cost;
      spinning = true;
      spinBtn.disabled = true;
      window._haptic?.('impact');
      updateUI(app);
      saveGame();

      // Generate results
      const results = [weightedRandom(), weightedRandom(), weightedRandom()];

      // Animate reels
      const reels = [0, 1, 2].map(i => app.querySelector(`#reel-${i}`));
      reels.forEach((reel, i) => {
        reel.classList.add('spinning');
        setTimeout(() => {
          reel.classList.remove('spinning');
          reel.querySelector('.slot-img').src = results[i].img;
          reel.classList.add('slot-land');
          setTimeout(() => reel.classList.remove('slot-land'), 300);
          window._haptic?.('impact');
        }, 600 + i * 400);
      });

      // Check result after all reels stop
      setTimeout(() => {
        const resultEl = app.querySelector('#slot-result');
        if (results[0].name === results[1].name && results[1].name === results[2].name) {
          // JACKPOT!
          const prize = SLOT_PRIZES[results[0].name];
          const winAmount = cost * prize.multiplier;
          game.coins += winAmount;
          game.totalCoins += winAmount;
          resultEl.innerHTML = `<span class="slot-win">${prize.label}<br/>+🪙 ${winAmount}</span>`;
          resultEl.classList.add('jackpot-flash');
          setTimeout(() => resultEl.classList.remove('jackpot-flash'), 2000);
          window._haptic?.('success');
        } else {
          resultEl.textContent = '😂 Ha-ha, casino wins!';
        }
        spinning = false;
        spinBtn.disabled = false;
        updateUI(app);
        saveGame();
      }, 600 + 3 * 400 + 200);
    };
  }

  // Auto tap interval
  startAutoTap(app);

  // Cleanup
  return () => {
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null; }
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  };
}

// ─── Helpers ─────────────────────────────────────────────
function updateUI(app) {
  const coinEl = app.querySelector('#coin-amount');
  if (coinEl) coinEl.textContent = formatNum(game.coins);

  const statTap = app.querySelector('#stat-tap');
  if (statTap) statTap.textContent = tapValue();

  const statAuto = app.querySelector('#stat-auto');
  if (statAuto) statAuto.textContent = autoRate();

  const statTotal = app.querySelector('#stat-total');
  if (statTotal) statTotal.textContent = formatNum(game.totalCoins);



  // Update upgrade affordability
  app.querySelectorAll('.upgrade-btn').forEach(btn => {
    const id = btn.dataset.upgrade;
    const cost = upgradeCost(id);
    btn.classList.toggle('can-afford', game.coins >= cost);
    const costEl = btn.querySelector('.upgrade-cost');
    if (costEl) costEl.textContent = '🪙 ' + formatNum(cost);
    const lvlEl = btn.querySelector('.upgrade-level');
    if (lvlEl) lvlEl.textContent = 'Lv.' + game.upgrades[id];
  });

  // Level up button
  const levelUpBtn = app.querySelector('#btn-level-up');
  if (levelUpBtn) {
    levelUpBtn.classList.toggle('can-afford', game.coins >= nextLevelCost());
  }
}

function renderUpgrades() {
  return UPGRADES.map(u => `
    <button class="clicker-upgrade-btn upgrade-btn ${game.coins >= upgradeCost(u.id) ? 'can-afford' : ''}" data-upgrade="${u.id}">
      <div class="upgrade-info">
        <div class="upgrade-name">${u.name} <span class="upgrade-level">Lv.${game.upgrades[u.id]}</span></div>
        <div class="upgrade-desc">${u.desc}</div>
      </div>
      <div class="upgrade-cost">🪙 ${formatNum(upgradeCost(u.id))}</div>
    </button>
  `).join('');
}

function refreshUpgradesPanel(app) {
  const panel = app.querySelector('#panel-upgrades');
  if (!panel) return;
  // Re-render upgrades only (keep level-up button)
  const levelUpHtml = game.level < LEVELS.length - 1 ? `
    <button class="clicker-upgrade-btn level-up-btn ${game.coins >= nextLevelCost() ? 'can-afford' : ''}" id="btn-level-up">
      <div class="upgrade-info">
        <div class="upgrade-name">🚗 Upgrade Vehicle</div>
        <div class="upgrade-desc">Unlock next vehicle</div>
      </div>
      <div class="upgrade-cost">🪙 ${nextLevelCost()}</div>
    </button>
  ` : '';
  panel.innerHTML = renderUpgrades() + levelUpHtml;

  // Re-bind upgrade buttons
  panel.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.upgrade;
      const cost = upgradeCost(id);
      if (game.coins >= cost) {
        game.coins -= cost;
        game.upgrades[id]++;
        window._haptic?.('success');
        saveGame();
        refreshUpgradesPanel(app);
        updateUI(app);
        // Restart auto tap in case autoTap upgraded
        startAutoTap(app);
      } else {
        window._haptic?.('error');
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 400);
      }
    };
  });

  // Re-bind level up
  const levelUpBtn = panel.querySelector('#btn-level-up');
  if (levelUpBtn) {
    levelUpBtn.onclick = () => {
      const cost = nextLevelCost();
      if (game.coins >= cost && game.level < LEVELS.length - 1) {
        game.coins -= cost;
        game.level++;
        window._haptic?.('success');
        saveGame();
        clickerPage(app);
      } else {
        window._haptic?.('error');
        levelUpBtn.classList.add('shake');
        setTimeout(() => levelUpBtn.classList.remove('shake'), 400);
      }
    };
  }
}

function startAutoTap(app) {
  if (autoInterval) clearInterval(autoInterval);
  const rate = autoRate();
  if (rate > 0) {
    autoInterval = setInterval(() => {
      game.coins += rate;
      game.totalCoins += rate;
      updateUI(app);
      saveGame();
    }, 1000);
  }
}

function spawnParticle(container, event, value) {
  const particle = document.createElement('div');
  particle.className = 'tap-particle';
  particle.textContent = `+${value}`;

  // Position near click
  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  particle.style.left = x + 'px';
  particle.style.top = y + 'px';
  particle.style.setProperty('--drift', (Math.random() - 0.5) * 60 + 'px');

  container.appendChild(particle);
  setTimeout(() => particle.remove(), 800);
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}
