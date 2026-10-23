# 原型規格（賽前設計原型）

- 作者：協調者 debug-40，2026-10-18。
- 這是給建置 agent 的正本。§3 與 §4 以 `data/README.md` 與 `assets/common.js` 的實際內容為準（資料 agent 先寫好），本檔只列預期。§6～§11 是頁面規格，照做。
- 依據：`../decisions/2026-10-18-focus-draft.md` §2、`../decisions/2026-10-18-consensus.md`、`data/marts/README.md`。

## 1. 目的

給使用者（決策者）看兩個入口長什麼樣、數字對不對、2 分鐘 Demo 能不能講完。不是最終產品。

## 2. 檔案

| 檔 | 內容 |
|---|---|
| `index.html`＋`assets/citizen.js`＋`assets/citizen.css` | 市民入口「我家危險嗎」 |
| `city.html`＋`assets/city.js`＋`assets/city.css` | 市府入口「哪些里不論怎麼算都在前面」 |
| `brief.html`＋`assets/brief.js` | 一頁里況說明（列印）與府函段落（§11） |
| `assets/common.css`、`assets/common.js`、`assets/vendor/` | 共用資產（資料 agent 寫） |
| `data/villages.geojson`、`data/towns.json`、`data/meta.json`、`data/buildings/<town_code>.json` | 資料（`scripts/build_prototype_data.py` 產生） |

## 3. 資料（以 data/README.md 為準）

### 3.1 villages.geojson

一里一個 feature。屬性含 `village_indicators` 與 `village_rankings` 的欄位（見 `data/marts/README.md`），加 `p_elderly`、`p_old_stock`、`p_rescue`、`p_soft_story`、`p_liquefaction_city2019`、`p_liquefaction_national2026`（百分位 0～1，越大越危險）。

### 3.2 buildings/<town_code>.json

一區一片。`columns` 陣列＋`items` 二維陣列。欄位至少：point_id、address、addr_norm、village_code、lon、lat、status、undetermined_reason、built_year、code_generation、structure_class、floors、liq_level_city2019、liq_level_national2026、liq_agreement、soft_story_candidate、sea_sand、no_elevator_30plus。有的話再加：built_year_min、built_year_max、age_source、age_conf、sea_sand_list_address、sea_sand_list_version、quake_listed、quake_listed_address、quake_listed_version。缺的欄位畫面就不顯示該項，不能壞。

### 3.3 地址正規化

全形數字轉半形、去空白、「台」轉「臺」、「－」「—」轉「-」。比對用 `addr_norm` 的 includes。

### 3.4 towns.json、meta.json

`towns.json`：`[{town_code, town_name, n_buildings}]`。`meta.json`：產生時間、各因子資料日期、筆數。

## 4. common.js（以實際檔案為準）

預期有：`loadVillages()`、`loadTown(code)`、`LABELS`（status、reason、code_generation、liq、agreement、factor 名稱）、`FACTORS`、`levelColor(level)`、`computeWeighted(props, weights, version)`、`rankAll(features, weights, version)`、`fmtPct`、`fmtInt`。頁面 agent 只用它，不改它。缺的函式寫在自己的頁面 JS。

## 5. 設計 token

淺色與深色各一組：背景、卡片、文字、次要文字、邊線、強調色、5 級色階（1 淺到 5 深，色盲友善，深淺可分）。字體：`"Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif`。間距 4 的倍數。圓角 8。手機 16 px 側邊距。

## 6. 市民入口 index.html

### 6.1 流程

1. 標題：「我家危險嗎」。副標一句：「輸入地址，看這棟房子與這個里的地震風險，和下一步可以找誰。」
2. 第一步：選區（下拉 12 區，來自 towns.json）。選了才載入該區分片。
3. 第二步：輸入地址（例：「西園路2段261巷11號」）。自動完成最多 20 筆，依 addr_norm includes 比對，顯示原始 address。選一筆出結果卡。
4. 勾選框「家裡有 65 歲以上」，影響下一步卡片的欄位（§6.3）。

### 6.2 結果卡（區塊順序固定）

