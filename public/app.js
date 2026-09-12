// ========================================
// CCAC App - 完整 JavaScript
// ========================================

// 網頁版使用同源相對路徑（本機 wrangler dev 打本機 API、線上打同域 API，自動正確）
// Android 原生 App（Capacitor）的 WebView origin 是 localhost，必須使用絕對網址
const IS_NATIVE_APP = typeof window !== 'undefined' && !!(window.Capacitor && (
    (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
    (window.Capacitor.platform && window.Capacitor.platform !== 'web')
));
const API_URL = IS_NATIVE_APP ? 'https://ccac-api.ccac-church.workers.dev' : '';

// 播客 RSS Feed 一定要用「完整公開網址」先可以提交到 Apple/Spotify 等平台，
// 所以唔可以依賴 API_URL（網頁版係相對路徑）
const PODCAST_BASE_URL = 'https://ccac-api.ccac-church.workers.dev';

// ========================================
// 快取破壞工具函式 - 強制每次都取得最新內容
// ========================================

/**
 * 產生帶有快取破壞參數的 URL
 * 在 Android WebView 中，後端設定的 Cache-Control 過長，導致內容不會更新
 * 加入 timestamp 確保每次請求都是唯一 URL，繞過快取
 */
function cacheBust(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_cb=${Date.now()}`;
}

/**
 * 帶有快取破壞的 fetch 包裝函式
 * 所有 API 呼叫都應該使用此函式，確保取得最新資料
 */
async function cachedFetch(url, options = {}) {
    const cacheBustedUrl = cacheBust(url);
    return fetch(cacheBustedUrl, options);
}

// ========================================
// 圖片輪播設定（首頁）
// ========================================

let currentSlide = 0;
let slideInterval;
let currentPage = 'home';
let cachedPhotos = [];
let eventPhotoInterval;
let currentEventPhotoIndex = 0;

// 講道三層導覽狀態
let sermonView = 'list';        // list | series | player
let sermonSeriesId = null;
let sermonSermonId = null;
let sermonBackView = 'list';

// ========================================
// 首頁輪播 - 從後端載入照片
// ========================================

async function initCarousel() {
    const container = document.getElementById('carouselSlides');
    const dotsContainer = document.getElementById('carouselDots');

    if (!container) return;

    // 嘗試從後端載入照片
    try {
        const response = await cachedFetch(`${API_URL}/api/documents?category=photo&limit=20`);
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            const photos = data.data.map(doc => ({
                id: doc.id,
                url: `${API_URL}/api/documents/${doc.id}/download`,
                title: doc.title
            }));
            renderCarousel(photos.map(p => p.url));
            return;
        }
    } catch (e) {
        console.log('無法從後端載入照片，使用本地照片');
    }

    // 使用本地照片
    const localPhotos = [];
    for (let i = 1; i <= 10; i++) {
        localPhotos.push(`/photo/photo${i}.jpg`);
    }
    
    const validImages = [];
    let loadedCount = 0;
    
    if (localPhotos.length === 0) {
        container.innerHTML = `
            <div class="carousel-slide" style="display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text-light);font-size:14px;flex-direction:column;gap:4px;">
                <span style="font-size:32px;">📸</span>
                <span>尚無照片</span>
                <small style="font-size:11px;">請在後台上傳照片</small>
            </div>
        `;
        return;
    }

    localPhotos.forEach((imgSrc) => {
        const img = new Image();
        img.onload = function() {
            validImages.push(imgSrc);
            loadedCount++;
            if (loadedCount === localPhotos.length) {
                renderCarousel(validImages);
            }
        };
        img.onerror = function() {
            loadedCount++;
            if (loadedCount === localPhotos.length) {
                renderCarousel(validImages);
            }
        };
        img.src = imgSrc;
    });
}

function renderCarousel(images) {
    const container = document.getElementById('carouselSlides');
    const dotsContainer = document.getElementById('carouselDots');

    if (!images || images.length === 0) {
        container.innerHTML = `
            <div class="carousel-slide" style="display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text-light);font-size:14px;flex-direction:column;gap:4px;">
                <span style="font-size:32px;">📸</span>
                <span>尚無照片</span>
                <small style="font-size:11px;">請在後台上傳照片</small>
            </div>
        `;
        return;
    }

    container.innerHTML = images.map((img, index) => `
        <div class="carousel-slide">
            <img src="${img}" alt="教會照片 ${index + 1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">
        </div>
    `).join('');

    dotsContainer.innerHTML = images.map((_, index) => `
        <button class="carousel-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide(${index})"></button>
    `).join('');

    const slides = document.querySelectorAll('#carouselSlides .carousel-slide');
    slides.forEach((slide, i) => {
        slide.style.display = i === 0 ? 'block' : 'none';
    });

    const carousel = document.getElementById('heroCarousel');
    carousel.querySelectorAll('.carousel-arrow').forEach(el => el.remove());

    if (images.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'carousel-arrow prev';
        prevBtn.innerHTML = '‹';
        prevBtn.onclick = (e) => { e.stopPropagation(); prevSlide(); };
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'carousel-arrow next';
        nextBtn.innerHTML = '›';
        nextBtn.onclick = (e) => { e.stopPropagation(); nextSlide(); };

        carousel.appendChild(prevBtn);
        carousel.appendChild(nextBtn);
        startAutoSlide();
    }
}

function goToSlide(index) {
    const slides = document.querySelectorAll('#carouselSlides .carousel-slide');
    const dots = document.querySelectorAll('#carouselDots .carousel-dot');
    
    if (!slides.length) return;
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    
    currentSlide = index;
    
    slides.forEach((slide, i) => {
        slide.style.display = i === index ? 'block' : 'none';
    });
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function nextSlide() {
    goToSlide(currentSlide + 1);
    resetAutoSlide();
}

function prevSlide() {
    goToSlide(currentSlide - 1);
    resetAutoSlide();
}

function startAutoSlide() {
    if (slideInterval) clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, 4000);
}

function resetAutoSlide() {
    clearInterval(slideInterval);
    startAutoSlide();
}

// ========================================
// 活動照片輪播
// ========================================

async function loadEventPhotos() {
    const container = document.getElementById('eventPhotosSlides');
    const dotsContainer = document.getElementById('eventPhotosDots');
    if (!container) return;
    
    try {
        const response = await cachedFetch(`${API_URL}/api/documents?category=photo&limit=20`);
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            const photos = data.data.map(doc => ({
                id: doc.id,
                url: `${API_URL}/api/documents/${doc.id}/download`,
                title: doc.title || '活動照片',
                description: doc.description || ''
            }));
            
            window.eventPhotos = photos;
            
            container.innerHTML = photos.map((p, index) => `
                <div class="carousel-slide" onclick="viewEventPhoto(${index})">
                    <img src="${p.url}" alt="${p.title}" loading="lazy">
                    ${p.title ? `<div class="photo-caption">${p.title}</div>` : ''}
                </div>
            `).join('');
            
            dotsContainer.innerHTML = photos.map((_, index) => `
                <button class="carousel-dot ${index === 0 ? 'active' : ''}" onclick="goToEventPhoto(${index})"></button>
            `).join('');
            
            const slides = container.querySelectorAll('.carousel-slide');
            slides.forEach((slide, i) => {
                slide.style.display = i === 0 ? 'block' : 'none';
            });
            
            currentEventPhotoIndex = 0;
            
            if (photos.length > 1) {
                startEventPhotoSlide();
            }
        } else {
            container.innerHTML = `
                <div class="carousel-slide" style="display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text-light);font-size:14px;flex-direction:column;gap:4px;min-height:150px;">
                    <span style="font-size:32px;">📸</span>
                    <span>尚無活動照片</span>
                    <small style="font-size:11px;">請在後台上傳照片（分類：照片）</small>
                </div>
            `;
        }
    } catch (e) {
        console.error('載入活動照片失敗:', e);
        container.innerHTML = `
            <div class="carousel-slide" style="display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text-light);font-size:14px;flex-direction:column;gap:4px;min-height:150px;">
                <span style="font-size:32px;">⚠️</span>
                <span>無法載入照片</span>
            </div>
        `;
    }
}

function startEventPhotoSlide() {
    if (eventPhotoInterval) clearInterval(eventPhotoInterval);
    eventPhotoInterval = setInterval(() => {
        const slides = document.querySelectorAll('#eventPhotosSlides .carousel-slide');
        if (slides.length <= 1) return;
        const nextIndex = (currentEventPhotoIndex + 1) % slides.length;
        goToEventPhoto(nextIndex);
    }, 4000);
}

function goToEventPhoto(index) {
    const container = document.getElementById('eventPhotosSlides');
    const slides = container ? container.querySelectorAll('.carousel-slide') : [];
    const dots = document.querySelectorAll('#eventPhotosDots .carousel-dot');
    
    if (!slides.length) return;
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    
    currentEventPhotoIndex = index;
    
    slides.forEach((slide, i) => {
        slide.style.display = i === index ? 'block' : 'none';
    });
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function viewEventPhoto(index) {
    const photos = window.eventPhotos || [];
    if (!photos.length || index >= photos.length) {
        showToast('無法載入照片');
        return;
    }
    
    const photo = photos[index];
    showModalWithContent('🖼️ ' + photo.title, `
        <div style="text-align:center;">
            <img src="${photo.url}" alt="${photo.title}" style="max-width:100%;max-height:50vh;border-radius:8px;margin-bottom:12px;">
            ${photo.description ? `<p style="color:var(--text-muted);font-size:13px;">${photo.description}</p>` : ''}
            <p style="color:var(--text-light);font-size:11px;margin-top:8px;">點擊關閉</p>
        </div>
    `);
}

// ========================================
// 頁面切換
// ========================================

function switchPage(page) {
    bibleStopSpeech(); // 離開頁面時停止語音朗讀
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    
    // 更新底部導航
    const navItems = document.querySelectorAll('.nav-item');
    const pageMap = ['home', 'sermons', 'bible', 'events', 'more'];
    navItems.forEach((n, i) => {
        n.classList.toggle('active', pageMap[i] === page);
    });
    
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.scrollTop = 0;
    
    // 根據頁面載入對應內容
    if (page === 'events') {
        renderEventsPage();
        loadEventPhotos();
    } else if (page === 'bible') {
        renderBiblePage();
    } else if (page === 'sermons') {
        renderSermons();
    } else if (page === 'home') {
        renderHomeEvents();
        renderHomeAnnouncements();
    }
}

// ========================================
// API 請求
// ========================================

async function fetchAPI(endpoint, options = {}) {
    try {
        const url = cacheBust(`${API_URL}${endpoint}`);
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        return data.success ? data.data : [];
    } catch (e) {
        console.error('API 錯誤:', e);
        return [];
    }
}

// ========================================
// 數據轉換函數
// ========================================

function transformSermon(sermon) {
    return {
        id: sermon.id,
        title: sermon.title,
        speaker: sermon.speaker,
        date: sermon.date,
        date_short: sermon.date_short || formatDate(sermon.date),
        duration: sermon.duration || '',
        video_id: sermon.video_id,
        youtube_url: sermon.youtube_url,
        thumbnail: sermon.thumbnail_url || (sermon.video_id && sermon.video_id !== 'N/A' ? 
            `https://img.youtube.com/vi/${sermon.video_id}/hqdefault.jpg` : null),
        type: sermon.type || 'video',
        description: sermon.description,
        published: sermon.published,
        series_id: sermon.series_id,
        series_title: sermon.series_title || '',
        series_cover: sermon.series_cover
            ? (String(sermon.series_cover).startsWith('http') ? sermon.series_cover : `${API_URL}${sermon.series_cover}`)
            : null,
        has_audio: !!(sermon.audio_key),
        has_pdf: !!(sermon.pdf_key),
        pdf_name: sermon.pdf_name || '',
        audio_url: sermon.audio_key ? `${API_URL}/api/sermons/${sermon.id}/audio` : null,
        pdf_url: sermon.pdf_key ? `${API_URL}/api/sermons/${sermon.id}/pdf` : null
    };
}

