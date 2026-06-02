/* ═══════════════════════════════════════════
   GOVNO ne TONet — maps.js
   Логика строительства объектов с динамическим JS-масштабированием
═══════════════════════════════════════════ */

// Хранилище для установленных объектов
let placedCabins = [];
// Хранилище для активных JS-таймеров
let activeCabinTimers = {};

// Ссылки на обе темы (Светлая и Темная)
const THEMES = {
  light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};

let currentTheme = 'light'; 
let currentTileLayer = null; 
let selectedObjectType = 'taz'; 

// База данных объектов
const OBJECT_TYPES_CONFIG = {
  taz:   { name: 'Кабинка', income: '0.1',  img: 'img/taz.png',  emoji: '🚽' },
  gold:  { name: 'Золотой',  income: '0.5',  img: 'img/taz.png',  emoji: '👑' },
  super: { name: 'Супер',   income: '2.5',  img: 'img/taz.png',  emoji: '⚡' }
};

// НАСТРОЙКА ВРЕМЕНИ ЖИЗНИ ОБЪЕКТА (1 минута)
const CABIN_LIFETIME = 60 * 1000; 

/**
 * Инициализация карты
 */
function initGameMap() {
  if (window.myLeafletMap) {
    window.myLeafletMap.invalidateSize();
    return;
  }

  window.myLeafletMap = L.map('mapContainer', {
    center: [54.5260, 15.2551],
    zoom: 4,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: false,
    attributionControl: false,
    zoomDelta: 2.0,
    zoomSnap: 1.0,
    wheelPxPerZoomLevel: 10,
    wheelDebounceTime: 40
  });

  currentTileLayer = L.tileLayer(THEMES[currentTheme], {
    subdomains: 'abc',
    maxZoom: 18,
    detectRetina: false
  }).addTo(window.myLeafletMap);

  // ✅ ОБРАБОТЧИК КЛИКА — БЫЛ ПРОПУЩЕН
  window.myLeafletMap.on('click', function(e) {
    if (!selectedObjectType) return;
    const expiresAt = Date.now() + CABIN_LIFETIME;
    placeToiletCabin(e.latlng.lat, e.latlng.lng, selectedObjectType, expiresAt);
    resetBuildSelection();
  });

  window.myLeafletMap.whenReady(() => {
    updateAllCabinVisibility();
  });

  window.myLeafletMap.on('zoomend', updateAllCabinVisibility);
  loadSavedCabins();
}

/**
 * ⚡ УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ ОБЪЕКТОВ
 */
function updateAllCabinVisibility() {
  if (!window.myLeafletMap) return;
  const currentZoom = window.myLeafletMap.getZoom();
  const mapContainer = document.getElementById('mapContainer');

  // Управление отображением таймеров через класс контейнера
  if (currentZoom >= 14) {
    mapContainer.classList.add('show-map-timers');
  } else {
    mapContainer.classList.remove('show-map-timers');
  }

  window.myLeafletMap.eachLayer((layer) => {
    // 1. Проверяем, что это маркер и он наш
    if (layer instanceof L.Marker && layer.options.isCabin) {
      
      // 2. Логика видимости маркера
      if (currentZoom < 6) {
        layer.setOpacity(0);
        return;
      }
      layer.setOpacity(1);

      // 3. Безопасная работа с иконкой
      if (!layer._icon) return; 

      const wrapper = layer._icon.querySelector('.cabin-icon-wrapper');
      if (wrapper) {
        const isBig = currentZoom >= 14;
        
        // Масштабирование через размеры
        wrapper.style.width = isBig ? '40px' : '8px';
        wrapper.style.height = isBig ? '40px' : '8px';
        
        // Классы для стилизации
        wrapper.classList.toggle('size-full', isBig);
        wrapper.classList.toggle('size-dot', !isBig);
        
        // Значок (корона/молния)
        const badge = wrapper.querySelector('.cabin-badge');
        if (badge) badge.style.display = isBig ? 'block' : 'none';
      }
    }
  });
}

/**
 * Управление видимостью таймеров в зависимости от зума
 */
function updateTimerVisibilityByZoom() {
  const currentZoom = window.myLeafletMap.getZoom();
  const mapContainer = document.getElementById('mapContainer');
  
  if (currentZoom >= 14) {
    mapContainer.classList.add('show-map-timers');
  } else {
    mapContainer.classList.remove('show-map-timers');
  }
}

