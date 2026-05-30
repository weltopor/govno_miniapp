/* ═══════════════════════════════════════════
   GOVNO ne TONet — game.js
   Логика экрана игры
═══════════════════════════════════════════ */

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#0e0a06'); tg.setBackgroundColor('#0e0a06'); }

// ── КОНФИГУРАЦИЯ ИГРЫ ──
// В реальном приложении параметры придут с сервера (WebSocket)
const GAME = {
  id:       1107,
  nominal:  1,
  players:  10,         // 2–15
  myIndex:  3,          // позиция @you в списке (0-based)
  attempt:  1,          // текущая попытка (1 или 2)
};

// Список игроков
const PLAYERS = [
  '@igor','@anna','@max','@you','@kate',
  '@dima','@alex','@mia','@oleg','@lena'
];

// Генерация шаров
const TOTAL_BALLS  = GAME.players * 2;
const WIN_BALLS    = GAME.players + 1;
const PRIZE_POOL   = (GAME.players * GAME.nominal * 0.975).toFixed(2);

// Генерируем выигрышные позиции случайно (в реале — сервер)
function genWinners(total, wins) {
  const arr = new Set();
  while (arr.size < wins) arr.add(Math.floor(Math.random() * total) + 1);
  return arr;
}
const WINNERS = genWinners(TOTAL_BALLS, WIN_BALLS);

// ── СОСТОЯНИЕ ──
let state = {
  opened:    {},      // { шарНомер: 'won' | 'lost' }
  curTurn:   0,       // индекс текущего игрока в очереди
  attempt:   1,
  order:     [],      // порядок ходов попытка 1
  order2:    [],      // порядок ходов попытка 2 (обратный)
  chosen:    null,    // выбранный номер
  myTurn:    false,
  finished:  false,
  timer:     30,
  timerRef:  null,
};

// ── КОЛОНКИ СЕТКИ ──
function getGridCols(players) {
  if (players <= 5)  return 2;
  if (players <= 7)  return 3;
  if (players <= 12) return 4;
  return 5;
}

// ── РАЗМЕР ШРИФТА УНИТАЗА ──
function getEmojiSize(players) {
  if (players <= 4)  return '28px';
  if (players <= 7)  return '22px';
  if (players <= 10) return '18px';
  if (players <= 13) return '15px';
  return '13px';
}

function getNumSize(players) {
  if (players <= 7)  return '9px';
  if (players <= 12) return '8px';
  return '7px';
}

// ── СТРОИМ СЕТКУ УНИТАЗОВ ──
function buildGrid() {
  const grid = document.getElementById('toiletGrid');
  const cols = getGridCols(GAME.players);
  const emojiSz = getEmojiSize(GAME.players);
  const numSz   = getNumSize(GAME.players);

  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = '';

  for (let i = 1; i <= TOTAL_BALLS; i++) {
    const cell = document.createElement('div');
    cell.className = 't-cell';
    cell.id = `cell-${i}`;
    cell.innerHTML = `
      <span class="t-emoji" style="font-size:${emojiSz}">🚽</span>
      <span class="t-num"   style="font-size:${numSz}">№${i}</span>
    `;
    cell.addEventListener('click', () => selectCell(i));
    grid.appendChild(cell);
  }
}

// ── ОЧЕРЕДЬ ──
function buildQueue() {
  // Попытка 1: случайный порядок (в реале — с сервера)
  state.order  = [...Array(GAME.players).keys()];
  state.order2 = [...state.order].reverse(); // попытка 2 — обратный

  renderQueue();
}

function renderQueue() {
  const list  = document.getElementById('queueList');
  const order = state.attempt === 1 ? state.order : state.order2;

  list.innerHTML = order.map((pIdx, i) => {
    const name = PLAYERS[pIdx];
    let cls = 'q-item';
    if (i <  state.curTurn) cls += ' done';
    if (i === state.curTurn) cls += ' active';
    return `<span class="${cls}">${name}</span>`;
  }).join('');
}

