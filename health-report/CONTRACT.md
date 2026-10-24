# 健檢報告接口說明（CONTRACT）

給前端、後端隊友。引擎：`lib/report.js`（ES module，不碰 DOM）。版本 `version: 1`（2026-10-24）。第二～五輪只**新增**欄位，沒有改名或刪除（第二輪新增標「＋」，第三輪「＋＋」，第四輪「＋＋＋」，第五輪「⁵」）。給民眾看的簡化版讀第三輪的 `verdict`、`risks`、`plain_village`。

## 1. 參數

網址與 `buildReport(input)` 用同一組名字。網址可用 `parseQuery(location.search)` 轉成 `{input, opts}`。每個參數都可以缺，缺的在頁面上補填；格式不對的當成沒填。**姓名不得放進網址參數**（見 `user`）。

| 參數 | 等級 | 型別 | 影響 |
|---|---|---|---|
| `addr` | 必填 | 字串 | 門牌。可帶「臺北市」「大安區」，全形、國字數字、樓層、之幾都會正規化（同 renewal-calculator）。沒帶區名時搜全市 12 區。只有確切對上才有 `building`、列管旗標、你家座標 |
| `age` | 建議 | 整數，年 | 住戶自己填的屋齡。並列推估屋齡、重算耐震世代；資料沒有年份時用它判 1999 前後 |
| `elder` | 建議 | `1`／`0` | 家裡有沒有 65 歲以上長者。`1`：檢核表長者項排前、加電梯與避難建議、`elder_lift` 風險 |
| `type` | 選填 | `apt`／`house`／`building` | 公寓／透天／大樓。`house`：一樓補強補助寫「透天每件最高 50 萬」、不出電梯補助；`apt`、`building`：寫「集合住宅每棟最高 450 萬」 |
| `units` | 選填 | 整數，戶 | 全棟戶數。初評 action 加「每戶約 N 元」＝(1.2 萬＋審查費 1,000) ÷ 戶數，四捨五入到百元（3,000 m² 以上用 1.5 萬另算）。沒填時用門牌數推估並標推估 |
| `floor` | 選填 | 整數，樓 | 住幾樓。`elder=1` 且沒電梯：3 樓以上 `elder_lift` 高、2 樓中；1 樓以下低。沒填照舊 |
| `ground` | 選填 | `shop`／`parking`／`arcade`／`home` | 一樓用途（店面／停車／騎樓／住家）。`ground_floor` 風險改 `basis: "user"`：前三種至少中（原本高維持高），`home` 為低 |
| `own` | 選填 | `owner`／`renter` | `renter`：跟房子有關的 action（`initial_eval`、`soft_story`、`elevator`、`visible_damage`、`weilao`、`listed`）的 `next.who` 前加「先跟房東說：」，其他不加 |
| `mc` | 選填 | `1`／`0` | 有無管委會。`0`：電梯、初評 action 加「沒有管委會：要先推派住戶代表」 |
| `crack` | 選填 | `1`／`0` | 看到裂縫、鋼筋外露、漏水。`1`：`visible_damage` 風險高（`basis: "user"`）＋action「請結構技師或建管處來看」＋總評至少黃燈（line「你說看到裂縫或鋼筋外露，建議請人來看。」；原本紅燈維持紅） |
| `v` | 選填 | 里代碼 11 碼 | 門牌對不上時直接指定里（→ `opts.village_code`） |
| `t` | 選填 | 區代碼 8 碼 | 限定搜尋的區（→ `opts.town_code`） |
| `#w=a,b,c,d,e` | 選填 | 0～4 | 排名權重，順序：高齡、老屋、液化、救災、軟弱層。預設 `1,1,3,3,1`（→ `opts.weights`） |
| `embed` | 頁面用（v1） | `1` | 被嵌進團隊 App（模擬市民－都更篇）時用：隱藏輸入卡、精簡輸入列與大抬頭，只留「報告編號｜受檢人」一小行；輸入由外層 App 負責，外層要帶 `addr`（或 `v`）。引擎不讀這個參數 |
| `#p=1..4` | 頁面用（v1） | 整數 | 開在第幾頁：1 分數與重點、2 這棟房子、3 你家附近、4 接下來可以做的事＋我的里。可分享 |

