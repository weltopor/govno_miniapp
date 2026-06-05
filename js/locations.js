/* ═══════════════════════════════════════════
   GOVNO ne TONet — locations.js
   Экран локаций: 12 событий, таймеры, заявки
═══════════════════════════════════════════ */

// ── КОНФИГУРАЦИЯ ТИПОВ СОБЫТИЙ ──
const LOC_TYPES = {
  ordinary: {
    name: 'Обычное',
    icon: '🚽',
    color: '#6ade80',
    rolls: 1,
    pieces: 1,
    fee: 1,        // KAK на регистрацию
    maxSlots: 40,
    miningRate: 0.002 // GOVNO/час
  },
  large: {
    name: 'Крупное',
    icon: '🪣',
    color: '#60a5fa',
    rolls: 2,
    pieces: 2,
    fee: 2,
    maxSlots: 30,
    miningRate: 0.004
  },
  massive: {
    name: 'Масштабное',
    icon: '🏗️',
    color: '#f472b6',
    rolls: 3,
    pieces: 3,
    fee: 4,
    maxSlots: 20,
    miningRate: 0.006
  },
  global: {
    name: 'Глобальное',
    icon: '👑',
    color: '#e8c040',
    rolls: 4,
    pieces: 4,
    fee: 8,
    maxSlots: 10,
    miningRate: 0.008
  }
};

// ── СОСТОЯНИЕ ИГРОКА (мок-данные) ──
const playerState = {
  rolls: 7,       // рулоны
  pieces: 42,     // KAK
  govno: 1284.50, // баланс
  joinedLocations: new Set() // ID локаций, в которых участвует
};

// ── ГЕНЕРАЦИЯ 12 СОБЫТИЙ ──
// Цикл: ordinary, large, massive, global повторяется
const TYPE_CYCLE = ['ordinary', 'large', 'massive', 'global'];

function generateLocations() {
  const now = Date.now();
  const locations = [];
  const cities = [
    'Moscow', 'Berlin', 'Tokyo', 'Paris', 'London',
    'Dubai', 'New York', 'Seoul', 'Rome', 'Sydney',
    'Singapore', 'Istanbul'
  ];

  for (let i = 0; i < 12; i++) {
    const type = TYPE_CYCLE[i % 4];
    const cfg  = LOC_TYPES[type];

    // i=0 вверху — меньше всего времени (скоро закроется)
    // i=11 внизу — максимум 12 часов (только добавилось)
    // Шаг: каждая следующая карточка ~1 час дольше
    const hoursLeft = i + 1; // 1ч, 2ч, 3ч ... 12ч
    const secondsLeft = hoursLeft * 3600 - Math.floor(Math.random() * 1800);
    const endsAt = now + secondsLeft * 1000;

    const filled = Math.floor(Math.random() * 95); // участников всегда из 100

    // Случайный бонус раз в день на один номинал
    const isBonus = Math.random() < 0.08; // ~8% шанс

    locations.push({
      id: `loc_${i}_${now}`,
      type,
      city: cities[i],
      endsAt,
      filled,
      maxSlots: cfg.maxSlots,
      isBonus,
      bonusPct: isBonus ? (5 + Math.floor(Math.random() * 11)) : 0, // 5–15%
      participantCap: 100, // участников всегда из 100
      status: 'open', // open | exchange | closed
      isNewest: i === 11
    });
  }
  return locations;
}

let locationsData = generateLocations();
let locTimerInterval = null;
let activeFilter = 'all';

