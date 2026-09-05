// ============================================================
// CCAC Admin Panel - 管理後台
// ============================================================

// 網頁版使用同源相對路徑（本機 wrangler dev 打本機 API、線上打同域 API，自動正確）
// Android 原生 App（Capacitor）的 WebView origin 是 localhost，必須使用絕對網址
const IS_NATIVE_APP = typeof window !== 'undefined' && !!(window.Capacitor && (
    (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
    (window.Capacitor.platform && window.Capacitor.platform !== 'web')
));
const API_URL = IS_NATIVE_APP ? 'https://ccac-api.ccac-church.workers.dev' : '';
let token = localStorage.getItem('adminToken');
let currentTab = 'sermons';

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 30000);
    
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) splash.classList.add('hide');
    }, 2000);

    document.querySelector('.app-container').classList.remove('show-footer');

    if (token) {
        showDashboard();
        loadAllData();
    }
});

// ============================================================
// TIME FUNCTIONS
// ============================================================

function updateTime() {
    const now = new Date();
    let h = now.getHours();
    let m = now.getMinutes();
    const ampm = h >= 12 ? '下午' : '上午';
    h = h % 12 || 12;
    m = m < 10 ? '0' + m : m;
    const el = document.getElementById('statusTime');
    if (el) el.textContent = ampm + ' ' + h + ':' + m;
}

// ============================================================
// TOGGLE PASSWORD VISIBILITY
// ============================================================

function togglePassword() {
    const input = document.getElementById('loginPassword');
    const toggle = document.querySelector('.password-toggle');
    
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
                <line x1="2" y1="2" x2="22" y2="22"/>
            </svg>
        `;
    } else {
        input.type = 'password';
        toggle.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;
    }
}

// ============================================================
// AUTHENTICATION
// ============================================================

function login() {
    const password = document.getElementById('loginPassword');
    if (!password) return;
    
    const pwd = password.value;
    if (!pwd) {
        showToast('請輸入密碼', 'error');
        return;
    }

    fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            token = data.token;
            localStorage.setItem('adminToken', token);
            showToast('登入成功！', 'success');
            showDashboard();
            loadAllData();
        } else {
            showToast('密碼錯誤，請重試', 'error');
        }
    })
    .catch((err) => {
        console.error('登入錯誤:', err);
        showToast('登入失敗，請檢查網路', 'error');
    });
}

function logout() {
    if (!confirm('確定要登出嗎？')) return;
    token = null;
    localStorage.removeItem('adminToken');
    showLogin();
    showToast('已登出');
}

function showLogin() {
    document.getElementById('page-login').classList.add('active');
    document.getElementById('page-dashboard').classList.remove('active');
    document.querySelector('.app-container').classList.remove('show-footer');
}

function showDashboard() {
    document.getElementById('page-login').classList.remove('active');
    document.getElementById('page-dashboard').classList.add('active');
    document.querySelector('.app-container').classList.add('show-footer');
}

// ============================================================
// TAB NAVIGATION
// ============================================================

function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navMap = { sermons: 0, series: 1, documents: 2, events: 3, announcements: 4 };
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems[navMap[tab]]) navItems[navMap[tab]].classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const tabContent = document.getElementById(`tab-${tab}`);
    if (tabContent) tabContent.classList.add('active');
    
    loadTabData(tab);
}

// ============================================================
// DATA LOADING
// ============================================================

function loadAllData() {
    loadStats();
    loadTabData('sermons');
}

function loadStats() {
    const endpoints = [
        { id: 'statSermons', url: '/api/sermons' },
        { id: 'statDocuments', url: '/api/documents' },
        { id: 'statEvents', url: '/api/events' },
        { id: 'statAnnouncements', url: '/api/announcements' }
    ];

    endpoints.forEach(({ id, url }) => {
        fetch(`${API_URL}${url}`)
            .then(res => res.json())
            .then(data => {
                const el = document.getElementById(id);
                if (el) el.textContent = data.data ? data.data.length : 0;
            })
            .catch(() => {});
    });
}

function loadTabData(tab) {
    switch(tab) {
        case 'sermons': loadSermons(); break;
        case 'series': loadSeries(); break;
        case 'documents': loadDocuments(); break;
        case 'events': loadEvents(); break;
        case 'announcements': loadAnnouncements(); break;
    }
}

// ============================================================
// LOAD SERMONS（依系列分組、預設收合、點擊展開）
// ============================================================

// 已展開的講道分組（預設全部收合）
const expandedSermonGroups = new Set();

function sermonItemHtml(s) {
    return `
                <div class="list-item">
                    <div class="item-info">
                        <h4>${escapeHtml(s.title)}</h4>
                        <div class="item-meta">
                            ${escapeHtml(s.speaker)} • ${escapeHtml(s.date)}
                            <span class="type-badge ${s.type}">${s.type === 'video' ? '🎬 影片' : '🎵 音頻'}</span>
                            ${s.video_id && s.video_id !== 'N/A' ? `<span class="type-badge youtube">▶ YouTube</span>` : ''}
                            ${s.audio_key ? '<span class="type-badge audio">🎵 MP3</span>' : ''}
                            ${s.pdf_key ? '<span class="type-badge pdf">📄 講義</span>' : ''}
                            ${s.published === 1 ? '<span class="type-badge published">✅ 已發布</span>' : '<span class="type-badge unpublished">⛔ 隱藏</span>'}
                        </div>
                    </div>
                    <div class="item-actions">
                        ${s.video_id && s.video_id !== 'N/A' ? `
                            <button class="btn-play" onclick="playSermon('${s.video_id}')" title="播放">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                            </button>
                        ` : ''}
                        <button class="btn-edit" onclick="editSermon(${s.id})" title="編輯">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-delete" onclick="deleteItem('sermon', ${s.id})" title="刪除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
}

function toggleSermonGroup(key) {
    const group = document.getElementById(`sermonGroup-${key}`);
    if (!group) return;
    const body = group.querySelector('.sermon-group-body');
    const isOpen = group.classList.toggle('expanded');
    if (body) body.style.display = isOpen ? '' : 'none';
    if (isOpen) {
        expandedSermonGroups.add(key);
    } else {
        expandedSermonGroups.delete(key);
    }
}