## 2. 呼叫

```js
import { buildReport, listVillages, parseQuery } from "./lib/report.js";
const r = await buildReport({ addr, age, elder, type, units, floor, ground, own, mc, crack },
  { village_code, town_code, weights, base, fetch, user, now });
// or: const { input, opts } = parseQuery(location.search); await buildReport(input, opts);
```

`opts.base` 預設是 `mvp-variants/`（由模組位置推得）；`opts.fetch` 可換成讀檔（見 `test/check-engine.mjs`）。`listVillages()` 回傳 `[{village_code, village_name, town_code, town_name}]`，給選里用。

## 3. 回傳物件

證據欄：**實**＝原始資料或官方清冊；**估**＝推估或候選；**算**＝本隊依原始資料排序或彙總。

### 最上層

| 欄位 | 型別 | 說明 |
|---|---|---|
| `version` | 數字 | 1 |
| `generated_at` | ISO 字串 | 產生時間 |
| `input` | `{addr, age, elder}` | 清過的輸入；缺的是 `null` |
| `missing` | 字串陣列 | 缺哪幾個：`addr`、`age`、`elder` |
| `weights` | 數字×5 | 排名用的權重 |
| `address` | 物件 | 門牌比對，見下 |
| `building` | 物件或 `null` | **只有確切門牌對上時才有**，見下 |
| `age` | 物件 | `user`（年）、`estimated`（年）、`estimated_source`、`built_year_user`、`built_year_estimated`；＋`code_generation_user`、`code_generation_user_label`（用住戶屋齡重算的耐震規範世代）、＋`code_generation_estimated`、`code_generation_estimated_label`（資料的推估）、＋`pre1999_user`（布林） |
| `village` | 物件或 `null` | `village_code`、`village_name`、`town_code`、`town_name`、`pop_total`（人）、`area_km2` |
| `needs_village` | 布林 | 沒有里可用（門牌對不上且沒給 `v`），頁面要叫使用者選里 |
| `ranking` | 物件 | 我的里在全市的位置 |
| `rescue` | 物件 | 救災地圖與指標條 |
| `checklist` | 陣列 | 演練檢核表 |
| `checklist_note` | 字串或 `null` | `elder=1` 時的說明句 |
| `bonus` | 物件 | 獎勵積木（平均組成） |
| `my_village` | 物件 | 翻譯機「我的里」 |
| `actions` | 陣列，3～5 條 | 報告結果 |
| `sources` | `[{part, text}]` | 資料來源，頁尾摺疊用 |
| `disclaimer` | 字串 | 「這是推估與白話整理，不是官方評估或鑑定。」 |
| `warnings` | 字串陣列 | 例：同門牌跨區 |
| ＋`home` | 物件或 `null` | 地圖上的「你家」，見下 |
| ＋`nearest_weak_shelter` | 物件或 `null` | 最近一處適合避難弱者的收容所，見下 |
| ＋`age_rank` | 物件或 `null` | 「你家比本里幾 % 的房子老」，見下 |
| ＋＋`verdict` | `{level, label, line}` 或 `null` | 總評燈號，見下；沒有里時 `null` |
| ＋＋`risks` | 陣列 | 給民眾看的風險清單，見下；沒有里時是空陣列 |
| ＋＋`user` | `{name, id}` 或 `null` | 只來自 `opts.user`，見下 |
| ＋＋`report_id` | 字串 | 例 `HR-20261024-FAA1`，見下 |
| ＋＋`plain_village` | 字串或 `null` | 一句白話取代排名，例「你住的里，一樓比較空的房子比臺北 9 成的里多。」排名欄位照舊保留 |
| ＋＋＋`input_optional` | 物件 | 選填參數回顯：`{type, units, floor, ground, own, mc, crack}`，沒填或格式不對是 `null` |
| ＋＋＋`missing_optional` | 字串陣列 | 沒填的選填參數名 |
| ⁵`score` | 物件或 `null` | 0～100 分，見下；沒有里時 `null` |
| ＋＋＋`nearby_medical` | 物件或 `null` | 各類最近一處醫療點，見下；`data/medical.json` 不存在時整欄 `null` |