function transformEvent(event) {
    return {
        id: event.id,
        title: event.title,
        month: event.month,
        day: event.day,
        weekday: event.weekday,
        time: event.time,
        location: event.location,
        description: event.description,
        date: event.start_date || event.date,
        published: event.published
    };
}

function transformAnnouncement(ann) {
    return {
        id: ann.id,
        title: ann.title,
        description: ann.description,
        time_label: ann.time_label || '剛剛',
        modal_content: ann.modal_content || ann.description,
        published: ann.published
    };
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
        return dateStr;
    }
}

// ========================================
// 首頁功能
// ========================================

async function renderHomeEvents() {
    const container = document.getElementById('homeEvents');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-light);font-size:13px;">載入中...</div>';
    
    const events = await fetchAPI('/api/events');
    const publishedEvents = events.filter(e => e.published !== 0);
    const latest = publishedEvents.slice(0, 3);

    if (latest.length === 0) {
        container.innerHTML = '<p style="color:var(--text-light);font-size:13px;padding:8px 0;">尚無活動</p>';
        return;
    }

    container.innerHTML = latest.map(e => {
        const event = transformEvent(e);
        return `
            <div class="event-item" onclick="switchPage('events')">
                <div class="event-date-mini">${event.month || ''} ${event.day || ''}</div>
                <div class="event-info-mini">
                    <h4>${event.title}</h4>
                    <p>${event.time || ''} ${event.location ? '• ' + event.location : ''}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function renderHomeAnnouncements() {
    const container = document.getElementById('homeAnnouncements');
    if (!container) return;
    
    const announcements = await fetchAPI('/api/announcements');
    const publishedAnn = announcements.filter(a => a.published !== 0);
    const latest = publishedAnn.slice(0, 2);

    if (latest.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = latest.map(a => {
        const ann = transformAnnouncement(a);
        return `
            <div class="announcement-banner" onclick="switchPage('more')">
                <span class="ann-icon">📢</span>
                <div class="ann-content">
                    <strong>${ann.title}</strong>
                    <span class="ann-time">${ann.time_label}</span>
                </div>
                <span class="ann-arrow">→</span>
            </div>
        `;
    }).join('');
}

async function updateSermonDate() {
    const dateEl = document.getElementById('sermonDate');
    if (!dateEl) return;
    
    const sermons = await fetchAPI('/api/sermons?limit=1');
    const published = sermons.filter(s => s.published !== 0);
    if (published.length > 0) {
        const sermon = transformSermon(published[0]);
        dateEl.textContent = `(${sermon.date_short})`;
    } else {
        dateEl.textContent = '';
    }
}


// ========================================
// 聖經頁面（繁體和合本 • 章節閱讀）
// 資料來源：public/bible/*.json（公有領域 Chinese Union Version, 1919）
// ========================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const BIBLE_VERSIONS = [
    { id: 'cut', label: '和合本' },
    { id: 'cus', label: '简体和合本' },
    { id: 'kjv', label: 'KJV' }
];
let bibleVersion = 'cut';                       // 目前譯本
const bibleIndexPromises = {};                  // version -> Promise(index)
let bibleIndexCache = [];                       // 目前譯本書卷目錄
const bibleBookData = {};                       // 'version:bookId' -> 書卷經文快取
let bibleView = { bookId: null, chapter: null }; // 目前瀏覽狀態
const BIBLE_FONT_SIZES = [15, 17, 19, 22, 25];   // 經文字體大小（px），第 1 級為預設最小
let bibleFontSize = parseInt(localStorage.getItem('bibleFontSize'), 10) || BIBLE_FONT_SIZES[0];
if (!BIBLE_FONT_SIZES.includes(bibleFontSize)) bibleFontSize = BIBLE_FONT_SIZES[0];

// ---- 粵語語音朗讀狀態 ----
// 引擎 1：Web Speech API（Android Chrome 上的 Google 廣東話 / iOS Siri 香港中文）
// 引擎 2（Android 備援）：Capacitor 原生 TTS plugin（@capacitor-community/text-to-speech）
// 當 WebView 不支援 window.speechSynthesis 時，改用 Android 系統 TTS，裝置仍需廣東話語音
const BIBLE_TTS_UNSUPPORTED_MSG = '此裝置不支援語音朗讀。請安裝「Google 文字轉語音」並下載「廣東話」語音，或將 App 更新到最新版本後再試';
const bibleSpeech = {
    supported: (typeof window !== 'undefined' && 'speechSynthesis' in window)
        || !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech),
    synth: (typeof window !== 'undefined' && 'speechSynthesis' in window) ? window.speechSynthesis : null,
    native: !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech),
    voice: null,     // 目前選用的粵語語音
    pref: 'auto',    // 語音偏好：auto | '語音名稱'
    running: false,  // 朗讀進行中
    paused: false,   // 暫停中
    verses: [],      // 目前章節經文陣列
    index: 0,        // 目前朗讀到第幾節
    nativeTimer: null,   // 原生 TTS 無「播完」事件，用計時器估算完成
    nativeOffsets: []    // 每節在整章文字中的起點（onRangeStart 高亮度用）
};
// 讀取上次選用的語音偏好（舊版曾儲存 female/male，現統一以 Google 粵語為預設）
try {
    const p = localStorage.getItem('bibleVoicePref');
    if (p && p !== 'female' && p !== 'male') bibleSpeech.pref = p;
} catch (e) { /* 忽略 */ }

// ---- 伴唱音樂狀態（WebAudio 合成柔和環境和弦，無需音檔，$0） ----
// 在粵語朗讀之下墊一層輕柔的「詩歌」氛圍，營造 thesinging.bible 式誦讀＋音樂效果
const bibleMusic = {
    ctx: null,       // AudioContext
    buffer: null,    // 離線渲染好的 20 秒和弦環境音
    source: null,    // 背景 bufferSource
    gain: null,      // 主音量節點
    enabled: true,   // 伴唱音樂開關
    volume: 0.45,    // 伴唱音樂音量（0~1）
    playing: false,  // 正在播放
    rendering: false // 正在渲染音訊
};
try {
    const m = localStorage.getItem('bibleMusic');
    if (m === '0') bibleMusic.enabled = false;
    const v = parseFloat(localStorage.getItem('bibleMusicVol'));
    if (!isNaN(v)) bibleMusic.volume = Math.max(0, Math.min(1, v));
} catch (e) { /* 忽略 */ }

let bibleR2Audio = null; // 目前播放中的聖經聲音檔（R2 串流）

function bibleVersionLabel(ver) {
    const v = BIBLE_VERSIONS.find(x => x.id === ver);
    return v ? v.label : ver;
}

async function getBibleIndex(ver) {
    if (!bibleIndexPromises[ver]) {
        bibleIndexPromises[ver] = fetch(`/bible/${ver}/index.json`)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }
    return bibleIndexPromises[ver];
}

async function getBibleBook(ver, bookId) {
    const key = `${ver}:${bookId}`;
    if (bibleBookData[key]) return bibleBookData[key];
    const num = String(bookId).padStart(3, '0');
    const res = await fetch(`/bible/${ver}/${num}.json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    bibleBookData[key] = data;
    return data;
}

async function renderBiblePage() {
    const container = document.getElementById('bibleContent');
    if (!container) return;

    bibleStopSpeech(); // 切換書卷／章節／譯本時停止語音朗讀

    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);font-size:13px;">載入中...</div>';

    try {
        const index = await getBibleIndex(bibleVersion);
        bibleIndexCache = index.books || [];
        if (bibleView.bookId && bibleView.chapter) {
            await renderBibleChapter(container, bibleView.bookId, bibleView.chapter);
        } else if (bibleView.bookId) {
            renderBibleChapters(container, bibleView.bookId);
        } else {
            renderBibleIndex(container, index);
        }
    } catch (e) {
        console.error('載入聖經失敗:', e);
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px;font-size:13px;">載入聖經失敗，請稍後再試</p>';
    }
}

