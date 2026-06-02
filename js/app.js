/* ═══════════════════════════════════════════
   GOVNO ne TONet — app.js
   Telegram Mini App логика (Оптимизированная)
═══════════════════════════════════════════ */

// ── Инициализация Telegram WebApp ──
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand(); // Разворачиваем на весь экран
  tg.setHeaderColor('#0e0a06');
  tg.setBackgroundColor('#0e0a06');
}

// ── Toast уведомление ──
let toastEl = null;
function showToast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// ── Кнопка ВОЙТИ ──
function joinLobby(btn, nominal) {
  // Проверяем: кошелёк подключён?
  if (!walletConnected) {
    walletConnected = true;
    document.querySelector('.wallet-dot').classList.add('connected');
    document.getElementById('walletShort').textContent = 'TEST...wallet';
  }

  const card = btn.closest('.lobby-card');
  const alreadyJoined = card.classList.contains('joined');

  if (alreadyJoined) {
    showToast('Ты уже в этой заявке 🚽');
    return;
  }

  // Анимация кнопки
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span> ЖДЁМ...';
  btn.classList.add('joined-state');
  card.classList.add('joined');

  // Обновляем слот (UI-заглушка)
  const filled = card.querySelector('.slots-filled');
  const bar    = card.querySelector('.slots-fill');
  const cur    = parseInt(filled.textContent);
  const next   = Math.min(cur + 1, 10);
  filled.textContent = next;
  bar.style.width = (next * 10) + '%';

  showToast(`✅ Вошёл в заявку на ${nominal} GOVNO!`);

  // Переходим на экран игры через 1.5 сек
  setTimeout(() => {
    const players = parseInt(card.dataset.players) || 10;
    window.location.href = `game.html?nominal=${nominal}&players=${players}`;
  }, 1500);

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred('medium');
  }
}

// ── Подключение кошелька ──
let walletConnected = false;

function highlightWallet() {
  const badge = document.getElementById('walletBadge');
  badge.style.borderColor = '#e8a030';
  badge.style.boxShadow = '0 0 12px rgba(200,150,0,.5)';
  setTimeout(() => {
    badge.style.borderColor = '';
    badge.style.boxShadow = '';
  }, 1500);
}

// ── 🗺️ ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК (БЕЗ КОДА КАРТЫ ВНУТРИ) ──
// ── 🗺️ ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК (ОПТИМИЗИРОВАННОЕ ПОД LEAFLET) ──
function switchTab(btn, tab) {  
  // Убираем активное состояние со всех кнопок навигации
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Скрываем абсолютно все экраны-секции
  document.querySelectorAll('.screen-section').forEach(screen => screen.classList.add('hidden'));

  if (tab === 'home') {
    // Включаем главный экран с лобби
    document.getElementById('screenHome').classList.remove('hidden');
  } 
  else if (tab === 'map') {
    // Включаем экран интерактивной карты
    const mapScreen = document.getElementById('screenMap');
    if (mapScreen) {
      mapScreen.classList.remove('hidden');
    }
    
    // Безопасно вызываем инициализацию из maps.js
    if (typeof initGlobalMap === 'function') {
      // Инициализируем карту, если она еще не создана
      initGlobalMap();
    }

    // КРИТИЧЕСКИЙ ФИКС ДЛЯ LEAFLET:
    // Даем браузеру 150 миллисекунд, чтобы отрисовать блок #screenMap на экране,
    // после чего принудительно заставляем карту обновить свои внутренние размеры.
    setTimeout(() => {
      // Проверяем наличие карты в глобальной области видимости window
      const globalMapInstance = window.myLeafletMap || window.map;
      
      if (globalMapInstance && typeof globalMapInstance.invalidateSize === 'function') {
        globalMapInstance.invalidateSize();
      } else {
        // Если карта уже существует внутри замыкания maps.js, попробуем 
        // стриггерить системное событие изменения размера окна, которое Leaflet перехватит сам
        window.dispatchEvent(new Event('resize'));
      }
    }, 150);
  } 
  else {
    // Для всех остальных нереализованных вкладок (Рейтинг, Билеты)
    document.getElementById('screenHome').classList.remove('hidden'); // Оставляем на главной
    showToast('🚧 Раздел в разработке...');
  }

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.selectionChanged();
  }
}

// ── Таймер лобби (обратный отсчёт) ──
function startLobbyTimers() {
  let seconds = 6 * 60 + 23; // 6:23

  setInterval(() => {
    if (seconds <= 0) {
      seconds = 10 * 60; // Перезапуск на 10 минут
    } else {
      seconds--;
    }

    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    const txt = seconds > 0 ? `Старт через ${m}:${s}` : '🔄 Обновление...';
    
    document.querySelectorAll('.lobby-timer-txt').forEach(el => {
      el.textContent = txt;
    });
  }, 1000);
}

// ── Анимация суммы банка ──
function animateCounter(el, target, duration = 1200) {
  const start = 0;
  const step = (target / duration) * 16;
  let current = start;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (current >= target) clearInterval(timer);
  }, 16);
}

