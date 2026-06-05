/* ═══════════════════════════════════════════
   GOVNO ne TONet — maps.js
   Логика строительства объектов с динамическим JS-масштабированием
═══════════════════════════════════════════ */

let placedCabins = [];
let activeCabinTimers = {};
let citiesLayer = L.layerGroup();
let eventsLayer = L.layerGroup();
let cabinsLayer = L.layerGroup();
let districtsLayer = L.layerGroup();
let slotsLayer = L.layerGroup();

// Бесплатные тайлы с английскими названиями
const THEMES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};

const TEST_LOCATIONS = [
{
  country: "Россия",

  city: "Москва",

  districts: [

    {
      id: 1,

      name: "Тверской",

      lat: 55.7608,
      lng: 37.6115,

      events: [
        {
          id: 101,
          title: "Праздник Большого Рулона"
        }
      ]
    },   

  ]
}
];

let currentTheme = 'light';
let currentTileLayer = null;

const OBJECT_TYPES_CONFIG = {
  taz:   { name: 'Кабинка', income: '0.1', img: 'img/taz.png', emoji: '🚽' },
  gold:  { name: 'Золотой', income: '0.5', img: 'img/taz.png', emoji: '👑' },
  super: { name: 'Супер',   income: '2.5', img: 'img/taz.png', emoji: '⚡' }
};

const CABIN_LIFETIME = 60 * 1000;

function initGameMap() {
  if (window.myLeafletMap) {
    window.myLeafletMap.invalidateSize();
    return;
  }

  window.myLeafletMap = L.map('mapContainer', {
    center: [30, 10],

    zoom: 4,

    minZoom: 4,
    maxZoom: 16,

    zoomControl: false,
    attributionControl: false,

    zoomDelta: 1,
    zoomSnap: 1,

    wheelPxPerZoomLevel: 25,
    wheelDebounceTime: 20
  });

  // ✅ CartoDB Voyager — бесплатно, без ключа, всегда английский
  currentTileLayer = L.tileLayer(THEMES.light, {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  }).addTo(window.myLeafletMap);
  citiesLayer.addTo(window.myLeafletMap);
  eventsLayer.addTo(window.myLeafletMap);
  cabinsLayer.addTo(window.myLeafletMap);
  districtsLayer.addTo(window.myLeafletMap);
  slotsLayer.addTo(window.myLeafletMap);
  
  window.myLeafletMap.whenReady(() => {
    updateAllCabinVisibility();
    updateAllSlotVisibility();
    updateZoomLayers();
  });

  window.myLeafletMap.on('zoomend', updateAllCabinVisibility);
  window.myLeafletMap.on( 'zoomend', updateAllSlotVisibility);
  window.myLeafletMap.on('zoomend', updateZoomLayers);  
  createTestLocations();
  loadSavedCabins();
}

function updateZoomLayers() {

  const zoom =
    window.myLeafletMap.getZoom();

  // Мир

  if (zoom <= 4) {

    window.myLeafletMap.addLayer(eventsLayer);

    window.myLeafletMap.removeLayer(
      districtsLayer
    );

    window.myLeafletMap.removeLayer(
      slotsLayer
    );

    window.myLeafletMap.removeLayer(
      cabinsLayer
    );
  }

  // Город

  else if (zoom === 5) {

    window.myLeafletMap.addLayer(eventsLayer);

    window.myLeafletMap.removeLayer(
      districtsLayer
    );

    window.myLeafletMap.removeLayer(
      slotsLayer
    );

    window.myLeafletMap.removeLayer(
      cabinsLayer
    );
  }

  // Район

  else if (zoom === 6) {

    window.myLeafletMap.addLayer(eventsLayer);

    window.myLeafletMap.addLayer(
      districtsLayer
    );

    window.myLeafletMap.removeLayer(
      slotsLayer
    );

    window.myLeafletMap.removeLayer(
      cabinsLayer
    );
  }

  // Места

  else if (zoom === 7) {

    window.myLeafletMap.addLayer(eventsLayer);

    window.myLeafletMap.addLayer(
      districtsLayer
    );

    window.myLeafletMap.addLayer(
      slotsLayer
    );

    window.myLeafletMap.removeLayer(
      cabinsLayer
    );
  }

  // Кабинки

  else {

    window.myLeafletMap.addLayer(eventsLayer);

    window.myLeafletMap.addLayer(
      districtsLayer
    );

    window.myLeafletMap.addLayer(
      slotsLayer
    );

    window.myLeafletMap.addLayer(
      cabinsLayer
    );
  }
}