function selectBuildObject(type, element) {
  document.querySelectorAll('.shop-item').forEach(item => item.classList.remove('active-build'));
  
  if (selectedObjectType === type) {
    selectedObjectType = null;
    document.getElementById('mapOverlayHint').innerHTML = '<span>Выберите объект слева для установки 🛠️</span>';
  } else {
    selectedObjectType = type;
    element.classList.add('active-build');
    const config = OBJECT_TYPES_CONFIG[type];
    document.getElementById('mapOverlayHint').innerHTML = `<span>Режим установки: Кликни на карту, чтобы поставить ${config.name} ${config.emoji}</span>`;
  }

  // БЕЗОПАСНАЯ ПРОВЕРКА HAPTIC FEEDBACK
  if (window.Telegram?.WebApp?.HapticFeedback) {
    try {
      // Проверяем версию, если метод поддерживает
      if (typeof window.Telegram.WebApp.isVersionAtLeast === 'function') {
        if (window.Telegram.WebApp.isVersionAtLeast('6.1')) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
      } else {
        // Если метод версии недоступен, просто вызываем (или убираем блок, если совсем не работает)
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    } catch (e) {
      console.warn("Haptic feedback error:", e);
    }
  }
}

function resetBuildSelection() {
  selectedObjectType = null;
  document.querySelectorAll('.shop-item').forEach(item => item.classList.remove('active-build'));
  document.getElementById('mapOverlayHint').innerHTML = '<span>Выберите объект слева для установки 🛠️</span>';
}

/**
 * Функция установки объекта на карту
 */
function placeToiletCabin(lat, lng, type = 'taz', expiresAt) {
  // 1. Проверка на существование карты
  if (!window.myLeafletMap) return;

  // 2. Проверка времени жизни объекта
  const timeLeft = expiresAt - Date.now();
  if (timeLeft <= 0) return; 

  // 3. Получение конфигурации объекта
  const config = OBJECT_TYPES_CONFIG[type] || OBJECT_TYPES_CONFIG.taz;
  const iconHtml = `<div class="cabin-icon-wrapper"><img src="${config.img}" class="cabin-img">${type !== 'taz' ? `<span class="cabin-badge">${config.emoji}</span>` : ''}</div>`;

  // 4. Настройка иконки (корректный размер и привязка к центру)
  const toiletIcon = L.divIcon({
    html: iconHtml, 
    className: 'zoomable-cabin-icon',
    iconSize: [40, 40], 
    iconAnchor: [20, 20]
  });

  // 5. Создание уникального ID и добавление маркера
  const cabinId = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
  const marker = L.marker([lat, lng], { 
      icon: toiletIcon,
      isCabin: true 
  }).addTo(window.myLeafletMap);

  // 6. Прикрепление всплывающего таймера
  marker.bindTooltip(`
    <div class="inline-map-timer">
      ⏱️ <span id="timer_${cabinId}">${Math.ceil(timeLeft / 1000)}s</span>
    </div>
  `, {
    permanent: true,         
    direction: 'bottom',    
    className: 'custom-map-tooltip', 
    offset: [0, 10]          
  });

  // 7. Обработчик клика для удаления
  marker.on('click', () => window.removeCabin(lat, lng));

  // 8. Логика сохранения в массив, если объект новый
  if (!placedCabins.some(c => c.lat === lat && c.lng === lng)) {
    placedCabins.push({ lat, lng, type, expiresAt });
    saveCabinsToStorage();
    
    if (typeof showToast === 'function') {
      showToast(`🚀 ${config.name} успешно введен в эксплуатацию!`);
    }
  }

  // 9. Управление таймером обновления секунд
  if (activeCabinTimers[cabinId]) clearInterval(activeCabinTimers[cabinId]);

  activeCabinTimers[cabinId] = setInterval(() => {
    const currentRemaining = expiresAt - Date.now();
    const timerElement = document.getElementById(`timer_${cabinId}`);
    
    if (timerElement) {
      timerElement.innerText = `${Math.ceil(currentRemaining / 1000)}s`;
    }

    if (currentRemaining <= 0) {
      clearInterval(activeCabinTimers[cabinId]);
      delete activeCabinTimers[cabinId];
      autoDestroyCabin(lat, lng);
    }
  }, 1000);

  // 10. Исправленный вызов обновления видимости и зума
  updateAllCabinVisibility();
  updateTimerVisibilityByZoom();
}

/**
 * Хирургическое удаление объекта (только один маркер)
 */
function removeCabinFromMap(lat, lng) {
  placedCabins = placedCabins.filter(c => !(c.lat === lat && c.lng === lng));
  saveCabinsToStorage();

  const cabinId = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
  if (activeCabinTimers[cabinId]) {
    clearInterval(activeCabinTimers[cabinId]);
    delete activeCabinTimers[cabinId];
  }

  window.myLeafletMap.eachLayer((layer) => {
    if (layer instanceof L.Marker && layer.options.isCabin) {
      const pos = layer.getLatLng();
      if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
        window.myLeafletMap.removeLayer(layer);
      }
    }
  });
}