### `address`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `query`、`normalized` | 字串 | 原輸入、正規化後 |
| `match` | `exact`／`similar`／`none` | |
| `town_code` | 字串 | 對上時的區 |
| `suggestions` | `[{town_code, town_name, address, village_code}]` | `similar` 時最多 12 筆，**不含任何列管旗標** |
| `ambiguous` | 同上 | 同一門牌在不只一區對上 |

### `building`（來源 `renewal-calculator/data/towns/<區碼>.json`，即 `data/marts/building_points`）

| 欄位 | 型別／單位 | 證據 | 說明 |
|---|---|---|---|
| `address`、`point_id`、`town_code`、`village_code` | 字串 | 實 | |
| `built_year` | 西元年 | 估（`permit`、`sea_sand_list` 為實） | 沒有單一年份時取鄰棟範圍中點 |
| `built_year_range` | `[min,max]` 或 `null` | 估 | 鄰棟推估範圍 |
| `built_year_confirmed` | 布林 | | 來源是使用執照或海砂屋清冊 |
| `age_estimated` | 年 | 估 | 今年 − `built_year` |
| `age_user` | 年 | | 住戶填的 |
| `age_gap` | 年 | | `age_user − age_estimated` |
| `age_source`、`age_source_label` | 字串 | | `permit`／`sea_sand_list`／`lvr`／`lvr_neighbor`／`none` |
| `age_conf`、`status` | 字串 | | `status`：`confirmed`／`estimated`／`undetermined` |
| `pre1999` | 布林或 `null` | 估 | 申請建造日（建成年 − 2）在 1999 以前。資料沒有時改用住戶屋齡 |
| `pre1999_basis` | `data`／`user_age`／`unknown` | | |
| `code_generation` | 字串 | 估 | 耐震規範世代，如 `g2_1974_1982` |
| ＋`code_generation_label` | 字串 | | 中文，如「1974～1982 年的耐震規範」 |
| ＋`code_generation_user`、`code_generation_user_label` | 字串或 `null` | | 用住戶屋齡重算（建成年 − 2 年對 `GENERATIONS` 切點，同 `pipelines/build/build_building_points.py`） |
| ＋`code_generation_match` | 布林或 `null` | | 兩者是否同一代 |
| ＋`pre1999_user` | 布林或 `null` | | 依住戶屋齡判 1999 前後 |
| `floors` | 層 | 實 | |
| `has_elevator` | 布林或 `null` | 估 | 實價登錄 |
| `building_type`、`building_type_label` | 字串 | 估 | 實價登錄型態 |
| `structure`、`structure_label` | 字串 | 實 | |
| `units` | 戶 | 估 | 門牌數當戶數近似 |
| `no_elevator_30plus` | 布林 | 估 | 30 年以上無電梯 |
| `soft_story_candidate`、`soft_story_label` | `A`／`B`／`null` | 估（候選） | 一樓軟弱層候選 |
| `liq_level`、`liq_label` | `high`／`medium`／`low`／`not_mapped` | 實（區域尺度） | 城市版 2019 |
| `near_heritage_50m`、`heritage_n_50m` | 布林、處 | 算 | |
| `flags.sea_sand` | `{kind, kind_label, list_address, list_version}` 或 `null` | 實 | 海砂屋列管 |
| `flags.quake_listed` | `{event, list_address, list_version}` 或 `null` | 實 | 地震受損列管（黃單） |

### `ranking`（來源 `priority-ranking/data/villages.geojson`，邏輯同 `priority-ranking/app.js`）