function updateAllCabinVisibility() {
  if (!window.myLeafletMap) return;
  const currentZoom = window.myLeafletMap.getZoom();
  const mapContainer = document.getElementById('mapContainer');

  if (currentZoom >= 8) {
    mapContainer.classList.add('show-map-timers');
  } else {
    mapContainer.classList.remove('show-map-timers');
  }

  window.myLeafletMap.eachLayer((layer) => {
    if (layer instanceof L.Marker && layer.options.isCabin) {
      if (currentZoom < 3) {
        layer.setOpacity(0);
        return;
      }
      layer.setOpacity(1);

      if (!layer._icon) return;

      const wrapper = layer._icon.querySelector('.cabin-icon-wrapper');
      if (wrapper) {
        const isBig = currentZoom >= 8;
        wrapper.style.width  = isBig ? '40px' : '8px';
        wrapper.style.height = isBig ? '40px' : '8px';
        wrapper.classList.toggle('size-full', isBig);
        wrapper.classList.toggle('size-dot',  !isBig);

        const badge = wrapper.querySelector('.cabin-badge');
        if (badge) badge.style.display = isBig ? 'block' : 'none';
      }
    }
  });
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
    document.getElementById('mapOverlayHint').innerHTML =
      `<span>Режим установки: Кликни на карту, чтобы поставить ${config.name} ${config.emoji}</span>`;
  }

  if (window.Telegram?.WebApp?.HapticFeedback) {
    try {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
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

function placeToiletCabin(lat, lng, type = 'taz', expiresAt) {
  if (!window.myLeafletMap) return;

  const timeLeft = expiresAt - Date.now();
  if (timeLeft <= 0) return;

  const config = OBJECT_TYPES_CONFIG[type] || OBJECT_TYPES_CONFIG.taz;
  const iconHtml = `<div class="cabin-icon-wrapper">
    <img src="${config.img}" class="cabin-img">
    ${type !== 'taz' ? `<span class="cabin-badge">${config.emoji}</span>` : ''}
  </div>`;

  const toiletIcon = L.divIcon({
    html: iconHtml,
    className: 'zoomable-cabin-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  const cabinId = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
  const marker = L.marker([lat, lng], {
    icon: toiletIcon,
    isCabin: true
  });
  cabinsLayer.addLayer(marker);
  
  marker.on('click', () => window.removeCabin(lat, lng));

  if (!placedCabins.some(c => c.lat === lat && c.lng === lng)) {
    placedCabins.push({ lat, lng, type, expiresAt });
    saveCabinsToStorage();
    if (typeof showToast === 'function') {
      showToast(`🚀 ${config.name} успешно введен в эксплуатацию!`);
    }
  }

  setTimeout(() => {

    autoDestroyCabin(
      lat,
      lng
    );

  }, timeLeft);

  updateAllCabinVisibility();
  
}

function autoDestroyCabin(lat, lng) {
  removeCabinFromMap(lat, lng);
  if (typeof showToast === 'function') {
    showToast('⏱️ Время эксплуатации объекта истекло.');
  }
}

window.removeCabin = function(lat, lng) {
  if (!confirm('Вы уверены, что хотите демонтировать этот объект?')) return;
  removeCabinFromMap(lat, lng);
  if (typeof showToast === 'function') showToast('💥 Объект успешно ликвидирован');
  if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
  }
};

function removeCabinFromMap(lat, lng) {
  placedCabins = placedCabins.filter(
    c => !(Math.abs(c.lat - lat) < 0.0005 && Math.abs(c.lng - lng) < 0.0005)
  );
  saveCabinsToStorage();

  const cabinId = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
  if (activeCabinTimers[cabinId]) {
    clearInterval(activeCabinTimers[cabinId]);
    delete activeCabinTimers[cabinId];
  }

  if (window.myLeafletMap) {
    window.myLeafletMap.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.options.isCabin) {
        const pos = layer.getLatLng();
        if (Math.abs(pos.lat - lat) < 0.0005 && Math.abs(pos.lng - lng) < 0.0005) {
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
      if (obj.expiresAt && obj.expiresAt > Date.now()) {
        placeToiletCabin(obj.lat, obj.lng, obj.type || 'taz', obj.expiresAt);
      }
    });
    placedCabins = coordsArray.filter(obj => obj.expiresAt > Date.now());
    saveCabinsToStorage();
  } catch (err) {
    console.error("Ошибка загрузки объектов", err);
  }
}

function toggleMapTheme() {
  if (!window.myLeafletMap || !currentTileLayer) return;

  currentTheme = (currentTheme === 'light') ? 'dark' : 'light';

  const btn = document.getElementById('mapThemeBtn');
  if (btn) btn.innerHTML = currentTheme === 'light'
    ? '<span class="toggle-icon">🌙</span>'
    : '<span class="toggle-icon">☀️</span>';

  window.myLeafletMap.removeLayer(currentTileLayer);

  // Оба варианта — CartoDB, бесплатно, всегда английский
  currentTileLayer = L.tileLayer(THEMES[currentTheme], {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  }).addTo(window.myLeafletMap);

  if (window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
  }
}

function initGlobalMap() {
  initGameMap();
}

document.addEventListener('DOMContentLoaded', initGameMap);

function createTestLocations() {

  TEST_LOCATIONS.forEach(city => {

    city.districts.forEach(district => {
      
      district.events.forEach(event => {

        const eventMarker =
          L.circleMarker(
            [district.lat, district.lng],
            {
              radius: 1,
              color: '#ffd700',
              fillColor: '#ffd700',
              fillOpacity: 0.8
            }
          );

        eventMarker.bindPopup(`
          <b>${event.title}</b><br>
          ${city.country},
          ${city.city},
          ${district.name}
        `);

        eventsLayer.addLayer(
          eventMarker
        );
      });

      generateDistrictSlots(
        district,
        35
      );

    });

  });

}

function generateClusterCenters(count) {

  const centers = [];

  const spread = 0.08;
  const minDistance = 0.015;

  let attempts = 0;

  while (
    centers.length < count &&
    attempts < 1000
  ) {

    const x =
      (Math.random() - 0.5) * spread;

    const y =
      (Math.random() - 0.5) * spread;

    const tooClose = centers.some(([cx, cy]) => {

      const dx = cx - x;
      const dy = cy - y;

      return Math.sqrt(
        dx * dx + dy * dy
      ) < minDistance;

    });

    if (!tooClose) {
      centers.push([x, y]);
    }

    attempts++;

  }

  console.log(
    'clusters:',
    centers.length
  );

  return centers;

}

function generateDistrictSlots(
  district,
  winners = 25
) {

  let clusters;

  switch (winners) {

    case 15:
      clusters = generateClusterCenters(3);
      break;

    case 20:
      clusters = generateClusterCenters(4);
      break;

    case 25:
      clusters = generateClusterCenters(5);
      break;

    case 35:
      clusters = generateClusterCenters(7);
      break;

    default:
      clusters = generateClusterCenters(5);

  }

  let slotIndex = 0;

  clusters.forEach(([dx, dy]) => {

    const points = createCluster(
      district.lat + dy,
      district.lng + dx
    );

    points.forEach(([lat, lng]) => {

      const slot = L.circleMarker(
        [lat, lng],
        {
          color: '#6befff',
          weight: 1,
          fillColor: '#6befff',
          fillOpacity: 0.15,
          isSlot: true
        }
      );

      slot.on('click', () => {

        openSlotMenu(
          slot,
          district,
          slotIndex
        );

      });

      slotsLayer.addLayer(slot);

      slotIndex++;

    });

  });

}

function openSlotMenu(
  slot,
  district,
  slotIndex
) {

  const pos =
    slot.getLatLng();

  L.popup({
    closeButton: true
  })
  .setLatLng(pos)
  .setContent(`

    <div class="slot-popup">

      <b>${district.name}</b>

      <br>

      Свободное место

      <br><br>

      <button
        onclick="
          buildCabin(
            ${pos.lat},
            ${pos.lng}
          )
        "
      >
        🚽 Поставить кабинку
      </button>

    </div>

  `)
  .openOn(
    window.myLeafletMap
  );
}

function buildCabin(
  lat,
  lng
) {

  const expiresAt =
    Date.now() +
    CABIN_LIFETIME;

  placeToiletCabin(
    lat,
    lng,
    'taz',
    expiresAt
  );

  window.myLeafletMap.closePopup();
}

function updateAllSlotVisibility() {

  if (!window.myLeafletMap) return;

  const zoom =
    window.myLeafletMap.getZoom();

  slotsLayer.eachLayer(layer => {

    if (!layer.options.isSlot) return;

    let radius = 0.5;
    let opacity = 0.05;

    if (zoom >= 8) {
      radius = 1;
      opacity = 0.15;
    }

    if (zoom >= 9) {
      radius = 2;
      opacity = 0.4;
    }

    if (zoom >= 10) {
      radius = 3;
      opacity = 0.55;
    }

    if (zoom >= 12) {
      radius = 5;
      opacity = 0.7;
    }

    if (zoom >= 14) {
      radius = 10;
      opacity = 0.85;
    }

    if (zoom >= 16) {
      radius = 20;
      opacity = 1;
    }

    layer.setRadius(radius);

    layer.setStyle({
      fillOpacity: opacity,
      opacity: opacity
    });

  });

}

function createCluster(
  centerLat,
  centerLng
) {

  const d = 0.0035;

  return [

    [centerLat, centerLng],

    [centerLat + d, centerLng],
    [centerLat - d, centerLng],

    [centerLat, centerLng + d],
    [centerLat, centerLng - d]

  ];

}