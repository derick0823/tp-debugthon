# 10/22 夜間衝刺：三個 MVP 變體

- 發起：使用者 2026-10-22 夜。統籌：「MVP專案經理」（session 原名 MVP專案經理，就是 R1 資料層作者 c8）。助理：e3、34、a0（原名 debug-e3、debug-34、debug-a0）。
- 目標：10/23 早上交出 2～3 個**可以操作的 MVP 變體**，讓使用者選。每個變體都用同一份 `data/marts/`，不重做資料層。
- 活動規則：產品程式要 Day 1（10/23 晚）之後才寫。今晚的產出一律放在這個資料夾，當**設計原型與資料準備**。不要建 `app/`。
- 本夜的觸發：隊友群組 10/22 的討論（`inbox/`、Messenger）。重點兩句：
  - 「新屋經濟效益試算⋯只要講到更新後容積，全部都要問市府」「舊房子的價值是土地持份＋建物價值，建物價值沒有資料」。
  - 「容積那一頁的 ΔF1～F6 不是人看的」「資訊需要轉譯」。

## 0. 開工前每個人都要讀

1. `ops/CONVENTIONS.md`（誰可以改哪些檔、證據等級、程式放哪）。
2. `research/issue-06/data-patterns/2026-10-19-research-inventory-for-find.md`（全隊研究導覽，10 分鐘）。
3. `data/marts/README.md`（資料層欄位字典）。
4. `research/issue-06/solutions/prototype/README.md` 與 `SPEC.md`（既有原型 v3 長什麼樣，不要重做它）。
5. `research/issue-06/solutions/decisions/2026-10-18-consensus.md`（已定的方向與不做清單）。

## 1. 共同規則

| 規則 | 內容 |
|---|---|
| 寫檔範圍 | 只寫 `research/issue-06/mvp-variants/<你的子資料夾>/`。要改 `pipelines/`、`data/marts/`，先傳訊息給 MVP專案經理 |
| 不碰 | `README.md`、`docs/`、`data/catalog.json`、`research/README.md`、`PLAN.md`、`IDEAS.md`、`solutions/` |
| git | 只 `git add` 自己的子資料夾。commit message 英文，前綴 `[MVP]`。一個議題一個 commit。**暫存區是全部 session 共用的**：commit 一律寫 `git commit -- <自己的路徑>`，不要裸 `git commit`（01:00 統籌的 commit 誤帶了 a0 暫存的刪除） |
| 抓政府網站 | 一次一個請求、間隔 ≥4 秒、不平行、遇到非 200 就停、不登入、不碰驗證碼。每個請求記進 `_manifest.json`。上限 1,500 個請求 |
| 個資 | 不存人名、電話、完整門牌以外的個人資料。實施者公司名可以存（法人） |
| 證據 | 每個數字標【實測】【文件】【推論】【待確認】 |
| 原型技術 | 純靜態 HTML＋CSS＋原生 JS。地圖用 `solutions/prototype/assets/vendor/` 已有的 Leaflet。不加追蹤碼。手機 375 px 不橫捲 |
| 用語 | 逐棟屋齡與軟弱層一律「推估」「候選」；風險是「相對於臺北其他里」；已知案件只在輸入確切地址時顯示 |
| 多圖少字（10/22 00:45 新增） | 使用者原話：「設計要多用圖片、動畫，太多文字一般民眾會看得很痛苦。」第一屏要有主視覺；數字用長條、量尺、格子圖；滑桿動時圖跟著動（CSS transition）；每段 ≤2 句，細節收進 `<details>`。不加套件，用 inline SVG 或 CSS |
| 自己驗證（10/22 00:45 新增） | 每個 MVP 要能從 README 的指令啟動，作者自己用 Chrome MCP 或 curl 驗 200、資料檔、主控台無錯，並在 README 寫「驗證紀錄」。統一用 MVP專案經理 開的 http.server 8778（根目錄 `research/issue-06`），不另開 |
| 卡權限時 | 停下，寫進自己 README 的「待使用者處理」，繼續做不需要那個動作的部分。不轉給別的 session 做 |
| 省 token（10/22 00:55 新增） | 使用者要求彼此溝通用最少 token。訊息只給路徑＋3 行；不重述對方的話；不確認收到 |
| 回報 | 做完傳 `SendMessage` 給 `MVP專案經理`：路徑＋3 行摘要。卡住 30 分鐘也傳 |

## 2. 分工

