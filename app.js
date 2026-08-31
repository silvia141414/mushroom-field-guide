const STORAGE_KEY = "su-mushroom-records-v1";
const OBSERVATION_STORAGE_KEY = "su-mushroom-observations-v1";

let records = loadRecords();
let observations = loadObservations();
let currentLatitude = null;
let currentLongitude = null;
let currentWeatherHistory = [];
let currentWeatherFetchedAt = null;
let pendingPhoto = "";

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
      <input class="extra-photo" type="file" accept="image/*">
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
  const file = event.target.files?.[0];
  if (!file) return;

  pendingPhoto = await compressImage(file, 1200, 0.78);
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

recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const observationId = "obs-" + Date.now();

  const observation = {
    id: observationId,
    date: document.getElementById("dateInput").value,
    place: document.getElementById("placeInput").value.trim(),

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
  const record = {
    id: crypto.randomUSSSSUID ? crypto.randomUUID() : String(Date.now()),
    observationId: observationId,
    name,
    stage: document.getElementById("stageInput").value,
    category: document.getElementById("categoryInput").value,
    date: dateInput.value || todayLocal(),
    place: document.getElementById("placeInput").value.trim(),
    memo: document.getElementById("memoInput").value.trim(),
    photo: pendingPhoto,
    createdAt: new Date().toISOString()
  };

  records.unshift(record);

  const extraMushrooms = document.querySelectorAll(".extra-mushroom");

  for (let index = 0; index < extraMushrooms.length; index++) {
  const mushroom = extraMushrooms[index];

  const photoInput = mushroom.querySelector(".extra-photo");
  const photoFile = photoInput.files[0];

  let extraPhoto = "";

  if (photoFile) {
    extraPhoto = await compressImage(photoFile, 1200, 0.78);
  }

  const extraRecord = {
    id: String(Date.now() + index + 1),
    observationId: observationId,
    name: mushroom.querySelector(".extra-name").value.trim() || "未同定",
    stage: mushroom.querySelector(".extra-stage").value,
    category: mushroom.querySelector(".extra-category").value,
    date: document.getElementById("dateInput").value, 
    place: document.getElementById("placeInput").value.trim(),
    memo: mushroom.querySelector(".extra-memo").value.trim(),
    photo: extraPhoto,
    createdAt: new Date().toISOString()
  };

  records.unshift(extraRecord);
}

  saveRecords();
  renderAll();

  recordForm.reset();
  dateInput.value = todayLocal();
  pendingPhoto = "";
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
  const latest = records.slice(0, 4);
  if (!latest.length) {
    recentList.className = "card-list empty-state";
    recentList.textContent = "まだ発見記録がありません。";
    return;
  }
  recentList.className = "card-list";
  recentList.innerHTML = latest.map(cardHTML).join("");
  attachCardEvents(recentList);
}

function renderLibrary() {
  const q = searchInput.value.trim().toLowerCase();
  const f = filterInput.value;

  let filtered = records.filter(r => {
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

  detailContent.innerHTML = `
    ${r.photo ? `<img class="detail-photo" src="${r.photo}" alt="${escapeHTML(r.name)}">` : ""}
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
    <button class="danger-btn" id="deleteOneBtn" type="button">この記録を削除</button>
  `;

  document.getElementById("deleteOneBtn").addEventListener("click", () => {
    if (!confirm("この記録を削除しますか？")) return;
    records = records.filter(x => x.id !== id);
    saveRecords();
    detailDialog.close();
    renderAll();
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
});

syncBtn.addEventListener("click", async () => {
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
      photo: r.photo || ""
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
});

pullBtn.addEventListener("click", async () => {
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
      createdAt: r.created_at
    }));

    // -------------------------
    // 既存データと合体
    // 同じIDならクラウド側を採用
    // -------------------------

    const observationMap = new Map(
      observations.map(o => [String(o.id), o])
    );

    downloadedObservations.forEach(o => {
      observationMap.set(String(o.id), o);
    });

    observations = [...observationMap.values()];


    const recordMap = new Map(
      records.map(r => [String(r.id), r])
    );

    downloadedRecords.forEach(r => {
      recordMap.set(String(r.id), r);
    });

    records = [...recordMap.values()];

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
});


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

updateAuthUI();

renderAll();