| 欄位 | 型別 | 證據 | 說明 |
|---|---|---|---|
| `rank` | 名次 | 算 | 依 `weights` 加權百分位重排，同分取較前名次 |
| `rank_equal` | 名次 | 算 | 等權名次 |
| `n_villages` | 數字 | | 456 |
| `score` | 0～1 | 算 | |
| `levels` | `{elderly, old_stock, liquefaction, rescue, soft_story}`，1～5 | 算 | 5 級最高 |
| `top_k`、`top_k_share` | 46、比例 0～1 | 算 | 隨機權重 2,000 次排進前 46 名的比例 |
| `rank_range` | `{p05, p50, p95}` | 算 | 隨機權重名次區間 |
| `sentence` | 字串×2 | | 卡片上的兩句 |
| `numbers` | 物件 | | 卡片「數字」摺疊：`share_65plus`、`bld_share_pre_policy_1999`（估）、`liq_high_share_city2019`、`lanes_n`、`soft_n`（估）等 |

### `rescue`（來源 `rescue-drill-map/data/`，邏輯同 `rescue-drill-map/app.js`）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `s5_candidate`、`s5_reason` | 布林、字串 | 救災可及性候選里 |
| `pop_total`、`pop_80plus` | 人 | |
| `share_80plus`、`share_80plus_city_median` | 比例 | |
| `bars` | `[{k, label, value, unit, text, ratio, sub, estimated?}]` | 五條：`lanes` 列管窄巷（條）、`liq` 液化高潛勢（占里面積）、`old` 1999 前老屋（估）、`heritage` 文資點（處）、`soft` 軟弱層候選（棟，估）。`ratio`＝本里÷全市最高里 |
| `levels` | `{elderly…soft_story: {level, label}}` | `label`：低／偏低／中／偏高／高 |
| `map.village` | GeoJSON Feature | 里界 |
| `map.lanes`、`map.heritage` | FeatureCollection | 紅黃區窄巷（位置是門牌中心，估）、文資代表點 |
| `map.fire_access_lanes` | 陣列 | 消防通道清冊，無座標 |

### `checklist[]`

`{id, icon, title, detail, elder_related, shelters?}`。`id`：`lanes`、`hydrant`、`liq`、`elder80`、`heritage`、`soft`、`shelter`、`apply`，條件同救災演練地圖。`elder=1` 時 `elder_related` 的項目（`elder80`、`shelter`）排前面。收容所只有名稱、類別、容量、無障礙、適合避難弱者，不含聯絡人。

### `bonus`（來源 `bonus-translator/data/cases.json`、`bonus-items.csv`、`bonus-usage.json`）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `scope`、`scope_label` | `village`／`town`／`city` | 本里有案就用本里，否則本區，再否則全市 |
| `n_cases`、`case_ids` | 數字、字串陣列 | 都更基地（每基地最新一版，F＞F0） |
| `gain_mean` | 比例 | 平均 (F−F0)/F0，算 |
| `gain_city_median` | 比例 | 全臺北中位數 |
| `cap_multiple` | 1.5 | 上限倍數 |
| `blocks[]` | `{code, short, icon, plain, color, mean_pct_of_F0, used_share}` | 每塊＝各案該項÷該案 F0 的平均（沒拿算 0）；`used_share`＝有拿的案比例 |

### `my_village`（來源 `bonus-translator/data/villages.json`，邏輯同翻譯機「我的里」）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `top10_share`、`top10_text` | 比例、字串 | 2000 種算法排進全市前 10% 的比例（如「7%」，<1% 寫「<1%」） |
| `levels` | 1～5×5 | 五格級數 |
| `hidden_factors` | 字串陣列 | 被總分藏起來的因子 |
| `s5_candidate` | 布林 | |
| `silver` | `{share, rank, top_pct, top_text, n, total}` 或 `null` | 銀髮住宅狀況，內政部統計處 113 年；比例與排序是推算 |
| `facts` | 物件 | `heritage_sites_n`（處）、`weilao_active_est`（件，估）、`sea_sand_cases_n`（案）、`quake_listed_n`（筆）、`uro_sites`、`uro_sites_approved`（處；資料不足時 `null`） |