| # | 區塊 | 內容與規則 |
|---|---|---|
| 1 | 標頭 | address、區、里名。右側狀態徽章：已確認／推估／未判定（大、先看到）。 |
| 2 | 這棟房子 | 建成年與耐震規範世代。status＝confirmed：「已確認 1998 年（使用執照）」；estimated：「推估 1975 年（實價登錄）」；有 built_year_min／max 而 built_year 空：「依鄰棟推估 1970～1985 年，信心低」；undetermined：「未判定」＋原因（LABELS.reason）。世代用 LABELS.code_generation 的短句。構造、樓層有才顯示。文資（c8 10/18）：`near_heritage_50m` 為真才多一行「附近 50 公尺內有文化資產。重建前可能需要文化局審查；不影響補強與耐震評估。」加來源小字「文化部文資局開放資料，2026-10-18」；欄位不在就不顯示。 |
| 3 | 液化 | 城市 2019 版等級、全國 2026 版等級、一致度一句（LABELS.agreement）。固定附註：「區域尺度，不是這棟的鑑定。」not_mapped 顯示「未繪製（山區）」。 |
| 4 | 一樓軟弱層候選 | 只有 A 或 B 才顯示。文字：「A 型候選：連棟騎樓街屋」或「B 型候選：底層開放的中高樓」。固定附註：「這是候選，不是判定。」 |
| 5 | 市府列管 | 只有 sea_sand 或 quake_listed 非空才顯示。文字：「已確認：市府列管海砂屋（建管處 115.3.25 清冊）。清冊地址：<sea_sand_list_address>。類別：須拆除重建／可加勁補強。」附官方頁連結 https://cmo.gov.taipei/cp.aspx?n=4B7B63655A6565E9 。黃單同理，附清冊日期，加「列管狀態以建管處為準」。沒有 list_address 欄就只寫版本。 |
| 6 | 這個里 | 五因子各一格：名稱、等級 1～5 的色塊、一句數字（高齡：65 歲以上 X%；老屋：1999 年前 X%（樣本 N 棟）；液化：高潛勢占里面積 X%；救災：列管窄巷 N 條、寬度 <6 m 標註 X%；一樓軟弱層候選：N 棟）。下面一句：「這個里在 X% 的權重組合下都排進全市前 46 名（前 10%）。」用 share_top46_<預設版本>。`heritage_sites_n` > 0 時加一句「本里有登錄文化資產 N 處」（來源小字同第 2 列），0 或缺欄不顯示。固定附註：「等級是相對於臺北市其他里。」 |
| 7 | 里層級已知案件 | 「本里海砂屋列管 N 案、地震黃單 N 筆、有效危老核准案約 N 件（依路段分攤的期望值）。」 |
| 8 | 下一步 | §6.3。 |
| 9 | 小地圖 | Leaflet，該棟的點＋里界。底圖 OSM；載不到不能壞版。 |

### 6.3 下一步卡片

資料：`assets/nextsteps.js`，由 `research/issue-06/world-practices/taipei-assistance/next-step-card.md` 的「卡片表」17 列原封不動轉成。顯示規則照該檔「顯示規則（給前端）」5 條。

挑列規則（順序照表的「順序」欄）：

- 一律：1（先問免費顧問）、15（查最新液化潛勢）、16（液化自主檢查）。
- status 為 undetermined，或 built_year ≤ 1999，或 built_year_max ≤ 1999：加 2（耐震初評）、3（臺北市補強補助）、4（中央弱層補強）、5（危老重建）、6（防災型都更）、11（整建維護）。
- no_elevator_30plus 為真，或 floors ≤ 6 且 built_year ≤ 1996：加 10（公寓加裝電梯）。
- sea_sand 非空：加 8（575）、9（海砂屋鑑定與拆除補助）；quake_listed 非空：加 8。
- 勾了「家裡有 65 歲以上」：用高齡戶欄文字，並加 12、13、14。
- 有 5 或 6 時加 17（重建期間住哪）。

卡片欄位：標題、這是什麼、誰可以申請、金額（依勾選切欄）、截止（60 天內加「快截止」）、入口（文字＋連結）。底下小字：「資料日期 2026-10-18。以主管機關公告為準。」

## 7. 市府入口 city.html 與 brief.html

### 7.1 版面

左欄（控制）、中間（地圖）、右欄（選中的里）、下方（四個清單分頁）。768 px 以下改單欄。

### 7.2 控制

- 視圖：高齡、1999 年前老屋存量、液化、救災不便、一樓軟弱層候選、等權合成（標「僅供對照」）、滑桿加權。
- 版本：city2019／national2026，預設 city2019（授權確定的版本；全國 2026 版當對照，可切換）。2026-10-18 晚改：內部原型也改預設城市版，和公開版一致。
- 五支滑桿 0～100，預設等權，「重設」鈕。說明一行：「排名區間是預先用 2,000 組隨機權重算的；滑桿只重算加權和。」

### 7.3 右欄：選中的里