// ---- 書卷目錄（舊約 / 新約） ----

function renderBibleIndex(container, index) {
    const ot = bibleIndexCache.filter(b => b.testament === 'OT');
    const nt = bibleIndexCache.filter(b => b.testament === 'NT');
    const bookBtn = b => `
        <button class="bible-book-btn" onclick="bibleOpenBook(${b.id})">
            <span class="bible-book-name">${escapeHtml(b.zh)}</span>
            <span class="bible-book-meta">${b.chapterCount} 章</span>
        </button>`;

    container.innerHTML = `
        ${biblePillsHTML()}
        <div class="bible-version-bar">
            <span class="bible-version-badge">📖 ${escapeHtml(index.label || '繁體和合本')}</span>
            <span class="bible-version-note">點選書卷開始閱讀</span>
        </div>
        <h3 class="bible-section-title">舊約聖經 <small>Old Testament</small></h3>
        <div class="bible-book-grid">${ot.map(bookBtn).join('')}</div>
        <h3 class="bible-section-title">新約聖經 <small>New Testament</small></h3>
        <div class="bible-book-grid">${nt.map(bookBtn).join('')}</div>
        <div id="bibleDocsSection"></div>
    `;

    loadBibleDocs();
    window.scrollTo(0, 0);
}        
// ---- 章節選擇 ----

function renderBibleChapters(container, bookId) {
    const book = bibleIndexCache.find(b => b.id === bookId);
    if (!book) return;

    const chapters = Array.from({ length: book.chapterCount }, (_, i) => i + 1);
    container.innerHTML = `
        ${biblePillsHTML()}
        <button class="bible-back-btn" onclick="bibleBackToIndex()">‹ 書卷目錄</button>
        <div class="bible-reader-title">${escapeHtml(book.zh)} <small>${escapeHtml(book.en || '')}</small></div>
        <p class="bible-reader-sub">${escapeHtml(bibleVersionLabel(bibleVersion))} • 共 ${book.chapterCount} 章，請選擇章節</p>
        <div class="bible-chapter-grid">
            ${chapters.map(c => `<button class="bible-chapter-btn" onclick="bibleOpenChapter(${book.id}, ${c})">${c}</button>`).join('')}
        </div>
    `;
    window.scrollTo(0, 0);
}

// ---- 經文閱讀 ----

async function renderBibleChapter(container, bookId, chapter) {
    const data = await getBibleBook(bibleVersion, bookId);
    const verses = data.chapters[String(chapter)] || [];

    // 計算上一章 / 下一章（可跨書卷）
    let prev = null, next = null;
    const idx = bibleIndexCache.findIndex(b => b.id === bookId);
    if (chapter > 1) {
        prev = { bookId, chapter: chapter - 1, label: `${data.zh} ${chapter - 1}` };
    } else if (idx > 0) {
        const pb = bibleIndexCache[idx - 1];
        prev = { bookId: pb.id, chapter: pb.chapterCount, label: `${pb.zh} ${pb.chapterCount}` };
    }
    const chKeys = Object.keys(data.chapters || {});
    if (chapter < chKeys.length) {
        next = { bookId, chapter: chapter + 1, label: `${data.zh} ${chapter + 1}` };
    } else if (idx >= 0 && idx < bibleIndexCache.length - 1) {
        const nb = bibleIndexCache[idx + 1];
        next = { bookId: nb.id, chapter: 1, label: `${nb.zh} 1` };
    }

    bibleSpeech.verses = verses;
    container.innerHTML = `
        ${biblePillsHTML()}
        <button class="bible-back-btn" onclick="bibleOpenBook(${bookId})">‹ ${escapeHtml(data.zh)} 章節</button>
        <div class="bible-reader-title">${escapeHtml(data.zh)} 第 ${chapter} 章 <small>${escapeHtml(data.en || '')} ${chapter}</small></div>
        <div class="bible-audio-bar">
            <button class="bible-audio-btn" onclick="bibleToggleSpeech()">🔊 播放／暫停</button>
            <button class="bible-audio-btn" onclick="bibleStopSpeech()">⏹ 停止</button>
            <select class="bible-audio-voice" id="bibleAudioVoice" onchange="bibleChangeVoice(this.value)" aria-label="選擇粵語語音">
                ${bibleVoiceOptionsHTML()}
            </select>
            <input type="range" class="bible-music-vol" id="bibleMusicVol" min="0" max="100" step="1" value="${Math.round(bibleMusic.volume * 100)}" oninput="bibleMusicSetVolume(this.value)" aria-label="伴唱音樂音量">
            <span class="bible-audio-state" id="bibleAudioState"></span>
            ${bibleVersion !== 'cut' ? '<span class="bible-audio-hint">粵語朗讀建議使用「和合本」效果最佳</span>' : ''}
        </div>
        <div class="bible-font-bar">
            <button class="bible-font-btn" onclick="bibleFontChange(-1)" aria-label="縮小字體">A－</button>
            <span class="bible-font-size-label">${bibleFontSize}px</span>
            <button class="bible-font-btn bible-font-btn-lg" onclick="bibleFontChange(1)" aria-label="放大字體">A＋</button>
        </div>
        <div class="bible-verses" style="font-size:${bibleFontSize}px">
            ${verses.map((v, i) => `<p class="bible-verse" data-verse="${i}" onclick="bibleSpeakVerseFrom(${i})" title="從此節開始朗讀"><sup class="bible-verse-num">${chapter}:${i + 1}</sup>${escapeHtml(v)}</p>`).join('')}
        </div>
        <div class="bible-chapter-nav">
            ${prev ? `<button class="bible-nav-btn" onclick="bibleGoChapter(${prev.bookId}, ${prev.chapter})">‹ ${escapeHtml(prev.label)}</button>` : '<span></span>'}
            ${next ? `<button class="bible-nav-btn" onclick="bibleGoChapter(${next.bookId}, ${next.chapter})">${escapeHtml(next.label)} ›</button>` : '<span></span>'}
        </div>
    `;
    bibleSpeechClearHighlight();
    bibleRefreshVoiceControl();
    window.scrollTo(0, 0);
}

// ---- 導航（供 inline onclick 使用） ----

function bibleOpenBook(bookId) { bibleView = { bookId, chapter: null }; renderBiblePage(); }
function bibleOpenChapter(bookId, chapter) { bibleView = { bookId, chapter }; renderBiblePage(); }
function bibleBackToIndex() { bibleView = { bookId: null, chapter: null }; renderBiblePage(); }
function bibleGoChapter(bookId, chapter) { bibleView = { bookId, chapter }; renderBiblePage(); }

// 經文字體大小調整（A－ / A＋）：直接更新樣式、不重新渲染，保留目前閱讀位置
function bibleFontChange(dir) {
    const idx = BIBLE_FONT_SIZES.indexOf(bibleFontSize);
    const next = BIBLE_FONT_SIZES[Math.min(BIBLE_FONT_SIZES.length - 1, Math.max(0, idx + dir))];
    if (next === bibleFontSize) {
        showToast(dir > 0 ? '已經是最大字體' : '已經是最小字體');
        return;
    }
    bibleFontSize = next;
    try { localStorage.setItem('bibleFontSize', String(bibleFontSize)); } catch (e) { /* 無法儲存也繼續 */ }
    const verses = document.querySelector('#bibleContent .bible-verses');
    if (verses) verses.style.fontSize = `${bibleFontSize}px`;
    const label = document.querySelector('#bibleContent .bible-font-size-label');
    if (label) label.textContent = `${bibleFontSize}px`;
}

function bibleSwitchVersion(ver) {
    if (BIBLE_VERSIONS.some(v => v.id === ver) && ver !== bibleVersion) {
        bibleVersion = ver;
        renderBiblePage(); // 保持在原書卷/章節，只切換譯本
    }
}

function biblePillsHTML() {
    return `<div class="bible-version-pills">${BIBLE_VERSIONS.map(v =>
        `<button class="bible-pill ${v.id === bibleVersion ? 'active' : ''}" onclick="bibleSwitchVersion('${v.id}')">${escapeHtml(v.label)}</button>`
    ).join('')}</div>`;
}

// ========================================
// 粵語語音朗讀（Web Speech API，零成本，需裝置已安裝粵語 TTS 語音）
// ========================================

let bibleNativeVoices = null; // 原生 TTS 語音清單快取

async function bibleLoadNativeVoices() {
    if (!bibleSpeech.native || bibleNativeVoices) return;
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.TextToSpeech) return;
    try {
        const r = await window.Capacitor.Plugins.TextToSpeech.getSupportedVoices();
        bibleNativeVoices = (r && r.voices) || [];
        bibleSpeechRefreshVoice();
        bibleRefreshVoiceControl();
    } catch (e) { /* 忽略 */ }
}

function bibleGetVoices() {
    if (bibleSpeech.synth) return (bibleSpeech.synth.getVoices && bibleSpeech.synth.getVoices()) || [];
    return bibleNativeVoices || [];
}

// 判斷是否為粵語語音（yue / zh-HK 優先，其次名稱含「粵語／香港」）
function isCantoneseVoice(v) {
    const lang = (v.lang || '').replace('_', '-').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('yue') || lang.startsWith('zh-hk')
        || name.includes('cantonese') || name.includes('粵語') || name.includes('香港');
}