### ＋`home`

`{lon, lat, source, label}`。`source`：`building_points`（門牌確切對上，座標取自 `solutions/prototype/data/buildings/<區碼>.json`，由 `data/marts/building_points` 產生）或 `village_center`（沒有門牌座標時用里界面積中心，`label` 寫明「不是你家」）。

### ＋`nearest_weak_shelter`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `name`、`lon`、`lat` | | 收容所名稱與座標 |
| `cap` | 人或 `null` | 依名稱對教育局一覽表的容納人數；對不到為 `null` |
| `distance_m` | 公尺 | 直線距離，四捨五入到 10 m；**估**，不是步行路線 |
| `from` | `home`／`village_center` | 從你家還是里中心量 |
| `n_sites` | 數字 | 候選收容所處數（119） |
| `note`、`source` | 字串 | |

資料：`data/shelters_weak.json`（`scripts/build_shelters.py` 產生）。只有名稱、座標、容量，沒有聯絡人欄。

### ＋`age_rank`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `village_code` | 字串 | |
| `n_known` | 棟 | 本里有實際建成年的棟數（使用執照、實價登錄、清冊；不含鄰棟推估） |
| `older_than_share_estimated` | 比例或 `null` | 本里比這棟晚建的比例，用推估建成年（這棟只有鄰棟推估時為 `null`） |
| `older_than_share_user` | 比例或 `null` | 同上，用住戶屋齡換算的建成年 |
| `note` | 字串 | |

### ＋＋`verdict`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `level` | `red`／`yellow`／`green` | 規則從 `print.js` 的 `verdictOf` 搬來，順序不變：列管（海砂屋或地震受損，只在確切門牌）＝紅；`crack=1`＝黃（第四輪加）；有 `initial_eval` 或 `soft_story` 行動＝黃；里在預設權重前 46 名＝黃；沒對上門牌但里的老屋 4 級以上＝黃；其他＝綠 |
| `label` | 字串 | 紅「建議盡快處理」、黃「建議找人檢查」、綠「目前沒有明顯警訊」 |
| `line` | 字串，≤30 字 | 一句白話理由 |

規則是團隊自訂，不是官方標準。`print.js` 之後改讀這個欄位。

### ⁵`score`

`{value, grade, label, deductions: [{risk_id, points, cap?}], unknown_n, note}`。**團隊自訂的計分，不是官方評分**（`note` 固定這句）。

- 從 100 分起扣；`risks` 裡 `high` 扣第一個數、`mid` 扣第二個數，`low`、`unknown` 不扣。下限 0。

  | risk_id | high | mid |
  |---|---|---|
  | `age_code` | 20 | 10 |
  | `ground_floor` | 15 | 7 |
  | `soil` | 10 | 5 |
  | `elder_lift` | 10 | 5 |
  | `fire_lane` | 8 | 4 |
  | `shelter` | 5 | 2 |
  | `medical` | 5 | 2 |
  | `visible_damage` | 20 | 10 |

- `quake_listed` 或 `sea_sand` 為 `high`（確切門牌在列管清冊上）時封頂 39 分；`deductions` 多一筆 `cap: true`。
- `grade`／`label`：80 以上 `good`「良好」、60～79 `watch`「要留意」、59 以下 `check`「建議檢查」。
- `unknown_n`：有權重但查不到的風險數（沒有扣分，頁面可提示）。
- 例：`信義路2段86巷40號`、age=50、elder=1 → 61 分「要留意」（年紀 −20、土壤 −5、長者上下樓 −10、窄巷 −4）。

### ＋＋`risks[]`

