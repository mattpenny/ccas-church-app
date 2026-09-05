// ========================================
// CCAC App - 完整 JavaScript (完整整合版)
// ========================================

const API_URL = 'https://ccac-api.ccac-church.workers.dev';

// ========================================
// 圖片輪播設定
// ========================================

let currentSlide = 0;
let slideInterval;
let currentPage = 'home';
let cachedPhotos = [];

// ========================================
// 圖片輪播功能 - 從後端載入
// ========================================

async function initCarousel() {
    const container = document.getElementById('carouselSlides');
    const dotsContainer = document.getElementById('carouselDots');

    if (!container) return;

    // 嘗試從後端載入照片 (photo 分類的文檔)
    try {
        const response = await fetch(`${API_URL}/api/documents?category=photo&limit=20`);
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            // 使用後端上傳的照片
            cachedPhotos = data.data.map(doc => ({
                id: doc.id,
                url: `${API_URL}/api/documents/${doc.id}/download`,
                title: doc.title,
                description: doc.description
            }));
            renderCarousel(cachedPhotos.map(p => p.url));
            return;
        }
    } catch (e) {
        console.log('無法從後端載入照片，使用本地照片');
    }

    // 如果後端沒有照片，使用本地照片
    const localPhotos = [];
    for (let i = 1; i <= 10; i++) {
        localPhotos.push(`/photo/photo${i}.jpg`);
    }
    
    // 檢查本地照片是否存在
    const validImages = [];
    let loadedCount = 0;
    
    if (localPhotos.length === 0) {
        container.innerHTML = `
            <div class="carousel-slide" style="display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text-light);font-size:14px;flex-direction:column;gap:4px;">
                <span style="font-size:32px;">📸</span>
                <span>尚無照片</span>
                <small style="font-size:11px;">請在後台上傳照片或將 photo1.jpg 放入 photo 資料夾</small>
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

    const slides = document.querySelectorAll('.carousel-slide');
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
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    
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
// 頁面切換
// ========================================

function switchPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach((n, i) => {
        const pages = ['home', 'sermons', 'bible', 'more'];
        n.classList.toggle('active', pages[i] === page);
    });
    
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.scrollTop = 0;
}

// ========================================
// API 請求
// ========================================

async function fetchAPI(endpoint, options = {}) {
    try {
        const url = `${API_URL}${endpoint}?t=${Date.now()}`;
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
        duration: sermon.duration || '—',
        video_id: sermon.video_id,
        youtube_url: sermon.youtube_url,
        thumbnail: sermon.thumbnail_url || (sermon.video_id && sermon.video_id !== 'N/A' ? 
            `https://img.youtube.com/vi/${sermon.video_id}/hqdefault.jpg` : null),
        type: sermon.type || 'video',
        description: sermon.description,
        published: sermon.published
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
        published: event.published
    };
}