// ── РЕНДЕР ОДНОЙ КАРТОЧКИ ──
function renderLocCard(loc) {
  const cfg = LOC_TYPES[loc.type];
  const isJoined   = playerState.joinedLocations.has(loc.id);
  const cap        = loc.participantCap || 100;
  const isFull     = loc.filled >= cap;
  const isClosed   = loc.status === 'closed';
  const isExchange = loc.status === 'exchange';
  const fillPct    = Math.min((loc.filled / cap) * 100, 100);

  // Кнопка
  let btnHtml = '';
  if (isExchange) {
    btnHtml = `<button class="loc-action-btn closed" disabled>📈 НА БИРЖЕ</button>`;
  } else if (isClosed) {
    btnHtml = `<button class="loc-action-btn closed" disabled>🔒 ЗАКРЫТО</button>`;
  } else if (isFull) {
    btnHtml = `<button class="loc-action-btn full" disabled>🚫 МЕСТа НЕТ</button>`;
  } else if (isJoined) {
    btnHtml = `<button class="loc-action-btn joined" onclick="leaveLocation('${loc.id}')">
      ✅ УБРАТЬ РУЛОН
    </button>`;
  } else {
    btnHtml = `<button class="loc-action-btn" onclick="joinLocation('${loc.id}')">
      🚽 ВНЕСТИ РУЛОН
    </button>`;
  }

  // Бонус-бейдж
  const bonusBadge = loc.isBonus
    ? `<span class="loc-bonus-badge">🔥 +${loc.bonusPct}%</span>`
    : '';

  // Классы карточки
  let cardClasses = `loc-card`;
  if (loc.type)      cardClasses += ` loc-type-${loc.type}`;
  if (isJoined)      cardClasses += ` player-joined`;
  if (loc.isBonus)   cardClasses += ` bonus-active`;
  if (loc.isNewest)  cardClasses += ` newest-card`;
  if (isExchange)    cardClasses += ` status-exchange`;

  return `
  <div class="${cardClasses}" data-id="${loc.id}" data-type="${loc.type}">
    <div class="loc-card-top">
      <div class="loc-card-left">
        <div class="loc-type-icon">${cfg.icon}</div>
        <div class="loc-title-block">
          <div class="loc-type-name">${cfg.name} ${bonusBadge}</div>
          <div class="loc-location-name">📍 ${loc.city}</div>
        </div>
      </div>
      <div class="loc-timer-block">
        <div class="loc-timer-label">ОСТАЛОСЬ</div>
        <div class="loc-timer-val" id="timer_${loc.id}">--:--:--</div>
      </div>
    </div>

    <div class="loc-card-mid">
      <div class="loc-stats">
        <div class="loc-stat">
          <div class="loc-stat-label">Участников</div>
          <div class="loc-stat-val" id="filled_${loc.id}">
            ${loc.filled}<span class="stat-unit">/ 100</span>
          </div>
        </div>
        <div class="loc-stat">
          <div class="loc-stat-label">Майнинг/ч</div>
          <div class="loc-stat-val">${cfg.miningRate.toFixed(3)}<span class="stat-unit">GOVNO</span></div>
        </div>
      </div>
      <div class="loc-slots-block">
        <div class="loc-slots-txt">
          <span class="slots-cur" id="slots_${loc.id}">${loc.filled}</span>
          <span style="color:var(--text-dim);font-size:10px;">/ 100 участников</span>
        </div>
        <div class="loc-slots-bar">
          <div class="loc-slots-fill ${isFull ? 'full' : ''}" 
               id="bar_${loc.id}" 
               style="width:${fillPct}%"></div>
        </div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:2px;text-align:right;">
          🎲 разыгрывается: <span style="color:var(--amber);font-weight:700;">${cfg.maxSlots} мест</span>
        </div>
      </div>
    </div>

    <div class="loc-card-bot">
      <div class="loc-cost-block">
        <div class="loc-cost-icon">🧻</div>
        <div class="loc-cost-info">
          <div class="loc-cost-main">
            ${cfg.rolls} рулон${cfg.rolls > 1 ? 'а' : ''} + ${cfg.pieces} KAK
          </div>
          <div class="loc-cost-fee">Сбор: ${cfg.fee} KAK (не возвращается)</div>
        </div>
      </div>
      ${btnHtml}
    </div>
  </div>`;
}

