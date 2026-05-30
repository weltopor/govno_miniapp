/* ═══════════════════════════════════════════
   GOVNO ne TONet — game.js  v2.1
   Логика экрана игры
═══════════════════════════════════════════ */

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#1a1408'); tg.setBackgroundColor('#1a1408'); }

// ── КОНФИГУРАЦИЯ ИГРЫ ──
const GAME = {
  id:      1107,
  nominal: 1,
  players: 10,
  myIndex: 3,
};

const PLAYERS = ['@igor','@anna','@max','@you','@kate','@dima','@alex','@mia','@oleg','@lena'];

const TOTAL_BALLS = GAME.players * 2;
const WIN_BALLS   = GAME.players + 1;
const PRIZE_POOL  = (GAME.players * GAME.nominal * 0.975).toFixed(2);

function genWinners(total, wins) {
  const s = new Set();
  while (s.size < wins) s.add(Math.floor(Math.random() * total) + 1);
  return s;
}
const WINNERS = genWinners(TOTAL_BALLS, WIN_BALLS);

// ── СОСТОЯНИЕ ──
let state = {
  opened:   {},
  curTurn:  0,
  attempt:  1,
  order:    [],
  order2:   [],
  chosen:   null,
  myTurn:   false,
  finished: false,
  timer:    30,
  timerRef: null,
  animating: false,   // ← флаг: идёт анимация смыва
};

// ── СЕТКА ──
function getGridCols(p) {
  if (p <= 5)  return 2;
  if (p <= 7)  return 3;
  if (p <= 12) return 4;
  return 5;
}
function getEmojiSize(p) {
  if (p <= 4)  return '30px';
  if (p <= 7)  return '24px';
  if (p <= 10) return '20px';
  if (p <= 13) return '16px';
  return '14px';
}
function getNumSize(p) {
  if (p <= 7)  return '10px';
  if (p <= 12) return '9px';
  return '8px';
}

function buildGrid() {
  const grid = document.getElementById('toiletGrid');
  grid.style.gridTemplateColumns = `repeat(${getGridCols(GAME.players)}, 1fr)`;
  grid.innerHTML = '';
  for (let i = 1; i <= TOTAL_BALLS; i++) {
    const cell = document.createElement('div');
    cell.className = 't-cell';
    cell.id = `cell-${i}`;
    cell.innerHTML = `
      <span class="t-emoji" style="font-size:${getEmojiSize(GAME.players)}">🚽</span>
      <span class="t-num"   style="font-size:${getNumSize(GAME.players)}">№${i}</span>`;
    cell.addEventListener('click', () => selectCell(i));
    grid.appendChild(cell);
  }
}

// ── ОЧЕРЕДЬ ──
function buildQueue() {
  state.order  = [...Array(GAME.players).keys()];
  state.order2 = [...state.order].reverse();
  renderQueue();
}

function renderQueue() {
  const list  = document.getElementById('queueList');
  const order = state.attempt === 1 ? state.order : state.order2;
  list.innerHTML = order.map((pIdx, i) => {
    let cls = 'q-item';
    if (i < state.curTurn)  cls += ' done';
    if (i === state.curTurn) cls += ' active';
    return `<span class="${cls}">${PLAYERS[pIdx]}</span>`;
  }).join('');
}

// ── ХОД ──
function updateTurnUI() {
  if (state.animating) return; // не обновляем пока идёт анимация
  const order  = state.attempt === 1 ? state.order : state.order2;
  const pIdx   = order[state.curTurn];
  const myTurn = pIdx === GAME.myIndex;
  state.myTurn = myTurn;

  document.getElementById('curPlayer').textContent  = PLAYERS[pIdx];
  document.getElementById('curAttempt').textContent = `Попытка ${state.attempt}/2`;

  document.querySelectorAll('.t-cell').forEach(cell => {
    if (cell.classList.contains('won') || cell.classList.contains('lost')) return;
    cell.classList.toggle('dim', !myTurn);
    if (myTurn) cell.classList.remove('mine');
  });

  const iz   = document.getElementById('inputZone');
  const wait = document.getElementById('waitOverlay');

  if (myTurn) {
    iz.classList.remove('blocked');
    wait.classList.add('hidden');
    startTimer();
    showQuickBtns();
  } else {
    iz.classList.add('blocked');
    wait.classList.remove('hidden');
    document.getElementById('woPlayer').textContent = PLAYERS[pIdx];
    stopTimer();
    const delay = 1800 + Math.random() * 2200;
    setTimeout(() => {
      if (!state.myTurn && !state.finished && !state.animating) botMove();
    }, delay);
  }

  renderQueue();
}

