/* ═══════════════════════════════════════════
   GOVNO ne TONet — app.js
   Telegram Mini App логика
═══════════════════════════════════════════ */

// ── Инициализация Telegram WebApp ──
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand(); // Разворачиваем на весь экран
  tg.setHeaderColor('#0e0a06');
  tg.setBackgroundColor('#0e0a06');
}

// ── ЗВУК МЕНЮ ──
const menuClick = new Audio('sounds/menu_click.ogg');
menuClick.preload = 'auto';
menuClick.volume = 0.6;

function playMenuClick() {
  menuClick.currentTime = 0;
  menuClick.play().catch(() => {});
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
  playMenuClick();
  // Проверяем: кошелёк подключён?
  if (!walletConnected) {
    // Для тестирования — автоподключение
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

  // Лёгкая вибрация (если поддерживается)
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

// ── Переключение вкладок ──
function switchTab(btn, tab) {
  playMenuClick();
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (tab !== 'home') {
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
    seconds = Math.max(0, seconds - 1);
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    const txt = seconds > 0 ? `Старт через ${m}:${s}` : '🔄 Обновление...';
    document.querySelectorAll('.lobby-timer-txt').forEach(el => {
      el.textContent = txt;
    });
    if (seconds === 0) {
      setTimeout(() => { seconds = 10 * 60; }, 2000); // новая заявка через 10 мин
    }
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

// ── Инициализация ──
document.addEventListener('DOMContentLoaded', () => {
  startLobbyTimers();

  document.getElementById('walletBadge').addEventListener('click', () => {
    playMenuClick();
    if (walletConnected) {
      showToast('💰 Кошелёк уже подключён');
      return;
    }
    // Здесь будет TON Connect 2.0
    // Пока — заглушка
    showToast('🔗 Подключаем TON-кошелёк...');
    setTimeout(() => {
      walletConnected = true;
      const dot = document.querySelector('.wallet-dot');
      const short = document.getElementById('walletShort');
      dot.classList.add('connected');
      short.textContent = 'UQAb...f3Kp';
      showToast('✅ Кошелёк подключён!');
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    }, 1200);
  });

  // Приветственный звук
  if (!sessionStorage.getItem('welcomePlayed')) {
    const welcomeSound = new Audio('sounds/welcome.ogg');
    welcomeSound.preload = 'auto';
    welcomeSound.volume = 0.7;

    const playWelcome = () => {
      welcomeSound.play()
        .then(() => {
          sessionStorage.setItem('welcomePlayed', '1');
        })
        .catch(() => {});
    };

    document.addEventListener('click', playWelcome, { once: true });
    document.addEventListener('touchstart', playWelcome, { once: true });
  }

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

  setTimeout(initFlies, 500);
});

// ── МУХИ ЖУЖЖАТ ──
// Создаём заранее чтобы браузер не блокировал
const buzzSound = new Audio('sounds/buzz.ogg');
buzzSound.preload = 'auto';
buzzSound.volume = 0.5;

function initFlies() {
  document.querySelectorAll('.fly').forEach(fly => {
    fly.style.cursor = 'pointer';
    fly.addEventListener('click', (e) => {
      e.stopPropagation(); // не триггерим welcomeSound
      const buzz = new Audio('sounds/buzz.ogg');
      buzz.volume = 0.5;
      buzz.play().catch(err => console.log('buzz error:', err));
      fly.style.fontSize = '20px';
      setTimeout(() => fly.style.fontSize = '13px', 300);
    });
  });
}