// ── РЕНДЕР ВСЕГО СПИСКА ──
function renderLocationsList() {
  const container = document.getElementById('locList');
  if (!container) return;

  const filtered = activeFilter === 'all'
    ? locationsData
    : locationsData.filter(l => l.type === activeFilter);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="loc-card-skeleton">
      <span class="loc-skeleton-txt">⚙ Нет событий этого типа</span>
    </div>`;
    return;
  }

  // Первые 3 карточки вверху — горят (меньше всего времени)
  // Остальные — ожидают своей очереди
  let html = `<div class="loc-section-divider">
    <span class="loc-section-divider-line"></span>
    <span class="loc-section-divider-text">🔥 Закрываются скоро</span>
    <span class="loc-section-divider-line"></span>
  </div>`;

  filtered.forEach((loc, i) => {
    if (i === 3) {
      html += `<div class="loc-section-divider">
        <span class="loc-section-divider-line"></span>
        <span class="loc-section-divider-text">⏳ Ожидают очереди</span>
        <span class="loc-section-divider-line"></span>
      </div>`;
    }
    html += renderLocCard(loc);
  });

  container.innerHTML = html;
  updateTimersDOM();
}

// ── ОБНОВЛЕНИЕ ТАЙМЕРОВ ──
function updateTimersDOM() {
  const now = Date.now();
  locationsData.forEach(loc => {
    const el = document.getElementById(`timer_${loc.id}`);
    if (!el) return;

    const diff = Math.max(0, loc.endsAt - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    // Срочность < 5 минут
    if (diff < 300000 && diff > 0) {
      el.classList.add('urgent');
    } else {
      el.classList.remove('urgent');
    }

    // Истёкшую переводим в биржу
    if (diff <= 0 && loc.status === 'open') {
      loc.status = 'exchange';
      // Через 30 сек после биржи — закрыть и добавить новую (мок)
      setTimeout(() => {
        loc.status = 'closed';
        addNewLocation();
        renderLocationsList();
        if (typeof showToast === 'function') showToast('🆕 Добавлено новое событие!');
      }, 30000);
      renderLocationsList();
    }
  });
}

// ── ДОБАВЛЕНИЕ НОВОЙ ЛОКАЦИИ (сдвиг списка) ──
function addNewLocation() {
  // Убираем самую верхнюю (первую)
  locationsData.shift();

  // Добавляем новую снизу
  const now = Date.now();
  const typeIdx = Math.floor(Math.random() * 4);
  const type = TYPE_CYCLE[typeIdx];
  const cfg  = LOC_TYPES[type];
  const cities = ['Bangkok', 'Cairo', 'Mumbai', 'Lagos', 'Buenos Aires', 'Toronto'];
  const city = cities[Math.floor(Math.random() * cities.length)];

  locationsData.push({
    id: `loc_new_${now}`,
    type,
    city,
    endsAt: now + 12 * 3600 * 1000,
    filled: 0,
    maxSlots: cfg.maxSlots,
    isBonus: Math.random() < 0.08,
    bonusPct: 5 + Math.floor(Math.random() * 11),
    status: 'open',
    isNewest: true
  });

  // Сбрасываем флаг newest у всех кроме последней
  locationsData.forEach((l, i) => { l.isNewest = (i === locationsData.length - 1); });
}

// ── ВСТУПЛЕНИЕ В ЛОКАЦИЮ ──
function joinLocation(locId) {
  const loc = locationsData.find(l => l.id === locId);
  if (!loc) return;

  const cfg = LOC_TYPES[loc.type];

  // Проверка баланса
  const cap = loc.participantCap || 100;
  if (loc.filled >= cap) {
    showToast('❌ Событие заполнено — 100 участников!');
    return;
  }
  if (playerState.pieces < cfg.fee) {
    showToast(`❌ Недостаточно KAK! Нужно ${cfg.fee}`);
    return;
  }
  if (playerState.rolls < cfg.rolls) {
    showToast(`❌ Недостаточно рулонов! Нужно ${cfg.rolls}`);
    return;
  }

  // Показываем модальное подтверждение
  showJoinConfirm(loc, cfg, () => {
    // Безвозвратно списываем KAK (регистрационный сбор)
    playerState.pieces -= cfg.fee;

    // Рулоны уходят в заморозку (не списываются — вернутся если не выиграл)
    playerState.rolls -= cfg.rolls;

    // Добавляем в заявки
    playerState.joinedLocations.add(locId);
    loc.filled = Math.min(loc.filled + 1, cap);

    // Обновляем баланс в шапке
    updateLocBalanceUI();

    // Обновляем карточку
    const card = document.querySelector(`[data-id="${locId}"]`);
    if (card) card.outerHTML = renderLocCard(loc);

    showToast(`✅ Заявка подана! ${cfg.rolls} рулон${cfg.rolls > 1 ? 'а' : ''} заморожен${cfg.rolls > 1 ? 'ы' : ''}.`);

    if (window.Telegram?.WebApp?.HapticFeedback) {
      try { window.Telegram.WebApp.HapticFeedback.impactOccurred('medium'); } catch(e) {}
    }
  });
}

// ── МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ──
function showJoinConfirm(loc, cfg, onConfirm) {
  // Удаляем предыдущий модал если есть
  document.getElementById('joinConfirmModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'joinConfirmModal';
  
  modal.innerHTML = `
    <div class="jc-overlay" id="jcOverlay">
      <div class="jc-modal">

        <div class="jc-header">
          <span class="jc-icon">${cfg.icon}</span>
          <div class="jc-title-block">
            <div class="jc-type">${cfg.name} событие</div>
            <div class="jc-city">📍 ${loc.city}</div>
          </div>
        </div>

        <div class="jc-divider"></div>

        <div class="jc-row">
          <span class="jc-row-label">🧻 Рулоны</span>
          <span class="jc-row-val freeze">
            🔒 ${cfg.rolls} рулон${cfg.rolls > 1 ? 'а' : ''} — заморозка
          </span>
        </div>
        <div class="jc-note freeze-note">
          Вернутся, если не получишь место
        </div>

        <div class="jc-row" style="margin-top:10px;">
          <span class="jc-row-label">💩 KAK</span>
          <span class="jc-row-val burn">
            🔥 ${cfg.fee} KAK — безвозвратно
          </span>
        </div>
        <div class="jc-note burn-note">
          Регистрационный сбор не возвращается
        </div>

        <div class="jc-divider"></div>

        <div class="jc-prize-row">
          <span class="jc-prize-label">🎲 Разыгрывается</span>
          <span class="jc-prize-val">${cfg.maxSlots} мест из 100</span>
        </div>

        <div class="jc-buttons">
          <button class="jc-btn jc-cancel" id="jcCancel">Отмена</button>
          <button class="jc-btn jc-confirm" id="jcConfirm">✅ Подтвердить</button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Закрытие по оверлею
  document.getElementById('jcOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'jcOverlay') modal.remove();
  });

  document.getElementById('jcCancel').addEventListener('click', () => modal.remove());

  document.getElementById('jcConfirm').addEventListener('click', () => {
    modal.remove();
    onConfirm();
  });

  // Haptic при открытии
  if (window.Telegram?.WebApp?.HapticFeedback) {
    try { window.Telegram.WebApp.HapticFeedback.impactOccurred('light'); } catch(e) {}
  }
}

