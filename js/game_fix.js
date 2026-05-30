// Патч: заменяем showFlushAnim на исправленную версию
// Вставляется в конец game.js — перезаписывает функцию

function showFlushAnim(num, isWin, cb) {
  const anim   = document.getElementById('flushAnim');
  const inner  = anim.querySelector('.fa-inner');
  const result = document.getElementById('faResult');
  const toilet = document.getElementById('faToilet');
  const swirl  = document.getElementById('faSwirl');

  // ── ПОЛНЫЙ СБРОС перед каждым запуском ──
  anim.querySelectorAll('.fa-caption, .fa-prize').forEach(e => e.remove());
  result.classList.add('hidden');
  result.textContent = '';
  toilet.textContent = '🚽';
  swirl.style.display = 'none';
  swirl.style.opacity = '1';
  anim.classList.remove('hidden');

  // Фаза 1: унитаз трясётся
  setTimeout(() => {
    swirl.style.display = 'block';
  }, 400);

  // Фаза 2: результат появляется
  setTimeout(() => {
    swirl.style.display = 'none';
    toilet.textContent  = isWin ? '💩' : '🪰';

    result.classList.remove('hidden');

    const cap = document.createElement('div');
    cap.className   = `fa-caption ${isWin ? 'win' : 'lose'}`;
    cap.textContent = isWin ? 'Выигрыш!' : 'Пусто...';
    inner.appendChild(cap);

    if (isWin) {
      const openedWins   = Object.values(state.opened).filter(v => v === 'won').length;
      const prizePercent = getPrizePercent(GAME.players, openedWins);
      const prize        = (parseFloat(PRIZE_POOL) * prizePercent / 100).toFixed(3);

      const prizeEl       = document.createElement('div');
      prizeEl.className   = 'fa-prize';
      prizeEl.textContent = `+${prize} GOVNO`;
      inner.appendChild(prizeEl);

      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else {
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
    }
  }, 900);

  // Фаза 3: закрываем + чистим остатки
  setTimeout(() => {
    anim.classList.add('hidden');
    // Убираем созданные элементы ПОСЛЕ скрытия
    anim.querySelectorAll('.fa-caption, .fa-prize').forEach(e => e.remove());
    result.classList.add('hidden');
    cb();
  }, 2300);
}