function bibleCantoneseVoices() {
    return bibleGetVoices().filter(isCantoneseVoice);
}

// Google 語音最自然，作為首選（Chrome / Android 上通常是 Google 粵語）
function isGoogleVoice(v) {
    return /google/i.test((v.name || '') + ' ' + (v.voiceURI || ''));
}

// 依偏好選出語音：預設 Google 粵語優先，其次其他粵語語音；亦支援「指定語音名稱」
function biblePickVoice() {
    const voices = bibleCantoneseVoices();
    if (!voices.length) return null;
    const pref = bibleSpeech.pref;
    if (pref && pref !== 'auto') {
        const exact = voices.find(v => v.name === pref);
        if (exact) return exact;
    }
    return voices.find(isGoogleVoice) || voices[0];
}

function bibleSpeechRefreshVoice() {
    const prev = bibleSpeech.voice ? bibleSpeech.voice.name : null;
    bibleSpeech.voice = biblePickVoice();
    if (bibleSpeech.voice && bibleSpeech.voice.name !== prev) {
        bibleRefreshVoiceControl();
    }
}

// 語音選擇器選單代碼（預設 Google 粵語，另有裝置上所有粵語語音可手動選）
function bibleVoiceOptionsHTML() {
    const voices = bibleCantoneseVoices();
    const pref = bibleSpeech.pref || 'auto';
    let html = `<option value="auto" ${pref === 'auto' ? 'selected' : ''}>⭐ Google 粵語（預設）</option>`;
    if (voices.length) {
        html += '<option disabled>── 裝置可用粵語語音 ──</option>';
        html += voices.map(v =>
            `<option value="${escapeHtml(v.name)}" ${pref === v.name ? 'selected' : ''}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`
        ).join('');
    }
    return html;
}

// 重新填滿語音選單（語音清單非同步載入後呼叫）
function bibleRefreshVoiceControl() {
    const sel = document.getElementById('bibleAudioVoice');
    if (!sel) return;
    sel.innerHTML = bibleVoiceOptionsHTML();
    const pref = bibleSpeech.pref || 'auto';
    if (pref === 'auto' || Array.from(sel.options).some(o => o.value === pref)) {
        sel.value = pref;
    }
}

// 使用者變更語音偏好（女聲／男聲／指定語音）
function bibleChangeVoice(val) {
    if (!val) return;
    bibleSpeech.pref = val;
    try { localStorage.setItem('bibleVoicePref', val); } catch (e) { /* 忽略 */ }
    bibleSpeechRefreshVoice();
    if (bibleSpeech.running) {
        const from = bibleSpeech.index || 0;
        bibleSpeechStop(true);        // 安靜停止
        bibleStartSpeech(from);       // 用新語音從同一節重新開始
    } else {
        showToast('語音已更新，按「播放」開始朗讀');
    }
}

// 語音清單非同步載入完成後，更新可選語音（Chrome / Android 需要）
if (bibleSpeech.supported && bibleSpeech.synth && bibleSpeech.synth.onvoiceschanged !== undefined) {
    bibleSpeech.synth.onvoiceschanged = () => {
        bibleSpeechRefreshVoice();
        bibleRefreshVoiceControl();
    };
}

// ========================================
// 伴唱音樂（WebAudio 即時合成柔和和弦墊底音）
// ========================================

function bibleMusicInit() {
    if (bibleMusic.ctx) return bibleMusic.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    bibleMusic.ctx = new Ctor();
    return bibleMusic.ctx;
}

// 離線渲染 20 秒「弦樂 pad」：Cmaj7 - Am7 - F - G，低通濾波 + 回音，柔和耳感
function bibleMusicRenderPad() {
    return new Promise(resolve => {
        const sr = 44100;
        const seconds = 20;
        const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!Offline) { resolve(null); return; }
        const off = new Offline(2, sr * seconds, sr);
        const chords = [
            { notes: [130.81, 164.81, 196.00, 246.94] }, // Cmaj7
            { notes: [110.00, 130.81, 164.81, 220.00] }, // Am7
            { notes: [ 87.31, 130.81, 174.61, 220.00] }, // F
            { notes: [ 98.00, 123.47, 146.83, 196.00] }  // G
        ];
        const chordDur = seconds / chords.length;

        const master = off.createGain();
        master.gain.value = 0.9;
        master.connect(off.destination);

        // 空間感：簡單 delay feedback
        const delay = off.createDelay(1.0);
        delay.delayTime.value = 0.38;
        const fb = off.createGain();
        fb.gain.value = 0.32;
        const wet = off.createGain();
        wet.gain.value = 0.28;
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(wet);
        wet.connect(master);

        const lp = off.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        lp.connect(master);
        lp.connect(delay);

        chords.forEach((chord, ci) => {
            const t0 = ci * chordDur;
            chord.notes.forEach((freq, ni) => {
                const o = off.createOscillator();
                o.type = ni === 0 ? 'sine' : 'triangle';
                o.frequency.value = freq;
                o.detune.value = (ni - 1.5) * 4; // 細微失諧 → 弦樂感
                const g = off.createGain();
                const a = 3.0, r = 2.0;
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.linearRampToValueAtTime(0.22, t0 + a);
                g.gain.setValueAtTime(0.22, t0 + chordDur - r);
                g.gain.linearRampToValueAtTime(0.0001, t0 + chordDur);
                const lfo = off.createOscillator();
                lfo.frequency.value = 0.12 + ci * 0.03 + ni * 0.02;
                const lfoG = off.createGain();
                lfoG.gain.value = 2.5; // 緩慢整顫（cent）
                lfo.connect(lfoG);
                lfoG.connect(o.detune);
                o.connect(g);
                g.connect(lp);
                o.start(t0);
                o.stop(t0 + chordDur + 0.1);
                lfo.start(t0);
                lfo.stop(t0 + chordDur + 0.1);
            });
        });

        // 每個和弦轉換時加上輕柔 arpeggio 旋律，令「詩歌」感更明顯
        chords.forEach((chord, ci) => {
            const t0 = ci * chordDur;
            chord.notes.forEach((freq, ni) => {
                for (let k = 0; k < 2; k++) {
                    const b0 = t0 + ni * 0.28 + k * 1.4;
                    const bell = off.createOscillator();
                    bell.type = 'sine';
                    bell.frequency.value = freq * 2;
                    const bg = off.createGain();
                    bg.gain.setValueAtTime(0.0001, b0);
                    bg.gain.linearRampToValueAtTime(0.045, b0 + 0.04);
                    bg.gain.exponentialRampToValueAtTime(0.0001, b0 + 1.8);
                    bell.connect(bg);
                    bg.connect(master);
                    bell.start(b0);
                    bell.stop(b0 + 1.9);
                }
            });
        });
        off.startRendering().then(buf => {
            bibleMusic.buffer = buf;
            resolve(buf);
        });
    });
}

function bibleMusicPlayNode() {
    const ctx = bibleMusic.ctx;
    if (!ctx || !bibleMusic.buffer) return;
    if (bibleMusic.source) { try { bibleMusic.source.stop(); } catch (e) { /* 忽略 */ } bibleMusic.source = null; }
    if (!bibleMusic.gain) {
        bibleMusic.gain = ctx.createGain();
        bibleMusic.gain.connect(ctx.destination);
    }
    bibleMusic.gain.gain.setTargetAtTime(0.7 * bibleMusic.volume, ctx.currentTime, 0.05);
    const src = ctx.createBufferSource();
    src.buffer = bibleMusic.buffer;
    src.loop = true;
    src.connect(bibleMusic.gain);
    src.start();
    bibleMusic.source = src;
    bibleMusic.playing = true;
}

function bibleMusicStart() {
    if (!bibleMusic.enabled) return;
    const ctx = bibleMusicInit();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (bibleMusic.playing) return;
    if (!bibleMusic.buffer) {
        if (bibleMusic.rendering) return;
        bibleMusic.rendering = true;
        bibleMusicRenderPad().then(() => {
            bibleMusic.rendering = false;
            if (bibleMusic.enabled && !bibleMusic.playing) bibleMusicPlayNode();
        });
        return;
    }
    bibleMusicPlayNode();
}

function bibleMusicPause() {
    if (!bibleMusic.ctx || !bibleMusic.playing) return;
    if (bibleMusic.gain) bibleMusic.gain.gain.setTargetAtTime(0, bibleMusic.ctx.currentTime, 0.05);
    if (bibleMusic.ctx.state === 'running') bibleMusic.ctx.suspend().catch(() => {});
}

function bibleMusicResume() {
    if (!bibleMusic.enabled || !bibleMusic.ctx || !bibleMusic.playing) return;
    if (bibleMusic.ctx.state === 'suspended') bibleMusic.ctx.resume().catch(() => {});
    if (bibleMusic.gain) bibleMusic.gain.gain.setTargetAtTime(0.7 * bibleMusic.volume, bibleMusic.ctx.currentTime, 0.05);
}

function bibleMusicStop() {
    if (!bibleMusic.ctx) return;
    if (bibleMusic.source) { try { bibleMusic.source.stop(); } catch (e) { /* 忽略 */ } bibleMusic.source = null; }
    bibleMusic.playing = false;
    if (bibleMusic.ctx.state === 'running') bibleMusic.ctx.suspend().catch(() => {});
}

