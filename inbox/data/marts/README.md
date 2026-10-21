# data/marts：合併後的共用表

本資料夾的檔案由程式產生，每次執行整份重寫。不要手改。

## village_indicators：第 6 題里層級共用表

- 檔案：`village_indicators.csv`（一里一列，456 列）、`village_indicators.geojson`（同欄位＋里界，EPSG:4326，幾何簡化 5 m）。
- 產生：`uv run python -X utf8 -m pipelines.build.build_village_indicators`。前面要先跑 `pipelines/README.md` 列的 stage 程式，再跑 `build_building_points`。
- 2026-10-18 更新：液化欄名照 `ops/CONVENTIONS.md` §4a 改成帶版本（`liq_high_share_city2019` 等）；新增 `bld_*`、`soft_story_*`、`no_elevator_30plus_n` 共 10 欄，來自逐棟表。
- 建立：2026-10-17，研究任務 R1（session c8）。研究報告：`research/issue-06/data-patterns/report.md`。

### 讀表前要知道的 6 件事

1. **「類型」欄**：`原始`＝來源直接加總或相除；`推估`＝經過地址比對、空間分攤、樣本推論或收縮。推估值不能當成普查值引用。
2. **地址比對**：只有地址的清單，用門牌表比對到里。只計 `geo_level` 1～3 的列（1 精確門牌、2 同巷弄最近門牌、3 該巷多數里）。各清單比對率見報告 H7 一節。
3. **實價登錄（`lvr_*`）是成交樣本，不是存量**。屋齡與構造指標已排除「成交時屋齡 2 年內」的新成屋（約占樣本 29%）。每里樣本數中位數只有 25 筆，小樣本里請用 `_est` 欄或看 `lvr_n_*`。
4. **區層級欄（`town_*`）**：來源只到區，同區每個里的值相同。不能拿來比同一區內的里。
5. **液化比例的分母是整個里面積**。城市版只畫平地，山區的里比例是 0，不代表查過是 0。
6. **全國 2026 版欄位（`*_national2026`）的公開條件**（整合者 2026-10-18，`docs/data-licenses.md` §6）：里層級比例是統計值，可以公開；但畫面預設要用城市版（`*_city2019`），全國版欄位要標來源「經濟部地礦中心 2026，僅供對照」。逐址的全國版等級不上公開站。這個條件也適用 `village_rankings` 的 `f_liquefaction_national2026`、`lv_liquefaction_national2026` 與其他 `_national2026` 欄。

### 欄位字典

