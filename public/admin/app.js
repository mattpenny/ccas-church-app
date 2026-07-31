// CCAC Church App - Admin Panel
// 格拉納達山基督教會 - 管理後台

const API_URL = window.location.origin;
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
    .catch(() => {
        showToast('登入失敗，請檢查網路', 'error');
    });
}

function logout() {
    if (!confirm('確定要登出嗎？')) return;
    token = null;
    localStorage.removeItem('adminToken');
    document.getElementById('screen-dashboard').classList.remove('active');
    document.getElementById('screen-login').classList.add('active');
    showToast('已登出');
}

function showDashboard() {
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-dashboard').classList.add('active');
}

// ============================================================
// TAB NAVIGATION
// ============================================================

function switchTab(tab) {
    currentTab = tab;
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navMap = { sermons: 0, documents: 1, events: 2, announcements: 3 };
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems[navMap[tab]]) navItems[navMap[tab]].classList.add('active');
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    
    // Update content
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
        fetch(url)
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
        case 'documents': loadDocuments(); break;
        case 'events': loadEvents(); break;
        case 'announcements': loadAnnouncements(); break;
    }
}

// ============================================================
// LOAD SERMONS
// ============================================================

function loadSermons() {
    fetch('/api/sermons')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('sermonsList');
            if (!container) return;
            
            if (!data.data || data.data.length === 0) {
                container.innerHTML = `<div class="empty-state"><p>📖 暫無講道資料</p></div>`;
                return;
            }
            
            container.innerHTML = data.data.map(s => `
                <div class="sermon-item-admin">
                    <div class="info">
                        <h4>${s.title}</h4>
                        <div class="meta">
                            ${s.speaker} • ${s.date}
                            <span class="type-badge ${s.type}">${s.type === 'video' ? '🎬 影片' : '🎵 音頻'}</span>
                            ${s.video_id ? `<span class="type-badge youtube">▶ YouTube</span>` : ''}
                        </div>
                    </div>
                    <div class="actions">
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
            `).join('');
        })
        .catch(() => showToast('載入講道失敗', 'error'));
}

// ============================================================
// LOAD DOCUMENTS
// ============================================================