function loadSermons() {
    Promise.all([
        fetch(`${API_URL}/api/sermons`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()),
        fetch(`${API_URL}/api/series`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).catch(() => ({ data: [] }))
    ])
    .then(([sermonsRes, seriesRes]) => {
        const container = document.getElementById('sermonsList');
        if (!container) return;

        const sermons = sermonsRes.data || [];
        const seriesList = seriesRes.data || [];

        if (sermons.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>📖 暫無講道資料</p></div>`;
            return;
        }

        // 依 series_id 分組
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

        const groupHtml = (key, icon, title, subtitle, items) => {
            const isOpen = expandedSermonGroups.has(key);
            return `
                <div class="sermon-group ${isOpen ? 'expanded' : ''}" id="sermonGroup-${key}">
                    <div class="sermon-group-header" onclick="toggleSermonGroup('${key}')">
                        <span class="sg-chevron">▶</span>
                        <div class="sg-info">
                            <h4>${icon} ${escapeHtml(title)}</h4>
                            ${subtitle ? `<div class="sg-subtitle">${escapeHtml(subtitle)}</div>` : ''}
                        </div>
                        <span class="sg-count">${items.length} 篇</span>
                    </div>
                    <div class="sermon-group-body" ${isOpen ? '' : 'style="display:none;"'}>
                        ${items.length
                            ? items.map(sermonItemHtml).join('')
                            : '<div class="sg-empty">此系列尚無講道</div>'}
                    </div>
                </div>
            `;
        };

        let html = '';

        // 各系列分組（照系列排序）
        seriesList.forEach(series => {
            const items = bySeries.get(series.id) || [];
            html += groupHtml(`series-${series.id}`, '📚', series.title, series.subtitle || '', items);
            bySeries.delete(series.id);
        });

        // 所屬系列已不存在（被刪除）的講道
        bySeries.forEach((items, seriesId) => {
            html += groupHtml(`series-${seriesId}`, '📚', `系列 #${seriesId}`, '', items);
        });

        // 單次講道（不屬於任何系列）
        if (standalone.length) {
            html += groupHtml('standalone', '🎤', '單次講道', '', standalone);
        }

        container.innerHTML = html;
    })
    .catch(() => showToast('載入講道失敗', 'error'));
}

// ============================================================
// PLAY SERMON（播放功能）
// ============================================================

function playSermon(videoId) {
    if (!videoId || videoId === 'N/A') {
        showToast('此講道尚無影片連結', 'error');
        return;
    }
    
    const modal = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    
    body.innerHTML = `
        <h3>🎬 播放講道</h3>
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px;margin:12px 0;">
            <iframe 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
            </iframe>
        </div>
        <button class="modal-close" onclick="closeModal()">關閉</button>
    `;
    
    modal.classList.add('show');
}

// ============================================================
// EDIT FUNCTIONS（完整編輯功能）
// ============================================================

function editSermon(id) {
    fetch(`${API_URL}/api/sermons/${id}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showEditModal('sermon', data.data);
            } else {
                showToast('載入講道資料失敗', 'error');
            }
        })
        .catch(() => showToast('載入失敗，請檢查網路', 'error'));
}

function editEvent(id) {
    fetch(`${API_URL}/api/events/${id}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showEditModal('event', data.data);
            } else {
                showToast('載入活動資料失敗', 'error');
            }
        })
        .catch(() => showToast('載入失敗，請檢查網路', 'error'));
}