里名、區名、人口、65 歲以上比例。五因子：等級色塊＋數字（§6.2 第 6 列同一套文字）。排名區間條：1～456 刻度，畫 p05～p95 區間與 p50 點，旁寫「等權排名第 N」。share_top46 一句。被總分藏起來：是／否，是的話列哪幾個因子。S5 候選：是的話顯示 s5_reason。里層級已知案件（§6.2 第 7 列），那一句加「文化資產 N 處」（`heritage_sites_n`，缺欄就不加）。按鈕「一頁里況說明」→ `brief.html?v=<village_code>`。

文資欄（c8 10/18）：§7.4 的穩定前段清單（含 ≥ 0.5 那段）與救災可及性候選清單各加一欄「文資」顯示 `heritage_sites_n`；§7.5 的已知案件表加一列「文化資產（處）」，來源寫文化部文資局開放資料（slug `cultural-heritage-boch`，2026-10-18 下載）。

### 7.4 四個清單分頁

1. 穩定前段：share_top46 ≥ 0.9；下面另列 ≥ 0.5。
2. 被總分藏起來：hidden_by_composite 為真，列 hidden_factors。
3. 救災可及性候選：s5_candidate 為真，列 s5_reason。
4. 高齡化最快：share_65plus_change_110_115 前 20，並列 bld_share_pre_policy_1999。

點一列，地圖與右欄跟著跳。

### 7.5 brief.html

讀 `?v=`。一頁 A4：標題（區＋里）、五因子表（因子、等級、數字、資料日期、來源 slug）、排名區間、被藏起來的因子、S5 理由、已知案件、危老期望件數、固定免責（§8）、「列印」鈕。資料日期與來源抄 `data/marts/README.md` 的欄位字典。

## 8. 每頁底部

兩行固定文字：

1. 「本頁是事前排序與推估，不是官方耐震評估。等級是相對於臺北市其他里。資料日期見各欄。」
2. 「真實資料：人口（115 年 9 月）、液化圖（城市 2019、全國 2026）、使用執照、實價登錄（101S4～115S3）、消防與窄巷清冊、海砂屋與黃單清冊。推估：建成年（實價登錄、鄰棟）、構造、一樓軟弱層候選、里層級比例。」

## 9. 標籤文字

| 鍵 | 文字 |
|---|---|
| status confirmed／estimated／undetermined | 已確認／推估／未判定 |
| reason no_sale_since_2012_no_permit | 2012 年後沒有成交紀錄，也沒有 2001 年後的使用執照 |
| reason sale_without_built_year | 有成交紀錄，但沒有填建成年 |
| g1_pre1974 | 1974 年以前：當時建築法規尚無地震力規定 |
| g2_1974_1982 | 1974～1982：第一版耐震規定 |
| g3_1982_1989 | 1982～1989 |
| g4_1989_1997 | 1989～1997 |
| g5_1997_1999 | 1997～1999：921 前最後一版 |
| g6_2000_plus | 2000 年以後：921 後規範 |
| liq high／medium／low／none／not_mapped | 高／中／低／無潛勢／未繪製（山區） |
| agreement both_high／one_high／neither_high／undetermined | 兩版都判高／只有一版判高／兩版都不是高／未判定（山區，沒有圖） |
| factor elderly／old_stock／liquefaction／rescue／soft_story | 高齡／1999 年前老屋存量／液化／救災不便／一樓軟弱層候選 |
| age_source permit／sea_sand_list／lvr／lvr_neighbor／none | 使用執照／海砂屋清冊／實價登錄／鄰棟實價登錄／無 |

不得出現的字：「預測倒塌」「官方初評」「軟弱層」單獨出現（只能是「一樓軟弱層候選」）「危險分數」。

## 10. L2 鄰棟推估的顯示

built_year 空而 built_year_min／max 有值：顯示「依鄰棟推估 <min>～<max> 年」，徽章仍是「未判定」但副標「有鄰棟線索」，信心寫「低」。不得顯示單一年份。規範世代只有在 min 與 max 落在同一世代時才顯示。

## 11. 府函段落（BD13，有時間才做）

brief.html 加一個分頁「府函段落」：把選中的里（可多選，用 `?v=a,b,c`）的數字寫成能貼進公文的句子，每段附「統計截至 115 年 9 月（人口）、1151002 版（危老清冊）」等資料日期與來源。只放已確認與原始統計，不放推估類因子。加「複製」鈕。(e) 已知案件段加子句「登錄文化資產 <heritage_sites_n> 處（文化部文資局開放資料）」，缺欄就省略。「複製全部」時在文字最後附一行「（本段由原型於 <YYYY-MM-DD HH:mm> 產生，資料版本見各句括號）」，時間用瀏覽器當下時間，頁面上不顯示。依據：debug-aa 10/18 讀 16 則議會書面質詢答復，答復最常寫日期與期程、法規條號、全市件數、既有措施、補助金額。