// 伴唱音樂開關鈕
function bibleMusicToggle() {
    bibleMusic.enabled = !bibleMusic.enabled;
    try { localStorage.setItem('bibleMusic', bibleMusic.enabled ? '1' : '0'); } catch (e) { /* 忽略 */ }
    if (bibleMusic.enabled) {
        showToast('伴唱音樂已開啟 🎵');
        if (bibleSpeech.running) bibleMusicStart();
    } else {
        showToast('伴唱音樂已關閉');
        bibleMusicStop();
    }
    const btn = document.getElementById('bibleMusicBtn');
    if (btn) btn.textContent = bibleMusic.enabled ? '🎵 伴唱音樂：開' : '🎵 伴唱音樂：關';
}

// 伴唱音樂音量滑桿
function bibleMusicSetVolume(val) {
    bibleMusic.volume = Math.max(0, Math.min(1, parseFloat(val) / 100 || 0));
    try { localStorage.setItem('bibleMusicVol', String(bibleMusic.volume)); } catch (e) { /* 忽略 */ }
    if (bibleMusic.gain && bibleMusic.ctx) {
        bibleMusic.gain.gain.setTargetAtTime(0.7 * bibleMusic.volume, bibleMusic.ctx.currentTime, 0.05);
    }
}

// 試聽伴唱音樂（不朗讀，播放約 6 秒）
let bibleMusicPreviewTimer = null;
function bibleMusicPreview() {
    if (!bibleMusic.enabled) { showToast('請先開啟伴唱音樂'); return; }
    bibleMusicStart();
    showToast('🎵 試聽中…');
    clearTimeout(bibleMusicPreviewTimer);
    bibleMusicPreviewTimer = setTimeout(() => {
        if (!bibleSpeech.running) bibleMusicStop();
    }, 6000);
}

// 首次點擊／觸控時及早建立 AudioContext，確保瀏覽器准許播放聲音
function bibleMusicGestureInit() {
    const ctx = bibleMusicInit();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    document.removeEventListener('pointerdown', bibleMusicGestureInit);
    document.removeEventListener('touchstart', bibleMusicGestureInit);
}
document.addEventListener('pointerdown', bibleMusicGestureInit, { passive: true });
document.addEventListener('touchstart', bibleMusicGestureInit, { passive: true });

// ========================================
// R2 聲音檔播放（AI 生成／真人錄音，串流 API：/api/bible/audio.mp3）
// ========================================

function bibleR2Url(bookId, chapter) {
    return `${API_URL}/api/bible/audio.mp3?ver=${encodeURIComponent(bibleVersion)}&book=${bookId}&ch=${chapter}`;
}

// 檢查是否有聲音檔，有才顯示「📻 播放聲音檔」按鈕
async function bibleUpdateR2Button(bookId, chapter) {
    const btn = document.getElementById('bibleR2Btn');
    if (!btn) return;
    try {
        const res = await fetch(bibleR2Url(bookId, chapter), {
            method: 'HEAD',
            headers: { 'Range': 'bytes=0-0' }
        });
        const available = res.ok && (res.status === 206 || res.status === 200);
        btn.style.display = available ? 'inline-flex' : 'none';
        if (available) btn.innerHTML = '📻 播放聲音檔';
    } catch (e) {
        btn.style.display = 'none';
    }
}

function biblePlayR2Audio() {
    const url = bibleR2Url(bibleView.bookId, bibleView.chapter);
    if (bibleSpeech.running || bibleSpeech.paused) bibleStopSpeech(true);
    const btn = document.getElementById('bibleR2Btn');
    if (!bibleR2Audio) bibleR2Audio = new Audio();
    bibleR2Audio.onended = () => {
        if (btn) btn.innerHTML = '📻 播放聲音檔';
        bibleSpeechSetState('');
    };
    if (bibleR2Audio.paused || !bibleR2Audio.src) {
        bibleR2Audio.src = url;
        bibleR2Audio.play().then(() => {
            bibleSpeechSetState('📻 聲音檔播放中');
            if (btn) btn.innerHTML = '⏸ 暫停聲音檔';
        }).catch(() => {
            showToast('聲音檔載入失敗，可能尚未產生');
            if (btn) btn.innerHTML = '📻 播放聲音檔';
        });
    } else {
        bibleR2Audio.pause();
        if (btn) btn.innerHTML = '📻 播放聲音檔';
        bibleSpeechSetState('');
    }
}

// 語音清單可能是非同步載入（Chrome / 原生 TTS），尚未就緒時稍候重試
function bibleSpeechEnsureVoice(cb) {
    if (bibleSpeech.native && !bibleSpeech.synth) {
        bibleLoadNativeVoices().then(() => {
            bibleSpeechRefreshVoice();
            cb(!!bibleSpeech.voice);
        });
        return;
    }
    bibleSpeechRefreshVoice();
    if (bibleSpeech.voice) { cb(true); return; }
    let tries = 0;
    const retry = () => {
        bibleSpeechRefreshVoice();
        if (bibleSpeech.voice || tries >= 5) cb(!!bibleSpeech.voice);
        else { tries++; setTimeout(retry, 250); }
    };
    setTimeout(retry, 250);
}

function bibleSpeakText(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-HK'; // 廣東話（香港）
    if (bibleSpeech.voice) u.voice = bibleSpeech.voice;
    u.rate = 0.95;    // 朗讀聖經稍慢，更容易聽清
    u.pitch = 1;
    return u;
}

// ---- 原生 TTS 引擎（Android Capacitor plugin，WebView 無 speechSynthesis 時使用） ----

function bibleNativeSpeakChapter(startIndex) {
    const tts = window.Capacitor.Plugins.TextToSpeech;
    const verses = bibleSpeech.verses || [];
    const segs = verses.slice(startIndex);
    if (!segs.length) return;
    const text = segs.join('。\n');

    // 記錄每節經文在整章文字中的起點，onRangeStart 用來高亮度「正在讀的經文」
    bibleSpeech.nativeOffsets = [];
    let off = 0;
    segs.forEach((v, i) => {
        bibleSpeech.nativeOffsets.push({ verse: startIndex + i, start: off });
        off += v.length + 2; // 「。」＋換行
    });

    const voices = bibleNativeVoices || [];
    const vi = bibleSpeech.voice
        ? voices.findIndex(v => v.name === bibleSpeech.voice.name)
        : -1;

    tts.speak({
        text,
        lang: (bibleSpeech.voice && bibleSpeech.voice.lang) || 'yue-HK',
        rate: 0.95,
        pitch: 1,
        queueStrategy: 0, // Flush：取代目前播放
        category: 'ambient',
        ...(vi >= 0 ? { voice: vi } : {})
    });

    // Android 原生 TTS 沒有「播完」事件，以文字長度估算完成時間
    clearTimeout(bibleSpeech.nativeTimer);
    const estMs = Math.max(3000, Math.round(text.length * 215 / 0.95));
    bibleSpeech.nativeTimer = setTimeout(() => {
        bibleSpeechStop();
        showToast('本章已朗讀完畢 🎉');
    }, estMs);
}