// ── МОЙ ХОД? ──
function isMyTurn() {
  const order = state.attempt === 1 ? state.order : state.order2;
  return order[state.curTurn] === GAME.myIndex;
}

// ── ОБНОВИТЬ UI ПОД ТЕКУЩИЙ ХОД ──
function updateTurnUI() {
  const order  = state.attempt === 1 ? state.order : state.order2;
  const pIdx   = order[state.curTurn];
  const pName  = PLAYERS[pIdx];
  const myTurn = pIdx === GAME.myIndex;
  state.myTurn = myTurn;

  document.getElementById('curPlayer').textContent  = pName;
  document.getElementById('curAttempt').textContent = `Попытка ${state.attempt}/2`;

  const iz       = document.getElementById('inputZone');
  const waitOver = document.getElementById('waitOverlay');
  const woPlayer = document.getElementById('woPlayer');

  // Подсвечиваем / затемняем ячейки
  document.querySelectorAll('.t-cell').forEach(cell => {
    if (cell.classList.contains('won') || cell.classList.contains('lost')) return;
    cell.classList.toggle('dim', !myTurn);
  });

  if (myTurn) {
    iz.classList.remove('blocked');
    waitOver.classList.add('hidden');
    startTimer();
    showQuickBtns();
  } else {
    iz.classList.add('blocked');
    waitOver.classList.remove('hidden');
    woPlayer.textContent = pName;
    stopTimer();
    // Бот ходит за офлайн-игроков через 2–4 сек (имитация)
    const delay = 1500 + Math.random() * 2500;
    setTimeout(() => {
      if (!state.myTurn && !state.finished) botMove();
    }, delay);
  }

  renderQueue();
}

