# 變體 D：老公寓要幾戶點頭

- 負責：debug-6a。統籌：MVP專案經理。任務編號 6A。
- 一句話：同一棟老公寓，換一條法律、講清楚一點、多派一個人陪，能過同意門檻的樓差多少。
- 頁面：`index.html`。本機預覽 http://127.0.0.1:8778/mvp-variants/consent-simulator/ （伺服器由 MVP專案經理 開在 `research/issue-06`）。
- 評估報告：`report.md`（矽基樣本能不能用、模型假設、檢查結果）。
- 全部是**設計原型與模擬資料**，依活動規則不放 `app/`。

## 1. 三個分頁

| 分頁 | 給誰看 | 內容 | 資料 |
|---|---|---|---|
| 🏢 門檻模擬 | 市府、評審 | 100 小人格子圖、四種同意門檻的成功棟數、哪一招最有用、透明度曲線 | 規則版代理人模型（`assets/sim.js`），瀏覽器即時跑 2,000 次 |
| 💬 住戶在想什麼 | 市府、說明會承辦 | 88 位 AI 扮演的虛構住戶，各聽建商版與市府版說明 | Claude 批次產生（`data/portraits-data.js`） |
| 🧭 不能都更怎麼辦 | 屋主、試算器 | 可點的流程圖，24 個節點、35 個替代方案；下方「中繼期間住哪」4 步驟 | `decision-tree/decision-tree.json`；中繼住宅依 S29 原則【文件】 |

網址可以帶錨點直接開分頁：`#sim`、`#people`、`#tree`。

## 2. 給其他變體的介面

### 2.1 變體 E 同意書進度板 → 本頁

網址帶三個參數，就當成模擬的初始狀態：

```
index.html?n_total=16&n_signed=10&n_refused=2
```

- `n_signed` 的戶一開始就簽了。
- `n_refused` 的戶效用先減 2.0（假設：已拒絕的人比較難回頭），而且第一次說明會前，鄰居就看得到他們拒絕。
- 頁首會出現藍色提示條。戶數滑桿會跟著 `n_total` 調整範圍。

### 2.2 嵌入卡片 `embed.html`（給總覽頁）

320×200 的住戶原話輪播，3 秒換一位，標「AI 扮演的虛構住戶」。滑鼠移上去會暫停。

```html
<iframe src="../consent-simulator/embed.html" width="320" height="200" style="border:0" title="住戶會怎麼說"></iframe>
```

- 參數：`?interval=3000`（毫秒，最少 1500）、`?theme=light` 或 `dark`（不給就跟系統）。
- 只挑 42 字以內的原話，依「住在這裡的屋主、店家、租客、不住這裡的屋主」輪流，共 12 張。
- 第一張不靠動畫，iframe 截圖也看得到。

### 2.3 本頁 → 變體 A 試算器（34）

`decision-tree/decision-tree.json` 的讀法見 `decision-tree/alternatives.md` 開頭。重點：

- 從 `nodes[0]` 開始。每個分支有 `label`、`when`（結構化條件）、`next`、`option_ids`，可以同時有 `next` 和 `option_ids`。
- `inputs[].source_field` 不是 null 時，直接讀 `data/marts/` 的欄位。是 null 的，由使用者在試算器自填，並列在 `data_debts`。
- `options[].card_order` 對應 `solutions/prototype/assets/nextsteps.js` 的卡片順序。

## 3. 檔案