// 原生 TTS 的逐字範圍事件 → 高亮度目前經文
if (bibleSpeech.native && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) {
    window.Capacitor.Plugins.TextToSpeech.addListener('onRangeStart', info => {
        if (!bibleSpeech.running) return;
        const offsets = bibleSpeech.nativeOffsets || [];
        const start = info.start || 0;
        let vi = offsets.length - 1;
        for (let i = 0; i < offsets.length; i++) {
            if (start < offsets[i].start) { vi = i - 1; break; }
        }
        if (vi < 0) vi = offsets.length - 1;
        if (vi >= 0) {
            const verse = offsets[vi].verse;
            bibleSpeech.index = verse;
            bibleSpeechHighlight(verse);
            const container = document.getElementById('bibleContent');
            const els = container ? container.querySelectorAll('.bible-verse') : [];
            const el = els[verse];
            if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    });
}

function bibleSpeechHighlight(i) {
    const container = document.getElementById('bibleContent');
    if (!container) return;
    container.querySelectorAll('.bible-verse').forEach((el, idx) => {
        el.classList.toggle('reading', idx === i);
    });
}

function bibleSpeechClearHighlight() {
    const container = document.getElementById('bibleContent');
    if (!container) return;
    container.querySelectorAll('.bible-verse.reading').forEach(el => el.classList.remove('reading'));
}

function bibleSpeechSetState(text) {
    const el = document.getElementById('bibleAudioState');
    if (el) el.textContent = text;
}

// 從指定經文開始朗讀
async function bibleStartSpeech(startIndex) {
    if (!bibleSpeech.supported) {
        showToast(BIBLE_TTS_UNSUPPORTED_MSG);
        return;
    }
    const verses = bibleSpeech.verses || [];
    const container = document.getElementById('bibleContent');
    if (!verses.length || !container) return;

    bibleSpeechEnsureVoice(ok => {
        if (!ok) {
            showToast('未偵測到粵語語音，請在裝置安裝「廣東話」TTS 語音後再試');
            return;
        }
        // 非同步等候語音期間可能已切換章節，重新確認
        const els = container.querySelectorAll('.bible-verse');
        if (!els.length || !container.contains(els[0])) return;

        bibleSpeech.running = true;
        bibleSpeech.paused = false;
        bibleSpeech.index = Math.max(0, Math.min(parseInt(startIndex, 10) || 0, verses.length - 1));

        if (bibleSpeech.synth) {
            // Web Speech API：逐節朗讀，onend 串接下一節
            bibleSpeech.synth.cancel();
            const u = bibleSpeakText(verses[bibleSpeech.index]);
            u.onend = bibleSpeechNext;
            u.onerror = () => bibleSpeechStop('朗讀中斷，請再試一次');
            bibleSpeech.synth.speak(u);
        } else {
            // 原生 TTS：一次朗讀整章，onRangeStart 高亮度目前經文
            bibleNativeSpeakChapter(bibleSpeech.index);
        }

        bibleSpeechHighlight(bibleSpeech.index);
        const el = els[bibleSpeech.index];
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        bibleSpeechSetState('🔊 播放中');
        bibleMusicStart(); // 開始朗讀時同步播放伴唱音樂
    });
}

// 完成一節後朗讀下一節
function bibleSpeechNext() {
    if (!bibleSpeech.running || bibleSpeech.paused) return;
    const verses = bibleSpeech.verses || [];
    if (bibleSpeech.index >= verses.length - 1) {
        bibleSpeechStop();
        showToast('本章已朗讀完畢 🎉');
        return;
    }
    bibleSpeech.index++;
    const container = document.getElementById('bibleContent');
    const els = container ? container.querySelectorAll('.bible-verse') : [];

    const u = bibleSpeakText(verses[bibleSpeech.index]);
    u.onend = bibleSpeechNext;
    u.onerror = () => bibleSpeechStop('朗讀中斷，請再試一次');
    bibleSpeech.synth.speak(u);

    bibleSpeechHighlight(bibleSpeech.index);
    const el = els[bibleSpeech.index];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// 主控制鈕：播放／暫停切換
function bibleToggleSpeech() {
    if (!bibleSpeech.supported) {
        showToast(BIBLE_TTS_UNSUPPORTED_MSG);
        return;
    }
    if (!bibleSpeech.running) {
        bibleStartSpeech(0);
        return;
    }
    if (bibleSpeech.native && !bibleSpeech.synth) {
        // 原生 TTS 不支援暫停：播放中再按＝停止，未播放＝開始
        bibleStopSpeech(true);
        showToast('已停止朗讀');
        return;
    }
    if (bibleSpeech.paused) {
        bibleSpeech.synth.resume();
        bibleSpeech.paused = false;
        bibleSpeechSetState('🔊 播放中');
        bibleMusicResume();
    } else {
        bibleSpeech.synth.pause();
        bibleSpeech.paused = true;
        bibleSpeechSetState('⏸ 已暫停');
        bibleMusicPause();
    }
}

// 點擊某節經文→從該節開始朗讀
function bibleSpeakVerseFrom(i) {
    if (!bibleSpeech.supported) {
        showToast(BIBLE_TTS_UNSUPPORTED_MSG);
        return;
    }
    const verses = bibleSpeech.verses || [];
    if (!verses.length || i < 0 || i >= verses.length) return;
    bibleStartSpeech(i);
}

// 停止朗讀並清除經文標示（切換章節／頁面／譯本時自動呼叫）
function bibleStopSpeech(silent) {
    if (bibleSpeech.synth) {
        try { bibleSpeech.synth.cancel(); } catch (e) { /* 忽略 */ }
    }
    if (bibleSpeech.native && !bibleSpeech.synth) {
        try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) {
                window.Capacitor.Plugins.TextToSpeech.stop();
            }
        } catch (e) { /* 忽略 */ }
        clearTimeout(bibleSpeech.nativeTimer);
    }
    bibleMusicStop(); // 停止朗讀時同步停止伴唱音樂
    if (bibleR2Audio) { // 停止 R2 聲音檔播放
        bibleR2Audio.pause();
        const r2btn = document.getElementById('bibleR2Btn');
        if (r2btn) r2btn.innerHTML = '📻 播放聲音檔';
    }
    if (bibleSpeech.running) {
        bibleSpeech.running = false;
        bibleSpeech.paused = false;
        bibleSpeech.index = 0;
        bibleSpeechClearHighlight();
        bibleSpeechSetState('');
        if (!silent) showToast('已停止朗讀');
    }
}

// ---- 查經資源文檔（保留原功能，顯示於目錄頁下方） ----

async function loadBibleDocs() {
    const section = document.getElementById('bibleDocsSection');
    if (!section) return;
    try {
        const response = await cachedFetch(`${API_URL}/api/documents?category=study&limit=20`);
        const data = await response.json();
        const docs = (data.data || []).filter(d => d.published !== 0);
        if (docs.length === 0) { section.innerHTML = ''; return; }
        section.innerHTML = `
            <h3 class="bible-section-title">查經資源 <small>Documents</small></h3>
            ${docs.map(doc => {
                const isPDF = doc.file_type === 'application/pdf';
                const isImage = doc.file_type && doc.file_type.startsWith('image/');
                const icon = isPDF ? '📄' : isImage ? '🖼️' : '📎';
                const sizeMB = (doc.file_size / 1024 / 1024).toFixed(1);
                return `
                    <div class="bible-doc-item" onclick="downloadDocument(${doc.id}, '${jsStr(doc.file_type || '')}')">
                        <div class="bible-doc-icon">${icon}</div>
                        <div class="bible-doc-info">
                            <h4>${escapeHtml(doc.title)}</h4>
                            <p class="bible-doc-meta">${escapeHtml(doc.file_name)} • ${sizeMB} MB</p>
                            ${doc.description ? `<p class="bible-doc-desc">${escapeHtml(doc.description)}</p>` : ''}
                        </div>
                        <div class="bible-doc-arrow">📥</div>
                    </div>
                `;
            }).join('')}
        `;
    } catch (e) {
        section.innerHTML = '';
    }
}

function downloadDocument(docId, fileType) {
    showToast('📥 正在下載...');
    const url = `${API_URL}/api/documents/${docId}/download`;
    // 手機 App：非圖片檔（PDF / Word 等）改用 Google 檢視器開啟（WebView 無法直接顯示）
    if (IS_NATIVE_APP && !(fileType || '').startsWith('image/')) {
        openPdfUrl(url);
    } else {
        openExternal(url);
    }
}

// ========================================
// 活動頁面
// ========================================

async function renderEventsPage() {
    const container = document.getElementById('eventsList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);font-size:13px;">載入中...</div>';
    
    const events = await fetchAPI('/api/events');
    const publishedEvents = events.filter(e => e.published !== 0);

    if (publishedEvents.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px;font-size:13px;">尚無活動</p>';
        return;
    }

    container.innerHTML = publishedEvents.map(e => {
        const event = transformEvent(e);
        const isPast = isPastEvent(event);
        return `
            <div class="event-card ${isPast ? 'past-event' : 'upcoming-event'}" onclick="showEventDetail(${event.id})">
                <div class="event-date-large">
                    <span class="event-month">${event.month || ''}</span>
                    <span class="event-day">${event.day || ''}</span>
                    <span class="event-weekday">${event.weekday || ''}</span>
                </div>
                <div class="event-details">
                    <h4>${event.title}</h4>
                    <p class="event-time">🕐 ${event.time || '時間待定'}</p>
                    <p class="event-location">📍 ${event.location || '地點待定'}</p>
                    ${event.description ? `<p class="event-desc">${event.description}</p>` : ''}
                    ${isPast ? '<span class="event-badge past">已結束</span>' : '<span class="event-badge upcoming">即將舉行</span>'}
                </div>
                <div class="event-arrow">→</div>
            </div>
        `;
    }).join('');
}

function isPastEvent(event) {
    if (!event.date) return false;
    try {
        const eventDate = new Date(event.date);
        const today = new Date();
        return eventDate < today;
    } catch {
        return false;
    }
}

// ========================================
// 更多頁面
// ========================================

async function renderMoreAnnouncements() {
    const container = document.getElementById('moreAnnouncements');
    if (!container) return;
    
    const announcements = await fetchAPI('/api/announcements');
    const published = announcements.filter(a => a.published !== 0);

    if (published.length === 0) {
        container.innerHTML = '<p style="padding:14px 16px;color:var(--text-light);font-size:13px;">尚無公告</p>';
        return;
    }

    container.innerHTML = published.map(a => {
        const ann = transformAnnouncement(a);
        return `
            <div class="announcement-banner" onclick="showAnnouncementDetail(${ann.id})">
                <span class="ann-icon">📢</span>
                <div class="ann-content">
                    <strong>${ann.title}</strong>
                    <span class="ann-time">${ann.time_label}</span>
                </div>
                <span class="ann-arrow">→</span>
            </div>
        `;
    }).join('');
}

async function showAnnouncementDetail(annId) {
    const announcements = await fetchAPI(`/api/announcements/${annId}`);
    if (!announcements || announcements.length === 0) {
        showToast('無法載入公告詳情');
        return;
    }
    
    const a = transformAnnouncement(announcements[0] || announcements);
    showModalWithContent('📢 ' + a.title, `
        <p style="color:var(--text-muted);font-size:13px;">${a.time_label}</p>
        <p style="margin-top:12px;">${a.modal_content || a.description}</p>
    `);
}

// ========================================
// 活動詳情
// ========================================

async function showEventDetail(eventId) {
    const events = await fetchAPI(`/api/events/${eventId}`);
    if (!events || events.length === 0) {
        showToast('無法載入活動詳情');
        return;
    }
    
    const e = transformEvent(events[0] || events);
    showModalWithContent('📅 ' + e.title, `
        <p><strong>日期：</strong>${e.month || ''} ${e.day || ''} ${e.weekday || ''}</p>
        <p><strong>時間：</strong>${e.time || '待定'}</p>
        ${e.location ? `<p><strong>地點：</strong>${e.location}</p>` : ''}
        ${e.description ? `<p style="margin-top:12px;">${e.description}</p>` : ''}
    `);
}

// ========================================
// 週報
// ========================================

function openNewsletter() {
    cachedFetch(`${API_URL}/api/documents?category=bulletin&limit=1`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data && data.data.length > 0) {
                const doc = data.data[0];
                const url = `${API_URL}/api/documents/${doc.id}/download`;
                if (IS_NATIVE_APP && !(doc.file_type || '').startsWith('image/')) {
                    openPdfUrl(url);
                } else {
                    openExternal(url);
                }
            } else {
                showToast('目前尚無週報');
            }
        })
        .catch(() => showToast('無法載入週報'));
}

