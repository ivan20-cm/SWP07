/* SWP07：原生 JavaScript + Leaflet + OpenStreetMap，直接使用政府即時 JSON。 */
(() => {
  'use strict';
  const API_URL = 'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json';
  const INITIAL_CENTER = [25.0375, 121.5637]; // 臺北市政府，涵蓋信義區周邊。
  const INITIAL_ZOOM = 13;
  const REFRESH_INTERVAL = 60_000;
  const $ = id => document.getElementById(id);
  const numberFormat = new Intl.NumberFormat('zh-TW');
  let map;
  let stationLayer;
  let markers = new Map();
  let loading = false;
  let hasData = false;
  let lastSuccessAt = null;
  let failed = false;

  // API 字串先跳脫，避免外部資料被當成 HTML 執行。
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function count(value) {
    const result = Number(value);
    return Number.isFinite(result) && result >= 0 ? Math.floor(result) : 0;
  }
  function normalizeStation(raw) {
    const lat = Number(raw.latitude ?? raw.lat);
    const lng = Number(raw.longitude ?? raw.lng);
    // 空白經緯度不可被 Number('') 轉成零，且僅接受臺北周邊合理座標。
    if (!raw.sno || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 24.8 || lat > 25.3 || lng < 121.3 || lng > 121.8) return null;
    return {id:String(raw.sno), name:String(raw.sna ?? '未命名站點').replace(/^YouBike2\.0_/, ''), area:String(raw.sarea ?? ''), address:String(raw.ar ?? ''), lat, lng,
      bikes:count(raw.available_rent_bikes ?? raw.sbi), spaces:count(raw.available_return_bikes ?? raw.bemp), capacity:count(raw.Quantity ?? raw.quantity ?? raw.tot),
      active:String(raw.act) === '1', updated:String(raw.infoTime ?? raw.mday ?? raw.updateTime ?? '未提供')};
  }
  function stationState(station) {
    if (!station.active) return {className:'inactive', text:'暫停營運'};
    if (station.bikes === 0) return {className:'empty', text:station.spaces > 0 ? '無車可借，可還車' : '無車可借，無空位可還'};
    return {className:station.bikes <= 5 ? 'low' : 'available', text:station.spaces > 0 ? '營運中' : '營運中，無空位可還'};
  }
  function createIcon(station) {
    const state = stationState(station);
    return L.divIcon({className:'station-icon', html:`<span class="station-pin ${state.className} ${station.active ? '' : 'is-inactive'}">${station.active ? station.bikes : '×'}</span>`, iconSize:[32,32], iconAnchor:[16,16], popupAnchor:[0,-18]});
  }
  function createPopup(station) {
    const state = stationState(station);
    return `<p class="popup-area">${escapeHtml(station.area)} · YouBike 2.0</p><h3 class="popup-title">${escapeHtml(station.name)}</h3><p class="popup-address">${escapeHtml(station.address)}</p><p class="popup-state">${escapeHtml(state.text)}</p><div class="popup-stats"><div><span>可借車輛</span><b>${station.active ? station.bikes : '—'}</b></div><div><span>可還空位</span><b>${station.active ? station.spaces : '—'}</b></div></div><p class="popup-meta">總停車格：${station.capacity} · 站點代號：${escapeHtml(station.id)}</p><p class="popup-meta">站點更新：${escapeHtml(station.updated)}（臺灣時間）</p>`;
  }
  function renderStations(stations) {
    const nextIds = new Set();
    let bikes = 0;
    let spaces = 0;
    stations.forEach(station => {
      nextIds.add(station.id);
      if (station.active) {bikes += station.bikes; spaces += station.spaces;}
      let marker = markers.get(station.id);
      if (marker) {
        marker.setLatLng([station.lat,station.lng]);
        marker.setIcon(createIcon(station));
        marker.setPopupContent(createPopup(station));
        marker.options.title = station.name;
      } else {
        marker = L.marker([station.lat,station.lng], {icon:createIcon(station), title:station.name, alt:`${station.name}站點`, keyboard:true})
          .bindPopup(createPopup(station), {maxWidth:300}).addTo(stationLayer);
        markers.set(station.id, marker);
      }
      const icon = marker.getElement();
      if (icon) icon.setAttribute('aria-label', `${station.name}，${station.active ? `可借 ${station.bikes} 輛，可還 ${station.spaces} 位` : '暫停營運'}`);
    });
    // 來源移除的站點也同步移除，保留使用者目前地圖位置與已開啟的 Popup。
    markers.forEach((marker,id) => {if (!nextIds.has(id)) {stationLayer.removeLayer(marker); markers.delete(id);}});
    $('station-count').textContent = numberFormat.format(stations.length);
    $('bike-count').textContent = numberFormat.format(bikes);
    $('space-count').textContent = numberFormat.format(spaces);
  }
  function updateStatus() {
    if (loading) {$('status-text').textContent = hasData ? '正在更新站點資料…' : '正在取得站點資料…'; return;}
    if (!hasData) {$('status-text').textContent = '尚未取得即時資料'; return;}
    const age = Date.now() - lastSuccessAt;
    const stale = age > REFRESH_INTERVAL * 2;
    $('status-dot').className = `status-dot ${failed || stale ? 'error' : 'ready'}`;
    $('status-text').textContent = failed ? '更新失敗，顯示上次成功資料' : stale ? '資料已超過 2 分鐘，請更新' : $('auto-refresh').checked ? '即時資料 · 自動更新中' : '即時資料 · 自動更新已暫停';
  }
  async function loadStations() {
    if (loading || !map) return;
    loading = true;
    $('refresh').disabled = true;
    $('refresh').textContent = '更新中…';
    updateStatus();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(API_URL, {cache:'no-store', signal:controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('來源格式不符，預期 JSON 陣列');
      const stations = data.map(normalizeStation).filter(Boolean);
      if (!stations.length) throw new Error('來源未提供有效站點');
      renderStations(stations);
      hasData = true;
      failed = false;
      lastSuccessAt = Date.now();
      $('error-message').hidden = true;
      const time = new Intl.DateTimeFormat('zh-TW', {timeZone:'Asia/Taipei', hour12:false, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'}).format(new Date(lastSuccessAt));
      $('fetched-time').textContent = `取得資料：${time}（臺灣時間）`;
    } catch (error) {
      failed = true;
      $('status-dot').className = 'status-dot error';
      $('error-message').textContent = `無法${hasData ? '更新' : '載入'} YouBike 資料。${hasData ? '目前保留上次成功取得的資料。' : '目前沒有可顯示的站點資料。'}請確認網路連線後按「立即更新」。`;
      $('error-message').hidden = false;
      console.error('YouBike 資料讀取失敗：', error);
    } finally {
      clearTimeout(timeout);
      loading = false;
      $('refresh').disabled = false;
      $('refresh').textContent = '立即更新';
      updateStatus();
    }
  }
  function init() {
    if (typeof L === 'undefined') {
      $('status-text').textContent = '地圖程式未載入';
      $('status-dot').className = 'status-dot error';
      $('error-message').hidden = false;
      $('error-message').textContent = '無法載入 Leaflet。請確認已完整解壓縮，並保留 vendor 資料夾。';
      $('refresh').disabled = true;
      $('reset-view').disabled = true;
      $('auto-refresh').disabled = true;
      return;
    }
    map = L.map('map', {scrollWheelZoom:true}).setView(INITIAL_CENTER, INITIAL_ZOOM);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    }).addTo(map);
    let warnedTiles = false;
    tiles.on('tileerror', () => {if (!warnedTiles) {warnedTiles = true; $('error-message').hidden = false; $('error-message').textContent = '部分底圖無法載入。請確認網路連線；站點資料仍會繼續更新。';}});
    stationLayer = L.layerGroup().addTo(map);
    $('refresh').addEventListener('click', loadStations);
    $('reset-view').addEventListener('click', () => map.setView(INITIAL_CENTER, INITIAL_ZOOM));
    $('auto-refresh').addEventListener('change', updateStatus);
    loadStations();
    setInterval(() => {if ($('auto-refresh').checked && !document.hidden) loadStations();}, REFRESH_INTERVAL);
    setInterval(updateStatus, 10_000);
    document.addEventListener('visibilitychange', () => {if (!document.hidden && $('auto-refresh').checked && (!lastSuccessAt || Date.now()-lastSuccessAt >= REFRESH_INTERVAL)) loadStations();});
  }
  init();
})();