| 路徑 | 用途 | 進 git |
|---|---|---|
| `index.html`、`assets/` | 頁面。`assets/theme-map.css` 把本頁變數對到 puma 主題 | ✅ |
| `embed.html` | 可嵌入的住戶原話輪播卡 | ✅ |
| `data/portraits-data.js`、`data/tree-data.js` | 頁面讀的資料，由程式產生 | ✅ |
| `scripts/make_personas.py` | 依里別真實分布＋假設，生成 5 棟虛構樓的 88 戶 | ✅ |
| `scripts/run_portraits.py` | 呼叫 Claude：`pilot` 即時試跑、`submit` 送批次、`fetch` 下載 | ✅ |
| `scripts/check_portraits.py` | 千篇一律檢查：集中度、重跑一致、雙向探測、引言相似度 | ✅ |
| `scripts/build_social_housing.py` | 把 e3 社宅清單彙總成各區已完工戶數（`data/social-housing.js`） | ✅ |
| `scripts/build_web_data.py` | 把結果與決策樹轉成 `data/*.js` | ✅ |
| `decision-tree/` | 決策樹 JSON、說明、驗證程式 | ✅ |
| `out/personas.jsonl`、`out/archetypes.json` | 虛構住戶與五棟原型 | ✅ |
| `out/portraits.jsonl`、`out/check.json` | Claude 回應（已解析）與檢查結果 | ✅ |
| `out/raw_results.jsonl`、`out/batch_requests.jsonl`、`out/pilot/` | 原始回應與請求 | ✅（不含金鑰與個資） |
| `out/shots/` | 驗證截圖 | ✅ |

### 重跑

```bash
# 在 repo 根目錄
uv run python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/make_personas.py
# 下面這支要用系統 Python（有 anthropic SDK；uv 環境沒有），會花錢
python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/run_portraits.py pilot --n 3
python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/run_portraits.py submit
python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/run_portraits.py fetch --batch <id>
uv run python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/check_portraits.py
uv run python -X utf8 research/issue-06/mvp-variants/consent-simulator/scripts/build_web_data.py
uv run python -X utf8 research/issue-06/mvp-variants/consent-simulator/decision-tree/scripts/validate_tree.py
```

- 金鑰讀 `~/.config/anthropic/.env`，要帶 `ANTHROPIC_WORKSPACE_ID`（程式自動加標頭）。
- 每次呼叫都記進 `~/.config/anthropic/usage/YYYY-MM.jsonl`，`project` 欄是「市政debug松」。

## 4. 花費

| 項目 | 筆數 | 美元 |
|---|---|---|
| 試跑（即時，含 3 筆缺工作區標頭的失敗） | 11 | 約 0.36 |
| 批次（打 5 折，1 小時快取） | 120 | 2.96 |
| 合計 | 131 | 3.32 |

模型 `claude-opus-5-5`，effort medium。價格依 claude-api skill 2026-10-06 版【文件】。批次 ID 記在 `out/batch_id.txt`；結果已全部下載到本機。

## 5. 驗證紀錄