/**
 * Автоудаление объекта (исправлено: удаляет только один конкретный маркер)
 */
function autoDestroyCabin(lat, lng) {
  // 1. Сначала удаляем логически
  removeCabinFromMap(lat, lng);

  if (typeof showToast === 'function') {
    showToast('⏱️ Время эксплуатации объекта истекло.');
  }
}

/**
 * Ручной демонтаж (исправлено: корректный вызов удаления)
 */
window.removeCabin = function(lat, lng) {
  if (!confirm('Вы уверены, что хотите демонтировать этот объект?')) return;

  removeCabinFromMap(lat, lng);

  if (typeof showToast === 'function') showToast('💥 Объект успешно ликвидирован');
  if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
  }
};

/**
 * Единая функция для точечного удаления (Ключевая правка)
 */
function removeCabinFromMap(lat, lng) {
  // Удаляем из массива
  placedCabins = placedCabins.filter(c => !(c.lat === lat && c.lng === lng));
  saveCabinsToStorage();

  // Удаляем таймер
  const cabinId = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
  if (activeCabinTimers[cabinId]) {
    clearInterval(activeCabinTimers[cabinId]);
    delete activeCabinTimers[cabinId];
  }

  // Удаляем только один слой, соответствующий координатам
  if (window.myLeafletMap) {
    window.myLeafletMap.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.options.isCabin) {
        const pos = layer.getLatLng();
        // Сравниваем координаты с маленькой погрешностью
        if (Math.abs(pos.lat - lat) < 0.00001 && Math.abs(pos.lng - lng) < 0.00001) {
          window.myLeafletMap.removeLayer(layer);
        }
      }
    });
  }
}

function saveCabinsToStorage() {
  localStorage.setItem('toilet_cabins', JSON.stringify(placedCabins));
}

function loadSavedCabins() {
  const saved = localStorage.getItem('toilet_cabins');
  if (!saved) return;
  
  try {
    const coordsArray = JSON.parse(saved);
    coordsArray.forEach(obj => {
      // Важно: проверяем время истечения при загрузке
      if (obj.expiresAt && obj.expiresAt > Date.now()) {
        placeToiletCabin(obj.lat, obj.lng, obj.type || 'taz', obj.expiresAt);
      }
    });
    
    // Очищаем массив от просроченных
    placedCabins = coordsArray.filter(obj => obj.expiresAt > Date.now());
    saveCabinsToStorage();
  } catch (err) {
    console.error("Ошибка загрузки объектов", err);
  }
}

function toggleMapTheme() {
  if (!window.myLeafletMap || !currentTileLayer) return;

  currentTheme = (currentTheme === 'light') ? 'dark' : 'light';
  const subdomainsOption = (currentTheme === 'light') ? 'abc' : 'abcd';
  
  // Обновляем кнопку
  const btn = document.getElementById('mapThemeBtn');
  if (btn) btn.innerHTML = (currentTheme === 'light') ? '<span class="toggle-icon">🌙</span>' : '<span class="toggle-icon">☀️</span>';

  window.myLeafletMap.removeLayer(currentTileLayer);

  currentTileLayer = L.tileLayer(THEMES[currentTheme], {
    subdomains: subdomainsOption,
    maxZoom: 18,
    detectRetina: false
  }).addTo(window.myLeafletMap);

  if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
  }
}

function initGlobalMap() {
  initGameMap();
}