`{id, icon, title, level, plain, detail, basis, source}`。前 8 條固定、順序固定；第四輪在最後加 `visible_damage`（看得到的損傷，依 `crack`：1 高、0 低、沒填 `unknown`）與 `medical`（最近的急救責任醫院：直線 2 km 以內低、5 km 以內中、更遠高；沒有醫療資料為 `unknown`），共 10 條。取代演練檢核表給民眾看的角色（`checklist` 照舊保留）。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | 字串 | `age_code` 房子的年紀與耐震規定、`ground_floor` 一樓空間、`soil` 地下土壤、`elder_lift` 家有長者與電梯、`quake_listed` 地震受損列管、`sea_sand` 海砂屋、`fire_lane` 窄巷消防車、`shelter` 最近的避難處 |
| `title` | 字串，≤12 字 | 白話標題 |
| `level` | `high`／`mid`／`low`／`unknown` | `unknown`＝查不到，`plain` 會寫「查不到」或為什麼查不到 |
| `plain` | 字串，≤30 字 | 不用術語的一句話 |
| `detail` | 字串 | 給想看細節的人：數字、版本、推估說明 |
| `basis` | `data`／`estimate`／`user` | 官方資料／我們推估／使用者自己填的 |
| `source` | 字串 | 資料來源名稱 |

分級門檻（團隊自訂）：
- `age_code`：1999 前高、後低。
- `ground_floor`：一樓軟弱層候選為高。
- `soil`：這棟液化潛勢高／中／低；沒對上門牌時用里的高潛勢面積，25% 以上為高、大於 0 為中。
- `elder_lift`：家有長者又沒電梯為高。
- 列管兩條：在清冊上為高；沒有確切門牌時為 `unknown`。
- `fire_lane`：里的救災等級 4 以上為高、3 為中。
- `shelter`：直線 500 m 以內為低、1,000 m 以內為中、超過為高。

### ＋＋`user`

`buildReport(input, { user: { name, id } })` 傳入才有，否則 `null`。**姓名不得放進網址參數**；引擎也不從網址讀。未來由登入後的前端用 `opts.user` 傳入。`null` 時頁面要顯示什麼（例如「王小明（示範）」）由頁面決定。

### ＋＋`report_id`

`HR-<YYYYMMDD>-<4 碼十六進位>`。同一個門牌（以區碼＋正規化門牌為準，不同寫法得到同一碼）或同一個里代碼，在同一天得到同一碼。日期用本機日期，可用 `opts.now` 指定。給未來後端記錄用，不是安全識別碼。

### ＋＋＋`nearby_medical`

`{er_hospital, hospital, clinic, aed}`，每個是 `{name, distance_m, lon, lat, district, from}` 或 `null`（該類沒有資料）。`distance_m` 是直線距離，四捨五入到 10 m；`from` 是 `home` 或 `village_center`。資料：`data/medical.json`（另一個子代理產生，`items: [{kind, name, lon, lat, district}]`）。

### `actions[]`

`{id, priority, title, why, subsidy, next: {who, url}, source}`，第四輪加 `plain_title`（白話短標題，≤12 字，例「請人來看耐震」）、`money_tag`（例「最多補 480 萬」「每戶約 1,100 元」「免費」「費用另洽」）、`notes`（字串陣列，選填參數帶出的提醒；目前只有 `mc=0` 的「沒有管委會：要先推派住戶代表」，租屋提醒只在 `next.who` 前綴，不重複放這裡），初評另加 `per_household: {units, units_basis: "user"|"estimate", amount, amount_large}`（元）。新增 `id`：`visible_damage`（`crack=1`）。依 `priority` 排序取 3～5 條。挑選規則是團隊自訂，不是官方標準。`id`：`listed`（列管，只在確切門牌；`why` 只寫清冊版本，不印清冊原文地址）、`initial_eval`、`soft_story`、`elevator`（`elder=1` 且不是確定有電梯）、`elder`、`liquefaction`、`weilao`、`village_drill`。補助數字照 `ops/handoff/2026-10-24-day2-plan.md` 第 1 節與 `renewal-calculator/assets/nextsteps.js`。`next` 只有機關名稱與網址，不放人名電話。
