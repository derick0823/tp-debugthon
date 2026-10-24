# MVP 原型：我家健檢單（health-report）

- 2026-10-24（Day 2）。使用者負責的新原型；這個資料夾是引擎、接口說明與幾個版面。
- 一棟房子＋一個里＋家裡有沒有長者，整理成一張手機看得懂的單子。數字全部沿用既有原型的資料與算法，沒有另發明公式。

## 入口與參數

從 repo 根目錄起伺服器（`python -m http.server 8811 --bind 127.0.0.1`）後開：

| 頁面 | 用途 | 網址（8811，repo 根目錄） |
|---|---|---|
| `index.html` | **整合線上版**（給民眾，`online.js`／`online.css`） | `/research/issue-06/mvp-variants/health-report/?addr=信義路2段86巷40號&age=50&elder=1` |
| `print.html` | 正式列印版 | `/research/issue-06/mvp-variants/health-report/print.html?addr=…` |
| `v1.html` | 第一版健檢單（`app.js`／`style.css`） | `/research/issue-06/mvp-variants/health-report/v1.html?addr=…` |
| `report.html`、`visual.html`、`map.html` | 試作版 | 同上，換檔名 |

用 `research/issue-06/` 開的伺服器（8778）也可以，網址少前兩層。用檔案開（file://）不行，頁面用 fetch 讀 JSON。

**參數**（網址與 `buildReport(input)` 同名；完整影響見 `CONTRACT.md` 第 1 節）：

| 等級 | 參數 |
|---|---|
| 必填 | `addr` 門牌 |
| 建議 | `age` 屋齡（年，住戶自己填）、`elder` 家裡有沒有長者（1／0） |
| 選填 | `type`（apt／house／building）、`units`（全棟戶數）、`floor`（住幾樓）、`ground`（一樓用途 shop／parking／arcade／home）、`own`（owner／renter）、`mc`（有無管委會 1／0）、`crack`（看到裂縫、鋼筋外露、漏水 1／0）、`v`（里代碼）、`t`（區代碼）、`#w=1,1,3,3,1`（排名權重） |

缺的參數在頁面上補填。姓名不得放進網址；登入後由前端用 `opts.user` 傳給引擎。網址轉引擎輸入用 `parseQuery(location.search)`。

## 跑之前

各兄弟原型的 `data/` 不進 git，要先各自產生（見各原型 README）：`renewal-calculator`、`priority-ranking`、`rescue-drill-map`、`bonus-translator`；你家座標另讀 `solutions/prototype/data/buildings/`。本資料夾的 `data/shelters_weak.json` 進 git；`data/medical.json` 由產生它的子代理處理（2026-10-24 15:10 時尚未進 git）。

## 分工（2026-10-24 起）

- 引擎線（本線）：`lib/report.js`、`CONTRACT.md`、`test/`、`README.md`、`scripts/build_shelters.py`、`data/shelters_weak.json`。
- 整合線上版：`index.html`、`online.js`、`online.css`。列印版：`print.*`。第一版 `v1.html`、`app.js`、`style.css`、試作版 `report.*`、`visual.*`、`map.*` 由各自的子代理維護。
- 前端只讀 `lib/report.js` 的回傳物件；引擎只加欄位、不改名。

## 檔案地圖

| 路徑 | 內容 |
|---|---|
| `lib/report.js` | 引擎。`buildReport(input, opts)` 回傳純資料物件；`listVillages()`、`parseQuery()` |
| `CONTRACT.md` | 參數與回傳物件的欄位說明（給前端、後端） |
| `index.html`、`online.js`、`online.css` | 整合線上版 |
| `print.html`、`print.js`、`print.css` | 正式列印版 |
| `v1.html`、`app.js`、`style.css` | 第一版健檢單。Leaflet 用 `../../solutions/prototype/assets/vendor/`，配色吃 `../design-kit/theme-puma.css` |
| `report.*`、`visual.*`、`map.*` | 試作版 |
| `IDEAS.md` | 還可以放什麼的盤點 |
| `scripts/build_shelters.py` | 產生 `data/shelters_weak.json`：消防署收容所（臺北、依 shelterId 去重、適合避難弱者且含震災，119 處），只留名稱、座標、容量。`uv run python -X utf8 research/issue-06/mvp-variants/health-report/scripts/build_shelters.py` |
| `data/shelters_weak.json` | 上一列的產出（約 10 KB，政府資料開放授權，無聯絡人欄） |
| `data/medical.json` | 急救責任醫院、醫院、診所、AED 座標（另一子代理產生；欄位 kind、name、lon、lat、district、note） |
| `test/check-engine.mjs` | 引擎驗收：用 Node 讀檔跑引擎，比對既有頁面的數字。`node research/issue-06/mvp-variants/health-report/test/check-engine.mjs` |
| `test/mobile.html` | 第一版（`v1.html`）的 375 px 自檢：`test/mobile.html?q=<url 編碼的參數>`，結果寫在 `<pre id="out">` |

### 讀哪些資料、搬了哪段邏輯

