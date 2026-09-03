const STORAGE_KEY = "su-mushroom-records-v1";
const OBSERVATION_STORAGE_KEY = "su-mushroom-observations-v1";

let records = loadRecords();
let observations = loadObservations();
let currentLatitude = null;
let currentLongitude = null;
let currentLocationId = null;
let currentLocationFilterId = null;
let savedLocations = [];
let currentWeatherHistory = [];
let currentWeatherFetchedAt = null;
let pendingPhoto = "";
let pendingPhotos = [];
let editingRecordId = null; 

const views = [...document.querySelectorAll(".view")];
const navButtons = [...document.querySelectorAll(".nav-btn")];

const speciesCount = document.getElementById("speciesCount");
const recordCount = document.getElementById("recordCount");
const unknownCount = document.getElementById("unknownCount");
const recentList = document.getElementById("recentList");
const libraryList = document.getElementById("libraryList");
const libraryCount = document.getElementById("libraryCount");
const searchInput = document.getElementById("searchInput");
const filterInput = document.getElementById("filterInput");
const recordForm = document.getElementById("recordForm");
const saveRecordBtn = document.getElementById("saveRecordBtn");
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const dateInput = document.getElementById("dateInput");
const saveMessage = document.getElementById("saveMessage");
const detailDialog = document.getElementById("detailDialog");
const detailContent = document.getElementById("detailContent");
const settingsMessage = document.getElementById("settingsMessage");