// ── ОТЗЫВ ЗАЯВКИ ──
function leaveLocation(locId) {
  const loc = locationsData.find(l => l.id === locId);
  if (!loc) return;

  const cfg = LOC_TYPES[loc.type];

  // Возвращаем рулон (но НЕ KAK — они не возвращаются)
  playerState.rolls += cfg.rolls;
  playerState.joinedLocations.delete(locId);
  loc.filled = Math.max(0, loc.filled - 1);

  updateLocBalanceUI();

  const card = document.querySelector(`[data-id="${locId}"]`);
  if (card) card.outerHTML = renderLocCard(loc);

  showToast(`↩️ Рулон возвращён. Сбор (KAK) не возвращается.`);
}

// ── ОБНОВЛЕНИЕ БАЛАНСА В ШАПКЕ ──
function updateLocBalanceUI() {
  const rollsEl  = document.getElementById('locBalanceRolls');
  const piecesEl = document.getElementById('locBalancePieces');
  const govnoEl  = document.getElementById('locBalanceGovno');
  if (rollsEl)  rollsEl.textContent  = playerState.rolls;
  if (piecesEl) piecesEl.textContent = playerState.pieces;
  if (govnoEl)  govnoEl.textContent  = playerState.govno.toFixed(2);
}

// ── ФИЛЬТРАЦИЯ ──
function setLocFilter(type) {
  // Если нажали на ту же кнопку, которая уже активна — сбрасываем на 'all'
  if (activeFilter === type) {
    activeFilter = 'all';
  } else {
    activeFilter = type;
  }

  // Убираем класс active у всех кнопок и добавляем только выбранной
  document.querySelectorAll('.loc-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === activeFilter && activeFilter !== 'all');
  });

  // Перерисовываем список
  renderLocationsList();
}

// ── ЗАПУСК ──
function initLocationsScreen() {
  renderLocationsList();
  updateLocBalanceUI();

  // Запуск таймеров (каждую секунду)
  if (locTimerInterval) clearInterval(locTimerInterval);
  locTimerInterval = setInterval(updateTimersDOM, 1000);
}

// ── ВЫЗОВ ПРИ ПЕРЕКЛЮЧЕНИИ ВКЛАДКИ ──
// В app.js в switchTab добавить: else if (tab === 'locations') { initLocationsScreen(); }