function editAnnouncement(id) {
    fetch(`${API_URL}/api/announcements/${id}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showEditModal('announcement', data.data);
            } else {
                showToast('載入公告資料失敗', 'error');
            }
        })
        .catch(() => showToast('載入失敗，請檢查網路', 'error'));
}

// ============================================================
// SHOW EDIT MODAL
// ============================================================

function showEditModal(type, data) {
    const modal = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    
    let html = '';
    
    if (type === 'sermon') {
        const audioStatus = data.audio_key
            ? `<span class="type-badge audio">🎵 已有音頻：${escapeHtml(data.audio_name || 'MP3')}</span>`
            : '<span style="color:var(--text-light);font-size:12px;">尚未上傳音頻</span>';
        const pdfStatus = data.pdf_key
            ? `<span class="type-badge pdf">📄 已有大綱：${escapeHtml(data.pdf_name || 'PDF')}</span>`
            : '<span style="color:var(--text-light);font-size:12px;">尚未上傳大綱</span>';
        html = `
            <h3>✏️ 編輯講道</h3>
            <p class="subtitle">修改講道資訊</p>
            <div class="form-group">
                <label>標題 <span style="color:#EF4444;">*</span></label>
                <input type="text" id="editSermonTitle" value="${escapeHtml(data.title || '')}">
            </div>
            <div class="form-group">
                <label>講員 <span style="color:#EF4444;">*</span></label>
                <input type="text" id="editSermonSpeaker" value="${escapeHtml(data.speaker || '')}">
            </div>
            <div class="form-group">
                <label>日期 <span style="color:#EF4444;">*</span></label>
                <input type="date" id="editSermonDate" value="${data.date || ''}">
            </div>
            <div class="form-group">
                <label>所屬系列</label>
                <select id="editSermonSeries">
                    <option value="">— 單次講道（不屬於系列）—</option>
                </select>
            </div>
            <div class="form-group">
                <label>YouTube 影片 ID（選填）</label>
                <input type="text" id="editSermonVideoId" value="${escapeHtml(data.video_id === 'N/A' ? '' : (data.video_id || ''))}" placeholder="可留空（純音頻講道）">
                <small style="color:var(--text-light);font-size:11px;display:block;margin-top:4px;">
                    💡 聽眾可選擇看 YouTube 或聽 MP3 音頻
                </small>
            </div>
            <div class="form-group">
                <label>時長</label>
                <input type="text" id="editSermonDuration" value="${escapeHtml(data.duration || '')}" placeholder="例如：42:18">
            </div>
            <div class="form-group">
                <label>類型</label>
                <select id="editSermonType">
                    <option value="video" ${data.type === 'video' ? 'selected' : ''}>🎬 影片</option>
                    <option value="audio" ${data.type === 'audio' ? 'selected' : ''}>🎵 音頻</option>
                </select>
            </div>
            <div class="form-group">
                <label>講道簡介</label>
                <textarea id="editSermonDescription" rows="3" placeholder="顯示在講道播放頁的簡介...">${escapeHtml(data.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>發布狀態</label>
                <select id="editSermonPublished">
                    <option value="1" ${data.published === 1 ? 'selected' : ''}>✅ 已發布</option>
                    <option value="0" ${data.published === 0 ? 'selected' : ''}>⛔ 隱藏</option>
                </select>
            </div>
            <div class="asset-box">
                <label class="asset-label">🎵 音頻檔 (MP3)</label>
                <div id="editSermonAudioStatus" class="asset-status">${audioStatus}</div>
                <input type="file" id="editSermonAudioFile" accept=".mp3,audio/mpeg" style="display:none;" onchange="uploadSermonAsset(${data.id}, 'audio')">
                <button type="button" class="btn-upload secondary" onclick="document.getElementById('editSermonAudioFile').click()">⬆️ 上傳 / 更新 MP3</button>
                ${data.audio_key ? `<button type="button" class="btn-upload danger" onclick="deleteSermonAsset(${data.id}, 'audio')">🗑️ 移除音頻</button>` : ''}
            </div>
            <div class="asset-box">
                <label class="asset-label">📄 講道大綱 (PDF)</label>
                <div id="editSermonPdfStatus" class="asset-status">${pdfStatus}</div>
                <input type="file" id="editSermonPdfFile" accept=".pdf,application/pdf" style="display:none;" onchange="uploadSermonAsset(${data.id}, 'pdf')">
                <button type="button" class="btn-upload secondary" onclick="document.getElementById('editSermonPdfFile').click()">⬆️ 上傳 / 更新 PDF</button>
                ${data.pdf_key ? `<button type="button" class="btn-upload danger" onclick="deleteSermonAsset(${data.id}, 'pdf')">🗑️ 移除大綱</button>` : ''}
            </div>
            <button class="btn-upload" onclick="updateSermon(${data.id})">💾 儲存修改</button>
            <button class="btn-upload secondary" onclick="closeModal()">取消</button>
        `;
    } else if (type === 'series') {
        html = `
            <h3>✏️ 編輯系列</h3>
            <p class="subtitle">修改系列資訊</p>
            <div class="form-group">
                <label>系列名稱 <span style="color:#EF4444;">*</span></label>
                <input type="text" id="editSeriesTitle" value="${escapeHtml(data.title || '')}">
            </div>
            <div class="form-group">
                <label>副標題</label>
                <input type="text" id="editSeriesSubtitle" value="${escapeHtml(data.subtitle || '')}" placeholder="顯示在系列名稱下方">
            </div>
            <div class="form-group">
                <label>系列描述</label>
                <textarea id="editSeriesDescription" rows="3" placeholder="此系列的簡介...">${escapeHtml(data.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>排序（數字越小越前面）</label>
                <input type="number" id="editSeriesSort" value="${data.sort_order !== undefined ? data.sort_order : 0}">
            </div>
            <div class="form-group">
                <label>發布狀態</label>
                <select id="editSeriesPublished">
                    <option value="1" ${data.published === 1 ? 'selected' : ''}>✅ 已發布</option>
                    <option value="0" ${data.published === 0 ? 'selected' : ''}>⛔ 隱藏</option>
                </select>
            </div>
            <div class="asset-box">
                <label class="asset-label">🖼️ 系列封面圖</label>
                <div id="editSeriesCoverStatus" class="asset-status">
                    ${data.cover_url
                        ? `<img src="${escapeHtml(data.cover_url.startsWith('http') ? data.cover_url : API_URL + data.cover_url)}" style="max-width:120px;border-radius:8px;display:block;margin-bottom:6px;" alt="封面">`
                        : '<span style="color:var(--text-light);font-size:12px;">尚未上傳封面（未上傳時 App 會使用漸層色封面）</span>'}
                </div>
                <input type="file" id="editSeriesCoverFile" accept=".jpg,.jpeg,.png,.webp,.gif,image/*" style="display:none;" onchange="uploadSeriesCoverFile(${data.id})">
                <button type="button" class="btn-upload secondary" onclick="document.getElementById('editSeriesCoverFile').click()">⬆️ 上傳 / 更新封面</button>
            </div>
            <button class="btn-upload" onclick="updateSeries(${data.id})">💾 儲存修改</button>
            <button class="btn-upload secondary" onclick="closeModal()">取消</button>
        `;
    } else if (type === 'event') {
        html = `
            <h3>✏️ 編輯活動</h3>
            <p class="subtitle">修改活動資訊</p>
            <div class="form-group">
                <label>標題 <span style="color:#EF4444;">*</span></label>
                <input type="text" id="editEventTitle" value="${escapeHtml(data.title || '')}">
            </div>
            <div class="form-group">
                <label>日期</label>
                <input type="date" id="editEventDate" value="${data.start_date ? data.start_date.split('T')[0] : ''}">
            </div>
            <div class="form-group">
                <label>星期</label>
                <select id="editEventWeekday">
                    <option value="週日" ${data.weekday === '週日' ? 'selected' : ''}>週日</option>
                    <option value="週一" ${data.weekday === '週一' ? 'selected' : ''}>週一</option>
                    <option value="週二" ${data.weekday === '週二' ? 'selected' : ''}>週二</option>
                    <option value="週三" ${data.weekday === '週三' ? 'selected' : ''}>週三</option>
                    <option value="週四" ${data.weekday === '週四' ? 'selected' : ''}>週四</option>
                    <option value="週五" ${data.weekday === '週五' ? 'selected' : ''}>週五</option>
                    <option value="週六" ${data.weekday === '週六' ? 'selected' : ''}>週六</option>
                </select>
            </div>
            <div class="form-group">
                <label>時間</label>
                <input type="text" id="editEventTime" value="${escapeHtml(data.time || '')}">
            </div>
            <div class="form-group">
                <label>地點</label>
                <input type="text" id="editEventLocation" value="${escapeHtml(data.location || '')}">
            </div>
            <div class="form-group">
                <label>發布狀態</label>
                <select id="editEventPublished">
                    <option value="1" ${data.published === 1 ? 'selected' : ''}>✅ 已發布</option>
                    <option value="0" ${data.published === 0 ? 'selected' : ''}>⛔ 隱藏</option>
                </select>
            </div>
            <button class="btn-upload" onclick="updateEvent(${data.id})">💾 儲存修改</button>
            <button class="btn-upload secondary" onclick="closeModal()">取消</button>
        `;
    } else if (type === 'announcement') {
        html = `
            <h3>✏️ 編輯公告</h3>
            <p class="subtitle">修改公告資訊</p>
            <div class="form-group">
                <label>標題 <span style="color:#EF4444;">*</span></label>
                <input type="text" id="editAnnTitle" value="${escapeHtml(data.title || '')}">
            </div>
            <div class="form-group">
                <label>描述 <span style="color:#EF4444;">*</span></label>
                <textarea id="editAnnDesc" rows="2">${escapeHtml(data.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>時間標籤</label>
                <input type="text" id="editAnnTime" value="${escapeHtml(data.time_label || '剛剛')}">
            </div>
            <div class="form-group">
                <label>發布狀態</label>
                <select id="editAnnPublished">
                    <option value="1" ${data.published === 1 ? 'selected' : ''}>✅ 已發布</option>
                    <option value="0" ${data.published === 0 ? 'selected' : ''}>⛔ 隱藏</option>
                </select>
            </div>
            <button class="btn-upload" onclick="updateAnnouncement(${data.id})">💾 儲存修改</button>
            <button class="btn-upload secondary" onclick="closeModal()">取消</button>
        `;
    }
    
    body.innerHTML = html;
    modal.classList.add('show');

    if (type === 'sermon') {
        populateSeriesSelect('editSermonSeries', data.series_id);
    }
}

// ============================================================
// UPDATE FUNCTIONS（PUT 請求）
// ============================================================

function updateSermon(id) {
    const title = document.getElementById('editSermonTitle');
    const speaker = document.getElementById('editSermonSpeaker');
    const date = document.getElementById('editSermonDate');
    const videoId = document.getElementById('editSermonVideoId');
    const duration = document.getElementById('editSermonDuration');
    const type = document.getElementById('editSermonType');
    const published = document.getElementById('editSermonPublished');
    const seriesSel = document.getElementById('editSermonSeries');
    const desc = document.getElementById('editSermonDescription');
    
    if (!title || !speaker || !date || !videoId || !type || !published) {
        showToast('請填寫所有必填欄位', 'error');
        return;
    }
    
    const data = {
        title: title.value.trim(),
        speaker: speaker.value.trim(),
        date: date.value,
        video_id: videoId.value.trim() || 'N/A',
        duration: duration ? duration.value.trim() : '',
        type: type.value,
        description: desc ? desc.value.trim() : '',
        series_id: seriesSel && seriesSel.value ? parseInt(seriesSel.value) : null,
        published: parseInt(published.value)
    };
    
    if (!data.title || !data.speaker || !data.date) {
        showToast('請填寫標題、講員和日期', 'error');
        return;
    }
    
    fetch(`${API_URL}/api/sermons/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ 講道更新成功！', 'success');
            closeModal();
            loadSermons();
            loadStats();
        } else {
            showToast('更新失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('更新失敗，請檢查網路', 'error'));
}

function updateEvent(id) {
    const title = document.getElementById('editEventTitle');
    const date = document.getElementById('editEventDate');
    const weekday = document.getElementById('editEventWeekday');
    const time = document.getElementById('editEventTime');
    const location = document.getElementById('editEventLocation');
    const published = document.getElementById('editEventPublished');
    
    if (!title || !date || !weekday || !time || !location || !published) {
        showToast('請填寫所有欄位', 'error');
        return;
    }
    
    const dateVal = new Date(date.value);
    if (isNaN(dateVal.getTime())) {
        showToast('請選擇有效日期', 'error');
        return;
    }
    const month = dateVal.getMonth() + 1;
    
    const data = {
        title: title.value.trim(),
        day: dateVal.getDate(),
        month: `${month}月`,
        weekday: weekday.value,
        time: time.value.trim(),
        location: location.value.trim(),
        start_date: dateVal.toISOString(),
        published: parseInt(published.value)
    };
    
    if (!data.title || !data.day || !data.time || !data.location) {
        showToast('請填寫所有必填欄位', 'error');
        return;
    }
    
    fetch(`${API_URL}/api/events/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ 活動更新成功！', 'success');
            closeModal();
            loadEvents();
            loadStats();
        } else {
            showToast('更新失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('更新失敗，請檢查網路', 'error'));
}

function updateAnnouncement(id) {
    const title = document.getElementById('editAnnTitle');
    const desc = document.getElementById('editAnnDesc');
    const time = document.getElementById('editAnnTime');
    const published = document.getElementById('editAnnPublished');
    
    if (!title || !desc || !time || !published) {
        showToast('請填寫所有欄位', 'error');
        return;
    }
    
    const data = {
        title: title.value.trim(),
        description: desc.value.trim(),
        time_label: time.value.trim() || '剛剛',
        published: parseInt(published.value)
    };
    
    if (!data.title || !data.description) {
        showToast('請填寫標題和描述', 'error');
        return;
    }
    
    fetch(`${API_URL}/api/announcements/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ 公告更新成功！', 'success');
            closeModal();
            loadAnnouncements();
            loadStats();
        } else {
            showToast('更新失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('更新失敗，請檢查網路', 'error'));
}

// ============================================================
// SERIES MANAGEMENT（系列管理）
// ============================================================

let seriesOrderCache = [];

function loadSeries() {
    fetch(`${API_URL}/api/series`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('seriesList');
        if (!container) return;

        if (!data.data || data.data.length === 0) {
            seriesOrderCache = [];
            container.innerHTML = `<div class="empty-state"><p>📚 暫無系列。點上方「📚 新增系列」建立第一個系列。</p></div>`;
            return;
        }

        // 記住目前順序，供 ▲▼ 上移/下移使用
        seriesOrderCache = data.data.map(s => s.id);
        const total = data.data.length;

        container.innerHTML = data.data.map((s, i) => `
            <div class="list-item">
                <div class="item-info">
                    <h4><span class="order-num">${i + 1}</span>${escapeHtml(s.title)}</h4>
                    ${s.subtitle ? `<p style="margin:2px 0 4px;font-size:13px;color:var(--text-light);">${escapeHtml(s.subtitle)}</p>` : ''}
                    <div class="item-meta">
                        📖 ${s.sermon_count || 0} 篇講道
                        ${s.published === 1 ? '<span class="type-badge published">✅ 已發布</span>' : '<span class="type-badge unpublished">⛔ 隱藏</span>'}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-move" onclick="moveSeries(${s.id}, -1)" title="上移（在 App 中排更前面）" ${i === 0 ? 'disabled' : ''}>▲</button>
                    <button class="btn-move" onclick="moveSeries(${s.id}, 1)" title="下移（在 App 中排更後面）" ${i === total - 1 ? 'disabled' : ''}>▼</button>
                    <button class="btn-edit" onclick="editSeries(${s.id})" title="編輯">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-delete" onclick="deleteItem('series', ${s.id})" title="刪除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('') + `<p style="font-size:12px;color:var(--text-light);margin-top:10px;">💡 用 ▲▼ 調整系列在 App 中的列出順序（第 1 位排最前）</p>`;
    })
    .catch(() => showToast('載入系列失敗', 'error'));
}

function moveSeries(id, dir) {
    const ids = seriesOrderCache.slice();
    const idx = ids.indexOf(id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= ids.length) return;

    const tmp = ids[idx];
    ids[idx] = ids[target];
    ids[target] = tmp;

    showToast('⏳ 正在更新排序...');

    fetch(`${API_URL}/api/series/reorder`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ 排序已更新！', 'success');
            loadSeries();
        } else {
            showToast('排序更新失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('排序更新失敗，請檢查網路', 'error'));
}

function editSeries(id) {
    fetch(`${API_URL}/api/series/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.data && data.data.series) {
            showEditModal('series', data.data.series);
        } else {
            showToast('載入系列資料失敗', 'error');
        }
    })
    .catch(() => showToast('載入失敗，請檢查網路', 'error'));
}

function submitSeries() {
    const title = document.getElementById('seriesTitle');
    const subtitle = document.getElementById('seriesSubtitle');
    const desc = document.getElementById('seriesDescription');
    const sort = document.getElementById('seriesSort');
    const coverInput = document.getElementById('seriesCoverFile');

    if (!title) return;
    const titleVal = title.value.trim();
    if (!titleVal) {
        showToast('請填寫系列名稱', 'error');
        return;
    }

    showToast('⏳ 正在建立系列...');

    fetch(`${API_URL}/api/series`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            title: titleVal,
            subtitle: subtitle ? subtitle.value.trim() : '',
            description: desc ? desc.value.trim() : '',
            sort_order: sort && sort.value !== '' ? parseInt(sort.value) : 0
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const newId = data.data && data.data.id;
            if (newId && coverInput && coverInput.files[0]) {
                uploadSeriesCoverRequest(newId, coverInput.files[0])
                    .then(() => {
                        showToast('✅ 系列與封面上傳成功！', 'success');
                        closeModal();
                        loadSeries();
                    })
                    .catch(() => {
                        showToast('⚠️ 系列已建立，但封面上傳失敗，可在編輯中重試', 'error');
                        closeModal();
                        loadSeries();
                    });
            } else {
                showToast('✅ 系列建立成功！', 'success');
                closeModal();
                loadSeries();
            }
        } else {
            showToast('建立失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('建立失敗，請檢查網路', 'error'));
}

function updateSeries(id) {
    const title = document.getElementById('editSeriesTitle');
    const subtitle = document.getElementById('editSeriesSubtitle');
    const desc = document.getElementById('editSeriesDescription');
    const sort = document.getElementById('editSeriesSort');
    const published = document.getElementById('editSeriesPublished');

    if (!title || !published) return;
    const titleVal = title.value.trim();
    if (!titleVal) {
        showToast('請填寫系列名稱', 'error');
        return;
    }

    const data = {
        title: titleVal,
        subtitle: subtitle ? subtitle.value.trim() : '',
        description: desc ? desc.value.trim() : '',
        sort_order: sort && sort.value !== '' ? parseInt(sort.value) : 0,
        published: parseInt(published.value)
    };

    fetch(`${API_URL}/api/series/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            showToast('✅ 系列更新成功！', 'success');
            closeModal();
            loadSeries();
        } else {
            showToast('更新失敗: ' + (res.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('更新失敗，請檢查網路', 'error'));
}

function uploadSeriesCoverRequest(id, file) {
    const formData = new FormData();
    formData.append('cover', file);
    return fetch(`${API_URL}/api/series/${id}/cover`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    }).then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || '上傳失敗');
        return data;
    });
}

function uploadSeriesCoverFile(id) {
    const input = document.getElementById('editSeriesCoverFile');
    if (!input || !input.files[0]) return;

    showToast('⏳ 正在上傳封面...');
    uploadSeriesCoverRequest(id, input.files[0])
        .then(() => {
            showToast('✅ 封面上傳成功！', 'success');
            loadSeries();
            editSeries(id);
        })
        .catch((e) => showToast('封面上傳失敗: ' + (e.message || '未知錯誤'), 'error'));
}

// ============================================================
// SERMON FILE UPLOAD HELPERS（音頻 / PDF 上傳）
// ============================================================

function showPickedFile(inputId, infoId) {
    const input = document.getElementById(inputId);
    const info = document.getElementById(infoId);
    if (!input || !info || !input.files[0]) return;
    const f = input.files[0];
    info.textContent = `📎 ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`;
    info.style.color = 'var(--primary)';
    info.style.fontWeight = '600';
}

function populateSeriesSelect(selectId, selectedId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    fetch(`${API_URL}/api/series`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        if (!data.data || !data.data.length) return;
        const current = sel.value;
        data.data.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.title;
            sel.appendChild(opt);
        });
        if (selectedId) {
            sel.value = String(selectedId);
        } else if (current) {
            sel.value = current;
        }
    })
    .catch(() => {});
}

function uploadSermonAssetRequest(id, kind, file) {
    const formData = new FormData();
    // 後端欄位名：音頻為 'audio'，PDF 為 'pdf'
    formData.append(kind === 'audio' ? 'audio' : 'pdf', file);
    return fetch(`${API_URL}/api/sermons/${id}/${kind}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    }).then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || '上傳失敗');
        return data;
    });
}

function uploadSermonAsset(id, kind) {
    const input = document.getElementById(kind === 'audio' ? 'editSermonAudioFile' : 'editSermonPdfFile');
    const status = document.getElementById(kind === 'audio' ? 'editSermonAudioStatus' : 'editSermonPdfStatus');
    if (!input || !input.files[0]) return;

    const f = input.files[0];
    if (kind === 'audio' && f.type !== 'audio/mpeg' && !f.name.toLowerCase().endsWith('.mp3')) {
        showToast('請選擇 MP3 音頻檔案', 'error');
        return;
    }
    if (kind === 'pdf' && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
        showToast('請選擇 PDF 檔案', 'error');
        return;
    }

    if (status) status.innerHTML = `<span style="color:var(--text-light);font-size:12px;">⏳ 正在上傳 ${escapeHtml(f.name)}...</span>`;
    showToast(`⏳ 正在上傳${kind === 'audio' ? '音頻' : '大綱'}...`);

    uploadSermonAssetRequest(id, kind, f)
        .then(() => {
            showToast(kind === 'audio' ? '✅ 音頻上傳成功！' : '✅ 大綱上傳成功！', 'success');
            editSermon(id);
        })
        .catch((e) => {
            showToast('上傳失敗: ' + (e.message || '未知錯誤'), 'error');
            if (status) status.innerHTML = '<span style="color:#EF4444;font-size:12px;">上傳失敗，請重試</span>';
        });
}

function deleteSermonAsset(id, kind) {
    if (!confirm(`確定要移除這個${kind === 'audio' ? '音頻檔' : '講道大綱'}嗎？`)) return;

    fetch(`${API_URL}/api/sermons/${id}/${kind}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ 已移除', 'success');
            editSermon(id);
        } else {
            showToast('移除失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('移除失敗，請檢查網路', 'error'));
}

// ============================================================
// LOAD DOCUMENTS
// ============================================================

function loadDocuments() {
    fetch(`${API_URL}/api/documents`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('documentsList');
            if (!container) return;
            
            if (!data.data || data.data.length === 0) {
                container.innerHTML = `<div class="empty-state"><p>📄 暫無文檔資料</p></div>`;
                return;
            }
            
            container.innerHTML = data.data.map(d => {
                const sizeMB = (d.file_size / 1024 / 1024).toFixed(1);
                const icon = d.file_type && d.file_type.includes('image') ? '🖼️' : '📄';
                const categoryLabels = {
                    'bulletin': '週報',
                    'study': '查經筆記',
                    'newsletter': '通訊',
                    'photo': '照片',
                    'general': '其他'
                };
                const catLabel = categoryLabels[d.category] || d.category || '其他';
                
                return `
                <div class="list-item">
                    <div class="item-info">
                        <h4>${escapeHtml(d.title)}</h4>
                        <div class="item-meta">
                            ${icon} ${escapeHtml(d.file_name)} • ${sizeMB} MB
                            <span class="type-badge pdf">${catLabel}</span>
                            <span class="type-badge file">${d.file_type ? d.file_type.split('/').pop().toUpperCase() : '檔案'}</span>
                            ${d.published === 1 ? '<span class="type-badge published">✅ 已發布</span>' : '<span class="type-badge unpublished">⛔ 隱藏</span>'}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-download" onclick="downloadDocument(${d.id})" title="下載">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </button>
                        <button class="btn-delete" onclick="deleteItem('document', ${d.id})" title="刪除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `}).join('');
        })
        .catch(() => showToast('載作文檔失敗', 'error'));
}

// ============================================================
// LOAD EVENTS
// ============================================================

function loadEvents() {
    fetch(`${API_URL}/api/events`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('eventsList');
            if (!container) return;
            
            if (!data.data || data.data.length === 0) {
                container.innerHTML = `<div class="empty-state"><p>📅 暫無活動資料</p></div>`;
                return;
            }
            
            container.innerHTML = data.data.map(e => `
                <div class="list-item">
                    <div class="item-info">
                        <h4>${escapeHtml(e.title)}</h4>
                        <div class="item-meta">
                            📅 ${escapeHtml(e.month)}${e.day}日 (${escapeHtml(e.weekday)}) • 
                            🕐 ${escapeHtml(e.time)} • 
                            📍 ${escapeHtml(e.location)}
                            ${e.published === 1 ? '<span class="type-badge published">✅ 已發布</span>' : '<span class="type-badge unpublished">⛔ 隱藏</span>'}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit" onclick="editEvent(${e.id})" title="編輯">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-delete" onclick="deleteItem('event', ${e.id})" title="刪除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
        })
        .catch(() => showToast('載入活動失敗', 'error'));
}

// ============================================================
// LOAD ANNOUNCEMENTS
// ============================================================

function loadAnnouncements() {
    fetch(`${API_URL}/api/announcements`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('announcementsList');
            if (!container) return;
            
            if (!data.data || data.data.length === 0) {
                container.innerHTML = `<div class="empty-state"><p>📢 暫無公告資料</p></div>`;
                return;
            }
            
            container.innerHTML = data.data.map(a => `
                <div class="list-item">
                    <div class="item-info">
                        <h4>${escapeHtml(a.title)}</h4>
                        <div class="item-meta">
                            ${escapeHtml(a.description)} • 
                            <span style="color:var(--text-light);font-size:10px;">${escapeHtml(a.time_label || '剛剛')}</span>
                            ${a.published === 1 ? '<span class="type-badge published">✅ 已發布</span>' : '<span class="type-badge unpublished">⛔ 隱藏</span>'}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit" onclick="editAnnouncement(${a.id})" title="編輯">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-delete" onclick="deleteItem('announcement', ${a.id})" title="刪除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
        })
        .catch(() => showToast('載入公告失敗', 'error'));
}

// ============================================================
// SHOW ADD MODAL
// ============================================================

function showAddModal(type) {
    const modal = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    
    let html = '';
    
    switch(type) {
        case 'sermon':
            html = `
                <h3>📖 新增講道</h3>
                <p class="subtitle">支援 MP3 音頻、YouTube 影片或兩者皆有</p>
                <div class="form-group">
                    <label>標題 <span style="color:#EF4444;">*</span></label>
                    <input type="text" id="sermonTitle" placeholder="例如：信心的行走">
                </div>
                <div class="form-group">
                    <label>講員 <span style="color:#EF4444;">*</span></label>
                    <input type="text" id="sermonSpeaker" placeholder="例如：陳大衛牧師">
                </div>
                <div class="form-group">
                    <label>日期 <span style="color:#EF4444;">*</span></label>
                    <input type="date" id="sermonDate">
                </div>
                <div class="form-group">
                    <label>所屬系列</label>
                    <select id="sermonSeries">
                        <option value="">— 單次講道（不屬於系列）—</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>YouTube 影片 ID（選填）</label>
                    <input type="text" id="sermonVideoId" placeholder="可留空（純音頻講道）">
                    <small style="color:var(--text-light);font-size:11px;display:block;margin-top:4px;">
                        💡 從 YouTube 網址取得：youtube.com/watch?v=<b>影片ID</b>（聽眾可選擇看影片或聽 MP3）
                    </small>
                </div>
                <div class="form-group">
                    <label>時長</label>
                    <input type="text" id="sermonDuration" placeholder="例如：42:18">
                </div>
                <div class="form-group">
                    <label>類型</label>
                    <select id="sermonType">
                        <option value="video">🎬 影片</option>
                        <option value="audio">🎵 音頻</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>講道簡介</label>
                    <textarea id="sermonDescription" rows="2" placeholder="顯示在講道播放頁的簡介..."></textarea>
                </div>
                <div class="asset-box">
                    <label class="asset-label">🎵 音頻檔 (MP3，選填)</label>
                    <div id="sermonAudioInfo" class="asset-status" style="color:var(--text-light);font-size:12px;">尚未選擇檔案</div>
                    <input type="file" id="sermonAudioFile" accept=".mp3,audio/mpeg" style="display:none;" onchange="showPickedFile('sermonAudioFile','sermonAudioInfo')">
                    <button type="button" class="btn-upload secondary" onclick="document.getElementById('sermonAudioFile').click()">🎧 選擇 MP3 檔案</button>
                </div>
                <div class="asset-box">
                    <label class="asset-label">📄 講道大綱 (PDF，選填)</label>
                    <div id="sermonPdfInfo" class="asset-status" style="color:var(--text-light);font-size:12px;">尚未選擇檔案</div>
                    <input type="file" id="sermonPdfFile" accept=".pdf,application/pdf" style="display:none;" onchange="showPickedFile('sermonPdfFile','sermonPdfInfo')">
                    <button type="button" class="btn-upload secondary" onclick="document.getElementById('sermonPdfFile').click()">📄 選擇 PDF 檔案</button>
                </div>
                <button class="btn-upload" onclick="submitSermon()">📤 上傳講道</button>
                <button class="btn-upload secondary" onclick="closeModal()">取消</button>
            `;
            break;

        case 'series':
            html = `
                <h3>📚 新增系列</h3>
                <p class="subtitle">建立講道系列（例如：天地揭秘系列）</p>
                <div class="form-group">
                    <label>系列名稱 <span style="color:#EF4444;">*</span></label>
                    <input type="text" id="seriesTitle" placeholder="例如：天地揭秘系列">
                </div>
                <div class="form-group">
                    <label>副標題</label>
                    <input type="text" id="seriesSubtitle" placeholder="顯示在系列名稱下方，例如：啟示錄逐章解析">
                </div>
                <div class="form-group">
                    <label>系列描述</label>
                    <textarea id="seriesDescription" rows="3" placeholder="此系列的簡介..."></textarea>
                </div>
                <div class="form-group">
                    <label>排序（數字越小越前面）</label>
                    <input type="number" id="seriesSort" value="0">
                </div>
                <div class="asset-box">
                    <label class="asset-label">🖼️ 系列封面圖（選填）</label>
                    <div id="seriesCoverInfo" class="asset-status" style="color:var(--text-light);font-size:12px;">尚未選擇圖片（未上傳時 App 會使用漸層色封面）</div>
                    <input type="file" id="seriesCoverFile" accept=".jpg,.jpeg,.png,.webp,.gif,image/*" style="display:none;" onchange="showPickedFile('seriesCoverFile','seriesCoverInfo')">
                    <button type="button" class="btn-upload secondary" onclick="document.getElementById('seriesCoverFile').click()">🖼️ 選擇封面圖片</button>
                </div>
                <button class="btn-upload" onclick="submitSeries()">📤 建立系列</button>
                <button class="btn-upload secondary" onclick="closeModal()">取消</button>
            `;
            break;
        
        case 'document':
            html = `
                <h3>📄 上傳文檔或照片</h3>
                <p class="subtitle">支援 PDF、JPG、PNG、Word 檔案 (最大 10MB)</p>
                <div class="form-group">
                    <label>標題 <span style="color:#EF4444;">*</span></label>
                    <input type="text" id="docTitle" placeholder="例如：週報 2026-07-20">
                </div>
                <div class="form-group">
                    <label>分類</label>
                    <select id="docCategory">
                        <option value="bulletin">📋 週報</option>
                        <option value="study">📖 查經筆記</option>
                        <option value="newsletter">✉️ 通訊</option>
                        <option value="photo">🖼️ 照片</option>
                        <option value="general">📁 其他</option>
                    </select>
                </div>
                <div class="upload-zone" onclick="document.getElementById('docFile').click()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <h4>點擊上傳檔案</h4>
                    <p>或拖放到此處</p>
                    <div class="formats">
                        <span>PDF</span>
                        <span>JPG</span>
                        <span>PNG</span>
                        <span>Word</span>
                    </div>
                    <div id="docFileInfo" style="margin-top:8px;font-size:12px;color:var(--text-light);"></div>
                    <input type="file" id="docFile" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx" style="display:none;" onchange="updateFileInfo()">
                </div>
                <button class="btn-upload" onclick="submitDocument()">📤 上傳文檔</button>
                <button class="btn-upload secondary" onclick="closeModal()">取消</button>
            `;
            break;
            
        case 'event':
            html = `
                <h3>📅 新增活動</h3>
                <p class="subtitle">輸入活動資訊</p>
                <div class="form-group">
                    <label>標題 <span style="color:#EF4444;">*</span></label>
                    <input type="text" id="eventTitle" placeholder="例如：主日崇拜">
                </div>
                <div class="form-group">
                    <label>日期 <span style="color:#EF4444;">*</span></label>
                    <input type="date" id="eventDate">
                </div>
                <div class="form-group">
                    <label>星期 <span style="color:#EF4444;">*</span></label>
                    <select id="eventWeekday">
                        <option value="週日">週日</option>
                        <option value="週一">週一</option>
                        <option value="週二">週二</option>
                        <option value="週三">週三</option>
                        <option value="週四">週四</option>
                        <option value="週五">週五</option>
                        <option value="週六">週六</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>時間 <span style="color:#EF4444;">*</span></label>
                    <input type="text" id="eventTime" placeholder="例如：上午9:00 - 11:30">
                </div>
                <div class="form-group">
                    <label>地點 <span style="color:#EF4444;">*</span></label>
                    <input type="text" id="eventLocation" placeholder="例如：主堂">
                </div>
                <button class="btn-upload" onclick="submitEvent()">📤 上傳活動</button>
                <button class="btn-upload secondary" onclick="closeModal()">取消</button>
            `;
            break;
            
        case 'announcement':
            html = `
                <h3>📢 新增公告</h3>
                <p class="subtitle">輸入公告資訊</p>
                <div class="form-group">
                    <label>標題 <span style="color:#EF4444;">*</span></label>
                    <input type="text" id="annTitle" placeholder="例如：主日崇拜時間調整">
                </div>
                <div class="form-group">
                    <label>描述 <span style="color:#EF4444;">*</span></label>
                    <textarea id="annDesc" placeholder="簡要描述公告內容..." rows="2"></textarea>
                </div>
                <div class="form-group">
                    <label>時間標籤</label>
                    <input type="text" id="annTime" placeholder="例如：2小時前 (留空顯示「剛剛」)">
                </div>
                <div class="form-group">
                    <label>彈窗詳細內容</label>
                    <textarea id="annModal" placeholder="彈窗顯示的詳細內容..." rows="4"></textarea>
                    <small style="color:var(--text-light);font-size:11px;display:block;margin-top:4px;">
                        💡 留空則使用描述內容
                    </small>
                </div>
                <button class="btn-upload" onclick="submitAnnouncement()">📤 上傳公告</button>
                <button class="btn-upload secondary" onclick="closeModal()">取消</button>
            `;
            break;
    }
    
    body.innerHTML = html;
    modal.classList.add('show');

    if (type === 'sermon') {
        populateSeriesSelect('sermonSeries', null);
    }
}

// ============================================================
// SUBMIT FUNCTIONS
// ============================================================

function submitSermon() {
    const title = document.getElementById('sermonTitle');
    const speaker = document.getElementById('sermonSpeaker');
    const date = document.getElementById('sermonDate');
    const videoId = document.getElementById('sermonVideoId');
    const duration = document.getElementById('sermonDuration');
    const type = document.getElementById('sermonType');
    const seriesSel = document.getElementById('sermonSeries');
    const desc = document.getElementById('sermonDescription');
    const audioInput = document.getElementById('sermonAudioFile');
    const pdfInput = document.getElementById('sermonPdfFile');
    
    if (!title || !speaker || !date) return;
    
    const data = {
        title: title.value.trim(),
        speaker: speaker.value.trim(),
        date: date.value,
        video_id: videoId && videoId.value.trim() ? videoId.value.trim() : 'N/A',
        duration: duration ? duration.value.trim() : '',
        type: type ? type.value : 'video',
        description: desc ? desc.value.trim() : '',
        series_id: seriesSel && seriesSel.value ? parseInt(seriesSel.value) : null
    };
    
    if (!data.title || !data.speaker || !data.date) {
        showToast('請填寫標題、講員和日期', 'error');
        return;
    }
    
    if (!data.video_id || data.video_id === 'N/A') {
        if (!audioInput || !audioInput.files[0]) {
            showToast('請至少提供 YouTube 影片 ID 或上傳 MP3 音頻', 'error');
            return;
        }
        data.type = 'audio';
    }
    
    showToast('⏳ 正在上傳講道...');
    
    fetch(`${API_URL}/api/sermons`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            const newId = res.data && res.data.id;
            const uploads = [];
            if (newId && audioInput && audioInput.files[0]) {
                uploads.push(uploadSermonAssetRequest(newId, 'audio', audioInput.files[0]));
            }
            if (newId && pdfInput && pdfInput.files[0]) {
                uploads.push(uploadSermonAssetRequest(newId, 'pdf', pdfInput.files[0]));
            }
            if (uploads.length) {
                Promise.all(uploads)
                    .then(() => {
                        showToast('✅ 講道與檔案上傳成功！', 'success');
                        closeModal();
                        loadSermons();
                        loadStats();
                    })
                    .catch(() => {
                        showToast('⚠️ 講道已建立，但檔案上傳失敗，請在編輯中重新上傳', 'error');
                        closeModal();
                        loadSermons();
                        loadStats();
                    });
            } else {
                showToast('✅ 講道上傳成功！', 'success');
                closeModal();
                loadSermons();
                loadStats();
            }
        } else {
            showToast('上傳失敗: ' + (res.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('上傳失敗，請檢查網路', 'error'));
}

function submitDocument() {
    const title = document.getElementById('docTitle');
    const file = document.getElementById('docFile');
    const category = document.getElementById('docCategory');
    
    if (!title || !file) return;
    
    const titleVal = title.value.trim();
    const fileVal = file.files[0];
    const catVal = category ? category.value : 'general';
    
    if (!titleVal || !fileVal) {
        showToast('請填寫標題並選擇檔案', 'error');
        return;
    }
    
    const allowedTypes = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(fileVal.type)) {
        showToast('不支援的檔案格式。請上傳 PDF、JPG、PNG 或 Word 檔案', 'error');
        return;
    }
    
    if (fileVal.size > 10 * 1024 * 1024) {
        showToast(`檔案太大 (${(fileVal.size / 1024 / 1024).toFixed(1)}MB)，請上傳小於 10MB 的檔案`, 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('title', titleVal);
    formData.append('file', fileVal);
    formData.append('category', catVal);
    
    fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ 文檔上傳成功！', 'success');
            closeModal();
            loadDocuments();
            loadStats();
        } else {
            showToast('上傳失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('上傳失敗，請檢查網路', 'error'));
}

function submitEvent() {
    const title = document.getElementById('eventTitle');
    const date = document.getElementById('eventDate');
    const weekday = document.getElementById('eventWeekday');
    const time = document.getElementById('eventTime');
    const location = document.getElementById('eventLocation');
    
    if (!title || !date || !weekday || !time || !location) return;
    
    const dateVal = new Date(date.value);
    if (isNaN(dateVal.getTime())) {
        showToast('請選擇有效日期', 'error');
        return;
    }
    const month = dateVal.getMonth() + 1;
    
    const data = {
        title: title.value.trim(),
        day: dateVal.getDate(),
        month: `${month}月`,
        weekday: weekday.value,
        time: time.value.trim(),
        location: location.value.trim(),
        start_date: dateVal.toISOString()
    };
    
    if (!data.title || !data.day || !data.time || !data.location) {
        showToast('請填寫所有必填欄位', 'error');
        return;
    }
    
    fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ 活動上傳成功！', 'success');
            closeModal();
            loadEvents();
            loadStats();
        } else {
            showToast('上傳失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('上傳失敗，請檢查網路', 'error'));
}

function submitAnnouncement() {
    const title = document.getElementById('annTitle');
    const desc = document.getElementById('annDesc');
    const time = document.getElementById('annTime');
    const modal = document.getElementById('annModal');
    
    if (!title || !desc) return;
    
    const data = {
        title: title.value.trim(),
        description: desc.value.trim(),
        time_label: time ? time.value.trim() || '剛剛' : '剛剛',
        modal_content: modal ? modal.value.trim() || desc.value.trim() : desc.value.trim()
    };
    
    if (!data.title || !data.description) {
        showToast('請填寫標題和描述', 'error');
        return;
    }
    
    fetch(`${API_URL}/api/announcements`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ 公告上傳成功！', 'success');
            closeModal();
            loadAnnouncements();
            loadStats();
        } else {
            showToast('上傳失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('上傳失敗，請檢查網路', 'error'));
}

// ============================================================
// DELETE ITEM
// ============================================================

function deleteItem(type, id) {
    const typeNames = {
        'sermon': '講道',
        'series': '系列',
        'document': '文檔',
        'event': '活動',
        'announcement': '公告'
    };
    
    if (!confirm(`確定要刪除這項${typeNames[type] || type}嗎？\n此操作無法復原！${type === 'series' ? '\n（系列下的講道會變成「單次講道」，不會被刪除）' : ''}`)) return;
    
    const endpoint = type === 'series' ? `${API_URL}/api/series/${id}` : `${API_URL}/api/${type}s/${id}`;
    
    fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('✅ 刪除成功！', 'success');
            loadTabData(currentTab);
            loadStats();
        } else {
            showToast('刪除失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('刪除失敗，請檢查網路', 'error'));
}

// ============================================================
// DOWNLOAD DOCUMENT
// ============================================================

function downloadDocument(id) {
    showToast('📥 正在下載...');
    window.open(`${API_URL}/api/documents/${id}/download`, '_blank');
}

// ============================================================
// FILE UPLOAD HELPER
// ============================================================

function updateFileInfo() {
    const fileInput = document.getElementById('docFile');
    const info = document.getElementById('docFileInfo');
    if (!fileInput || !info) return;
    
    const file = fileInput.files[0];
    if (file) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        const icon = file.type.includes('pdf') ? '📄' : 
                     file.type.includes('image') ? '🖼️' : 
                     file.type.includes('word') ? '📝' : '📎';
        info.textContent = `${icon} ${file.name} (${sizeMB} MB)`;
        info.style.color = 'var(--primary)';
        info.style.fontWeight = '600';
    } else {
        info.textContent = '';
    }
}

// ============================================================
// MODAL FUNCTIONS
// ============================================================

function closeModal(e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById('modalOverlay');
    if (modal) modal.classList.remove('show');
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================================
// ESCAPE HTML（防止 XSS）
// ============================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
    
    if (e.key === 'Enter' && document.getElementById('loginPassword')) {
        const loginPage = document.getElementById('page-login');
        if (loginPage && loginPage.classList.contains('active')) {
            login();
        }
    }
});

// ============================================================
// AUTO-REFRESH
// ============================================================

setInterval(loadStats, 60000);

// ============================================================
// EXPOSE FUNCTIONS TO GLOBAL
// ============================================================

window.login = login;
window.logout = logout;
window.switchTab = switchTab;
window.showAddModal = showAddModal;
window.closeModal = closeModal;
window.submitSermon = submitSermon;
window.submitDocument = submitDocument;
window.submitEvent = submitEvent;
window.submitAnnouncement = submitAnnouncement;
window.deleteItem = deleteItem;
window.editSermon = editSermon;
window.editEvent = editEvent;
window.editAnnouncement = editAnnouncement;
window.updateSermon = updateSermon;
window.updateEvent = updateEvent;
window.updateAnnouncement = updateAnnouncement;
window.downloadDocument = downloadDocument;
window.updateFileInfo = updateFileInfo;
window.showToast = showToast;
window.togglePassword = togglePassword;
window.playSermon = playSermon;
window.toggleSermonGroup = toggleSermonGroup;
window.loadSermons = loadSermons;
window.escapeHtml = escapeHtml;

console.log('📊 CCAC Admin Panel 已載入');
console.log('🔐 管理後台版本 2.0.0');
console.log('🔗 API URL:', API_URL);
console.log('🎬 功能: 播放 | 編輯 | 刪除 | 新增');