dateInput.value = todayLocal();

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2,"0"),
    String(date.getUTCDate()).padStart(2,"0")
  ].join("-");
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

  function loadObservations(){
    try {
      const raw = localStorage.getItem(OBSERVATION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch{
      return[];
  }
}

function saveObservations(){
  localStorage.setItem(
    OBSERVATION_STORAGE_KEY,
    JSON.stringify(observations)
  );
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function switchView(id) {
  views.forEach(v => v.classList.toggle("active", v.id === id));
  navButtons.forEach(b => b.classList.toggle("active", b.dataset.view === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (id === "homeView" || id === "libraryView") renderAll();
}

navButtons.forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
document.getElementById("goLibraryBtn").addEventListener("click", () => switchView("libraryView"));
document.getElementById("getLocationBtn").addEventListener("click", (event) => {
  event.preventDefault();

  const status = document.getElementById("locationStatus");

  status.textContent = "現在地を取得中…";

  if (!navigator.geolocation) {
    status.textContent = "この端末では現在地を取得できません";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocationId = null;
      currentLatitude = position.coords.latitude;
      currentLongitude = position.coords.longitude;

      status.textContent =
       `緯度 ${currentLatitude.toFixed(6)} / 経度 ${currentLongitude.toFixed(6)}`;
    },

    (error) => {
  status.textContent =
    `取得失敗：${error.code} / ${error.message}`;

  console.error(error);
}
  );
});

const openMapBtn = document.getElementById("openMapBtn");
const mapPicker = document.getElementById("mapPicker");
const mapCoordinates = document.getElementById("mapCoordinates");

let locationMap = null;
let locationMarker = null;

openMapBtn.addEventListener("click", () => {
  mapPicker.hidden = false;

  if (!locationMap) {
    const startLat =
      currentLatitude !== null ? currentLatitude : 43.0621;
    const startLng =
      currentLongitude !== null ? currentLongitude : 141.3544;

    const startZoom =
      currentLatitude !== null && currentLongitude !== null ? 15 : 8;

    locationMap = L.map("locationMap").setView(
      [startLat, startLng],
      startZoom
    );

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }
    ).addTo(locationMap);

    if (
      currentLatitude !== null &&
      currentLongitude !== null
    ) {
      locationMarker = L.marker([
        currentLatitude,
        currentLongitude
      ]).addTo(locationMap);
    }

    locationMap.on("click", (event) => {
      currentLocationId = null;
      currentLatitude = event.latlng.lat;
      currentLongitude = event.latlng.lng;

      if (locationMarker) {
        locationMarker.setLatLng([
          currentLatitude,
          currentLongitude
        ]);
      } else {
        locationMarker = L.marker([
          currentLatitude,
          currentLongitude
        ]).addTo(locationMap);
      }

      mapCoordinates.textContent =
        `緯度 ${currentLatitude.toFixed(6)} / 経度 ${currentLongitude.toFixed(6)}`;

      document.getElementById("locationStatus").textContent =
        "🗺️ 地図で場所を指定しました";
    });
  } else {
    if (
      currentLatitude !== null &&
      currentLongitude !== null
    ) {
      locationMap.setView(
        [currentLatitude, currentLongitude],
        15
      );
    }
  }

  setTimeout(() => {
    locationMap.invalidateSize();
  }, 100);
});

const saveLocationBtn = document.getElementById("saveLocationBtn");

saveLocationBtn.addEventListener("click", async () => {
  const placeName =
    document.getElementById("placeInput").value.trim();

  if (!placeName) {
    alert("先に場所名を入力してください");
    return;
  }

  if (
    currentLatitude === null ||
    currentLongitude === null
  ) {
    alert("先に地図で場所を指定してください");
    return;
  }

  const {
    data: { session },
    error: sessionError
  } = await window.supabaseClient.auth.getSession();

  if (sessionError) {
    console.error(sessionError);
    alert("ログイン状態を確認できませんでした");
    return;
  }

  if (!session?.user) {
    alert("場所を登録するにはログインしてください");
    return;
  }

  

  const locationId =
    crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());

  const { error } = await window.supabaseClient
    .from("locations")
    .insert({
      id: locationId,
      user_id: session.user.id,
      name: placeName,
      latitude: currentLatitude,
      longitude: currentLongitude
    });

  if (error) {
    console.error(error);
    alert("場所を登録できませんでした");
    return;
  }

  currentLocationId = locationId;

  document.getElementById("locationStatus").textContent =
    `⭐ 「${placeName}」を登録しました`;

    await loadSavedLocations();

document.getElementById("savedLocationSelect").value = locationId;

});


async function loadSavedLocations() {
  const savedLocationSelect =
    document.getElementById("savedLocationSelect");

  const {
    data: { session },
    error: sessionError
  } = await window.supabaseClient.auth.getSession();

  if (sessionError || !session?.user) return;

  const { data: locations, error } =
    await window.supabaseClient
      .from("locations")
      .select("*")
      .order("name", { ascending: true });

      savedLocations = locations || [];

  if (error) {
    console.error(error);
    return;
  }

  savedLocationSelect.innerHTML =
    `<option value="">選択しない</option>`;

  locations.forEach((location) => {
    const option = document.createElement("option");

    option.value = location.id;
    option.textContent = location.name;
    option.dataset.latitude = location.latitude;
    option.dataset.longitude = location.longitude;

    savedLocationSelect.appendChild(option);
  });
}

const savedLocationSelect =
  document.getElementById("savedLocationSelect");

savedLocationSelect.addEventListener("change", () => {
  const selectedOption =
    savedLocationSelect.options[savedLocationSelect.selectedIndex];

  if (!selectedOption || !selectedOption.value) {
    currentLocationId = null;
    return;
  }

  currentLocationId = selectedOption.value;
  currentLatitude = Number(selectedOption.dataset.latitude);
  currentLongitude = Number(selectedOption.dataset.longitude);

  document.getElementById("placeInput").value =
    selectedOption.textContent;

  document.getElementById("locationStatus").textContent =
    `⭐ 登録済みの場所「${selectedOption.textContent}」を選択しました`;

  mapCoordinates.textContent =
    `緯度 ${currentLatitude.toFixed(6)} / 経度 ${currentLongitude.toFixed(6)}`;

  if (locationMap) {
    locationMap.setView(
      [currentLatitude, currentLongitude],
      15
    );

    if (locationMarker) {
      locationMarker.setLatLng([
        currentLatitude,
        currentLongitude
      ]);
    } else {
      locationMarker = L.marker([
        currentLatitude,
        currentLongitude
      ]).addTo(locationMap);
    }
  }
});

document.getElementById("placeInput").addEventListener("input", () => {
  if (!currentLocationId) return;

  currentLocationId = null;
  savedLocationSelect.value = "";

  document.getElementById("locationStatus").textContent =
    "場所名を手入力したため、登録済みの場所との紐付けを解除しました";
});

document.getElementById("getWeatherBtn").addEventListener("click", async (event) => {
  event.preventDefault();

const status = document.getElementById("weatherStatus");
const historyArea = document.getElementById("weatherHistory");

if (currentLatitude === null || currentLatitude === null){
  status.textContent = "先に現在地を取得してください"
  return;
}

const observationDate = document.getElementById("dateInput").value;

if (!observationDate) {
  status.textContent = "発見日を選んでください";
return;
}

const startDate = shiftDate(observationDate, -13);
const endDate = observationDate;

status.textContent = "過去14日間の天気を取得中…";
historyArea.innerHTML = "";

const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${currentLatitude}` +
    `&longitude=${currentLongitude}` +
    `&start_date=${startDate}` +
    `&end_date=${endDate}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration` +
    `&hourly=relative_humidity_2m` +
    `&timezone=Asia%2FTokyo`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`天気APIエラー: ${response.status}`);
    }

    const data = await response.json();

    currentWeatherHistory = data.daily.time.map((date, index) => {
      const humidityValues = [];

      data.hourly.time.forEach((time, hourIndex) => {
        if (time.startsWith(date)) {
          const humidity = data.hourly.relative_humidity_2m[hourIndex];

          if (humidity !== null) {
            humidityValues.push(humidity);
          }
        }
      });

      const averageHumidity =
        humidityValues.length > 0
          ? Math.round(
              humidityValues.reduce((sum, value) => sum + value, 0) /
              humidityValues.length
            )
          : null;

      return {
        date: date,
        weatherCode: data.daily.weather_code[index],
        maxTemp: data.daily.temperature_2m_max[index],
        minTemp: data.daily.temperature_2m_min[index],
        precipitation: data.daily.precipitation_sum[index],
        averageHumidity: averageHumidity,
        sunshineHours:
          data.daily.sunshine_duration[index] !== null
            ? Math.round(data.daily.sunshine_duration[index] / 360) / 10
            : null
      };
    });

    currentWeatherFetchedAt = new Date().toISOString();

    status.textContent =
      `${startDate} ～ ${endDate} の14日分を取得しました`;

    historyArea.innerHTML = currentWeatherHistory
      .map(weather => `
        <div class="weather-day">
          <strong>${weather.date}</strong><br>
          🌡 ${weather.maxTemp}℃ / ${weather.minTemp}℃
          💧 ${weather.averageHumidity ?? "-"}%
          ☔ ${weather.precipitation}mm
          ☀️ ${weather.sunshineHours ?? "-"}時間
        </div>
      `)
      .join("");

  } catch (error) {
    console.error(error);
    status.textContent = "天気データを取得できませんでした";
  }
});

document.getElementById("addMushroomBtn").addEventListener("click", () => {
  const area = document.getElementById("extraMushrooms");

  area.insertAdjacentHTML("beforeend", `
  <div class="form-card extra-mushroom">
    <h2>追加キノコ 🍄</h2>
    <label class="photo-picker">
      <input class="extra-photo" type="file" accept="image/*"multiple>
      <span>📷 写真を追加</span>
      </label>

    <label>
      名前
      <input class="extra-name" type="text" placeholder="例：タマゴタケ / 未同定">
    </label>

    <div class="two-col">
      <label>
        成長段階
        <select class="extra-stage">
          <option value="不明">不明</option>
          <option value="幼菌">幼菌</option>
          <option value="成菌">成菌</option>
          <option value="老菌">老菌</option>
        </select>
      </label>

      <label>
        判定
        <select class="extra-category">
          <option value="不明">不明</option>
          <option value="食用">食用</option>
          <option value="毒">毒</option>
          <option value="要注意">要注意</option>
        </select>
      </label>
    </div>

    <label>
      メモ
      <textarea class="extra-memo" rows="3" placeholder="特徴など"></textarea>
    </label>
  </div>
`);
  });


photoInput.addEventListener("change", async (event) => {
  const files = [...(event.target.files || [])];
  if (!files.length) return;

  // 新規登録のときだけ、1枚目の写真から撮影日時・GPSを自動取得
if (editingRecordId === null && window.exifr) {
  const firstFile = files[0];

  try {
    // 撮影日時を取得
    const exifData = await window.exifr.parse(firstFile, [
      "DateTimeOriginal",
      "CreateDate"
    ]);

    const photoDate =
      exifData?.DateTimeOriginal ||
      exifData?.CreateDate;

    if (photoDate instanceof Date && !Number.isNaN(photoDate.getTime())) {
      const year = photoDate.getFullYear();
      const month = String(photoDate.getMonth() + 1).padStart(2, "0");
      const day = String(photoDate.getDate()).padStart(2, "0");

      dateInput.value = `${year}-${month}-${day}`;
    }

    // GPSを取得
    const gps = await window.exifr.gps(firstFile);

    if (
      gps &&
      Number.isFinite(gps.latitude) &&
      Number.isFinite(gps.longitude)
    ) {
      currentLocationId = null;
      currentLatitude = gps.latitude;
      currentLongitude = gps.longitude;

      document.getElementById("savedLocationSelect").value = "";

      document.getElementById("locationStatus").textContent =
        `📷 写真の撮影位置を取得しました：緯度 ${currentLatitude.toFixed(6)} / 経度 ${currentLongitude.toFixed(6)}`;

      mapCoordinates.textContent =
        `緯度 ${currentLatitude.toFixed(6)} / 経度 ${currentLongitude.toFixed(6)}`;

      if (locationMap) {
        locationMap.setView(
          [currentLatitude, currentLongitude],
          15
        );

        if (locationMarker) {
          locationMarker.setLatLng([
            currentLatitude,
            currentLongitude
          ]);
        } else {
          locationMarker = L.marker([
            currentLatitude,
            currentLongitude
          ]).addTo(locationMap);
        }
      }
    }
  } catch (error) {
    console.warn("写真の撮影情報を取得できませんでした", error);
  }
}

  pendingPhotos = [];

  for (const file of files) {
    const compressedPhoto = await compressImage(file, 1200, 0.78);
    pendingPhotos.push(compressedPhoto);
  }

  // 旧1枚用処理との互換用
  pendingPhoto = pendingPhotos[0] || "";

  // 今はひとまず1枚目をプレビュー
  photoPreview.src = pendingPhoto;
  photoPreview.hidden = false;
  photoPlaceholder.hidden = true;
});

function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadPhotoToStorage(dataUrl) {
  if (!dataUrl) return "";

  // すでにStorageのURLならそのまま使う
  if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
    return dataUrl;
  }

  const {
    data: { session },
    error: sessionError
  } = await window.supabaseClient.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.user) {
    throw new Error("写真を保存するにはログインが必要です");
  }

  const blob = await fetch(dataUrl).then((response) => response.blob());

  const fileName = `${crypto.randomUUID()}.jpg`;
  const filePath = `${session.user.id}/${fileName}`;

  const { error: uploadError } = await window.supabaseClient.storage
    .from("mushroom-photos")
    .upload(filePath, blob, {
      contentType: "image/jpeg",
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data } = window.supabaseClient.storage
    .from("mushroom-photos")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function uploadPhotosToStorage(photoDataUrls) {
  const uploadedUrls = [];

  for (const photoDataUrl of photoDataUrls) {
    const url = await uploadPhotoToStorage(photoDataUrl);

    if (url) {
      uploadedUrls.push(url);
    }
  }

  return uploadedUrls;
}

async function deletePhotoFromStorage(photoUrl) {
  if (!photoUrl) return;

  const marker = "/storage/v1/object/public/mushroom-photos/";

  // Storageの写真URLじゃなければ何もしない
  if (!photoUrl.includes(marker)) return;

  const encodedPath = photoUrl.split(marker)[1];
  if (!encodedPath) return;

  const filePath = decodeURIComponent(
    encodedPath.split("?")[0]
  );

  const { error } = await window.supabaseClient.storage
    .from("mushroom-photos")
    .remove([filePath]);

  if (error) {
    console.warn("Storageの写真を削除できませんでした", error);
  }
}

recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
    if (editingRecordId !== null) {
    const recordIndex = records.findIndex(
      (r) => String(r.id) === String(editingRecordId)
    );

    if (recordIndex === -1) {
      alert("編集する記録が見つかりませんでした");
      editingRecordId = null;
      return;
    }

    const oldRecord = records[recordIndex];

   const oldPhotos =
  Array.isArray(oldRecord.photos) && oldRecord.photos.length > 0
    ? [...oldRecord.photos]
    : oldRecord.photo
      ? [oldRecord.photo]
      : [];

let storedEditedPhotos = oldPhotos;

const newPhotoFiles = [...(photoInput.files || [])];

if (newPhotoFiles.length > 0) {
  storedEditedPhotos = await uploadPhotosToStorage(pendingPhotos);

  for (const oldPhotoUrl of new Set(oldPhotos)) {
    await deletePhotoFromStorage(oldPhotoUrl);
  }
}

const storedEditedPhoto = storedEditedPhotos[0] || "";

    const updatedRecord = {
      ...oldRecord,
      name: document.getElementById("nameInput").value.trim() || "未同定",
      stage: document.getElementById("stageInput").value,
      category: document.getElementById("categoryInput").value,
      date: dateInput.value || todayLocal(),
      place: document.getElementById("placeInput").value.trim(),
      memo: document.getElementById("memoInput").value.trim(),
      photo: storedEditedPhoto,
photos: storedEditedPhotos
    };


    records[recordIndex] = updatedRecord;

    const linkedObservationId = oldRecord.observationId
  ? String(oldRecord.observationId)
  : null;

if (linkedObservationId) {
  const observationIndex = observations.findIndex(
    (o) => String(o.id) === linkedObservationId
  );

  if (observationIndex !== -1) {
    observations[observationIndex] = {
      ...observations[observationIndex],
      date: updatedRecord.date,
      place: updatedRecord.place,
      locationId: currentLocationId,
      latitude: currentLatitude,
      longitude: currentLongitude,
      weather: {
        ...(observations[observationIndex].weather ?? {}),
        fetchedAt: currentWeatherFetchedAt,
        history14: currentWeatherHistory
      }
    };

    saveObservations();
  }

  // 同じ観察で追加した他のキノコも、日付と場所を揃える
  records = records.map((item) =>
    String(item.observationId) === linkedObservationId
      ? {
          ...item,
          date: updatedRecord.date,
          place: updatedRecord.place
        }
      : item
  );
}

    saveRecords();
    renderAll();
    renderLocationBrowser();

    await syncToCloud();

    editingRecordId = null;
    saveRecordBtn.textContent = "この発見を保存";

    recordForm.reset();

    currentLocationId = null;
currentLatitude = null;
currentLongitude = null;
document.getElementById("savedLocationSelect").value = "";
document.getElementById("locationStatus").textContent =
  "緯度・経度はまだ取得していません";

    dateInput.value = todayLocal();
    pendingPhoto = "";
    pendingPhotos = [];
    photoPreview.hidden = true;
    photoPreview.removeAttribute("src");
    photoPlaceholder.hidden = false;

    saveMessage.textContent = `「${updatedRecord.name}」を更新しました ✏️`;

    setTimeout(() => {
      saveMessage.textContent = "";
      switchView("libraryView");
    }, 700);

    return;
  }

  const observationId = "obs-" + Date.now();

  const observation = {
    id: observationId,
    date: document.getElementById("dateInput").value,
    place: document.getElementById("placeInput").value.trim(),
    locationId: currentLocationId,

    latitude: currentLatitude,
    longitude: currentLongitude,

    weather: {
      fetchedAt: currentWeatherFetchedAt,
      current: null,
      history14: currentWeatherHistory
  }
};


  observations.unshift(observation);
  saveObservations();


  const name = document.getElementById("nameInput").value.trim() || "未同定";
  const storedPhotos = await uploadPhotosToStorage(pendingPhotos);
const storedPhoto = storedPhotos[0] || "";
  const record = {
    id: crypto.randomUSSSSUID ? crypto.randomUUID() : String(Date.now()),
    observationId: observationId,
    name,
    stage: document.getElementById("stageInput").value,
    category: document.getElementById("categoryInput").value,
    date: dateInput.value || todayLocal(),
    place: document.getElementById("placeInput").value.trim(),
    memo: document.getElementById("memoInput").value.trim(),
    photo: storedPhoto,
photos: storedPhotos,
    createdAt: new Date().toISOString()
  };

  records.unshift(record);

  const extraMushrooms = document.querySelectorAll(".extra-mushroom");

  for (let index = 0; index < extraMushrooms.length; index++) {
  const mushroom = extraMushrooms[index];

  const photoInput = mushroom.querySelector(".extra-photo");
  const photoFiles = [...(photoInput.files || [])];
const extraPhotoDataUrls = [];

for (const photoFile of photoFiles) {
  const compressedPhoto = await compressImage(photoFile, 1200, 0.78);
  extraPhotoDataUrls.push(compressedPhoto);
}

const storedExtraPhotos =
  await uploadPhotosToStorage(extraPhotoDataUrls);

const storedExtraPhoto = storedExtraPhotos[0] || "";

const extraRecord = {
    id: String(Date.now() + index + 1),
    observationId: observationId,
    name: mushroom.querySelector(".extra-name").value.trim() || "未同定",
    stage: mushroom.querySelector(".extra-stage").value,
    category: mushroom.querySelector(".extra-category").value,
    date: document.getElementById("dateInput").value, 
    place: document.getElementById("placeInput").value.trim(),
    memo: mushroom.querySelector(".extra-memo").value.trim(),
    photo: storedExtraPhotos,
    createdAt: new Date().toISOString()
  };

  records.unshift(extraRecord);
}

  saveRecords();
  renderAll();

  await syncToCloud();

  recordForm.reset();
  currentLocationId = null;
currentLatitude = null;
currentLongitude = null;

document.getElementById("savedLocationSelect").value = "";

document.getElementById("locationStatus").textContent =
  "緯度・経度はまだ取得していません";

mapCoordinates.textContent =
  "地図をタップして場所を指定してください";

  if (locationMarker && locationMap) {
  locationMap.removeLayer(locationMarker);
  locationMarker = null;
}


  dateInput.value = todayLocal();
  pendingPhoto = "";
  pendingPhotos = [];
  photoPreview.hidden = true;
  photoPreview.removeAttribute("src");
  photoPlaceholder.hidden = false;
  saveMessage.textContent = `「${name}」を保存しました 🍄`;

  setTimeout(() => {
    saveMessage.textContent = "";
    switchView("homeView");
  }, 700);
});

function renderAll() {
  renderStats();
  renderRecent();
  renderLibrary();
}

function renderStats() {
  const named = records
    .map(r => r.name.trim())
    .filter(name => name && name !== "未同定");

  speciesCount.textContent = new Set(named).size;
  recordCount.textContent = records.length;
  unknownCount.textContent = records.filter(r => r.name === "未同定").length;
}

function renderRecent() {
  const latest = records.slice(0, 6);

  if (!latest.length) {
    recentList.className = "recent-grid empty-state";
    recentList.textContent = "まだ発見記録がありません。";
    return;
  }

  recentList.className = "recent-grid";
  recentList.innerHTML = latest.map(cardHTML).join("");

  attachCardEvents(recentList);
}

function renderLibrary() {
  const q = searchInput.value.trim().toLowerCase();
  const f = filterInput.value;
  const locationObservationIds = currentLocationFilterId
  ? new Set(
      observations
        .filter(
          (o) =>
            String(o.locationId) === String(currentLocationFilterId)
        )
        .map((o) => String(o.id))
    )
  : null;

  let filtered = records.filter(r => {
  if (
    locationObservationIds &&
    !locationObservationIds.has(String(r.observationId))
  ) {
    return false;
  }

  const haystack = `${r.name} ${r.place} ${r.memo} ${r.stage} ${r.category}`.toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (f === "unknown" && r.name !== "未同定") return false;
    if (f === "food" && r.category !== "食用") return false;
    if (f === "poison" && r.category !== "毒") return false;
    return true;
  });

  libraryCount.textContent = `${filtered.length}件`;

  if (!filtered.length) {
    libraryList.className = "grid-list empty-state";
    libraryList.textContent = records.length ? "条件に合う記録がありません。" : "まだ図鑑が空です。";
    return;
  }

  libraryList.className = "grid-list";
  libraryList.innerHTML = filtered.map(cardHTML).join("");
  attachCardEvents(libraryList);
}

function renderLocationBrowser() {
  const locationBrowseList =
    document.getElementById("locationBrowseList");

  if (!locationBrowseList) return;

  if (!savedLocations.length) {
    locationBrowseList.innerHTML =
      `<p class="muted">登録した場所はまだありません。</p>`;
    return;
  }

  locationBrowseList.innerHTML = savedLocations
    .map((location) => {
      const observationIds = new Set(
        observations
          .filter(
            (o) =>
              String(o.locationId) === String(location.id)
          )
          .map((o) => String(o.id))
      );

      const count = records.filter((r) =>
        observationIds.has(String(r.observationId))
      ).length;

      return `
  <div class="location-entry">

    <div class="location-row">

      <button
        class="location-browse-btn"
        type="button"
        data-location-id="${escapeHTML(location.id)}"
      >
        <span>${escapeHTML(location.name)}</span>
        <span>${count}件</span>
      </button>

      <button
        class="location-menu-btn"
        type="button"
        data-location-menu-id="${escapeHTML(location.id)}"
        aria-label="${escapeHTML(location.name)}のメニュー"
      >
        ⋯
      </button>

    </div>

    <div
      class="location-actions"
      data-location-actions-id="${escapeHTML(location.id)}"
      hidden
    >
      <button
        class="location-rename-btn"
        type="button"
        data-location-id="${escapeHTML(location.id)}"
      >
        ✏️ 名前を変更
      </button>

      <button
        class="location-delete-btn"
        type="button"
        data-location-id="${escapeHTML(location.id)}"
      >
        🗑️ 場所を削除
      </button>
    </div>

  </div>
`;
    })
    .join("");
}


  locationBrowseList.addEventListener("click", (event) => {
  const menuButton = event.target.closest(".location-menu-btn");
  if (!menuButton) return;

  const locationId = menuButton.dataset.locationMenuId;

  const targetMenu = locationBrowseList.querySelector(
    `[data-location-actions-id="${locationId}"]`
  );

  document
    .querySelectorAll(".location-actions")
    .forEach((menu) => {
      if (menu !== targetMenu) {
        menu.hidden = true;
      }
    });

  targetMenu.hidden = !targetMenu.hidden;
});

locationBrowseList.addEventListener("click", async (event) => {
  const renameButton = event.target.closest(".location-rename-btn");
  if (!renameButton) return;

  const locationId = renameButton.dataset.locationId;

  const location = savedLocations.find(
    (item) => String(item.id) === String(locationId)
  );

  if (!location) return;

  const inputName = prompt(
    "新しい場所名を入力してください",
    location.name
  );

  if (inputName === null) return;

  const newName = inputName.trim();

  if (!newName) {
    alert("場所名を入力してください");
    return;
  }

  if (newName === location.name) return;

  const { error } = await window.supabaseClient
    .from("locations")
    .update({
      name: newName
    })
    .eq("id", locationId);

  if (error) {
    console.error(error);
    alert("場所名を変更できませんでした");
    return;
  }

  const linkedObservationIds = new Set(
    observations
      .filter(
        (o) => String(o.locationId) === String(locationId)
      )
      .map((o) => String(o.id))
  );

  observations = observations.map((o) =>
    String(o.locationId) === String(locationId)
      ? {
          ...o,
          place: newName
        }
      : o
  );

  records = records.map((r) =>
    linkedObservationIds.has(String(r.observationId))
      ? {
          ...r,
          place: newName
        }
      : r
  );

  saveObservations();
  saveRecords();

  await loadSavedLocations();

  if (String(currentLocationId) === String(locationId)) {
    document.getElementById("savedLocationSelect").value =
      locationId;

    document.getElementById("placeInput").value =
      newName;
  }

  if (String(currentLocationFilterId) === String(locationId)) {
    showLocationListBtn.textContent =
      `📍 ${newName} の記録`;
  }

  renderAll();
  renderLocationBrowser();

  await syncToCloud();
});

locationBrowseList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".location-delete-btn");
  if (!deleteButton) return;

  const locationId = deleteButton.dataset.locationId;

  const location = savedLocations.find(
    (item) => String(item.id) === String(locationId)
  );

  if (!location) return;

  const confirmed = confirm(
    `「${location.name}」を登録場所から削除しますか？\n\nキノコの記録自体は削除されません。`
  );

  if (!confirmed) return;

  const { error } = await window.supabaseClient
    .from("locations")
    .delete()
    .eq("id", locationId);

  if (error) {
    console.error(error);
    alert("場所を削除できませんでした");
    return;
  }

  // 過去の観察記録は残して、場所IDとの紐付けだけ外す
  observations = observations.map((o) =>
    String(o.locationId) === String(locationId)
      ? {
          ...o,
          locationId: null
        }
      : o
  );

  saveObservations();

  // 今選択中の場所だった場合は解除
  if (String(currentLocationId) === String(locationId)) {
    currentLocationId = null;
    document.getElementById("savedLocationSelect").value = "";
  }

  // 場所別図鑑で表示中だった場合も解除
  if (String(currentLocationFilterId) === String(locationId)) {
    currentLocationFilterId = null;
    showLocationListBtn.textContent = "📍 場所から見る";
    clearLocationFilterBtn.hidden = true;
  }

  await loadSavedLocations();

  renderAll();
  renderLocationBrowser();

  await syncToCloud();
});

  locationBrowseList.addEventListener("click", (event) => {
  const button = event.target.closest(".location-browse-btn");
  if (!button) return;

  currentLocationFilterId = button.dataset.locationId;

  const location = savedLocations.find(
    (item) => String(item.id) === String(currentLocationFilterId)
  );

  showLocationListBtn.textContent =
    location
      ? `📍 ${location.name} の記録`
      : "📍 場所から見る";

  clearLocationFilterBtn.hidden = false;

  renderLibrary();
});

clearLocationFilterBtn.addEventListener("click", () => {
  currentLocationFilterId = null;

  showLocationListBtn.textContent = "📍 場所から見る";

  clearLocationFilterBtn.hidden = true;

  renderLibrary();
});

showLocationListBtn.addEventListener("click", () => {
  locationBrowsePanel.hidden = !locationBrowsePanel.hidden;

  if (!locationBrowsePanel.hidden) {
    renderLocationBrowser();
  }
});

function cardHTML(r) {
  const safeName = escapeHTML(r.name);
  const safePlace = escapeHTML(r.place || "場所未登録");
  const media = r.photo
    ? `<img class="card-photo" src="${r.photo}" alt="${safeName}">`
    : `<div class="card-placeholder" aria-hidden="true">🍄</div>`;

  return `
    <article class="mushroom-card">
      <button type="button" data-id="${r.id}" aria-label="${safeName}の詳細">
        ${media}
        <div class="card-body">
          <div class="card-title">
            <strong>${safeName}</strong>
            <span class="badge">${escapeHTML(r.stage)}</span>
          </div>
          <div class="card-meta">${escapeHTML(r.date)}<br>${safePlace}</div>
        </div>
      </button>
    </article>`;
}

function attachCardEvents(container) {
  container.querySelectorAll("[data-id]").forEach(btn => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
}

function openDetail(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  const observation = observations.find(
  o => String(o.id) === String(r.observationId)
);
   const locationHtml =
  observation &&
  observation.latitude != null &&
  observation.longitude != null
    ? `
      
  <div class="detail-location">
    <h3>📍 発見位置</h3>

    <div
      id="detailLocationMap"
      class="detail-location-map"
    ></div>

    <p class="coordinates">
      緯度 ${observation.latitude}<br>
      経度 ${observation.longitude}
    </p>

    <a
      class="map-link"
      href="https://www.google.com/maps/search/?api=1&query=${observation.latitude},${observation.longitude}"
      target="_blank"
      rel="noopener noreferrer"
    >
      🗺 Googleマップで開く
    </a>
  </div>
`
    : `
      <div class="detail-location">
        <h3>📍 発見位置</h3>
        <p>位置情報なし</p>
      </div>
    `;


  const weatherHistory =
    observation?.weather?.history14 ?? [];

   const weatherHtml =
  weatherHistory.length > 0
    ? `
      <details class="weather-details">
        <summary>🌦 発見前14日間の天気</summary>

        <div class="detail-weather">
          ${weatherHistory.map(weather => `
            <div class="weather-day">
              <strong>${escapeHTML(weather.date)}</strong><br>
              🌡 ${weather.maxTemp ?? "-"}℃ / ${weather.minTemp ?? "-"}℃
             　💧 ${weather.averageHumidity ?? "-"}%
             　☔ ${weather.precipitation ?? "-"}mm
             　☀️ ${weather.sunshineHours ?? "-"}時間
            </div>
          `).join("")}
        </div>
      </details>
    `
    : `
      <h3>🌦 発見前14日間の天気</h3>
      <p>天気データなし</p>
    `;
    
    const detailPhotos =
  Array.isArray(r.photos) && r.photos.length > 0
    ? r.photos
    : r.photo
      ? [r.photo]
      : [];

const photosHtml =
  detailPhotos.length > 0
    ? `
      <div class="photo-gallery-wrap">

        <div class="photo-gallery">
          ${detailPhotos
            .map(
              (photoUrl, index) => `
                <div class="photo-slide">
                  <img
                    class="detail-photo"
                    src="${photoUrl}"
                    alt="${escapeHTML(r.name)} 写真${index + 1}"
                  >
                  ${
                    detailPhotos.length > 1
                      ? `<span class="photo-count">${index + 1} / ${detailPhotos.length}</span>`
                      : ""
                  }
                </div>
              `
            )
            .join("")}
        </div>

        ${
          detailPhotos.length > 1
            ? `
              <div class="photo-dots">
                ${detailPhotos
                  .map(
                    (_, index) => `
                      <button
                        class="photo-dot${index === 0 ? " active" : ""}"
                        type="button"
                        data-photo-index="${index}"
                        aria-label="写真${index + 1}"
                      ></button>
                    `
                  )
                  .join("")}
              </div>
            `
            : ""
        }

      </div>
    `
    : "";
  
  
  detailContent.innerHTML = `
    ${photosHtml}
    <h2 style="margin-top:14px">${escapeHTML(r.name)}</h2>
    <dl class="detail-grid">
      <dt>発見日</dt><dd>${escapeHTML(r.date)}</dd>
      <dt>成長段階</dt><dd>${escapeHTML(r.stage)}</dd>
      <dt>判定</dt><dd>${escapeHTML(r.category)}</dd>
      <dt>場所</dt><dd>${escapeHTML(r.place || "未登録")}</dd>
      <dt>メモ</dt><dd>${escapeHTML(r.memo || "なし")}</dd>
    </dl>

     
      ${locationHtml}
  ${weatherHtml}
  <button class="secondary-btn" id="editOneBtn" type="button">✏️ この記録を編集</button>
    <button class="danger-btn" id="deleteOneBtn" type="button">この記録を削除</button>
  `;

  // 詳細画面の発見位置ミニマップ
if (
  observation &&
  observation.latitude != null &&
  observation.longitude != null
) {
  const detailMapElement =
    document.getElementById("detailLocationMap");

  if (detailMapElement) {
    const lat = Number(observation.latitude);
    const lng = Number(observation.longitude);

    const detailMap = L.map(detailMapElement, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false
    }).setView([lat, lng], 14);

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }
    ).addTo(detailMap);

    L.marker([lat, lng]).addTo(detailMap);

    setTimeout(() => {
      detailMap.invalidateSize();
    }, 100);
  }
}

  const photoGallery = detailContent.querySelector(".photo-gallery");
const photoDots = [...detailContent.querySelectorAll(".photo-dot")];
const photoSlides = [...detailContent.querySelectorAll(".photo-slide")];

if (photoGallery && photoDots.length > 0 && photoSlides.length > 0) {
  const updateActiveDot = () => {
    const galleryLeft = photoGallery.getBoundingClientRect().left;

    let activeIndex = 0;
    let nearestDistance = Infinity;

    photoSlides.forEach((slide, index) => {
      const distance = Math.abs(
        slide.getBoundingClientRect().left - galleryLeft
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        activeIndex = index;
      }
    });

    photoDots.forEach((dot, index) => {
      dot.classList.toggle("active", index === activeIndex);
    });
  };

  photoGallery.addEventListener("scroll", updateActiveDot, {
    passive: true
  });

  photoDots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      const targetLeft =
        photoSlides[index].offsetLeft -
        photoSlides[0].offsetLeft;

      photoGallery.scrollTo({
        left: targetLeft,
        behavior: "smooth"
      });
    });
  });
}

  document.getElementById("editOneBtn").addEventListener("click", () => {
  editingRecordId = String(r.id);
  saveRecordBtn.textContent = "✏️ 変更を保存";
  const editingObservation = observations.find(
  (o) => String(o.id) === String(r.observationId)
);

if (editingObservation) {
  currentLatitude = editingObservation.latitude ?? null;
  currentLongitude = editingObservation.longitude ?? null;
  currentLocationId = editingObservation.locationId ?? null;
  document.getElementById("savedLocationSelect").value =
  currentLocationId || "";
  currentWeatherHistory =
    editingObservation.weather?.history14 ?? [];
  currentWeatherFetchedAt =
    editingObservation.weather?.fetchedAt ?? null;
}

  document.getElementById("nameInput").value = r.name || "";
  document.getElementById("stageInput").value = r.stage || "不明";
  document.getElementById("categoryInput").value = r.category || "不明";
  document.getElementById("dateInput").value = r.date || todayLocal();
  document.getElementById("placeInput").value = r.place || "";
  document.getElementById("memoInput").value = r.memo || "";

  pendingPhotos =
  Array.isArray(r.photos) && r.photos.length > 0
    ? [...r.photos]
    : r.photo
      ? [r.photo]
      : [];

pendingPhoto = pendingPhotos[0] || "";

if (pendingPhoto) {
  photoPreview.src = pendingPhoto;
  photoPreview.hidden = false;
  photoPlaceholder.hidden = true;
} else {
  photoPreview.hidden = true;
  photoPreview.removeAttribute("src");
  photoPlaceholder.hidden = false;
}

  detailDialog.close();
  switchView("addView");
});

 document.getElementById("deleteOneBtn").addEventListener("click", async () => {
  if (!confirm("この記録を削除しますか？")) return;
  const photosToDelete =
  Array.isArray(r.photos) && r.photos.length > 0
    ? r.photos
    : r.photo
      ? [r.photo]
      : [];

for (const photoUrl of new Set(photosToDelete)) {
  await deletePhotoFromStorage(photoUrl);
}

  const observationId = r.observationId
    ? String(r.observationId)
    : null;

  try {
    const {
      data: { session },
      error: sessionError
    } = await window.supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    // ログイン中ならクラウドからもキノコを削除
    if (session?.user) {
      const { error: recordDeleteError } =
        await window.supabaseClient
          .from("records")
          .delete()
          .eq("id", String(id));

      if (recordDeleteError) throw recordDeleteError;
    }

    // この端末から削除
    records = records.filter((x) => String(x.id) !== String(id));
    saveRecords();

    // 同じ観察にキノコがもう1件も無ければ、観察データも削除
    if (
      observationId &&
      !records.some(
        (x) => String(x.observationId) === observationId
      )
    ) {
      if (session?.user) {
        const { error: observationDeleteError } =
          await window.supabaseClient
            .from("observations")
            .delete()
            .eq("id", observationId);

        if (observationDeleteError) throw observationDeleteError;
      }

      observations = observations.filter(
        (o) => String(o.id) !== observationId
      );
      saveObservations();
    }

    detailDialog.close();
    renderAll();

    if (session?.user) {
      syncStatus.textContent = "✅ 削除をクラウドに反映しました";
    }
  } catch (error) {
    console.error(error);
    alert(
      `削除を同期できませんでした：${error.message ?? "不明なエラー"}`
    );
  }
}); 

  detailDialog.showModal();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  }[ch]));
}

searchInput.addEventListener("input", renderLibrary);
filterInput.addEventListener("change", renderLibrary);

document.getElementById("exportBtn").addEventListener("click", () => {
  const backupDate = {
    version: 2,
    exportedAt: new Date().toISOString(),
    records: records,
    observations: observations
  };
  const blob = new Blob([JSON.stringify(backupDate, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `su-mushroom-backup-${todayLocal()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  settingsMessage.textContent = "バックアップを書き出しました。";
});

document.getElementById("importInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());

if (Array.isArray(parsed)) {
  // 昔のバックアップ形式
  records = parsed;

} else if (
  parsed &&
  Array.isArray(parsed.records) &&
  Array.isArray(parsed.observations)
) {
  // 新しいバックアップ形式
  records = parsed.records;
  observations = parsed.observations;

} else {
  throw new Error("invalid");
}

saveRecords();
saveObservations();
renderAll();

    settingsMessage.textContent = "バックアップを読み込みました。";
  } catch {
    settingsMessage.textContent = "読み込みに失敗しました。";
  } finally {
    event.target.value = "";
  }
});