### E3：都更審議平台案件資料集（給試算器用的事實表）

負責：e3。子資料夾：`mvp-variants/uro-cases/`。

**為什麼**：隊友要算「更新後經濟效益」，說要問市府。其實都更處「都市更新審議服務平台」每一案都公開這些欄位（MVP專案經理 10/22 實測一案 `case_id=09608223`）：

- 費用資料：更新前土地平均單價(元/坪)、更新後住宅樓層平均單價(元/坪)、更新後車位平均單價、重建費用、權利變換費用、貸款利息、稅捐、管理費、實施都市更新費用合計。
- 獎勵資料：F、F0、ΔF1～ΔF6（含 F4-1～4-3、F5-1～5-6），獎勵上限。
- 基本資料：行政區、行政里、劃定方式、劃定日期、辦理進度、申請計畫日期、實施者、規劃單位。
- 頁面用 `ashx/Get_project168_*.ashx` 一組 POST 載入，頁面本身也會渲染，`innerText` 就讀得到。

**要做**：

1. 找到公開的案件列表頁（不是 `P_MyProjects.aspx`，那要登入）。先用瀏覽器或 `curl` 看首頁的「案件查詢」入口，確認列表怎麼翻頁、`case_id` 從哪來。
2. 寫 `fetch` 程式（放你的子資料夾，之後再搬 `pipelines/`）：抓列表 → 逐案抓詳細頁。**間隔 ≥4 秒**。原始 HTML 存 `data/raw/extra/renewal/uro-review-cases/<case_id>.html`（不進 git）。
3. 解析成一張表：一案一列，欄位照上面三組。里名用 `pipelines.address.TOWNS` 對出 `town_code`；里名對 `data/staged/base/village-boundary-nlsc.csv` 得 `village_code`（一案可能多個里，照 `stage_fire_access_lanes.py` 的做法拆列加權重）。
4. 產出 `data/staged/renewal/uro-review-cases.csv`（先放你的子資料夾 `out/`，MVP專案經理 審過再搬）。
5. 寫 `report.md`：案數、有費用資料的案數、依區的「更新後住宅單價 ÷ 更新前土地單價」分布、ΔF 各項的使用比例、共同負擔能不能算（權利變換費用合計 ÷ ⋯）。附 5 個抽查案的截圖或原文核對。

**不要**：不要抓計畫書 PDF、不要抓照片、不要存聯絡電話與地址以外的個人資料（實施者公司名可以）。

### 34：MVP 變體 A「我家都更划不划算」試算器

負責：34。子資料夾：`mvp-variants/renewal-calculator/`。

**為什麼**：隊友采柴已寫了一個小計算機，公式在共筆；Derick 說缺「舊房子現在值多少」。我們的資料層正好有：每棟的實價登錄成交（`data/staged/housing-stats/real-price-registration-lvr-all.parquet`，含 `building_key`、總價、面積、建成年）、每里的老屋成交單價、危老核准案的基地面積與獎勵額度。

**要做**：

1. 讀 `inbox/` 或 Messenger 轉述的采柴公式（在 `tp-debugthon` repo 的共筆或 html；找不到就先用下面的粗版）。
2. 粗版邏輯（全部標「推估」）：
   - 更新前：這棟或同里同型態（公寓）近 3 年成交的每坪單價中位數 × 使用者輸入的坪數。
   - 更新後：區層級「更新後住宅樓層平均單價」（E3 的資料；E3 沒好之前先用那一案的欄位格式放假資料，並標「示意」）× 分回坪數。分回坪數 ＝ 原坪數 × (1＋獎勵率) × (1－共同負擔率)，獎勵率與共同負擔率做成滑桿，預設值寫出處。
   - 不划算或湊不到同意門檻時，顯示替代路：耐震初評、補強補助、電梯補助（文字照 `world-practices/taipei-assistance/next-step-card.md`）。
3. 一頁靜態網頁：輸入區、地址（用 `data/marts/shards_public/` 的分片比對，照 `solutions/prototype/` 的做法）、坪數、滑桿；輸出「更新前市價、預估分回、差額、同意門檻（G3 的 29 m²/戶估戶數）、替代路」。
4. 每個數字旁邊寫來源與日期。頁尾寫「這是推估，實際以實施者計畫書與市府核定為準」。
5. `README.md` 寫假設、公式、資料來源、已知偏誤（實價登錄只有成交過的）。

### A0：MVP 變體 B「容積獎勵翻譯機＋一頁里況」

