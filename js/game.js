/* ═══════════════════════════════════════════
   GOVNO ne TONet — game.js  v3.5
   Логика экрана игры на базе официальных матриц
═══════════════════════════════════════════ */

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#1a1408'); tg.setBackgroundColor('#1a1408'); }

// ── КОНФИГУРАЦИЯ ИГРЫ ──
const params = new URLSearchParams(window.location.search);
const GAME = {
  id:      1107,
  nominal: parseFloat(params.get('nominal')) || 1,
  players: Math.min(parseInt(params.get('players')) || 10, 10), // Максимум 10 участников!
  myIndex: 1, // Твой индекс равен 1 (так как отсчет с 0, то индекс 1 — это второй ходящий)
};

const PLAYERS = ['@igor','@anna','@max','@you','@kate','@dima','@alex','@mia','@oleg','@lena','@vanya','@sasha','@olga','@ivan','@petr'];

// ── ГЕНЕРАЦИЯ ДИНАМИЧЕСКОЙ МАТРИЦЫ НА СТАРТЕ ──
const ROOM_DATA = generateGameBallsMatrix(GAME.nominal, GAME.players);

const TOTAL_BALLS = ROOM_DATA.totalBallsGenerated; // ВСЕГДА Игроки * 2
const PRIZE_POOL  = ROOM_DATA.netPrizeBank.toFixed(2); // Чистый банк монет после комиссии 4.5%

// Перемешиваем сгенерированные шары (монеты, билеты, пустышки)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const GAME_BALLS = shuffleArray(ROOM_DATA.balls);

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
  animating: false,
  prizes:   {}, // Баланс монет игроков
  tickets:  {}, // Баланс билетов игроков
};

// ── СЕТКА ──
function getGridCols(p) {
  if (p <= 3)  return 2;
  if (p <= 6)  return 3;
  if (p <= 12) return 4;
  return 5;
}
function getEmojiSize(p) {
  return '60%';
}
function getNumSize(p) {
  if (p <= 7)  return '10px';
  if (p <= 12) return '9px';
  return '8px';
}