function transformDocument(doc) {
    return {
        id: doc.id,
        title: doc.title,
        file_name: doc.file_name,
        file_size: doc.file_size,
        file_type: doc.file_type,
        category: doc.category,
        description: doc.description,
        download_url: `${API_URL}/api/documents/${doc.id}/download`,
        published: doc.published
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
// 渲染函數
// ========================================

// 首頁活動
async function renderHomeEvents() {
    const container = document.getElementById('homeEvents');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-light);font-size:13px;">載入中...</div>';
    
    const events = await fetchAPI('/api/events');
    // 只顯示已發布的活動
    const publishedEvents = events.filter(e => e.published !== 0);
    const latest = publishedEvents.slice(0, 3);

    if (latest.length === 0) {
        container.innerHTML = '<p style="color:var(--text-light);font-size:13px;padding:8px 0;">尚無活動</p>';
        return;
    }

    container.innerHTML = latest.map(e => {
        const event = transformEvent(e);
        return `
            <div class="event-item" onclick="showEventDetail(${event.id})">
                <div class="event-date-mini">${event.month || ''} ${event.day || ''}</div>
                <div class="event-info-mini">
                    <h4>${event.title}</h4>
                    <p>${event.time || ''} ${event.location ? '• ' + event.location : ''}</p>
                </div>
            </div>
        `;
    }).join('');
}

// 講道列表
async function renderSermons() {
    const container = document.getElementById('sermonList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);font-size:13px;">載入中...</div>';
    
    const sermons = await fetchAPI('/api/sermons?limit=50');
    // 只顯示已發布的講道
    const publishedSermons = sermons.filter(s => s.published !== 0);

    if (publishedSermons.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px;font-size:13px;">尚無講道</p>';
        return;
    }

    container.innerHTML = publishedSermons.map(s => {
        const sermon = transformSermon(s);
        return `
            <div class="sermon-item" onclick="openYouTube('${sermon.video_id || ''}')">
                <div class="sermon-icon">
                    ${sermon.thumbnail ? 
                        `<img src="${sermon.thumbnail}" alt="${sermon.title}" loading="lazy">` :
                        `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
                    }
                </div>
                <div class="sermon-info">
                    <h4>${sermon.title}</h4>
                    <div class="meta">
                        <span class="speaker">${sermon.speaker}</span>
                        <span>•</span>
                        <span>${sermon.date_short}</span>
                        ${sermon.duration && sermon.duration !== '—' ? `<span>•</span><span>${sermon.duration}</span>` : ''}
                    </div>
                </div>
                <div class="sermon-arrow">→</div>
            </div>
        `;
    }).join('');
}

// 首頁公告
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

// 更多頁面公告
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
            <div class="info-row" onclick="showAnnouncementDetail(${ann.id})">
                <span class="info-icon">📢</span>
                <span class="info-label">${ann.title}</span>
                <span style="font-size:10px;color:var(--text-light);margin-right:8px;">${ann.time_label}</span>
                <span class="info-arrow">→</span>
            </div>
        `;
    }).join('');
}

// 更新首頁講道日期
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

// 更新標題日期
function updateHeaderDate() {
    const el = document.getElementById('headerDate');
    if (!el) return;
    const now = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    el.textContent = now.toLocaleDateString('zh-TW', options);
}

// ========================================
// 詳情顯示函數
// ========================================

// 活動詳情
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

// 公告詳情
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
// 工具函數
// ========================================

function openYouTube(videoId) {
    if (!videoId || videoId === 'N/A' || videoId === 'dQw4w9WgXcQ') {
        showToast('此講道尚無影片連結');
        return;
    }
    showToast('開啟 YouTube...');
    setTimeout(() => {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }, 300);
}

// 開啟週報
function openNewsletter() {
    // 嘗試從後端載入最新週報
    fetch(`${API_URL}/api/documents?category=bulletin&limit=1`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data && data.data.length > 0) {
                const doc = data.data[0];
                window.open(`${API_URL}/api/documents/${doc.id}/download`, '_blank');
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
    // 更新標題日期
    updateHeaderDate();
    // 初始化圖片輪播
    initCarousel();
    // 載入資料
    renderHomeEvents();
    renderSermons();
    renderHomeAnnouncements();
    renderMoreAnnouncements();
    updateSermonDate();
});

// 每 5 分鐘重新整理
setInterval(() => {
    renderHomeEvents();
    renderSermons();
    renderHomeAnnouncements();
    renderMoreAnnouncements();
    updateSermonDate();
}, 300000);

// ========================================
// 導出全局函數
// ========================================

window.switchPage = switchPage;
window.goToSlide = goToSlide;
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.openYouTube = openYouTube;
window.openNewsletter = openNewsletter;
window.showModal = showModal;
window.showModalWithContent = showModalWithContent;
window.closeModal = closeModal;
window.showToast = showToast;
window.showEventDetail = showEventDetail;
window.showAnnouncementDetail = showAnnouncementDetail;

console.log('✅ CCAC App 已載入 (完整整合版)');
console.log('🔗 API URL:', API_URL);
console.log('📱 版本: 2.0.0');
console.log('📊 功能: 講道 | 活動 | 公告 | 照片輪播 | 週報');