| 欄名 | 定義 | 來源 slug | 資料年份 | 類型 |
|---|---|---|---|---|
| `village_code` | 里代碼 11 碼（內政部 VILLCODE，與人口檔一致） | village-boundary-nlsc | 115/8/17 版 | 原始 |
| `town_code` | 區代碼 8 碼 | village-boundary-nlsc | 115/8/17 版 | 原始 |
| `town_name` | 區名 | village-boundary-nlsc | 115/8/17 版 | 原始 |
| `village_name` | 里名 | village-boundary-nlsc | 115/8/17 版 | 原始 |
| `area_km2` | 里面積（km²，EPSG:3826 計算） | village-boundary-nlsc | 115/8/17 版 | 原始 |
| `pop_total` | 總人口 | village-population-by-age | 115 年 9 月 | 原始 |
| `pop_65plus` | 65 歲以上人數 | village-population-by-age | 115 年 9 月 | 原始 |
| `share_65plus` | 65 歲以上比例 | village-population-by-age | 115 年 9 月 | 原始 |
| `pop_80plus` | 80 歲以上人數 | village-population-by-age | 115 年 9 月 | 原始 |
| `share_80plus` | 80 歲以上比例 | village-population-by-age | 115 年 9 月 | 原始 |
| `share_65plus_change_110_115` | 65 歲以上比例的變化（115/9 減 110/1，比例差，不是百分比） | village-population-by-age | 110/1～115/9 | 原始 |
| `liq_high_share_city2019` | 城市版液化「高」（class 1）面積占里面積 | soil-liquefaction | soil.taipei 2019 版 | 原始 |
| `liq_medium_share_city2019` | 城市版液化「中」（class 2）面積占里面積 | soil-liquefaction | 同上 | 原始 |
| `liq_low_share_city2019` | 城市版液化「低」（class 3）面積占里面積 | soil-liquefaction | 同上 | 原始 |
| `liq_high_share_national2026` | 全國 2026 版 HIGH 面積占里面積 | liquefaction-national-gsmma-2026 | 2026（115/9/24 更新） | 原始 |
| `liq_medium_share_national2026` | 全國 2026 版 MED 面積占里面積 | liquefaction-national-gsmma-2026 | 同上 | 原始 |
| `liq_low_share_national2026` | 全國 2026 版 LOW 面積占里面積 | liquefaction-national-gsmma-2026 | 同上 | 原始 |
| `liq_high_share_geologycloud` | 舊全國版（geologycloud）高潛勢面積占里面積 | liquefaction-geologycloud-taipei-basin | 約 110 年【推論】 | 原始 |
| `liq_medium_share_geologycloud` | 舊全國版中潛勢面積占里面積 | liquefaction-geologycloud-taipei-basin | 同上 | 原始 |
| `liq_low_share_geologycloud` | 舊全國版低潛勢面積占里面積 | liquefaction-geologycloud-taipei-basin | 同上 | 原始 |
| `borehole_n` | 里內液化鑽孔數 | liquefaction-boreholes-soil-taipei | soil.taipei | 原始 |
| `borehole_pl_median` | 里內鑽孔液化潛能指數 PL 中位數（空白＝沒有鑽孔） | liquefaction-boreholes-soil-taipei | soil.taipei | 原始 |
| `doorplate_units` | 門牌筆數（每層各一筆，含非住宅），當作「戶數」的近似 | house-number-coordinates | 2026-10-02 版 | 原始 |
| `doorplate_buildings` | 門牌的「棟」數（同路、巷、弄、號算一棟） | house-number-coordinates | 2026-10-02 版 | 推估 |
| `town_share_age_30plus` | **所在區**的 30 年以上建物棟數比例 | house-tax-housing-overview-by-tax-office | 115 年度 | 原始（區） |
| `town_share_4_6f` | **所在區**的 4 層與 5～6 層建物棟數比例 | house-tax-housing-overview-by-tax-office | 115 年度 | 原始（區） |
| `new2001_footprint_m2` | 2001 年後建照套繪輪廓面積合計（排除增建、修建、改建），以輪廓代表點落里 | building-permit-footprints、use-permit-summary-* | 90～115 年執照，1151005 版 | 原始 |
| `new2001_units` | 2001 年後新建使照的戶數合計（地址比對落里） | use-permit-summary-historical、-115 | 90～115 年 | 推估 |
| `lvr_n_built` | 有建成年、排除新成屋後的實價登錄成交筆數（樣本數） | real-price-registration-lvr | 成交 114S4～115S3 | 原始 |
| `lvr_built_year_median` | 成交建物建成年（西元）中位數 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_share_pre1982` | 成交建物 1982 年以前（不含 1982）建成的比例 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_share_pre1999` | 成交建物 1999 年以前（不含 1999）建成的比例 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_share_age50plus` | 成交建物 1976 年以前建成（屋齡 50 年以上）的比例 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_n_structure` | 有主要建材、排除新成屋後的成交筆數（樣本數） | real-price-registration-lvr | 同上 | 原始 |
| `lvr_share_brick_reinforced` | 主要建材為加強磚造的比例 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_share_brick` | 主要建材為磚造的比例 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_share_walkup` | 建物型態為「公寓（5 樓含以下無電梯）」的比例 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_share_newbuild` | 成交中「新成屋」（建成後 2 年內成交）的比例，代表改建與新建的活躍度 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_share_pre1982_est` | `lvr_share_pre1982` 向所在區比例收縮：(k＋20×區比例)/(n＋20)。小樣本里較穩 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_share_age50plus_est` | `lvr_share_age50plus` 的收縮值，方法同上 | real-price-registration-lvr | 同上 | 推估 |
| `lvr_share_brick_reinforced_est` | `lvr_share_brick_reinforced` 的收縮值，方法同上 | real-price-registration-lvr | 同上 | 推估 |
| `fire_access_lanes` | 消防通道列管數。一條通道跨 n 個里時，每里記 1/n | fire-access-lanes | 2026-10-17 下載 | 原始（已清洗） |
| `narrow_lanes_n` | 狹小巷道（紅黃區）條數，以巷名比對落里 | narrow-lanes-red-yellow | 2026-10-17 下載 | 推估 |
| `narrow_lanes_red_n` | 其中紅區條數 | narrow-lanes-red-yellow | 同上 | 推估 |
| `fire_rescue_sites_n` | 火災搶救困難場所數，以地址比對落里 | fire-rescue-difficult-areas | 2026-10-17 下載 | 推估 |
| `road_markers_n` | 計畫道路寬度標註線數（不是道路條數，見下方說明） | road-width-planned | 2021-03 版 | 原始 |
| `road_markers_lt6m_share` | 寬度標註小於 6 m 的比例 | road-width-planned | 2021-03 版 | 原始 |
| `sea_sand_cases_n` | 海砂屋列管案數，以地址比對落里 | sea-sand-houses-full-list | 115/3/25 版 | 推估 |
| `sea_sand_units` | 海砂屋列管戶數 | sea-sand-houses-full-list | 115/3/25 版 | 推估 |
| `quake_listed_n` | 921、331、403 地震黃單筆數，以第一個地址落里 | earthquake-listed-buildings | 115/3/18 版 | 推估 |
| `weilao_active_est` | 有效危老核准案的**期望**件數：每案依「所在路段上各里的門牌棟數比例」分攤 | dangerous-old-building-rebuild-approved-cases | 1151002 版 | 推估 |
| `town_weilao_active_n` | **所在區**的有效危老核准案數（排除「失其效力」案）。用最新一版清冊 | dangerous-old-building-rebuild-approved-cases | 1151002 版：1,088 案、失效 189 案，截至 115-09-30 | 原始（區） |
| `town_weilao_per_1k_old_bld` | **所在區**每千棟 30 年以上建物的有效危老核准案數 | 同上＋house-tax-housing-overview-by-tax-office | 同上、115 年度 | 原始（區） |
| `pop_density_per_km2` | 人口密度（人/km²） | 人口＋里界 | 115 年 9 月 | 原始 |
| `new2001_footprint_share_of_land` | `new2001_footprint_m2` ÷ 里面積 | 同上 | 同上 | 原始 |
| `new2001_units_share` | `new2001_units` ÷ `doorplate_units`（上限 1）。2001 年後新建戶的近似比例 | 同上 | 同上 | 推估 |
| `bld_age_known_unit_share` | 有建成年（已確認或推估）的門牌戶數占里內門牌戶數 | building_points | 見逐棟表 | 推估 |
| `bld_age_known_n` | 有建成年的棟數 | building_points | 見逐棟表 | 推估 |
| `bld_share_pre_policy_1999` | 有建成年的戶中，屬 1999 政策線（88-12-31 申請建造）以前的比例。戶數加權 | building_points | 見逐棟表 | 推估 |
| `bld_share_pre1982` | 同上，規範世代 g1＋g2（推定申請年早於 71-06）的比例 | building_points | 見逐棟表 | 推估 |
| `bld_share_pre1974` | 同上，規範世代 g1（推定申請年早於 63-02，構造編尚無地震力規定）的比例 | building_points | 見逐棟表 | 推估 |
| `bld_share_brick_reinforced` | 有構造資料的戶中，加強磚造的比例 | building_points | 見逐棟表 | 推估 |
| `soft_story_a_n` | 一樓軟弱層 A 型候選棟數（連棟騎樓街屋） | building_points | 見逐棟表 | 推估 |
| `soft_story_b_n` | 一樓軟弱層 B 型候選棟數（底層開放中高樓） | building_points | 見逐棟表 | 推估 |
| `soft_story_rate` | (A＋B 候選棟數) ÷ 門牌棟數。「數」和「率」並列，照 R3 建議 | building_points | 見逐棟表 | 推估 |
| `heritage_sites_n` | 里內文資點數（古蹟、歷史建築、紀念建築、聚落建築群），座標來自文資局 | cultural-heritage-boch | 2026-10-18 下載 | 原始 |
| `no_elevator_30plus_n` | 30 年以上（建成年 ≤1996）且沒有電梯的棟數。給 S2 處境 C、D 用 | building_points | 見逐棟表 | 推估 |

### 做不到的指標與原因

| 任務書要的指標 | 狀態 | 原因 |
|---|---|---|
| 所在區 30 年以上棟數比例 | 做到 | `town_share_age_30plus` |
| 2001 年後新建執照的建物面積占比 | 部分做到 | 沒有全市建物輪廓當分母。提供「占里面積」與「戶數占門牌」兩種近似 |
| 實價登錄的建成年中位數、1982／1999 年前比例 | 做到 | 已排除新成屋。每里樣本數中位數 25 筆，另附收縮值 |
| 加強磚造、磚造比例 | 做到 | 同上 |
| 計畫道路寬度小於 6 m 的「長度」比例 | 改成「標註數」比例 | 來源每條線是橫跨道路的寬度標註，線長＝路寬，不是道路中心線（相關係數 0.999999） |
| 危老核准案數落到里 | 只做到期望值 | 96% 的案件只寫到路段。區層級是準的 |
| 50 年以上老屋比例 | 只能推估 | 官方棟數只分「未滿 30 年／30 年以上」。`lvr_share_age50plus` 是成交樣本推估 |

## building_points：逐棟表（S2 的底）

- 檔案：`building_points.parquet`（完整，約 8 MB，進 git）、`building_points.csv`（同欄位，約 45 MB）、`building_points_lite.geojson`（畫面用，只含有建成年或有旗標的棟，約 22 MB，座標 5 位小數）。
- `building_points_lite.geojson` 是可瀏覽的圖層，**不含 `sea_sand`、`quake_listed`**（協調者決定 BD10：海砂屋只在輸入確切地址時顯示，黃單只在里層級彙總）。
- **`building_points.csv` 與 `building_points_lite.geojson` 不進 git**（單檔超過 10 MB，見 `ops/CONVENTIONS.md` §4a-1）。跑下面的 build 指令就會產生。
- 產生：`uv run python -X utf8 -m pipelines.build.build_building_points`。
- 建立：2026-10-18，R1b（session c8）。
- 一列一棟。「棟」＝同一個基本門牌（區＋路段＋巷＋弄＋號），所有樓層與「之」號併成一列。全市 209,350 棟。

### 讀表前要知道的 4 件事

1. **`status` 是建成年的狀態**，值照 §4a：
   - `confirmed`：2001 年後新建使照，或海砂屋清冊的使照年。`built_year` 有值。
   - `estimated`：有兩種，看 `age_source` 分辨。
     - `lvr`：該門牌實價登錄的建成年中位數。`built_year` 有值。
     - `lvr_neighbor`：鄰棟借用。**`built_year` 是空的，只有 `built_year_min`、`built_year_max`**，`age_conf`＝low。畫面要顯示成區間＋「依鄰棟推估」，不能顯示成單一年份。
   - `undetermined`：判不出來，原因在 `undetermined_reason`。
   構造另有 `status_structure`。
2. **建成年的覆蓋率**【實測 2026-10-18，commit 之後的版本】：
   - 棟數：confirmed 6,873、estimated 135,830（其中實價登錄 63,453、鄰棟借用 72,377）、undetermined 66,647，共 209,350。
   - 逐棟有年份（使照、清冊、實價登錄）：以門牌戶數算 62.7%，以棟數算 33.6%。
   - 再加鄰棟借用（只有區間，`age_conf`＝low）：以戶數算 85.1%，以棟數算 68.2%。
   - 里層級的 `bld_*` 比例**只用有實際年份的棟**，不用鄰棟區間。判不出來的棟多半很小：門牌戶數中位數 1 戶，93.7% 在 5 戶以下；有實際年份的棟中位數 5 戶，56.4% 在 5 戶以下【實測，加入鄰棟借用後重算】。所以 `undetermined` **不是隨機缺漏**，畫面上要說明，不能只顯示空白。原因寫在 `undetermined_reason`。
3. **規範世代用「推定申請年＝建成年－2」分段**【推論：竣工通常晚於申請 2～3 年】。斷點取自初評表的設計年度分段與 1999 政策線，來源 `research/issue-06/gov-reports/notes/_bundle-assessment-methods.md`。
4. **軟弱層只標「候選」**，規格是 `research/issue-06/gov-reports/soft-story-spec.md`。
   - 候選數【實測】：A 型 1,109 棟、B 型 2,792 棟；另有 23 棟是「1999 後的 A 型樣態」（只提示，不計入）。
   - C3（一樓非住宅）要有該棟的實價登錄交易，所以沒有交易的棟一律不會是候選。
   - C1（年代）只用實際年份（使照、清冊、實價登錄），**不用鄰棟借用的區間**。若用區間，會多出 A 型 110 棟、B 型 55 棟。

### 欄位字典

| 欄名 | 定義 | 來源 slug | 資料日期 | 類型 |
|---|---|---|---|---|
| `point_id` | 棟的編號：`building_key` 的 SHA-1 前 12 碼 | house-number-coordinates | 2026-10-02 版 | 原始 |
| `village_code` | 里代碼（該棟門牌的多數里） | house-number-coordinates | 2026-10-02 版 | 原始 |
| `town_code` | 區代碼 | house-number-coordinates | 2026-10-02 版 | 原始 |
| `address` | 正規化後的基本門牌（不含市、區、樓層） | house-number-coordinates | 2026-10-02 版 | 原始 |
| `lon`、`lat` | 該棟各樓層門牌座標的平均（EPSG:4326） | house-number-coordinates | 2026-10-02 版 | 原始 |
| `doorplate_units` | 該棟門牌筆數（每層各一筆，含非住宅） | house-number-coordinates | 2026-10-02 版 | 原始 |
| `on_main_road` | 門牌不在巷、弄內（軟弱層 C4） | house-number-coordinates | 2026-10-02 版 | 原始 |
| `status` | 建成年的狀態：confirmed／estimated／undetermined | 見下 | — | — |
| `undetermined_reason` | 判不出建成年的原因：`no_sale_since_2012_no_permit`（2012 年後沒有成交，也沒有 2001 年後使照）、`sale_without_built_year`（有成交但沒填建成年） | real-price-registration-lvr、lvr-history、use-permit-summary-* | — | 原始 |
| `built_year` | 建成年（西元）。使照竣工年優先，其次海砂屋使照年，其次實價登錄中位數 | use-permit-summary-*、sea-sand-houses-full-list、real-price-registration-lvr、lvr-history | 使照 90～115 年；成交 101S4～115S3 | 依 `status` |
| `built_year_min`、`built_year_max` | 建成年的區間。有實際年份時兩欄都等於 `built_year`；鄰棟借用時是「同巷弄門牌 ±4 號內、有年份的鄰棟」的最早與最晚年各再放寬 5 年，`built_year` 留空。鄰棟年份相差超過 10 年就不借 | building_points | — | 推估 |
| `status_built_year` | 同 `status` | — | — | — |
| `age_source` | 建成年的來源：`permit`（2001 年後新建使照）、`sea_sand_list`（海砂屋清冊的使照年）、`lvr`（實價登錄）、`lvr_neighbor`（鄰棟借用，只有區間）、`none`。照 K6 §10 推估階梯 | — | — | — |
| `age_conf` | 建成年的可信度：`high`（使照、清冊，或實價登錄同棟各筆相差 ≤2 年）、`medium`（實價登錄同棟各筆相差 >2 年，可能是增建、填錯或比對錯棟）、`low`（鄰棟借用）、空白（未判定） | — | — | 推估 |
| `code_generation` | 耐震規範世代：`g1_pre1974`、`g2_1974_1982`、`g3_1982_1989`、`g4_1989_1997`、`g5_1997_1999`、`g6_2000_plus` | 由 `built_year` 推 | — | 推估 |
| `pre_policy_1999` | 推定在 88-12-31 以前申請建造 | 由 `built_year` 推 | — | 推估 |
| `structure_class` | 構造：rc／src_steel／brick_reinforced／brick／wood／other | 使照或實價登錄（眾數） | 同上 | 依 `status_structure` |
| `status_structure` | 構造的狀態 | — | — | — |
| `floors` | 地上層數（使照，或實價登錄總樓層數眾數） | 同上 | 同上 | 依 `status` |
| `lvr_txn_n` | 該棟 2012～2026 年的實價登錄成交筆數 | real-price-registration-lvr、lvr-history | 101S4～115S3 | 原始 |
| `lvr_built_year_spread` | 該棟各筆交易建成年的最大差（年）。大於 0 代表同門牌有不同建物或填寫不一致 | 同上 | 同上 | 原始 |
| `lvr_building_type` | 建物型態眾數（walkup_5_or_less、midrise_elevator、tower_11plus、townhouse⋯） | 同上 | 同上 | 原始 |
| `lvr_has_elevator` | 電梯欄眾數 | 同上 | 同上 | 原始 |
| `no_elevator_30plus` | 建成年 ≤1996 且沒有電梯（電梯欄為無，或型態是公寓） | 同上 | 同上 | 推估 |
| `lvr_ground_commercial` | 任一筆交易「移轉層次含一層」且主要用途為商業用或住商用，或型態為店面（軟弱層 C3） | 同上 | 同上 | 原始 |
| `liq_level_city2019` | 城市版液化等級：high／medium／low／not_mapped | soil-liquefaction | soil.taipei 2019 版 | 原始 |
| `liq_level_national2026` | 全國 2026 版液化等級：high／medium／low／none／not_mapped | liquefaction-national-gsmma-2026 | 2026 | 原始 |
| `liq_agreement` | 兩版一致度：both_high／one_high／neither_high／undetermined（城市版沒畫且全國版為山區） | 兩版液化圖 | — | 原始 |
| `sea_sand` | 海砂屋列管：rebuild（須拆除重建）／retrofit（可加勁補強）／空白。**只帶在精確比對到門牌（geo_level 1）的棟**；最近門牌或巷推出來的案不帶，只算進里層級件數 | sea-sand-houses-full-list | 115.3.25 版 | 原始（confirmed） |
| `sea_sand_list_address`、`sea_sand_list_version` | 清冊原文的地址字串與清冊版本。畫面顯示原文＋版本＋官方頁連結，不顯示我們比對後的地址 | 同上 | 同上 | 原始 |
| `quake_listed` | 地震黃單：921／331／403／空白。只帶在 geo_level 1 的棟，規則同 `sea_sand` | earthquake-listed-buildings | 115.3.18 版 | 原始（confirmed） |
| `quake_listed_address`、`quake_listed_version` | 清冊原文的地址字串與清冊版本 | 同上 | 同上 | 原始 |
| `soft_story_candidate` | 一樓軟弱層候選：A／B／空白 | 規格 soft-story-spec.md | — | 推估 |
| `soft_story_post1999_A_pattern` | 1999 後但符合 A 型樣態（不計入候選，只提示） | 同上 | — | 推估 |
| `soft_story_zoning_commercial` | 候選棟所在交易的使用分區含「商」（加註） | 同上 | — | 原始 |
| `near_heritage_50m` | 50 公尺內有文資點（文資是一個代表點，不是保存範圍；只當預檢與可行性篩選） | cultural-heritage-boch | 2026-10-18 下載 | 推估 |
| `heritage_n_50m` | 50 公尺內的文資點數，給預檢「文資：50 公尺內 N 處」 | cultural-heritage-boch | 2026-10-18 下載 | 推估 |
| `building_key` | 「區碼｜路段｜巷｜弄｜號」，地址比對器精確比對（`geo_level` 1）時回傳同一個鍵 | — | — | 原始 |

## village_rankings：S1 排名區間與 S5 候選

- 檔案：`village_rankings.csv`、`village_rankings.geojson`（EPSG:4326）。
- 產生：`uv run python -X utf8 -m pipelines.build.build_village_rankings`（要先有 `village_indicators`）。
- 建立：2026-10-18，R1b（session c8）。**不定權重**，只顯示權重不確定時排名會怎麼變。

### 方法

1. 5 個因子，數值越大越危險：
   - `elderly`：65 歲以上比例。
   - `old_stock`：`bld_share_pre_policy_1999`。已知棟數少於 20 的里改用所在區中位數。
   - `liquefaction`：高比例＋0.5×中比例，兩版各算一次。
   - `rescue`：（窄巷條數的百分位＋道路寬度標註 <6 m 比例的百分位）÷ 2。
   - `soft_story`：`soft_story_rate`。
2. 每個因子轉成百分位，再按固定比例分 5 級：最危險的 1.6% 為 5 級，再來 5.6%、15.8%、31.8%、45.2%（東京地域危險度的比例，見 R2）。
3. 等權合成：5 個百分位平均。
4. 權重敏感度：權重從平坦 Dirichlet 分布抽 2,000 次，記錄每個里排名的第 5、50、95 百分位，以及排進前 46 名（前 10%）的比例。亂數種子固定為 20261018。
5. 「被總分藏起來」：至少一個因子在 4～5 級，等權合成卻只有 1～2 級。
6. S5 候選：三項都成立。
   - 救災不便：有窄巷，或道路寬度標註 <6 m 比例在前 10%。
   - 液化高：任一版高潛勢比例 ≥25%。
   - 80 歲以上比例在中位數以上。

### 欄位字典

| 欄名 | 定義 |
|---|---|
| `f_<因子>`、`f_liquefaction_<版本>` | 因子原始值 |
| `lv_<因子>`、`lv_liquefaction_<版本>` | 因子等級 1～5（5 最危險） |
| `composite_equal_<版本>` | 等權合成（百分位平均，0～1） |
| `composite_rank_<版本>`、`composite_level_<版本>` | 等權合成的排名（1＝最危險）與等級 |
| `rank_p05_<版本>`、`rank_p50_<版本>`、`rank_p95_<版本>` | 隨機權重下排名的第 5、50、95 百分位 |
| `share_top46_<版本>` | 隨機權重下排進前 46 名的比例（≥0.9 可視為「不論權重都在前面」） |
| `hidden_by_composite_<版本>`、`hidden_factors_<版本>` | 是否被總分藏起來、是哪幾個因子 |
| `s5_candidate`、`s5_reason` | S5 候選與理由（中文，可直接顯示） |

`<版本>` 是 `city2019` 或 `national2026`。

## shards：S2 地址查詢的門牌分片

- 檔案：`shards/<town_code>.json`（一區一片，12 片）、`shards/index.json`（區清單、筆數、資料日期）。合計約 85 MB，最大一片約 11 MB。
- 產生：`uv run python -X utf8 -m pipelines.build.build_address_shards`（要先有 `building_points.parquet`）。**不進 git**。
- 規格：協調者決定 BD10（2026-10-18 修正版，`research/issue-06/solutions/decisions/2026-10-18-consensus.md` §2）。每筆欄位：`point_id`、`address`、`village_code`、`lon`、`lat`、`status`、`undetermined_reason`、`built_year`、`built_year_min`、`built_year_max`、`age_source`、`age_conf`、`code_generation`、`structure_class`、`floors`、`liq_level_city2019`、`liq_level_national2026`、`liq_agreement`、`soft_story_candidate`、`sea_sand`、`sea_sand_list_address`、`sea_sand_list_version`、`quake_listed`、`quake_listed_address`、`quake_listed_version`、`near_heritage_50m`、`heritage_n_50m`。共 27 欄。欄位定義同上面的逐棟表。
- 海砂屋與黃單一致處理：只帶在 geo_level 1 的棟；只在使用者輸入確切地址時顯示；顯示清冊原文地址、版本與官方頁連結；不做可瀏覽圖層。
- 每片格式：`{"town_code", "town_name", "generated", "records": [ {...}, ... ]}`。**缺值的欄位直接省略**（讀不到鍵就當 null），這樣檔案小約一半。

### 內部版與公開版

| | 內部版（預設） | 公開版（`--public`） |
|---|---|---|
| 位置 | `data/marts/shards/` | `data/marts/shards_public/` |
| 給誰 | 10.30.1.10 的隊內原型 | GitHub Pages 公開網站 |
| 欄數 | 27 | 25 |
| 合計大小 | 約 83 MB，最大一片 10.6 MB | 約 70 MB，最大一片 8.9 MB |
| 拿掉的欄 | — | `liq_level_national2026`、`liq_agreement`（全國 2026 圖資逐址重發布的授權未明，見 `docs/data-licenses.md` §6） |

兩版都不進 git。授權或共識有結論後，改 `build_address_shards.py` 的 `PUBLIC_DROP` 即可。