// ── ВЫБОР ЯЧЕЙКИ ──
function selectCell(num) {
  if (!state.myTurn || state.animating) return;
  const cell = document.getElementById(`cell-${num}`);
  if (!cell || cell.classList.contains('won') || cell.classList.contains('lost')) return;

  if (state.chosen) document.getElementById(`cell-${state.chosen}`)?.classList.remove('chosen');

  state.chosen = num;
  cell.classList.add('chosen');

  const inp = document.getElementById('toiletInput');
  inp.value = num;
  inp.classList.add('has-val');
  document.getElementById('flushBtn').disabled = false;

  if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

function onInputChange(val) {
  const num = parseInt(val);
  if (!num || num < 1 || num > TOTAL_BALLS) { clearChosen(); return; }
  selectCell(num);
}

function changeInput(delta) {
  selectCell(Math.max(1, Math.min(TOTAL_BALLS, (state.chosen || 0) + delta)));
}

function clearChosen() {
  if (state.chosen) document.getElementById(`cell-${state.chosen}`)?.classList.remove('chosen');
  state.chosen = null;
  document.getElementById('flushBtn').disabled = true;
  document.getElementById('toiletInput').classList.remove('has-val');
}

function showQuickBtns() {
  const avail = [];
  for (let i = 1; i <= TOTAL_BALLS; i++) if (!state.opened[i]) avail.push(i);
  const picks = avail.sort(() => Math.random() - .5).slice(0, 3);
  document.getElementById('quickBtns').innerHTML =
    picks.map(n => `<span class="qb-item" onclick="selectCell(${n})">№${n}</span>`).join('') +
    `<span class="qb-item" onclick="pickRandom()">🎲 Случайный</span>`;
}

function pickRandom() {
  const avail = [];
  for (let i = 1; i <= TOTAL_BALLS; i++) if (!state.opened[i]) avail.push(i);
  if (avail.length) selectCell(avail[Math.floor(Math.random() * avail.length)]);
}

// ── СМЫТЬ ──
function doFlush() {
  if (!state.myTurn || !state.chosen || state.animating) return;
  stopTimer();
  openBall(state.chosen, true);
}

function botMove() {
  const avail = [];
  for (let i = 1; i <= TOTAL_BALLS; i++) if (!state.opened[i]) avail.push(i);
  if (!avail.length) return;
  openBall(avail[Math.floor(Math.random() * avail.length)], false);
}

function openBall(num, isMe) {
  const isWin = WINNERS.has(num);
  state.opened[num] = isWin ? 'won' : 'lost';

  if (isMe) {
    state.animating = true;
    showFlushAnim(num, isWin, () => {
      state.animating = false;
      applyOpenedCell(num, isWin);
      clearChosen();
      document.getElementById('toiletInput').value = '';
      nextTurn();
    });
  } else {
    applyOpenedCell(num, isWin);
    nextTurn();
  }
}

function applyOpenedCell(num, isWin) {
  const cell = document.getElementById(`cell-${num}`);
  if (!cell) return;
  cell.querySelector('.t-emoji').textContent = isWin ? '💩' : '🪰';
  cell.classList.remove('mine','chosen','dim');
  cell.classList.add(isWin ? 'won' : 'lost');
}

// ── АНИМАЦИЯ СМЫВА — ПОЛНЫЙ СБРОС ──
function showFlushAnim(num, isWin, cb) {
  const anim   = document.getElementById('flushAnim');
  const inner  = anim.querySelector('.fa-inner');
  const toilet = document.getElementById('faToilet');
  const swirl  = document.getElementById('faSwirl');
  const result = document.getElementById('faResult');

  // 1. Полностью чистим предыдущее состояние ДО показа
  inner.querySelectorAll('.fa-caption,.fa-prize').forEach(e => e.remove());
  toilet.textContent      = '🚽';
  toilet.style.animation  = 'toiletShake .15s ease-in-out infinite';
  swirl.style.display     = 'none';
  swirl.style.animation   = 'swirlSpin .6s linear infinite';
  result.classList.add('hidden');
  result.textContent      = '';

  // 2. Показываем оверлей
  anim.classList.remove('hidden');

  // 3. Фаза: крутилка через 400мс
  const t1 = setTimeout(() => {
    swirl.style.display = 'block';
  }, 400);

  // 4. Фаза: результат через 1000мс
  const t2 = setTimeout(() => {
    swirl.style.display   = 'none';
    toilet.textContent    = isWin ? '💩' : '🪰';
    toilet.style.animation = 'none';

    const cap = document.createElement('div');
    cap.className   = `fa-caption ${isWin ? 'win' : 'lose'}`;
    cap.textContent = isWin ? '💰 Выигрыш!' : '🪰 Пусто...';
    inner.appendChild(cap);

    if (isWin) {
      const openedWins = Object.values(state.opened).filter(v => v === 'won').length;
      const pct   = getPrizePercent(GAME.players, openedWins);
      const prize = (parseFloat(PRIZE_POOL) * pct / 100).toFixed(3);
      const pEl   = document.createElement('div');
      pEl.className   = 'fa-prize';
      pEl.textContent = `+${prize} GOVNO`;
      inner.appendChild(pEl);
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else {
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
    }
  }, 1000);

  // 5. Закрываем через 2600мс — достаточно чтобы прочитать результат
  const t3 = setTimeout(() => {
    // Чистим ВСЁ перед скрытием
    inner.querySelectorAll('.fa-caption,.fa-prize').forEach(e => e.remove());
    result.classList.add('hidden');
    toilet.textContent = '🚽';
    anim.classList.add('hidden');
    cb(); // только теперь переходим к следующему ходу
  }, 2600);
}

function getPrizePercent(players, winIdx) {
  const table = {
    2:  [61.5, 23.1, 15.4],
    5:  [30.8, 16.6, 15.2, 14.9, 12.4, 10.3],
    10: [20.5, 8.5, 8.2, 7.2, 6.1, 5.1, 5.1, 5.1, 5.1, 5.1, 5.1],
  };
  const closest = [2, 5, 10].reduce((a, b) =>
    Math.abs(b - players) < Math.abs(a - players) ? b : a);
  const arr = table[closest];
  return arr[Math.min(winIdx - 1, arr.length - 1)] || 5.1;
}

// ── СЛЕДУЮЩИЙ ХОД ──
function nextTurn() {
  state.curTurn++;

  if (state.curTurn >= GAME.players) {
    if (state.attempt === 1) {
      state.attempt  = 2;
      state.curTurn  = 0;
      state.myTurn   = false;
      // Показываем плашку «Начинается попытка 2»
      showAttemptBanner(2, () => updateTurnUI());
    } else {
      setTimeout(showResults, 600);
    }
    return;
  }

  setTimeout(updateTurnUI, 300);
}

// ── БАННЕР СМЕНЫ ПОПЫТКИ ──
function showAttemptBanner(attempt, cb) {
  const anim   = document.getElementById('flushAnim');
  const inner  = anim.querySelector('.fa-inner');
  const toilet = document.getElementById('faToilet');
  const swirl  = document.getElementById('faSwirl');
  const result = document.getElementById('faResult');

  inner.querySelectorAll('.fa-caption,.fa-prize').forEach(e => e.remove());
  swirl.style.display = 'none';
  result.classList.add('hidden');
  toilet.style.animation = 'none';
  toilet.textContent = '⚙️';

  const cap = document.createElement('div');
  cap.className   = 'fa-caption win';
  cap.textContent = `Попытка ${attempt} из 2`;
  inner.appendChild(cap);

  const sub = document.createElement('div');
  sub.className   = 'fa-caption';
  sub.style.fontSize = '13px';
  sub.style.color    = 'var(--text-rust)';
  sub.textContent = 'Порядок ходов обратный';
  inner.appendChild(sub);

  anim.classList.remove('hidden');

  setTimeout(() => {
    inner.querySelectorAll('.fa-caption,.fa-prize').forEach(e => e.remove());
    anim.classList.add('hidden');
    toilet.textContent = '🚽';
    cb();
  }, 1800);
}

// ── ТАЙМЕР ──
function startTimer() {
  stopTimer();
  state.timer = 30;
  renderTimer();
  state.timerRef = setInterval(() => {
    state.timer--;
    renderTimer();
    if (state.timer <= 0) {
      stopTimer();
      if (state.myTurn && !state.animating) { pickRandom(); setTimeout(doFlush, 300); }
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerRef) { clearInterval(state.timerRef); state.timerRef = null; }
}

function renderTimer() {
  const el = document.getElementById('turnTimer');
  el.textContent = state.timer;
  el.classList.toggle('urgent', state.timer <= 8);
}

// ── ИТОГИ ──
function showResults() {
  state.finished = true;
  stopTimer();

  const screen = document.getElementById('resultsScreen');
  const table  = document.getElementById('rsTable');

  const results = PLAYERS.map((name, i) => {
    const won   = Math.random() > 0.45;
    const prize = won ? parseFloat((parseFloat(PRIZE_POOL) * (5 + Math.random() * 15) / 100).toFixed(3)) : 0;
    return { name, prize, isMe: i === GAME.myIndex };
  }).sort((a, b) => b.prize - a.prize);

  const me = results.find(r => r.isMe);

  document.getElementById('rsIcon').textContent   = me.prize > 0 ? '💩' : '🚽';
  document.getElementById('rsTitle').textContent  = me.prize > 0 ? 'Ты нашёл приз!' : 'Не повезло в этот раз';
  document.getElementById('rsAmount').textContent = me.prize > 0 ? `+${me.prize} GOVNO` : '0 GOVNO';
  document.getElementById('rsAmount').style.color = me.prize > 0 ? '#4ade80' : 'var(--text-dim)';

  table.innerHTML = results.map(r => `
    <div class="rs-row${r.isMe ? ' me' : ''}">
      <span class="rn">${r.name}${r.isMe ? ' 👤' : ''}</span>
      <span class="${r.prize > 0 ? 'rv-win' : 'rv-lose'}">${r.prize > 0 ? '+' + r.prize + ' GOVNO' : '—'}</span>
    </div>`).join('');

  screen.classList.remove('hidden');
}

function goHome() { window.location.href = 'index.html'; }

// ── ЛОАДЕР ──
function runLoader() {
  const wrap = document.getElementById('loaderPlayers');
  const fill = document.getElementById('loaderFill');
  const stat = document.getElementById('loaderStatus');

  for (let i = 0; i < GAME.players; i++) {
    const s = document.createElement('div');
    s.className = 'lp-slot'; s.id = `slot-${i}`; s.textContent = '·';
    wrap.appendChild(s);
  }

  let joined = 0;
  function add() {
    if (joined >= GAME.players) { stat.textContent = '🚽 Все готовы!'; setTimeout(startGame, 700); return; }
    const s = document.getElementById(`slot-${joined}`);
    s.classList.add('filled');
    s.textContent = joined === GAME.myIndex ? '👤' : '💀';
    joined++;
    fill.style.width = (joined / GAME.players * 100) + '%';
    stat.textContent = `${joined} / ${GAME.players} игроков`;
    setTimeout(add, joined === GAME.myIndex ? 80 : 250 + Math.random() * 400);
  }
  add();
}

function startGame() {
  document.getElementById('gameLoader').classList.add('hidden');
  document.getElementById('gameScreen').classList.remove('hidden');
  document.getElementById('playerCount').textContent = `${GAME.players} игроков`;
  document.getElementById('bankVal').textContent     = PRIZE_POOL;
  document.getElementById('toiletInput').max         = TOTAL_BALLS;
  buildGrid();
  buildQueue();
  updateTurnUI();
}

document.addEventListener('DOMContentLoaded', runLoader);