// ── ВЫБОР ЯЧЕЙКИ (клик или ввод) ──
function selectCell(num) {
  if (!state.myTurn) return;
  const cell = document.getElementById(`cell-${num}`);
  if (!cell || cell.classList.contains('won') || cell.classList.contains('lost')) return;

  // Снять предыдущий выбор
  if (state.chosen) {
    document.getElementById(`cell-${state.chosen}`)?.classList.remove('chosen');
  }

  state.chosen = num;
  cell.classList.add('chosen');

  const input = document.getElementById('toiletInput');
  input.value = num;
  input.classList.add('has-val');

  document.getElementById('flushBtn').disabled = false;

  if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

// ── ИЗМЕНЕНИЕ ПОЛЯ ВВОДА ──
function onInputChange(val) {
  const num = parseInt(val);
  if (!num || num < 1 || num > TOTAL_BALLS) {
    clearChosen();
    return;
  }
  selectCell(num);
}

function changeInput(delta) {
  const cur  = state.chosen || 0;
  const next = Math.max(1, Math.min(TOTAL_BALLS, cur + delta));
  selectCell(next);
}

function clearChosen() {
  if (state.chosen) {
    document.getElementById(`cell-${state.chosen}`)?.classList.remove('chosen');
    state.chosen = null;
  }
  document.getElementById('flushBtn').disabled = true;
  document.getElementById('toiletInput').classList.remove('has-val');
}

// ── БЫСТРЫЕ КНОПКИ ──
function showQuickBtns() {
  const wrap  = document.getElementById('quickBtns');
  // Предлагаем несколько случайных закрытых шаров
  const avail = [];
  for (let i = 1; i <= TOTAL_BALLS; i++) {
    if (!state.opened[i]) avail.push(i);
  }
  const picks = avail.sort(() => Math.random() - .5).slice(0, 3);
  wrap.innerHTML = picks.map(n =>
    `<span class="qb-item" onclick="selectCell(${n})">№${n}</span>`
  ).join('') + `<span class="qb-item" onclick="pickRandom()">🎲 Случайный</span>`;
}

function pickRandom() {
  const avail = [];
  for (let i = 1; i <= TOTAL_BALLS; i++) {
    if (!state.opened[i]) avail.push(i);
  }
  if (avail.length) selectCell(avail[Math.floor(Math.random() * avail.length)]);
}

// ── СМЫТЬ ──
function doFlush() {
  if (!state.myTurn || !state.chosen) return;
  stopTimer();
  openBall(state.chosen, true);
}

// ── БОТ ХОДИТ ──
function botMove() {
  const avail = [];
  for (let i = 1; i <= TOTAL_BALLS; i++) {
    if (!state.opened[i]) avail.push(i);
  }
  if (!avail.length) return;
  const pick = avail[Math.floor(Math.random() * avail.length)];
  openBall(pick, false);
}

// ── ОТКРЫТЬ ШАР ──
function openBall(num, isMe) {
  const isWin = WINNERS.has(num);
  state.opened[num] = isWin ? 'won' : 'lost';

  if (isMe) {
    // Анимация смыва
    showFlushAnim(num, isWin, () => {
      applyOpenedCell(num, isWin);
      clearChosen();
      document.getElementById('toiletInput').value = '';
      nextTurn();
    });
  } else {
    // Чужой ход — просто открываем ячейку
    applyOpenedCell(num, isWin);
    nextTurn();
  }
}

function applyOpenedCell(num, isWin) {
  const cell  = document.getElementById(`cell-${num}`);
  const emoji = cell.querySelector('.t-emoji');
  const nSize = cell.querySelector('.t-num').style.fontSize;

  emoji.style.fontSize = cell.querySelector('.t-emoji').style.fontSize;
  emoji.textContent    = isWin ? '💩' : '🪰';

  cell.classList.remove('mine', 'chosen', 'dim');
  cell.classList.add(isWin ? 'won' : 'lost');
}

// ── АНИМАЦИЯ СМЫВА ──
function showFlushAnim(num, isWin, cb) {
  const anim   = document.getElementById('flushAnim');
  const result = document.getElementById('faResult');
  const toilet = document.getElementById('faToilet');

  anim.classList.remove('hidden');
  result.classList.add('hidden');
  toilet.textContent = '🚽';

  // Фаза 1: трясётся 0.8 сек
  setTimeout(() => {
    document.getElementById('faSwirl').style.display = 'block';
  }, 400);

  // Фаза 2: результат
  setTimeout(() => {
    toilet.textContent   = isWin ? '💩' : '🪰';
    document.getElementById('faSwirl').style.display = 'none';

    result.classList.remove('hidden');

    // Создаём caption
    const existing = anim.querySelectorAll('.fa-caption, .fa-prize');
    existing.forEach(e => e.remove());

    const cap = document.createElement('div');
    cap.className = `fa-caption ${isWin ? 'win' : 'lose'}`;
    cap.textContent = isWin ? 'Выигрыш!' : 'Пусто...';
    anim.querySelector('.fa-inner').appendChild(cap);

    if (isWin) {
      // Считаем приз (упрощённо — один из выигрышных шаров)
      const openedWins = Object.values(state.opened).filter(v => v === 'won').length;
      const prizePercent = getPrizePercent(GAME.players, openedWins);
      const prize = (parseFloat(PRIZE_POOL) * prizePercent / 100).toFixed(3);

      const prizeEl = document.createElement('div');
      prizeEl.className = 'fa-prize';
      prizeEl.textContent = `+${prize} GOVNO`;
      anim.querySelector('.fa-inner').appendChild(prizeEl);

      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else {
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
    }

  }, 900);

  // Фаза 3: закрываем анимацию
  setTimeout(() => {
    anim.classList.add('hidden');
    cb();
  }, 2200);
}

// Упрощённая таблица процентов призов
function getPrizePercent(players, winIdx) {
  const table = {
    2:  [61.5, 23.1, 15.4],
    5:  [30.8, 16.6, 15.2, 14.9, 12.4, 10.3],
    10: [20.5, 8.5,  8.2,  7.2,  6.1,  5.1, 5.1, 5.1, 5.1, 5.1, 5.1],
  };
  const closest = [2, 5, 10].reduce((a, b) =>
    Math.abs(b - players) < Math.abs(a - players) ? b : a
  );
  const arr = table[closest];
  return arr[Math.min(winIdx - 1, arr.length - 1)] || 5.1;
}

// ── СЛЕДУЮЩИЙ ХОД ──
function nextTurn() {
  const orderLen = GAME.players;
  state.curTurn++;

  if (state.curTurn >= orderLen) {
    if (state.attempt === 1) {
      // Переходим к попытке 2
      state.attempt  = 2;
      state.curTurn  = 0;
      state.myTurn   = false;
      setTimeout(updateTurnUI, 500);
    } else {
      // Игра закончена
      setTimeout(showResults, 600);
    }
    return;
  }

  setTimeout(updateTurnUI, 300);
}

// ── ТАЙМЕР ХОДА ──
function startTimer() {
  stopTimer();
  state.timer = 30;
  renderTimer();

  state.timerRef = setInterval(() => {
    state.timer--;
    renderTimer();

    if (state.timer <= 0) {
      stopTimer();
      // Автоход бота за игрока
      if (state.myTurn) {
        pickRandom();
        setTimeout(doFlush, 300);
      }
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

  // Считаем выигрыши
  let myWon = false;
  let myPrize = 0;

  // Имитация результатов (в реале — с сервера)
  const results = PLAYERS.map((name, i) => {
    const won   = Math.random() > 0.5;
    const prize = won ? (parseFloat(PRIZE_POOL) * (5 + Math.random() * 15) / 100).toFixed(3) : 0;
    if (i === GAME.myIndex) { myWon = !!prize; myPrize = prize; }
    return { name, prize: parseFloat(prize) };
  }).sort((a, b) => b.prize - a.prize);

  document.getElementById('rsIcon').textContent   = myWon ? '💩' : '🚽';
  document.getElementById('rsTitle').textContent  = myWon ? 'Ты нашёл приз!' : 'Не повезло...';
  document.getElementById('rsAmount').textContent = myWon ? `+${myPrize} GOVNO` : '0 GOVNO';
  document.getElementById('rsAmount').style.color = myWon ? '#4ade80' : 'var(--text-dim)';

  table.innerHTML = results.map(r => `
    <div class="rs-row${r.name === '@you' ? ' me' : ''}">
      <span class="rn">${r.name}</span>
      <span class="${r.prize > 0 ? 'rv-win' : 'rv-lose'}">
        ${r.prize > 0 ? '+' + r.prize + ' GOVNO' : '—'}
      </span>
    </div>
  `).join('');

  screen.classList.remove('hidden');

  // Уведомление в Telegram
  if (tg && myWon) {
    tg.showAlert(`🎰 Игра #${GAME.id} завершена\n+${myPrize} GOVNO 💩\n🧻 +1 билет`);
  }
}

function goHome() {
  window.location.href = 'index.html';
}

// ── ЛОАДЕР — ЗАПОЛНЯЕМ СЛОТЫ ──
function runLoader() {
  const wrap  = document.getElementById('loaderPlayers');
  const fill  = document.getElementById('loaderFill');
  const stat  = document.getElementById('loaderStatus');

  // Создаём слоты
  for (let i = 0; i < GAME.players; i++) {
    const slot = document.createElement('div');
    slot.className = 'lp-slot';
    slot.id = `slot-${i}`;
    slot.textContent = '·';
    wrap.appendChild(slot);
  }

  let joined = 0;
  function addPlayer() {
    if (joined >= GAME.players) {
      // Все зашли — запускаем игру
      stat.textContent = '🚽 Все готовы! Начинаем...';
      setTimeout(startGame, 800);
      return;
    }

    const slot = document.getElementById(`slot-${joined}`);
    slot.classList.add('filled');
    slot.textContent = joined === GAME.myIndex ? '👤' : '💀';
    joined++;

    fill.style.width = (joined / GAME.players * 100) + '%';
    stat.textContent = `${joined} / ${GAME.players} игроков`;

    const delay = joined === GAME.myIndex ? 100 : 300 + Math.random() * 500;
    setTimeout(addPlayer, delay);
  }

  addPlayer();
}

// ── СТАРТ ИГРЫ ──
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

// ── ЗАПУСК ──
document.addEventListener('DOMContentLoaded', runLoader);