| 時間 | 方法 | 結果 |
|---|---|---|
| 2026-10-22 00:40 | `curl` 7 個檔（頁面、3 支 assets、2 支資料） | 全部 200【實測】 |
| 2026-10-22 00:45 | Chrome（Claude in Chrome）載入、重新整理、讀主控台 | 沒有錯誤或警告【實測】 |
| 2026-10-22 00:45 | 同上，用 JS 點三個分頁 | 小人亮 78 個；住戶卡 88 張，篩租客剩 16 張；流程圖點兩下出現 3 個選項；開個案經理後亮 84 個【實測】 |
| 2026-10-22 01:00 | 無頭 Edge 1400×900 截 `#sim`、`?n_total=16&n_signed=10&n_refused=2`；1400×1300 截 `#people` | 版面正常；帶參數時出現提示條、危老 13 → 28 棟【實測】`out/shots/desktop.png`、`board.png`、`people.png` |
| 2026-10-22 01:00 | 無頭 Edge 420×1560 開 `_test/iframe.html` 看 375 px | 沒有橫向捲動，控制項完整【實測】`out/shots/mobile-375.png` |
| 2026-10-22 01:20 | `design-kit/audit.html?u=../consent-simulator/#sim`、`#people`、`#tree`（375 px，無頭 Edge `--dump-dom`） | 三頁小於 15 px 的可見字都是 0；可見字數 508／1,454／179；沒有橫向捲動【實測】。改之前住戶頁有 15,271 字、門檻頁有 144 字是 14 px |
| 2026-10-22 01:25 | 無頭 Edge 420×1560 開 `_test/iframe.html` 看 `#people` 與首頁 | iframe 內動畫會凍結。已改成：分布點不做動畫、大數字第一次直接顯示終值（78、13）【實測】`out/shots/mobile-375*.png` |
| 2026-10-22 08:20 | 套 `design-kit/theme-puma.css`＋`assets/theme-map.css`；接 `design-kit/quest.js`。用暫時的 iframe 測試頁模擬拉滑桿、勾選、點決策樹 | 任務 4 個依序亮起；危老成功棟數越過 30 時出現彩帶與「你讓 28 棟多過門檻」；截圖對比正常【實測】`out/shots/desktop.png`、`people.png`、`embed.png`、`mobile-375.png` |
| 2026-10-22 08:10 | 加 e3 社宅清單（`uro-cases/out/social-housing.csv`）的各區已完工戶數長條，截 `#tree` | 臺北市內 56 處、12,925 戶；中正、大安為 0；標明「社宅要專案核准才能當中繼房源，不代表有空房」【實測】`out/shots/relo.png` |
| 2026-10-22 07:45 | 無頭 Edge 截 `#tree`（1400 寬）與兩個 320×200 iframe 嵌 `embed.html`（深、淺色） | 4 步驟圖正常；輪播首張完整、標籤與「看更多」都在；`embed.html` 回 200【實測】`out/shots/relo.png`、`embed.png` |
| 2026-10-22 02:00 | 讀 `uro-cases/out/uro-review-cases.csv`（466 案） | 更新前戶數中位 16（396 案），和預設一致；滑桿上限改 50【實測】 |
| 2026-10-22 01:45 | 照 `design-kit/REVIEW.md`「D 模擬器」9 點改完後，重跑 audit 三頁並截圖 | <15 px 可見字 0；字數 561／1,522／184；無橫捲【實測】。門檻選項、門檻格、10 棟房子、增減閃字、堆疊長條、圖示大按鈕、題數進度都有出現（`out/shots/desktop.png`、`people.png`、`mobile-375-tree.png`） |
| 2026-10-22 00:30 | `node` 跑 `sim.js` 校準與 10 種情境 | 基準危老 13.2%；兩者都做 44.6%；每 2,000 次 10 毫秒【實測】 |
| 2026-10-22 00:25 | `validate_tree.py` | 通過，0 錯誤 0 警告【實測，子 agent 回報】 |

## 6. 決定與待使用者處理

### 決定 D-1：住戶樣貌放第二頁，不當主角（2026-10-22 共識）

- 使用者 10/23 早上交給 debug-6a 與 MVP專案經理 討論決定。debug-6a 提案，MVP專案經理 07:3x 同意。
- 決定：「住戶在想什麼」保留為第二個分頁；總覽頁用 `embed.html` 放一小格輪播。2 分鐘 Demo 只講門檻模擬，口頭一句「我們用 AI 住戶找擔心，不用它算同意率」。
- 理由：
  1. 住戶原話是本組唯一有居民口吻的內容，最能讓人記住痛點（`report.md` §4）。
  2. 風險可控：紫色提示條、不出百分比、大數字旁註「AI 偏樂觀，真人應該更少」、README 標明模擬資料。活動規則允許模擬資料，要求標明【文件，`docs/event.md`】。
  3. 使用者 10/23 07:20 原話（MVP專案經理 轉述）：「模擬居民的部分，可以在某個地方有一點點的展示」。
- 想過但沒選：只在 README 寫、完全不放。

### 待使用者處理

1. 決策樹 3 件不確定的事（古蹟排除範圍、「超過」與「等於」門檻、公寓大廈條例能否用於耐震不足）。見 `decision-tree/alternatives.md`。
3. git：依統籌指示，交件時一次 commit。

## 7. 證據等級

- 【實測】本輪親自跑出。【文件】引用 repo 內研究或條文。【推論】我的判斷。【假設】沒有資料，自訂的值。
- 模型參數逐項出處：頁面「模型怎麼算」摺疊區，或 `assets/sim.js` 的 `PARAMS`。