負責：a0。子資料夾：`mvp-variants/bonus-translator/`。

**為什麼**：隊友說「ΔF1～F6 不是人看的」。都更容積獎勵有法定項目（臺北市都市更新建築容積獎勵辦法；危老另有容積獎勵辦法）。把每個 Δ 項目翻成一句白話＋條件＋上限，再套上一案的數字，就是一張「這一案多拿了多少、為什麼」的卡。

**要做**：

1. 查臺北市都市更新建築容積獎勵辦法的 ΔF1～ΔF6 各代表什麼（法條在 `city-workflow/n1-parameters.md` 可能已有一部分；沒有就查 laws.gov.taipei，附條號）。危老的獎勵項目對照 `city-workflow/2026-10-18-tw-rules-and-workflow.md` Q3。
2. 寫一張對照表 `bonus-items.csv`：代碼、法定名稱、白話一句、適用條件、上限、法源。
3. 一頁靜態網頁：貼上或選一案（先內建 MVP專案經理 實測的那一案 `09608223` 的數字；E3 的資料好了再接），顯示「基準容積 F0 → 核定容積 F，多出的 X% 來自：耐震設計 a%、時程 b%⋯」，每項可展開看白話與條件。
4. 第二個分頁：「一頁里況」的精簡版——選一個里，顯示五因子等級、文資數、救災候選理由、進行中的危老與都更案數。資料全部來自 `data/marts/village_indicators.csv`、`village_rankings.csv`。這一頁已有原型（`solutions/prototype/brief.html`），你的版本要**不同**：給市民看、不給承辦人看，用一句話解釋每個等級是什麼意思。
5. 另外做一件測試：把 `solutions/prototype/` 三頁在本機跑起來（README 有指令），用 3 個地址、3 個里走一遍，記錄數字對不對得上 marts、有沒有壞掉的連結或空白。寫成 `prototype-test-notes.md`。

### A0：MVP 變體 E「同意書蒐集進度板」（10/22 00:55 新增，B 交件後開工）

- 放 `mvp-variants/consent-tracker/`。給推動小組與住戶看同一張進度板。
- 輸入 building_key 或門牌數（`data/marts` 的 doorplate 戶數；住戶全部合成，不用真名）。逐戶格子：已簽亮、未聯絡灰、拒絕紅。進度尺標出門檻線（都更條例 §37、危老 100%，法源收進 details）。每戶卡可改狀態，只存 localStorage。「下一步」提示差幾戶、哪些要補掛號信。匯出 CSV。
- 整合：門檻算法與 34 的 `nextsteps.js` 一致；輸出 query string（`n_total`、`n_signed`、`n_refused`）給 6a 的模擬器接。

### 6A：MVP 變體 D「同意率模擬器」＋替代方案決策樹

- 放 `mvp-variants/consent-simulator/`。規則版 ABM 算同意機率；Claude API 產住戶樣貌只做質性，不出 %。透明度參數對成功率的影響要畫成曲線。
- `decision-tree.json`、`alternatives.md`：不能都更時的替代路（危老、耐震補強、整建維護、防災型都更、公辦），給 34 的「替代路」卡接。
- 接 E 的 query string 當初始狀態。

### 6f（統籌）自己做

1. 實價登錄推「更新前每戶市價」：各里、各建物型態、建成年代的近 3 年每坪單價中位數與樣本數，輸出 `mvp-variants/data/village_unit_prices.csv`，給 34 用。
2. 審 E3 的表，搬進 `pipelines/` 與 `data/marts/`。
3. 早上寫總結給使用者：三個變體各一段、截圖路徑、建議怎麼選。

## 3. 時間

| 時間 | 事項 |
|---|---|
| 10/22 24:00 前 | 三位讀完第 0 節，回 MVP專案經理「開工」＋你打算怎麼做（5 行內） |
| 03:00 | 中途回報一次：做到哪、卡什麼 |
| 07:00 | 交件：路徑＋3 行摘要。沒做完就交現況，寫清楚缺什麼 |
| 08:00 | MVP專案經理 整合成給使用者的總結：`mvp-variants/2026-10-22-morning-summary.md`（系統時間是 10/22 凌晨，交件日是 10/22 早上） |

## 4. 問題找誰

- 資料欄位、地址比對、marts：MVP專案經理。
- 其他原隊伍 session（debug-40 協調者、debug-83 整合者、debug-aa、debug-38）今晚不在線。他們的檔案照讀，不要改。