// ========================================
// Modal
// ========================================

function showModal(key) {
    const body = document.getElementById('modalBody');
    if (!body) return;

    if (key === 'give') {
        body.innerHTML = `
            <h3>❤️ 奉獻給 CCAC</h3>
            <p class="subtitle">支持事工</p>
            <p style="margin-bottom:16px;">「各人要隨本心所酌定的，不要作難，不要勉強，因為捐得樂意的人是神所喜愛的。」— 哥林多後書 9:7</p>
            <div style="background:var(--bg);padding:14px;border-radius:10px;margin-bottom:10px;">
                <p style="font-size:12px;color:var(--text-muted);margin-bottom:2px;">💳 線上奉獻</p>
                <p style="font-weight:600;">ccacgranadahills.org/give</p>
            </div>
            <button class="modal-close" onclick="closeModal()">關閉</button>
        `;
    } else if (key === 'about') {
        body.innerHTML = `
            <h3>ℹ️ 關於 CCAC</h3>
            <p>CCAC 是一個以三種語言敬拜的基督身體：國語、粤語和英語。</p>
            <p style="margin-top:12px;">我們是一群多元、友善、快樂的基督徒，發現神是奇妙、無限良善的。</p>
            <p style="margin-top:12px;">在學習信靠和跟隨耶穌基督的過程中，我們相信找到了永恆喜樂的秘訣。在學習彼此相愛和愛所有人的過程中，我們尋求與世界分享這份喜樂。</p>
            <button class="modal-close" onclick="closeModal()">關閉</button>
        `;
    }

    document.getElementById('modalOverlay').classList.add('show');
}

function showModalWithContent(title, content) {
    const body = document.getElementById('modalBody');
    if (!body) return;
    
    body.innerHTML = `
        <h3>${title}</h3>
        <div style="margin-top:12px;">${content}</div>
        <button class="modal-close" onclick="closeModal()">關閉</button>
    `;
    
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('modalOverlay').classList.remove('show');
}

// ========================================
// Toast
// ========================================

let toastTimer;

function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove('show');
    }, 2500);
}

// ========================================
// 初始化
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
    renderHomeEvents();
    renderHomeAnnouncements();
    renderSermons();
    renderMoreAnnouncements();
    renderEventsPage();
    renderBiblePage();
    updateSermonDate();
});

// 每 5 分鐘重新整理
setInterval(() => {
    if (currentPage === 'home') {
        renderHomeEvents();
        renderHomeAnnouncements();
        updateSermonDate();
    } else if (currentPage === 'sermons') {
        if (sermonView === 'list') renderSermons();
    } else if (currentPage === 'events') {
        renderEventsPage();
        loadEventPhotos();
    } else if (currentPage === 'bible') {
        if (!bibleSpeech.running) renderBiblePage(); // 朗讀進行中不重新整理，避免中斷
    } else if (currentPage === 'more') {
        renderMoreAnnouncements();
    }
}, 300000);

// ========================================
// 導出全局函數
// ========================================

window.switchPage = switchPage;
window.goToSlide = goToSlide;
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.goToEventPhoto = goToEventPhoto;
window.viewEventPhoto = viewEventPhoto;
window.openYouTube = openYouTube;
window.openNewsletter = openNewsletter;
window.showModal = showModal;
window.showModalWithContent = showModalWithContent;
window.closeModal = closeModal;
window.showToast = showToast;
window.showEventDetail = showEventDetail;
window.showAnnouncementDetail = showAnnouncementDetail;
window.downloadDocument = downloadDocument;
window.bibleToggleSpeech = bibleToggleSpeech;
window.bibleStopSpeech = bibleStopSpeech;
window.bibleSpeakVerseFrom = bibleSpeakVerseFrom;
window.bibleChangeVoice = bibleChangeVoice;
window.bibleMusicToggle = bibleMusicToggle;
window.bibleMusicSetVolume = bibleMusicSetVolume;
window.bibleMusicPreview = bibleMusicPreview;
window.biblePlayR2Audio = biblePlayR2Audio;

console.log('✅ CCAC App 已載入 (完整版)');
console.log('🔗 API URL:', API_URL);
console.log('📱 版本: 3.0.0');
console.log('📊 功能: 首頁 | 講道 | 聖經 | 活動 | 更多');
// ========================================
// 講道系列功能（v3.0 - Subsplash 風格）
// 三層：系列列表 → 系列內頁 → 單篇播放
// 放在檔案尾端，覆蓋舊的 renderSermons / openYouTube
// ========================================

const SERIES_GRADIENTS = [
    'linear-gradient(135deg, #6B4E9B, #8B6FB8)',
    'linear-gradient(135deg, #2A9D8F, #1A7A6E)',
    'linear-gradient(135deg, #C94C72, #A8385A)',
    'linear-gradient(135deg, #3B82F6, #1D4ED8)',
    'linear-gradient(135deg, #D97706, #B45309)',
    'linear-gradient(135deg, #059669, #065F46)',
    'linear-gradient(135deg, #7C3AED, #5B21B6)',
    'linear-gradient(135deg, #DB2777, #9D174D)'
];

function seriesGradient(id) {
    return SERIES_GRADIENTS[Number(id || 0) % SERIES_GRADIENTS.length];
}

function seriesCover(series) {
    if (!series || !series.cover_url) return null;
    return series.cover_url.startsWith('http') ? series.cover_url : `${API_URL}${series.cover_url}`;
}

// 將字串安全地嵌入 onclick="..." 的單引號字串中
function jsStr(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/[\r\n]+/g, ' ');
}

function showSermonView(name) {
    sermonView = name;
    const views = { list: 'sermonSeriesView', series: 'sermonSeriesDetail', player: 'sermonPlayerView' };
    Object.keys(views).forEach(v => {
        const el = document.getElementById(views[v]);
        if (el) el.style.display = v === name ? 'block' : 'none';
    });
}