| 區塊 | 資料 | 邏輯出處 |
|---|---|---|
| 門牌比對、老屋健檢 | `renewal-calculator/data/towns/*.json`、`prices.json` | `renewal-calculator/assets/calc.js` 的 `normalizeAddress`、`searchBuildings`、`renderBuilding` |
| 我的里在全市的位置 | `priority-ranking/data/villages.geojson`、`meta.json` | `priority-ranking/app.js` 的 `score`、`rerank`、`sentence`、`renderCard` |
| 救災地圖、檢核表 | `rescue-drill-map/data/*` | `rescue-drill-map/app.js` 的 `renderCard`、`shelterCheck`、`hydrantCheck`、`levels` |
| 容積獎勵、我的里 | `bonus-translator/bonus-items.csv`、`data/cases.json`、`villages.json`、`bonus-usage.json` | `bonus-translator/app.js` 的 `leaves`、`renderVillage`、`silverCard` |
| 你家座標 | `../solutions/prototype/data/buildings/<區碼>.json`（lon、lat，依 point_id 對） | 對不到時用里界面積中心並標明 |
| 最近的適合避難弱者收容所 | `data/shelters_weak.json` | 選法同 `rescue-drill-map/scripts/build_extra.py` 的 `nfa_weaker` |
| 報告結果的補助數字 | — | `ops/handoff/2026-10-24-day2-plan.md` 第 1 節；`renewal-calculator/assets/nextsteps.js`（電梯第 10 張等） |

「獎勵積木」是本頁新加的彙總：本里（沒有就本區、再沒有就全市）過去都更基地，各項獎勵÷該案法定容積後取平均。

## 驗收紀錄

| 時間 | 做了什麼 | 結果 |
|---|---|---|
| 2026-10-24 12:40 | `test/check-engine.mjs` | ALL PASS：`信義路2段86巷40號` 對上大安區光明里、1976 年建（與試算器同）、1999 前、無電梯；龍圖里權重 1,1,3,3,1 第 145 名、等權第 121 名；黎忠里「我的里」7% |
| 2026-10-24 12:45 | 無頭 Edge：桌機 1280 px 截圖、`test/mobile.html`（375 px 框） | 不橫捲、內文 17 px、JS 錯誤 0；`?v=63000030022` 頁面顯示「第 145 名／等權時第 121 名」，`?v=63000020040` 顯示 7% |
| 2026-10-24 13:30 | 第二輪：住戶屋齡重算耐震世代、比本里幾 % 老、最近收容所、地圖標你家、積木上限線不壓標籤；`listed` 不印清冊地址、`village_drill` 補助改寫 | `check-engine.mjs` ALL PASS（新增 6 項）；`test/mobile.html` 兩組（門牌、只選里）ALL PASS、JS 錯誤 0；`信義路2段86巷40號` 最近的是中正國中，直線約 320 m；比本里 87% 的房子老（69 棟有實際年份） |
| 2026-10-24 14:10 | 第三輪引擎：`verdict`、`risks`、`user`、`report_id`、`plain_village` | `check-engine.mjs` ALL PASS；範例門牌黃燈；海砂屋門牌 `大安區仁愛路3段96號` 紅燈 |
| 2026-10-24 14:40 | 第四輪引擎：七個選填參數、`input_optional`、`missing_optional`、action 的 `plain_title`／`money_tag`／`notes`、`nearby_medical`、風險加 `visible_damage`、`medical` | `check-engine.mjs` ALL PASS（含 `type=apt&units=12&floor=4&ground=shop&own=renter&mc=0&crack=1` 一組、`type=house&floor=1` 一組、醫療兩點測試資料）；`data/medical.json` 尚未產生，真資料驗收待檔案出現後補跑 |
| 2026-10-24 15:00 | `data/medical.json` 出現後重跑驗收（另一子代理產生：急救責任醫院 18、醫院 23、診所 335、AED 2,729；欄位只有 kind、name、lon、lat、district、note）；租屋提醒只加在房子相關 action、填裂縫總評至少黃燈 | `check-engine.mjs` ALL PASS。範例門牌：急救醫院臺大醫院直線約 1,010 m（medical 風險 low）、醫院 830 m、診所 450 m、AED 120 m；龍圖里（無門牌，從里中心）急救醫院約 800 m |

## 已知限制

- 沒帶區名的門牌要讀 12 區的門牌分片（合計約 45 MB），第一次要幾秒。帶區名或 `t=` 只讀一區。
- 列管旗標（海砂屋、黃單）只在確切門牌對上時出現；相近門牌清單不帶旗標，也沒有可瀏覽的清單。
- 「你家」座標要多讀一份該區的 `solutions/prototype/data/buildings/` 分片（2～4 MB）；那份資料不進 git，要先跑該原型的建置。讀不到時退回里中心並標明。
- 建成年除使用執照與清冊外都是推估。住戶屋齡另算一次耐震世代並列；判 1999 前後仍以資料推估優先，資料沒有年份才用住戶屋齡。
- 收容所距離是直線，不是步行路線；容量只有一半左右對得到教育局一覽表。
- 「我的里」的前 10% 比例（翻譯機欄位 `share_top46_city2019`）和排序卡的「排進前 46 名」（`top46`）是兩個原型各自的欄位，數字可能差一點，兩邊都照原頁面顯示。
- 報告結果的條件是本頁定的規則（見 `lib/report.js` 的 `actionsOf`），不是官方標準。

## 之後


- 列印版（`print.*`）與地圖版（`map.*`）由其他子代理做，只讀 `lib/report.js`。