function buildGrid() {
  const grid = document.getElementById('toiletGrid');
  grid.style.gridTemplateColumns = `repeat(${getGridCols(GAME.players)}, 1fr)`;
  const rows = Math.ceil(TOTAL_BALLS / getGridCols(GAME.players));
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  grid.style.height = '100%';
  grid.innerHTML = '';
  for (let i = 1; i <= TOTAL_BALLS; i++) {
    const cell = document.createElement('div');
    cell.className = 't-cell';
    cell.id = `cell-${i}`;
    cell.innerHTML = `
      <img class="t-emoji t-img" src="img/taz.png" style="width:${getEmojiSize(GAME.players)};height:auto">
      <span class="t-num" style="font-size:${getNumSize(GAME.players)}">№${i}</span>`;
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
  if (state.animating) return;
  const order  = state.attempt === 1 ? state.order : state.order2;
  const pIdx   = order[state.curTurn];
  const myTurn = pIdx === GAME.myIndex;
  state.myTurn = myTurn;

  document.getElementById('curPlayer').textContent  = PLAYERS[pIdx];
  document.getElementById('curAttempt').textContent = `Попытка ${state.attempt}/2`;

  document.querySelectorAll('.t-cell').forEach(cell => {
    if (cell.classList.contains('won') || cell.classList.contains('lost') || cell.classList.contains('ticket-won')) return;
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
  if (!cell || cell.classList.contains('won') || cell.classList.contains('lost') || cell.classList.contains('ticket-won')) return;

  if (state.chosen && state.chosen !== num) {
    const prev = document.getElementById(`cell-${state.chosen}`);
    if (prev) {
      prev.classList.remove('chosen');
      if (!prev.classList.contains('won') && !prev.classList.contains('lost') && !prev.classList.contains('ticket-won')) {
        prev.querySelector('.t-img').src = 'img/taz.png';
      }
    }
  }

  state.chosen = num;
  document.getElementById('inputZone').classList.add('has-selection');
  document.getElementById('flushBtn').classList.add('active-btn');
  cell.querySelector('.t-img').src = 'img/taz_aktiv.png';
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
  let next = (state.chosen || 0) + delta;
  while (next >= 1 && next <= TOTAL_BALLS && state.opened[next]) {
    next += delta;
  }
  if (next >= 1 && next <= TOTAL_BALLS) selectCell(next);
}

function clearChosen() {
  if (state.chosen) {
    const prevCell = document.getElementById(`cell-${state.chosen}`);
    if (prevCell) {
      prevCell.classList.remove('chosen');
      const prevImg = prevCell.querySelector('.t-img');
      if (prevImg && !prevCell.classList.contains('won') && !prevCell.classList.contains('lost') && !prevCell.classList.contains('ticket-won')) {
        prevImg.src = 'img/taz.png';
      }
    }
  }
  state.chosen = null;
  document.getElementById('inputZone').classList.remove('has-selection');
  document.getElementById('flushBtn').classList.remove('active-btn');
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
  const ballData = GAME_BALLS[num - 1]; 
  state.opened[num] = ballData.type; 
  
  const order = state.attempt === 1 ? state.order : state.order2;
  const pIdx  = order[state.curTurn];

  if (ballData.type === 'coin') {
    state.prizes[pIdx] = (state.prizes[pIdx] || 0) + ballData.coins;
  } else if (ballData.type === 'ticket') {
    state.tickets[pIdx] = (state.tickets[pIdx] || 0) + ballData.tickets;
  }

  if (isMe) {
    state.animating = true;
    showFlushAnim(num, ballData, () => {
      state.animating = false;
      applyOpenedCell(num, ballData);
      clearChosen();
      document.getElementById('toiletInput').value = '';
      nextTurn();
    });
  } else {
    applyOpenedCell(num, ballData);
    nextTurn();
  }
}

function applyOpenedCell(num, ballData) {
  const cell = document.getElementById(`cell-${num}`);
  if (!cell) return;
  const img = cell.querySelector('.t-img');
  
  if (ballData.type === 'coin') {
    img.src = 'img/govno_pobeda.png';
    cell.classList.add('won');
  } else if (ballData.type === 'ticket') {
    img.src = 'img/govno_pobeda.png'; // Можешь заменить картинку на билет, если есть
    cell.classList.add('ticket-won');
  } else {
    img.src = 'img/taz_s_muha.png'; // Пустышка (муха)
    cell.classList.add('lost');
  }
  img.style.opacity = '1';
  cell.classList.remove('mine', 'chosen', 'dim');
}

// ── АНИМАЦИЯ СМЫВА ──
function showFlushAnim(num, ballData, cb) {
  if (showFlushAnim._timers) {
    showFlushAnim._timers.forEach(clearTimeout);
  }
  showFlushAnim._timers = [];

  const anim   = document.getElementById('flushAnim');
  const inner  = anim.querySelector('.fa-inner');
  const toilet = document.getElementById('faToilet');
  const swirl  = document.getElementById('faSwirl');
  const result = document.getElementById('faResult');

  inner.querySelectorAll('.fa-caption,.fa-prize,.fa-pobeda').forEach(e => e.remove());
  toilet.textContent     = '🚽';
  toilet.style.display   = 'block';
  toilet.style.animation = 'toiletShake .15s ease-in-out infinite';
  swirl.style.display    = 'none';
  result.classList.add('hidden');
  result.textContent     = '';

  anim.classList.remove('hidden');

  showFlushAnim._timers.push(setTimeout(() => {
    swirl.style.display = 'block';
  }, 1000));

  showFlushAnim._timers.push(setTimeout(() => {
    swirl.style.display    = 'none';
    toilet.style.animation = 'none';

    if (ballData.type === 'coin') {
      toilet.style.display = 'none';
      anim.classList.add('hidden');
      document.getElementById('wsNum').textContent   = `№${num} — МОНЕТЫ!`;
      document.getElementById('wsPrize').textContent = `+${ballData.coins.toFixed(2)} GOVNO`;
      document.getElementById('winScreen').classList.remove('hidden');      
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else if (ballData.type === 'ticket') {
      toilet.textContent   = '🎫';
      toilet.style.display = 'block';
      const cap = document.createElement('div');
      cap.className   = 'fa-caption win';
      cap.textContent = `№${num} — БИЛЕТ!`;
      const prz = document.createElement('div');
      prz.className   = 'fa-prize';
      prz.textContent = `+${ballData.tickets} Лотерейный билет`;
      inner.appendChild(cap);
      inner.appendChild(prz);
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else {
      toilet.textContent   = '🪰';
      toilet.style.display = 'block';
      const cap = document.createElement('div');
      cap.className   = 'fa-caption lose';
      cap.textContent = '🪰 Пусто...';
      inner.appendChild(cap);      
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
    }
  }, 2000));

  showFlushAnim._timers.push(setTimeout(() => {
    inner.querySelectorAll('.fa-caption,.fa-prize,.fa-pobeda').forEach(e => e.remove());
    result.classList.add('hidden');
    toilet.textContent     = '🚽';
    toilet.style.display   = 'block';
    toilet.style.animation = 'toiletShake .15s ease-in-out infinite';
    anim.classList.add('hidden');
    document.getElementById('winScreen').classList.add('hidden');
    showFlushAnim._timers  = [];
    cb();
  }, 5000));
}

// ── СЛЕДУЮЩИЙ ХОД ──
function nextTurn() {
  state.curTurn++;

  if (state.curTurn >= GAME.players) {
    if (state.attempt === 1) {
      state.attempt  = 2;
      state.curTurn  = 0;
      state.myTurn   = false;
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
  sub.textContent = attempt === 1 ? 'Найди приз среди унитазов!' : 'Порядок ходов обратный';
  inner.appendChild(sub);

  anim.classList.remove('hidden');

  setTimeout(() => {
    inner.querySelectorAll('.fa-caption,.fa-prize').forEach(e => e.remove());
    anim.classList.add('hidden');
    toilet.textContent = '🚽';
    cb();
  }, 4000);
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

// ── ИТОГИ И ЭКРАН РЕЗУЛЬТАТОВ ──
function showResults() {
  state.finished = true;
  stopTimer();

  const screen = document.getElementById('resultsScreen');
  const table  = document.getElementById('rsTable');

  const activePlayers = PLAYERS.slice(0, GAME.players);
  const results = activePlayers.map((name, i) => {
    const coinPrize = parseFloat((state.prizes[i] || 0).toFixed(2));
    const ticketPrize = state.tickets[i] || 0;
    return {
      name,
      coinPrize,
      ticketPrize,
      isMe:  i === GAME.myIndex,
    };
  }).sort((a, b) => b.coinPrize - a.coinPrize || b.ticketPrize - a.ticketPrize);

  const me = results.find(r => r.isMe);
  const totalMeWin = me.coinPrize;

  document.getElementById('rsIcon').textContent   = totalMeWin > 0 ? '💩' : (me.ticketPrize > 0 ? '🎫' : '🚽');
  document.getElementById('rsTitle').textContent  = totalMeWin > 0 ? 'Ты нашёл приз!' : (me.ticketPrize > 0 ? 'Ты выиграл билет!' : 'Не повезло в этот раз');
  
  if (totalMeWin > 0) {
    document.getElementById('rsAmount').textContent = `+${totalMeWin.toFixed(2)} GOVNO` + (me.ticketPrize > 0 ? ` & +${me.ticketPrize} 🎫` : '');
    document.getElementById('rsAmount').style.color = '#4ade80';
  } else if (me.ticketPrize > 0) {
    document.getElementById('rsAmount').textContent = `+${me.ticketPrize} БИЛЕТ`;
    document.getElementById('rsAmount').style.color = '#38bdf8';
  } else {
    document.getElementById('rsAmount').textContent = '0 GOVNO';
    document.getElementById('rsAmount').style.color = 'var(--text-dim)';
  }

  table.innerHTML = results.map(r => {
    let prizeStr = '';
    if (r.coinPrize > 0) prizeStr += `+${r.coinPrize.toFixed(2)} GOVNO`;
    if (r.ticketPrize > 0) prizeStr += (prizeStr ? ' ' : '') + `+${r.ticketPrize} 🎫`;
    if (!prizeStr) prizeStr = '—';

    return `
    <div class="rs-row${r.isMe ? ' me' : ''}">
      <span class="rn">${r.name}${r.isMe ? ' 👤' : ''}</span>
      <span class="${r.coinPrize > 0 ? 'rv-win' : (r.ticketPrize > 0 ? 'rv-ticket' : 'rv-lose')}">${prizeStr}</span>
    </div>`;
  }).join('');

  screen.classList.remove('hidden');
  
  saveMatchToHistory(totalMeWin > 0);
  saveMatchToServer(totalMeWin > 0);
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
  showAttemptBanner(1, () => updateTurnUI());
}

document.addEventListener('DOMContentLoaded', runLoader);

function saveMatchToHistory(isWin) {
  let history = JSON.parse(localStorage.getItem('govno_game_history')) || [];
  const newMatch = {
    id: GAME.id || 1107,
    date: new Date().toLocaleDateString('ru-RU'),
    nominal: GAME.nominal,
    players: GAME.players,
    result: isWin ? 'win' : 'lose',
    reward: isWin ? (GAME.nominal * GAME.players).toFixed(2) : 0
  };
  history.unshift(newMatch);
  if (history.length > 20) history.pop();
  localStorage.setItem('govno_game_history', JSON.stringify(history));
}

function saveMatchToServer(isWin) {
  const userId = tg?.initDataUnsafe?.user?.id || 0;
  const username = tg?.initDataUnsafe?.user?.username || 'anonymous';
  const matchData = {
    userId: userId,
    username: username,
    gameId: GAME.id,
    nominal: GAME.nominal,
    players: GAME.players,
    result: isWin ? 'win' : 'lose',
    reward: isWin ? (GAME.nominal * GAME.players).toFixed(2) : '0.00',
    authData: window.Telegram?.WebApp?.initData
  };

  fetch('https://your-backend-api.com/api/history/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(matchData)
  })
  .then(response => { if (!response.ok) throw new Error('Ошибка сети'); return response.json(); })
  .then(data => { console.log('Игра успешно сохранена на сервере:', data); })
  .catch(error => { console.error('Не удалось сохранить игру на сервере:', error); });
}

/**
 * ИТОГОВЫЙ ГЕНЕРАТОР С УЧЕТОМ ПУСТЫХ ШАРОВ (ВСЕГДА ИГРОКИ * 2)
 */
function generateGameBallsMatrix(bet, players) {
  const HOUSE_EDGE = 0.045; 
  const totalPool = parseFloat((bet * players).toFixed(2));
  const weekMonthAllocation = parseFloat((totalPool * HOUSE_EDGE).toFixed(2));
  
  // Расчет строго от Чистого банка
  const netPrizeBank = parseFloat((totalPool - weekMonthAllocation).toFixed(2));
  
  // Процентная сетка призов (до 10 игроков включительно)
  const percentMatrix = {
    2:  [15.53, 22.93, 61.54],
    3:  [13.86, 18.75, 22.95, 44.44],
    4:  [13.03, 14.45, 17.25, 19.37, 35.90],
    5:  [10.43, 12.25, 14.38, 15.40, 16.77, 30.77],
    6:  [8.69, 10.26, 11.97, 13.68, 13.95, 14.10, 27.35],
    7:  [7.45, 8.79, 10.26, 11.72, 12.09, 12.09, 12.69, 24.91],
    8:  [6.52, 7.69, 8.97, 10.26, 10.59, 10.61, 11.14, 11.14, 23.08],
    9:  [5.79, 6.84, 7.98, 9.12, 9.40, 9.43, 9.93, 9.93, 9.93, 21.65],
    10: [5.22, 6.15, 7.18, 8.21, 8.46, 8.52, 8.93, 8.93, 8.93, 8.93, 20.54]
  };

  // Твоя НОВАЯ сетка вместимости лобби (максимум ограничено 10 игроками)
  const totalToiletsMatrix = {
    2: 5,  3: 7,  4: 9,  5: 12, 6: 14, 7: 16, 8: 19, 9: 21, 10: 23
  };

  let allBalls = [];
  let calculatedCoinsSum = 0;
  let ballIdCounter = 1;
  const currentPercentages = percentMatrix[players] || [];

  // ШАГ 1: Наполнение монетами (Расчет от Чистого Банка)
  currentPercentages.forEach((percent) => {
    let coinValue = parseFloat((netPrizeBank * (percent / 100)).toFixed(2));
    calculatedCoinsSum += coinValue;
    allBalls.push({ id: ballIdCounter++, type: 'coin', coins: coinValue, tickets: 0 });
  });

  // Корректировка округления по последнему шару
  calculatedCoinsSum = parseFloat(calculatedCoinsSum.toFixed(2));
  if (calculatedCoinsSum !== netPrizeBank && allBalls.length > 0) {
    const diff = parseFloat((netPrizeBank - calculatedCoinsSum).toFixed(2));
    allBalls[allBalls.length - 1].coins = parseFloat((allBalls[allBalls.length - 1].coins + diff).toFixed(2));
  }

  // ШАГ 2: Новая логика распределения билетов по твоим условиям
  let ticketsCount = 0;
  if (bet === 0.5) {
    if (players >= 5 && players <= 8)       ticketsCount = 1;
    else if (players >= 9 && players <= 10)  ticketsCount = 2; 
  } else if (bet === 1.0 || bet === 1.5) { 
    if (players >= 4 && players <= 7)       ticketsCount = 1;
    else if (players >= 8 && players <= 10)  ticketsCount = 2;
  } else if (bet === 2.0) {
    if (players >= 2 && players <= 5)       ticketsCount = 1;
    else if (players >= 6 && players <= 9)       ticketsCount = 2;
    else if (players === 10)                 ticketsCount = 3;
  }

  // Добавляем билеты в пул
  for (let i = 0; i < ticketsCount; i++) {
    allBalls.push({ id: ballIdCounter++, type: 'ticket', coins: 0, tickets: 1 });
  }

  // ШАГ 3: Заполнение пустышками (мухами) до новой нормы унитазов
  const targetTotalBalls = totalToiletsMatrix[players] || 10;
  const emptyBallsNeeded = targetTotalBalls - allBalls.length;
  for (let i = 0; i < emptyBallsNeeded; i++) {
    allBalls.push({ id: ballIdCounter++, type: 'empty', coins: 0, tickets: 0 });
  }

  return {
    netPrizeBank: netPrizeBank,
    totalBallsGenerated: allBalls.length,
    balls: allBalls
  };
}

function triggerGamePoopSplash(cellNum) {
  // Находим ячейку унитаза, которую выбрал игрок
  const cell = document.getElementById(`cell-${cellNum}`);
  if (!cell) return;

  // Рассчитываем координаты центра ячейки относительно всей сетки
  const grid = document.getElementById('toiletGrid');
  const gridRect = grid.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  // Вычисляем точку «взрыва» ровно по центру выбранного унитаза
  const centerX = (cellRect.left - gridRect.left) + (cellRect.width / 2);
  const centerY = (cellRect.top - gridRect.top) + (cellRect.height / 2);

  const particleCount = 10; // Количество частиц в фонтане
  const elements = ['💩', '🟤', '💦', '🪰']; 

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'poop-splash-particle';
    p.textContent = elements[Math.floor(Math.random() * elements.length)];

    // 🎯 НАПРАВЛЯЕМ ВВЕРХ: Угол зажат от -60° до -120° (в тригонометрии JS это строго вверх)
    const angle = -Math.PI / 3 - Math.random() * (Math.PI / 3); 
    
    // Дистанция вылета вверх (высота фонтана)
    const distance = 40 + Math.random() * 50;  
    
    // Считаем чистую траекторию полета
    const tx = Math.cos(angle) * (distance * 0.5); // Небольшой разлет в бока
    const ty = Math.sin(angle) * distance;         // Мощный рывок строго вверх
    const rot = (Math.random() - 0.5) * 180;       // Случайное вращение для реализма

    // Передаем координаты анимации в CSS
    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);
    p.style.setProperty('--rot', `${rot}deg`);

    // Спавним частицу в центре унитаза
    p.style.left = `${centerX - 12}px`; 
    p.style.top = `${centerY - 12}px`;

    grid.appendChild(p);

    p.addEventListener('animationend', () => p.remove());
  }
}