document.getElementById("clearBtn").addEventListener("click", () => {
  if (!confirm("本当に全データを削除しますか？")) return;
  records = [];
  saveRecords();
  renderAll();
  settingsMessage.textContent = "全データを削除しました。";
});

let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

/*
if (
  "serviceWorker" in navigator &&
  location.hostname !== "localhost" &&
  location.hostname !== "127.0.0.1"
) {
  navigator.serviceWorker.register("./sw.js");

  */

// =========================
// Supabase ログイン
// =========================

const authStatus = document.getElementById("authStatus");
const loginArea = document.getElementById("loginArea");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const syncBtn = document.getElementById("syncBtn");
const syncStatus = document.getElementById("syncStatus");
const pullBtn = document.getElementById("pullBtn");

async function updateAuthUI() {
  const {
    data: { session },
    error
  } = await window.supabaseClient.auth.getSession();

  if (error) {
    console.error(error);
    authStatus.textContent = "ログイン状態を確認できませんでした";
    return;
  }

  const user = session?.user;

  if (user) {
    authStatus.textContent = `ログイン中：${user.email}`;
    loginArea.hidden = true;
    logoutBtn.hidden = false;
  } else {
    authStatus.textContent = "ログインしていません";
    loginArea.hidden = false;
    logoutBtn.hidden = true;
  }
}

loginBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    authStatus.textContent =
      "メールアドレスとパスワードを入力してください";
    return;
  }

  authStatus.textContent = "ログイン中…";

  const { error } =
    await window.supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    console.error(error);
    authStatus.textContent = "ログインできませんでした";
    return;
  }

  loginPassword.value = "";
await updateAuthUI();
await pullFromCloud();
});

async function syncToCloud() {
  syncStatus.textContent = "☁️ 同期中…";
  syncBtn.disabled = true;

  try {
    const {
      data: { session },
      error: sessionError
    } = await window.supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.user) {
      syncStatus.textContent = "先にログインしてください";
      return;
    }

    const userId = session.user.id;

    // 観察データをクラウドへ送る
    const cloudObservations = observations.map(o => ({
      id: String(o.id),
      user_id: userId,
      date: o.date || null,
      place: o.place || "",
      location_id: o.locationId || null,
      latitude: o.latitude ?? null,
      longitude: o.longitude ?? null,
      weather: o.weather ?? null
    }));

    if (cloudObservations.length > 0) {
      const { error } = await window.supabaseClient
        .from("observations")
        .upsert(cloudObservations, {
          onConflict: "id"
        });

      if (error) throw error;
    }

    const observationIds = new Set(
      observations.map(o => String(o.id))
    );

    // キノコ記録をクラウドへ送る
    const cloudRecords = records.map(r => ({
      id: String(r.id),

      observation_id:
        r.observationId &&
        observationIds.has(String(r.observationId))
          ? String(r.observationId)
          : null,

      user_id: userId,
      name: r.name || "未同定",
      stage: r.stage || null,
      category: r.category || null,
      date: r.date || null,
      place: r.place || "",
      memo: r.memo || "",
photo: r.photo || "",
photos: Array.isArray(r.photos) ? r.photos : []
    }));

    if (cloudRecords.length > 0) {
      const { error } = await window.supabaseClient
        .from("records")
        .upsert(cloudRecords, {
          onConflict: "id"
        });

      if (error) throw error;
    }

    syncStatus.textContent =
      `✅ 同期完了：観察 ${cloudObservations.length}件 / キノコ ${cloudRecords.length}件`;

  } catch (error) {
    console.error(error);

    syncStatus.textContent =
      `❌ 同期できませんでした：${error.message ?? "不明なエラー"}`;

  } finally {
    syncBtn.disabled = false;
  }
}
syncBtn.addEventListener("click", syncToCloud);

