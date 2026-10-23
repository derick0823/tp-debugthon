# tp-debugthon：小水滴大浪潮

2026 臺北市政 debug 松，第 6 題「老屋耐震」。專案名稱「模擬市民－都更篇」。

## 這個 repo 有什麼

每次交接放一個資料夾，用日期命名，舊的不覆蓋。

| 資料夾 | 日期 | 內容 | 從哪裡開始 |
|---|---|---|---|
| [`2026-10-23-mvp/`](2026-10-23-mvp/) | 10/23（最新） | 六個可以點的 MVP 原型、146 秒示範影片、Day 1 提案頁、更正後的研究報告 | [`2026-10-23-mvp/README.md`](2026-10-23-mvp/README.md) |
| [`inbox/`](inbox/) | 10/22 | 研究組賽前整理的開放資料、資料處理程式、研究報告、方案書 | [`inbox/README.md`](inbox/README.md) |

兩個資料夾裡都有 `research/issue-06/gov-reports/`。研究報告以 `2026-10-23-mvp/` 的為準，因為它已依 10/23 的查核更正。

## 第一次來，照這個順序

1. 讀 [`2026-10-23-mvp/README.md`](2026-10-23-mvp/README.md) 第 1 節，2 分鐘把 MVP 跑起來。
2. 依你的角色看同一份 README 的第 3 節：行銷先看畫面與影片，後端先看資料欄位與公式。
3. 讀交接檔 [`2026-10-23-mvp/research/issue-06/mvp-variants/TEAM-HANDOFF-2026-10-23.md`](2026-10-23-mvp/research/issue-06/mvp-variants/TEAM-HANDOFF-2026-10-23.md)：誰接什麼、Day 2 審核要的三樣東西。
4. 要追資料從哪裡來，再去 [`inbox/data/DATASETS.md`](inbox/data/DATASETS.md)。

## 用到的開源套件與 AI 工具

活動規則：「可用開源套件與 AI 工具，須於 README 註明」。

| 類別 | 用了什麼 | 用在哪裡 |
|---|---|---|
| 前端 | Leaflet（地圖，附檔在 `solutions/prototype/assets/vendor/`，不連 CDN）；其餘是原生 HTML、CSS、JavaScript | 六個原型 |
| 影片 | Remotion 4（`video/package.json`） | 示範影片的剪接、字幕、配音 |
| 資料處理 | pandas、pyarrow、geopandas、shapely、pyproj、pyogrio、pdfplumber、pypdf、matplotlib、folium、openpyxl（`inbox/pyproject.toml`） | 開放資料清洗、里層級成品表、研究報告抽文字 |
| AI 工具 | Claude Code（Anthropic Claude）：研究、資料處理、原型程式、查核；OpenAI Codex：部分研究；Azure OpenAI GPT-5.5：批次翻譯與摘要 | 全程協作；所有數字與引文都回原文核對過（`gov-reports/verify/`） |

## 協作約定（建議，第一次合作可以再調）

- 不要直接改日期資料夾裡的檔。要改的話，複製到新的工作資料夾（例如 `app/`）再改，日期資料夾保留當時的樣子。
- 這個 repo 目前是私人的。活動結束後再決定哪些以 MIT 開源；資料照各自的原授權。
- 用語：逐棟屋齡與軟弱層寫「推估」「候選」，不說「危樓」；不放任何人名、電話。