function loadDocuments() {
    fetch('/api/documents')
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
                <div class="sermon-item-admin">
                    <div class="info">
                        <h4>${d.title}</h4>
                        <div class="meta">
                            ${icon} ${d.file_name} • ${sizeMB} MB
                            <span class="type-badge pdf">${catLabel}</span>
                            <span class="type-badge file">${d.file_type ? d.file_type.split('/').pop().toUpperCase() : '檔案'}</span>
                        </div>
                    </div>
                    <div class="actions">
                        <button class="btn-edit" onclick="downloadDocument(${d.id})" title="下載">
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
    fetch('/api/events')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('eventsList');
            if (!container) return;
            
            if (!data.data || data.data.length === 0) {
                container.innerHTML = `<div class="empty-state"><p>📅 暫無活動資料</p></div>`;
                return;
            }
            
            container.innerHTML = data.data.map(e => `
                <div class="sermon-item-admin">
                    <div class="info">
                        <h4>${e.title}</h4>
                        <div class="meta">
                            📅 ${e.month}${e.day}日 (${e.weekday}) • 
                            🕐 ${e.time} • 
                            📍 ${e.location}
                        </div>
                    </div>
                    <div class="actions">
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
    fetch('/api/announcements')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('announcementsList');
            if (!container) return;
            
            if (!data.data || data.data.length === 0) {
                container.innerHTML = `<div class="empty-state"><p>📢 暫無公告資料</p></div>`;
                return;
            }
            
            container.innerHTML = data.data.map(a => `
                <div class="sermon-item-admin">
                    <div class="info">
                        <h4>${a.title}</h4>
                        <div class="meta">
                            ${a.description} • 
                            <span style="color:var(--text-light);font-size:10px;">${a.time_label || '剛剛'}</span>
                        </div>
                    </div>
                    <div class="actions">
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
        // ==================== SERMON ====================
        case 'sermon':
            html = `
                <h3>📖 新增講道</h3>
                <p class="subtitle">輸入講道資訊 (YouTube 影片)</p>
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
                    <label>YouTube 影片 ID <span style="color:#EF4444;">*</span></label>
                    <input type="text" id="sermonVideoId" placeholder="例如：nq1e0g8jQpE">
                    <small style="color:var(--text-light);font-size:11px;display:block;margin-top:4px;">
                        💡 從 YouTube 網址取得：youtube.com/watch?v=<b>影片ID</b>
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
                <button class="upload-btn" onclick="submitSermon()">📤 上傳講道</button>
                <button class="upload-btn secondary" onclick="closeModal()" style="margin-top:8px;background:var(--bg);color:var(--text);">取消</button>
            `;
            break;
            
        // ==================== DOCUMENT ====================
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
                <button class="upload-btn" onclick="submitDocument()">📤 上傳文檔</button>
                <button class="upload-btn secondary" onclick="closeModal()" style="margin-top:8px;background:var(--bg);color:var(--text);">取消</button>
            `;
            break;
            
        // ==================== EVENT ====================
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
                <button class="upload-btn" onclick="submitEvent()">📤 上傳活動</button>
                <button class="upload-btn secondary" onclick="closeModal()" style="margin-top:8px;background:var(--bg);color:var(--text);">取消</button>
            `;
            break;
            
        // ==================== ANNOUNCEMENT ====================
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
                <button class="upload-btn" onclick="submitAnnouncement()">📤 上傳公告</button>
                <button class="upload-btn secondary" onclick="closeModal()" style="margin-top:8px;background:var(--bg);color:var(--text);">取消</button>
            `;
            break;
    }
    
    body.innerHTML = html;
    modal.classList.add('show');
}

// ============================================================
// SUBMIT FUNCTIONS
// ============================================================

// ---------- Submit Sermon ----------
function submitSermon() {
    const title = document.getElementById('sermonTitle');
    const speaker = document.getElementById('sermonSpeaker');
    const date = document.getElementById('sermonDate');
    const videoId = document.getElementById('sermonVideoId');
    const duration = document.getElementById('sermonDuration');
    const type = document.getElementById('sermonType');
    
    if (!title || !speaker || !date || !videoId) return;
    
    const data = {
        title: title.value.trim(),
        speaker: speaker.value.trim(),
        date: date.value,
        video_id: videoId.value.trim(),
        duration: duration ? duration.value.trim() : '',
        type: type ? type.value : 'video'
    };
    
    if (!data.title || !data.speaker || !data.date || !data.video_id) {
        showToast('請填寫所有必填欄位 (標題、講員、日期、YouTube ID)', 'error');
        return;
    }
    
    fetch('/api/sermons', {
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
            showToast('✅ 講道上傳成功！', 'success');
            closeModal();
            loadSermons();
            loadStats();
        } else {
            showToast('上傳失敗: ' + (data.error || '未知錯誤'), 'error');
        }
    })
    .catch(() => showToast('上傳失敗，請檢查網路', 'error'));
}

// ---------- Submit Document ----------
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
    
    // Check file type
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
    
    // Check file size (10MB)
    if (fileVal.size > 10 * 1024 * 1024) {
        showToast('檔案太大 (${(fileVal.size / 1024 / 1024).toFixed(1)}MB)，請上傳小於 10MB 的檔案', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('title', titleVal);
    formData.append('file', fileVal);
    formData.append('category', catVal);
    
    fetch('/api/documents/upload', {
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

// ---------- Submit Event ----------
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
    
    fetch('/api/events', {
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

// ---------- Submit Announcement ----------
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
    
    fetch('/api/announcements', {
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
    if (!confirm(`確定要刪除這項${type === 'sermon' ? '講道' : type === 'document' ? '文檔' : type === 'event' ? '活動' : '公告'}嗎？\n此操作無法復原！`)) return;
    
    const endpoint = `/api/${type}s/${id}`;
    
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
// EDIT FUNCTIONS (Placeholder - To be implemented)
// ============================================================

function editSermon(id) {
    showToast('✏️ 編輯功能開發中... (ID: ' + id + ')');
}

function editEvent(id) {
    showToast('✏️ 編輯功能開發中... (ID: ' + id + ')');
}

function editAnnouncement(id) {
    showToast('✏️ 編輯功能開發中... (ID: ' + id + ')');
}

// ============================================================
// DOWNLOAD DOCUMENT
// ============================================================

function downloadDocument(id) {
    showToast('📥 正在下載...');
    window.open(`/api/documents/${id}/download`, '_blank');
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
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', (e) => {
    // Escape to close modal
    if (e.key === 'Escape') {
        closeModal();
    }
    
    // Enter on login
    if (e.key === 'Enter' && document.getElementById('loginPassword')) {
        const loginScreen = document.getElementById('screen-login');
        if (loginScreen && loginScreen.classList.contains('active')) {
            login();
        }
    }
});

// ============================================================
// AUTO-REFRESH
// ============================================================

// Refresh stats every 60 seconds
setInterval(loadStats, 60000);

// ============================================================
// EXPOSE FUNCTIONS TO GLOBAL
// (For onclick handlers in HTML)
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
window.downloadDocument = downloadDocument;
window.updateFileInfo = updateFileInfo;
window.showToast = showToast;

console.log('✅ CCAC Admin Panel 已載入');
console.log('📊 管理後台版本 1.0.0');