async function pullFromCloud() {
  syncStatus.textContent = "☁️ クラウドから読み込み中…";
  pullBtn.disabled = true;

  try {
    const {
      data: { session },
      error: sessionError
    } = await window.supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.user) {
      syncStatus.textContent = "先にログインしてください";
      return;
    }

    // -------------------------
    // 観察データを取得
    // -------------------------

    const {
      data: cloudObservations,
      error: observationsError
    } = await window.supabaseClient
      .from("observations")
      .select("*");

    if (observationsError) throw observationsError;

    // -------------------------
    // キノコ記録を取得
    // -------------------------

    const {
      data: cloudRecords,
      error: recordsError
    } = await window.supabaseClient
      .from("records")
      .select("*");

    if (recordsError) throw recordsError;

    // Supabase形式 → 今の図鑑形式へ変換
    const downloadedObservations = cloudObservations.map(o => ({
      id: o.id,
      date: o.date,
      place: o.place || "",
      locationId: o.location_id || null,
      latitude: o.latitude,
      longitude: o.longitude,
      weather: o.weather
    }));

    const downloadedRecords = cloudRecords.map(r => ({
      id: r.id,
      observationId: r.observation_id,
      name: r.name,
      stage: r.stage || "不明",
      category: r.category || "不明",
      date: r.date,
      place: r.place || "",
      memo: r.memo || "",
      photo: r.photo || "",
photos: Array.isArray(r.photos) ? r.photos : [],
createdAt: r.created_at
    }));

    // -------------------------
    // 既存データと合体
    // 同じIDならクラウド側を採用
    // -------------------------

   observations = downloadedObservations;
records = downloadedRecords;

    records.sort((a, b) => {
  const aTime =
    a.createdAt ? new Date(a.createdAt).getTime() :
    Number(a.id) || 0;

  const bTime =
    b.createdAt ? new Date(b.createdAt).getTime() :
    Number(b.id) || 0;

  return bTime - aTime;
});

    // この端末にも保存
    saveObservations();
    saveRecords();

    renderAll();

    syncStatus.textContent =
      `✅ 読み込み完了：観察 ${downloadedObservations.length}件 / キノコ ${downloadedRecords.length}件`;

  } catch (error) {
    console.error(error);

    syncStatus.textContent =
      `❌ 読み込めませんでした：${error.message ?? "不明なエラー"}`;

  } finally {
    pullBtn.disabled = false;
  }
}


pullBtn.addEventListener("click", pullFromCloud);


logoutBtn.addEventListener("click", async () => {
  const { error } = await window.supabaseClient.auth.signOut();

  if (error) {
    console.error(error);
    authStatus.textContent = "ログアウトできませんでした";
    return;
  }

  await updateAuthUI();
});

window.supabaseClient.auth.onAuthStateChange(() => {
  updateAuthUI();
});

(async () => {
  await updateAuthUI();

  const {
    data: { session }
  } = await window.supabaseClient.auth.getSession();

  if (session?.user) {
    await pullFromCloud();
    await loadSavedLocations();
  } else {
    renderAll();
  }
})();