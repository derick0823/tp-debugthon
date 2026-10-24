# 2026-10-23：第 6 題 MVP「模擬市民－都更篇」

這個資料夾是 10/23 交給隊友的版本：六個可以點的原型、一支示範影片、Day 1 提案頁，以及今晚依查核更正過的研究。`../inbox/` 是 10/22 那次的研究資料，兩邊分開放，不互相覆蓋。

## 1. 先跑起來（2 分鐘）

要有 Python 3。從**這個資料夾的最上層**起伺服器（不要從子資料夾起，原型會讀上層的 `data/`）：

```bash
cd 2026-10-23-mvp
python -m http.server 8778
```

瀏覽器開 <http://127.0.0.1:8778/research/issue-06/mvp-variants/>。總覽頁先選角色（住戶、里長、市府、設計），會帶你走一條任務路線。

不能雙擊 `index.html` 直接開：原型用 `fetch` 讀資料檔，瀏覽器在 `file://` 底下會擋。

## 2. 六個原型

全部在 `research/issue-06/mvp-variants/`。每個原型資料夾都有 `README.md`，寫跑法、公式、資料來源、已知偏誤。

| 原型 | 給誰 | 回答什麼 | 資料夾 |
|---|---|---|---|
| 救災優先順序地圖 | 里長、市府 | 哪些里該先演練、先補強 | `rescue-drill-map/`、`priority-ranking/` |
| 我家都更划不划算 | 住戶 | 更新前市價、預估分回、不划算時的替代路 | `renewal-calculator/` |
| 容積獎勵翻譯機＋一頁里況 | 住戶 | 獎勵項目的白話、我的里的狀況 | `bonus-translator/` |
| 同意率模擬器＋替代方案決策樹 | 推動小組 | 溝通方式怎麼影響同意率 | `consent-simulator/` |
| 同意書蒐集進度板 | 推動小組、住戶 | 離門檻還差幾戶 | `consent-tracker/` |
| 規則地圖、屋頂願景 | 住戶、設計 | 哪條規定管到我、都更後長什麼樣 | `rules-map/`、`rooftop-vision/` |

另外：

- `uro-cases/`：都更審議 466 案的事實表，是試算器的依據。
- `design-kit/`：配色、元件、任務積分。
- `pitch/day1-pitch.html`：Day 1 提案頁，有講稿 A、B 與 3 分鐘計時。
- 示範影片：`video/out/mvp-demo-2026-10-24.mp4`（中文，163 秒，最新）、`video/out/mvp-demo-en-2026-10-24.mp4`（英文配音、中英字幕，175 秒）、`video/out/mvp-demo.mp4`（10/22 第一版，146 秒）。

## 3. 依你的角色從哪裡切入

| 你是 | 先看 | 再看 |
|---|---|---|
| 行銷 | 跑起來的總覽頁 20 分鐘、`video/out/mvp-demo-2026-10-24.mp4` | `pitch/day1-pitch.html`、`video/SCRIPT.md`（影片劇本與對象設定） |
| 後端 | `mvp-variants/TEAM-HANDOFF-2026-10-23.md` 第 4 節、`data/marts/README.md` | `renewal-calculator/README.md`（公式）、`uro-cases/report.md`（案件表）、`solutions/prototype/README.md` |
| 都想先懂全貌 | `mvp-variants/TEAM-HANDOFF-2026-10-23.md` | `mvp-variants/README.md` |

Day 2 審核要三樣東西：MVP、YouTube 影片、未來需要的資源。分工草案在 `TEAM-HANDOFF-2026-10-23.md` 第 9 節。

## 4. 資料夾地圖

```text
2026-10-23-mvp/
  README.md                          本檔
  research/issue-06/
    mvp-variants/                    六個原型、總覽頁、設計套件、提案頁、影片
    solutions/prototype/             早期原型。翻譯機的「查我家那一棟」「承辦人版」連到這裡；兩張地圖用它的 Leaflet
    gov-reports/                     58 份＋5 份政府研究報告的摘要與查核（10/23 更正版，取代 inbox 裡的舊版）
      report.md                      總報告
      verify/                        查核紀錄：每句話對回原文頁碼
    peer-analysis/                   Discord #6 有人分享的分析，我們的研讀與影響評估
    data-search/                     10/23 重搜 data.taipei、data.gov.tw、code.gov.tw 的候選資料清單
    data-patterns/2026-10-24-house-age-vs-official.md   我們的屋齡推估對照內政部稅籍與普查（偏低 1～11 個百分點，屬保守）
    world-practices/2026-10-23-bobingen-ai-building-permits.md   德國 AI 建照申請案例與對第 6 題的啟示
  data/marts/                        原型讀的兩張里層級表與欄位字典
```

目錄結構和研究 repo 一樣，所以程式裡的相對路徑都不用改。

## 5. 這份沒有放的

| 沒放 | 為什麼 | 要的話 |
|---|---|---|
| 影片的原始錄影、`node_modules` | 可以重新產生，檔案很大 | `cd research/issue-06/mvp-variants/video`，`npm install`，照 `SCRIPT.md` 重錄 |
| 列管清冊的地址原文 | 共識：已知案件只在輸入確切門牌時顯示旗標，不給可瀏覽的清單 | 逐棟分片裡的旗標都還在，畫面照常顯示「已列管」 |
| 研究報告全文 PDF | 著作權沒查 | 摘要與頁碼在 `gov-reports/` |
| 原始開放資料與處理程式 | 10/22 已放在 `../inbox/data/`、`../inbox/pipelines/` | 見 `../inbox/data/DATASETS.md` |

## 6. 更新紀錄

- **10/24 早上**：加入三份研究：屋齡比對（回答「數字可信嗎」）、德國 AI 建照案例（資源頁論據）、三個政府網站的資料清單。
- **10/24 早上**：示範影片第二版，中、英文各一支，多三句介紹新功能（市場錯位、收容所與消防栓、負擔力）。
- **10/24 凌晨**：七個原型依查核修正補助數字與說明；新增三個功能：試算器「這個里的負擔力」、健檢排序「市場錯位」圖、救災地圖「震後收容所」與「窄巷離消防栓」兩項檢核；翻譯機多一格銀髮住宅狀況。研究補一份屋齡比對：我們的推估比內政部稅籍低 1～11 個百分點，屬保守。
- **10/23 晚上**：第一版，六個原型、示範影片、Day 1 提案頁。

## 7. 用語與界線

- 逐棟的屋齡與軟弱層一律寫「推估」「候選」；風險是「相對於臺北其他里」。不說「危樓」。
- 模擬住戶不是民調。不放任何人名、電話。
- 這個 repo 現在是私人的。活動結束後再決定哪些以 MIT 開源；資料照原授權（`../inbox/data/DATASETS.md`）。公開前要先拿掉 `solutions/prototype/data/buildings/` 裡授權待確認的 `liq_level_national2026`、`liq_agreement` 兩欄。