async function renderSermons() {
    sermonView = 'list';
    sermonSeriesId = null;
    sermonSermonId = null;
    showSermonView('list');

    const container = document.getElementById('seriesListContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading-text">載入講道列表中...</div>';

    const [seriesList, allSermons] = await Promise.all([
        fetchAPI('/api/series'),
        fetchAPI('/api/sermons?limit=200')
    ]);

    const publishedSeries = (seriesList || []).filter(s => s.published !== 0);
    const sermons = (allSermons || []).filter(s => s.published !== 0);

    if (!publishedSeries.length && !sermons.length) {
        container.innerHTML = '<p class="empty-hint">尚無講道資料</p>';
        return;
    }

    // 依 series_id 分組：有系列的歸到所屬系列，沒有的歸到「單次講道」
    const bySeries = new Map();
    const standalone = [];
    sermons.forEach(s => {
        if (s.series_id) {
            if (!bySeries.has(s.series_id)) bySeries.set(s.series_id, []);
            bySeries.get(s.series_id).push(s);
        } else {
            standalone.push(s);
        }
    });

    // 只列「主標題 + 副標題」條目（不展開講道內容，點擊進入系列內頁）
    let html = '';
    publishedSeries.forEach(series => {
        const items = bySeries.get(series.id) || [];
        const sub = series.subtitle || (items.length ? `${items.length} 篇講道` : '尚未上傳');
        html += `
            <div class="series-row" onclick="openSeriesDetail(${series.id})">
                <div class="series-row-icon" style="background:${seriesGradient(series.id)}">📚</div>
                <div class="series-row-text">
                    <h3 class="sr-main">${series.title}</h3>
                    <p class="sr-sub">${sub}</p>
                </div>
                <span class="series-row-arrow">›</span>
            </div>`;
    });

    if (standalone.length) {
        html += `
            <div class="series-row" onclick="openStandaloneDetail()">
                <div class="series-row-icon" style="background:${seriesGradient(null)}">🎤</div>
                <div class="series-row-text">
                    <h3 class="sr-main">單次講道</h3>
                    <p class="sr-sub">${standalone.length} 篇講道</p>
                </div>
                <span class="series-row-arrow">›</span>
            </div>`;
    }

    container.innerHTML = html || '<p class="empty-hint">尚無講道資料</p>';
}

function renderSermonItem(s) {
    const badges = [
        s.has_audio ? '<span class="type-badge audio">🎵 音頻</span>' : '',
        s.has_pdf ? '<span class="type-badge pdf">📄 講義</span>' : '',
        s.video_id && s.video_id !== 'N/A' && s.video_id !== 'dQw4w9WgXcQ' ? '<span class="type-badge youtube">▶ 影片</span>' : ''
    ].filter(Boolean).join('');

    return `
        <div class="sermon-item" onclick="openSermonPlayer(${s.id}, '${s.series_id ? 'series' : 'list'}', ${s.series_id || 'null'})">
            <div class="sermon-icon">
                ${(s.thumbnail || s.series_cover)
                    ? `<img src="${s.thumbnail || s.series_cover}" alt="${s.title}" loading="lazy">`
                    : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
                }
            </div>
            <div class="sermon-info">
                <h4>${s.title}</h4>
                <div class="meta">
                    <span class="speaker">${s.speaker}</span>
                    <span>•</span>
                    <span>${s.date_short}</span>
                    ${s.duration ? `<span>•</span><span>${s.duration}</span>` : ''}
                </div>
                ${badges ? `<div class="sermon-badges">${badges}</div>` : ''}
            </div>
            ${s.has_audio
                ? '<div class="sermon-play"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>'
                : '<div class="sermon-arrow">→</div>'}
        </div>
    `;
}
async function openSeriesDetail(id) {
    sermonView = 'series';
    sermonSeriesId = id;
    sermonSermonId = null;
    showSermonView('series');

    const container = document.getElementById('seriesDetailContent');
    if (!container) return;
    container.innerHTML = '<div class="loading-text">載入系列...</div>';

    const detail = await fetchAPI(`/api/series/${id}`);
    if (!detail || !detail.series) {
        container.innerHTML = '<p class="empty-hint">系列載入失敗或已不存在</p>';
        return;
    }

    const series = detail.series;
    const sermons = (detail.sermons || []).filter(s => s.published !== 0);
    const hasPodcast = sermons.some(s => s.has_audio);

    container.innerHTML = `
        <div class="series-hero" style="background:${seriesGradient(series.id)}">
            ${seriesCover(series) ? `<img src="${seriesCover(series)}" alt="${series.title}" loading="lazy">` : ''}
            <div class="series-hero-overlay">
                <h2>${series.title}</h2>
                ${series.subtitle ? `<p class="hero-subtitle">${series.subtitle}</p>` : ''}
                <p>${series.sermon_count || sermons.length} 篇講道</p>
            </div>
        </div>
        ${series.description ? `<p class="series-desc">${series.description}</p>` : ''}
        ${hasPodcast ? `
            <div class="info-row podcast-row" style="margin-top:12px;" onclick="showSeriesPodcastModal(${series.id}, '${jsStr(series.title)}')">
                <span class="info-icon">🎙️</span>
                <span class="info-label">本系列播客 (RSS)</span>
                <span class="info-arrow">→</span>
            </div>` : ''}
        <div class="sermon-list" style="margin-top:14px;">
            ${sermons.length
                ? sermons.map(s => renderSermonItem(transformSermon(s))).join('')
                : '<p class="empty-hint">此系列尚無講道</p>'}
        </div>
    `;
}

async function openStandaloneDetail() {
    sermonView = 'series';
    sermonSeriesId = null;
    sermonSermonId = null;
    showSermonView('series');

    const container = document.getElementById('seriesDetailContent');
    if (!container) return;
    container.innerHTML = '<div class="loading-text">載入講道...</div>';

    const res = await fetchAPI('/api/sermons?series_id=none&limit=200');
    const sermons = (res || []).filter(s => s.published !== 0);

    container.innerHTML = `
        <div class="series-hero" style="background:${seriesGradient(null)}">
            <div class="series-hero-overlay">
                <h2>🎤 單次講道</h2>
                <p>${sermons.length} 篇講道</p>
            </div>
        </div>
        <div class="sermon-list" style="margin-top:14px;">
            ${sermons.length
                ? sermons.map(s => renderSermonItem(transformSermon(s))).join('')
                : '<p class="empty-hint">尚無講道</p>'}
        </div>
    `;
}

async function openSermonPlayer(id, backView, seriesId) {
    sermonView = 'player';
    sermonSermonId = id;
    sermonBackView = backView || 'list';
    if (seriesId) sermonSeriesId = seriesId;
    showSermonView('player');

    const container = document.getElementById('sermonPlayerContent');
    if (!container) return;
    container.innerHTML = '<div class="loading-text">載入講道...</div>';

    const data = await fetchAPI(`/api/sermons/${id}`);
    if (!data || !data.id) {
        container.innerHTML = '<p class="empty-hint">講道載入失敗或已不存在</p>';
        return;
    }
    const s = transformSermon(data);

    const youtubeBtn = (s.video_id && s.video_id !== 'N/A' && s.video_id !== 'dQw4w9WgXcQ')
        ? `<button class="btn-youtube" onclick="openYouTube('${s.video_id}')">
               <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
               <span>開啟 YouTube 影片</span>
           </button>`
        : '';

    const pdfBtn = s.has_pdf
        ? `<button class="btn-pdf" onclick="openSermonPdf(${s.id})">
               <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
               <span>📄 講道大綱 (PDF)</span>
           </button>`
        : '';

    const audioBlock = s.has_audio
        ? `<div class="audio-wrap">
               <audio controls preload="metadata" src="${s.audio_url}" style="width:100%;"></audio>
               <p class="audio-hint">🎧 播放後可點「講道大綱」同時查看 PDF</p>
           </div>`
        : '<div class="audio-empty">此講道尚未提供音頻，請改用下方選項。</div>';

    container.innerHTML = `
        <div class="sermon-player-card">
            <div class="player-cover">
                ${(s.thumbnail || s.series_cover)
                    ? `<img src="${s.thumbnail || s.series_cover}" alt="${s.title}">`
                    : `<div class="player-cover-fallback" style="background:${seriesGradient(s.series_id)}">🎬</div>`}
                ${s.series_title ? `<span class="player-series-tag">${s.series_title}</span>` : ''}
            </div>
            <h2>${s.title}</h2>
            <div class="player-meta">
                <span>${s.speaker}</span><span>•</span><span>${s.date_short}</span>
                ${s.duration ? `<span>•</span><span>${s.duration}</span>` : ''}
            </div>
            ${audioBlock}
            ${youtubeBtn || pdfBtn ? `<div class="sermon-actions">${youtubeBtn}${pdfBtn}</div>` : ''}
            ${s.description ? `<div class="player-desc"><h4>講道簡介</h4><p>${s.description}</p></div>` : ''}
        </div>
    `;
}

function goBackFromPlayer() {
    if (sermonBackView === 'series' && sermonSeriesId) {
        openSeriesDetail(sermonSeriesId);
    } else {
        renderSermons();
    }
}

function showSermonSeriesList() {
    renderSermons();
}

// Capacitor WebView（手機 App）不支援 window.open 開新視窗（點了沒反應）。
// 改用「頁面導航」：導航到外部網址時，Capacitor 會自動改用系統瀏覽器開啟；
// 桌機瀏覽器則維持原本的開新分頁行為。
function openExternal(url) {
    const full = url.startsWith('http') ? url : `${API_URL}${url}`;
    if (IS_NATIVE_APP) {
        window.location.href = full;
    } else {
        window.open(full, '_blank');
    }
}

// 手機 App 的 WebView 無法直接顯示 PDF（會一片空白），
// 因此包一層 Google 文件檢視器：外部網址 → 系統瀏覽器開啟並渲染 PDF。
function openPdfUrl(url) {
    if (IS_NATIVE_APP) {
        openExternal(`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`);
    } else {
        window.open(url, '_blank');
    }
}

function openSermonPdf(id) {
    showToast('📄 開啟講道大綱...');
    openPdfUrl(`${API_URL}/api/sermons/${id}/pdf`);
}
function openYouTube(videoId) {
    if (!videoId || videoId === 'N/A' || videoId === 'dQw4w9WgXcQ') {
        showToast('此講道尚無影片連結');
        return;
    }
    showToast('開啟 YouTube...');
    openExternal(`https://www.youtube.com/watch?v=${videoId}`);
}

function showPodcastModal() {
    const feedUrl = `${PODCAST_BASE_URL}/feed.xml`;
    showModalWithContent('🎙️ 播客訂閱 (RSS)', `
        <div class="info-row" style="margin-bottom:12px;" onclick="openExternal('https://open.spotify.com/show/3C0KX3UdfIO0UgtGGhkHdx')">
            <span class="info-icon">🎧</span>
            <span class="info-label">在 Spotify 收聽</span>
            <span class="info-arrow">→</span>
        </div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">把播客加入 Apple Podcasts、Spotify、Google Podcasts 等平台，新講道會自動出現：</p>
        <div class="copy-field">
            <code>${feedUrl}</code>
            <button class="copy-btn" onclick="copyRssLink()">複製</button>
        </div>
        <p style="font-size:11px;color:var(--text-light);margin-top:10px;">手機 Podcast App 也可「加入節目」並貼上此網址直接訂閱。</p>
        <p style="font-size:11px;color:var(--text-light);margin-top:6px;">💡 若想將個別系列當成獨立 Podcast 節目，請到「講道 → 系列內頁」取得該系列的專屬 Feed。</p>
    `);
}

function seriesFeedUrl(seriesId) {
    return `${PODCAST_BASE_URL}/feed/series/${seriesId}.xml`;
}

function showSeriesPodcastModal(seriesId, seriesTitle) {
    const feedUrl = seriesFeedUrl(seriesId);
    showModalWithContent('🎙️ 系列播客 (RSS)', `
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">「${seriesTitle || '本系列'}」的專屬 Podcast Feed — 可獨立提交到 Apple Podcasts、Spotify 等平台：</p>
        <div class="copy-field">
            <code>${feedUrl}</code>
            <button class="copy-btn" onclick="copySeriesPodcastLink(${seriesId})">複製</button>
        </div>
        <p style="font-size:11px;color:var(--text-light);margin-top:10px;">此 Feed 只包含本系列中「有 MP3 音頻」且「已發布」的講道；日後新增講道會自動出現。</p>
    `);
}

function copySeriesPodcastLink(seriesId) {
    const text = seriesFeedUrl(seriesId);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast('已複製系列 RSS 網址'), () => showToast('複製失敗'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已複製系列 RSS 網址');
    }
}

function copyRssLink() {
    const text = `${PODCAST_BASE_URL}/feed.xml`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast('已複製 RSS 網址'), () => showToast('複製失敗'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已複製 RSS 網址');
    }
}

// 導出系列功能（供 HTML onclick 使用）
window.openSeriesDetail = openSeriesDetail;
window.openSermonPlayer = openSermonPlayer;
window.goBackFromPlayer = goBackFromPlayer;
window.showSermonSeriesList = showSermonSeriesList;
window.openSermonPdf = openSermonPdf;
window.openExternal = openExternal;
window.showPodcastModal = showPodcastModal;
window.copyRssLink = copyRssLink;
window.showSeriesPodcastModal = showSeriesPodcastModal;
window.copySeriesPodcastLink = copySeriesPodcastLink;

console.log('🎙️ 系列講道功能 v3.1 已載入');