// ── СЕРВЕРНАЯ ИСТОРИЯ ИГР (ИМИТАЦИЯ ЗАГЛУШКИ) ──
function loadServerHistory() {
  const container = document.getElementById('historyContainer');
  if (!container) return;

  const mockServerData = [
    { gameId: 1109, nominal: 2.0, players: 10, result: 'lose', createdAt: new Date() },
    { gameId: 1108, nominal: 0.5, players: 2,  result: 'win',  reward: '1.00', createdAt: new Date(Date.now() - 3600000) },
    { gameId: 1105, nominal: 1.0, players: 5,  result: 'win',  reward: '5.00', createdAt: new Date(Date.now() - 86400000) }
  ];

  setTimeout(() => {
    container.innerHTML = ''; 

    if (mockServerData.length === 0) {
      container.innerHTML = `<div class="history-empty" style="text-align:center; color:#8a7048; padding:15px;">У вас пока нет сыгранных матчей... 🚽</div>`;
      return;
    }

    container.innerHTML = mockServerData.map(match => {
      const isWin = match.result === 'win';
      const badgeColor = isWin ? '#2a6020' : '#8b4513';
      const badgeText = isWin ? 'ПОБЕДА' : 'ОТПЛЫЛ';
      const profitText = isWin ? `+${match.reward}` : `-${match.nominal}`;
      const profitColor = isWin ? '#e8c040' : '#d08050';
      const matchDate = match.createdAt.toLocaleDateString('ru-RU');

      return `
        <div class="history-card" style="display:flex; justify-content:space-between; align-items:center; background:#2a2010; border:1px solid #6a4820; border-radius:8px; padding:10px; margin-bottom:8px; font-size:14px;">
          <div class="hc-left" style="display:flex; flex-direction:column; gap:4px;">
            <div style="font-weight:bold; color:var(--text-gold);">Игра #${match.gameId} <span style="font-size:11px; color:#8a7048; font-weight:normal;">(${matchDate})</span></div>
            <div style="font-size:12px; color:#8a7048;">Номинал: ${match.nominal} GOVNO | Игроков: ${match.players}</div>
          </div>
          <div class="hc-right" style="text-align:right; display:flex; flex-direction:column; gap:4px;">
            <span style="background:${badgeColor}; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold; text-align:center;">${badgeText}</span>
            <span style="color:${profitColor}; font-weight:bold; font-size:13px;">${profitText}</span>
          </div>
        </div>
      `;
    }).join('');
  }, 800);
}

// ── Инициализация приложения ──
document.addEventListener('DOMContentLoaded', () => {
  startLobbyTimers();

  document.getElementById('walletBadge').addEventListener('click', () => {    
    if (walletConnected) {
      showToast('💰 Кошелёк уже подключён');
      return;
    }
    showToast('🔗 Подключаем TON-кошелёк...');
    setTimeout(() => {
      walletConnected = true;
      document.querySelector('.wallet-dot').classList.add('connected');
      document.getElementById('walletShort').textContent = 'UQAb...f3Kp';
      showToast('✅ Кошелёк подключён!');
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    }, 1200);
  });
  
  // Анимируем счётчики банков при загрузке
  setTimeout(() => {
    animateCounter(document.getElementById('weeklyAmount'),  1284.50);
    animateCounter(document.getElementById('monthlyAmount'), 8742.00, 1600);
  }, 300);

  // Приветствие от бота
  const user = tg?.initDataUnsafe?.user;
  if (user?.first_name) {
    setTimeout(() => showToast(`Добро пожаловать, ${user.first_name}! 💩`), 800);
  }

  // Запуск загрузки истории игр
  loadServerHistory();
});

// ── Анимации всплесков частиц какашек ──
function createPoopSplash(event, cardElement) {
  const toiletImg = cardElement.querySelector('.lobby-icon img, .lobby-card img, [src*="taz"]');
  let centerX, centerY;
  
  if (toiletImg) {
    const cardRect = cardElement.getBoundingClientRect();
    const imgRect = toiletImg.getBoundingClientRect();
    centerX = (imgRect.left - cardRect.left) + (imgRect.width / 2);
    centerY = (imgRect.top - cardRect.top) + (imgRect.height / 2);
  } else {
    const rect = cardElement.getBoundingClientRect();
    centerX = event.clientX - rect.left;
    centerY = event.clientY - rect.top;
  }

  const particleCount = 8; 
  const emojis = ['💩', '🟤', '💦']; 

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'poop-splash-particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    
    const angle = Math.random() * Math.PI * 2; 
    const distance = 40 + Math.random() * 60;  
    
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 20; 
    const rot = Math.random() * 360; 

    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);
    particle.style.setProperty('--rot', `${rot}deg`);

    particle.style.left = `${centerX - 10}px`;
    particle.style.top = `${centerY - 10}px`;

    cardElement.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove());
  }
}

function playPoopSplash(event, cardElement) {
  const toiletNode = cardElement.querySelector('.lobby-toilet');
  if (!toiletNode) return;

  const cardRect = cardElement.getBoundingClientRect();
  const toiletRect = toiletNode.getBoundingClientRect();
  
  const centerX = (toiletRect.left - cardRect.left) + (toiletRect.width / 2);
  const centerY = (toiletRect.top - cardRect.top) + (toiletRect.height / 2);

  const particleCount = 8; 
  const items = ['💩', '🟤', '💦'];

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'poop-splash-particle';
    p.textContent = items[Math.floor(Math.random() * items.length)];

    const angle = Math.random() * Math.PI * 2;
    const distance = 35 + Math.random() * 55;
    
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 15; 
    const rot = Math.random() * 360;

    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);
    p.style.setProperty('--rot', `${rot}deg`);

    p.style.left = `${centerX - 10}px`;
    p.style.top = `${centerY - 10}px`;

    cardElement.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}