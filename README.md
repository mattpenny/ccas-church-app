# CCAC 基督教會 - 教會應用程式

## 📱 關於
CCAC 教會應用程式，包含前端展示和後端管理系統。

## 🚀 功能特色
- 講道管理 (MP3 音頻 / YouTube 影片，聽眾可自由選擇)
- 講道系列管理 (系列封面、系列內講道清單，Subsplash 風格瀏覽)
- 每篇講道可附講道大綱 PDF (一邊聽道、一邊看講義)
- 播客 RSS Feed (`/feed.xml`，可提交至 Apple Podcasts、Spotify 等平台)
- 文檔上傳與管理
- 活動管理
- 公告管理
- 多語言支援 (繁體中文、簡體中文、英文)
- 管理後台

## 📖 管理員使用手冊
完整後台操作說明（登入、講道/系列/文檔/活動/公告管理、播客提交、疑難排解）：
**[docs/ADMIN_MANUAL.md](docs/ADMIN_MANUAL.md)**

## 🛠️ 技術架構
- **前端**: HTML + CSS + JavaScript (原生)
- **後端**: Cloudflare Workers
- **資料庫**: Cloudflare D1 (SQLite)
- **儲存**: Cloudflare R2
- **部署**: Cloudflare

## 🎧 播客 RSS Feed 提交指南
上傳 MP3 音頻的講道會自動出現在 RSS Feed 中：

**總 Feed（全部講道）：**
`https://ccac-api.ccac-church.workers.dev/feed.xml`

**各系列專屬 Feed**（每個系列可當成獨立 Podcast 節目分別提交）：
`https://ccac-api.ccac-church.workers.dev/feed/series/{系列ID}.xml`
> 例子：`https://ccac-api.ccac-church.workers.dev/feed/series/5.xml`（哥林多前書系列）
> App 內「講道 → 系列內頁」也有「🎙️ 本系列播客 (RSS)」按鈕可一鍵複製網址。

### 提交步驟
1. **Apple Podcasts**：到 [Podcasts Connect](https://podcastsconnect.apple.com/) → 用 Apple ID 登入 → 「＋」新增節目 → 貼上 RSS Feed 網址 → 審核約需 1-5 個工作天
2. **Spotify**：到 [Spotify for Creators](https://creators.spotify.com/) → 新增節目 → 貼上 RSS Feed 網址 → 驗證後送出
3. **其他平台**（iHeartRadio、TuneIn 等）：同樣在節目設定中貼上此 Feed 網址即可

> 💡 想將不同系列做成不同 Podcast 節目？每個系列提交一次自己的系列 Feed 網址即可；總 Feed 則是一整個「講道」節目。

### 注意事項
- Feed 只包含**已發布且有 MP3 音頻**的講道
- 系列 Feed 的節目名稱／封面取自該系列名稱與系列封面
- 建議先在管理後台設定好教會名稱與封面（系列封面或講道縮圖會用作節目封面）
- Feed 更新後，各平台通常會在數小時內自動抓取新講道

## 📁 專案結構
