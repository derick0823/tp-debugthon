# prototype/data：原型頁面讀的靜態資料

- 產生：從 repo 根目錄跑 `uv run python -X utf8 research/issue-06/solutions/prototype/scripts/build_prototype_data.py`。每次執行整份重寫，不要手改。
- 來源：只讀 `data/marts/`（`village_rankings.geojson`、`village_indicators.csv`、`building_points.parquet`，以及 c8 的內部分片 `shards/<town_code>.json`，只拿海砂屋與黃單六欄）。欄位定義與資料日期以 `data/marts/README.md` 為正本，這裡只列原型多算的欄位與格式。`shards/` 不進 git，沒有的話先跑 `uv run python -X utf8 -m pipelines.build.build_address_shards`。
- 進 git：`villages.geojson`（1.3 MB）、`towns.json`、`meta.json`。**`buildings/` 不進 git**（12 片合計約 30 MB，見本目錄的 `.gitignore`），跑上面的指令就會產生。
- 讀取端：`assets/common.js` 的 `loadVillages()`、`loadTowns()`、`loadMeta()`、`loadTown(townCode)`（同 `loadTownBuildings`）。頁面不要自己 `fetch` 分片，因為分片是欄位陣列加字典編碼，要經過 `decodeShard()`。
- 與 `SPEC.md` 的關係：SPEC §3、§4 寫「以本檔與 `common.js` 實際內容為準」。本檔是資料契約的正本；SPEC 預期的名字（`columns`／`items`、`n_buildings`、`loadTown`、`computeWeighted`、`rankAll`、`fmtPct`、`fmtInt`、`LABELS`）都有。
- 建立：2026-10-18（資料層 agent）。對應的 parquet 版本：commit 84f486d（軟弱層 C1 只用實際年份；軟弱層候選 A 1,109／B 2,792）。旗標改從 c8 分片取：2026-10-18 第二輪。

## villages.geojson

- 456 個里，`Polygon`，EPSG:4326，座標 6 位小數。幾何來自 `village_rankings.geojson`。
- `properties` ＝ `village_rankings` 的全部欄位 ＋ `village_indicators` 的下列欄位 ＋ 原型自算的 `p_*`。數值四捨五入到 4 位小數，缺值是 `null`。

### 從 village_rankings 帶過來的（定義見 marts README「village_rankings」）

`village_code`、`town_code`、`town_name`、`village_name`、`f_<因子>`、`lv_<因子>`、`composite_equal_<版本>`、`composite_rank_<版本>`、`composite_level_<版本>`、`rank_p05_<版本>`、`rank_p50_<版本>`、`rank_p95_<版本>`、`share_top46_<版本>`、`hidden_by_composite_<版本>`、`hidden_factors_<版本>`（字串，多個因子用 `;` 分隔，`hiddenFactors()` 會拆成陣列）、`s5_candidate`、`s5_reason`。

因子名：`elderly`、`old_stock`、`liquefaction_<版本>`、`rescue`、`soft_story`。版本：`city2019`、`national2026`。

### 從 village_indicators 帶過來的

| 群 | 欄位 |
|---|---|
| 人口 | `area_km2`、`pop_total`、`pop_65plus`、`share_65plus`、`pop_80plus`、`share_80plus`、`share_65plus_change_110_115`、`pop_density_per_km2` |
| 液化 | `liq_high_share_city2019`、`liq_medium_share_city2019`、`liq_high_share_national2026`、`liq_medium_share_national2026`、`borehole_n`、`borehole_pl_median` |
| 建物 | `doorplate_units`、`doorplate_buildings`、`new2001_units`（2001 年後新建使照戶數，府函段落用）、`town_share_age_30plus`、`bld_age_known_unit_share`、`bld_age_known_n`、`bld_share_pre_policy_1999`、`bld_share_pre1982`、`bld_share_pre1974`、`bld_share_brick_reinforced`、`soft_story_a_n`、`soft_story_b_n`、`soft_story_rate`、`no_elevator_30plus_n`、`lvr_n_built`、`lvr_built_year_median`、`lvr_share_pre1982_est`、`lvr_share_age50plus_est` |
| 救災 | `narrow_lanes_n`、`narrow_lanes_red_n`、`fire_rescue_sites_n`、`fire_access_lanes`、`road_markers_n`、`road_markers_lt6m_share` |
| 已知案件（里層級筆數） | `sea_sand_cases_n`、`sea_sand_units`、`quake_listed_n`、`weilao_active_est`、`town_weilao_active_n`、`town_weilao_per_1k_old_bld` |
| 文化資產 | `heritage_sites_n`：里內登錄文化資產點數（古蹟、歷史建築、紀念建築、聚落建築群），整數。來源 `cultural-heritage-boch`（文化部文資局開放資料，2026-10-18 下載，臺北 566 處有座標），c8 2026-10-18 新增。csv 沒有這欄時腳本印警告並略過，頁面不顯示文資句。【實測 2026-10-18】145／456 里有至少 1 處，合計 566 處；記在 `meta.json` 的 `counts.heritage_villages`、`counts.heritage_sites_total` |

`town_*` 是區層級，同區各里相同，不能拿來比同區內的里。

### 原型自算：`p_<因子>`

- `p_elderly`、`p_old_stock`、`p_liquefaction_city2019`、`p_liquefaction_national2026`、`p_rescue`、`p_soft_story`。
- 定義：`f_<因子>` 的危險百分位，`rank(method='average') / n`，0～1，值越大越危險；缺值先補 0 再排。
- 用途：權重滑桿的加權合成（`computeWeighted()`、`rankAll()`）。**顯示等級請用 marts 的 `lv_*`**，不要從 `p_*` 重算：用 `LEVEL_SHARES` 切 `p_*` 和 marts 的 `lv_*` 有 50／2,736 筆（1.8%）在分級邊界不一致（並列值處理不同）【實測 2026-10-18】。

## buildings/<town_code>.json

- 12 片，一區一片，單片 1.5～4.2 MB（士林區 4.22 MB，超過 4 MB 軟上限），合計約 33 MB【實測 2026-10-18】。來自 `building_points.parquet`，一列一棟，209,350 棟；海砂屋與黃單六欄來自 c8 分片（見下）。
- **有 `quake_listed`、`quake_listed_address`、`quake_listed_version`**（2026-10-18 起，`INCLUDE_QUAKE_LISTED = True`，照共識 BD10 修正版）。三欄以字典編碼加在最後；`quake_listed` 值是 `"921"`／`"331"`／`"403"`，`quake_listed_version` 是 `115.3.18`。里層級筆數仍在 `villages.geojson` 的 `quake_listed_n`。頁面照 SPEC §3.2：欄位不在就不顯示那一項，不能壞（把常數改回 `False` 重跑就會拿掉三欄）。
- **有 `sea_sand`、`sea_sand_list_address`、`sea_sand_list_version`**，但頁面只在使用者輸入確切地址、`searchBuildings()` 的 `exact` 命中時才顯示，不做圖層、清單、地圖點。卡片顯示清冊原文地址（`sea_sand_list_address`）與版本，不顯示我們比對後的地址（BD10）。黃單同一種處理，卡片加「列管狀態以建管處為準」。
- **旗標規則（BD10 精確比對，`apply_list_flags_from_c8()`）**：兩組旗標（`sea_sand` 三欄、`quake_listed` 三欄）**以 `point_id` 從 c8 的內部分片 `data/marts/shards/<town_code>.json` 取**（`pipelines/build/build_address_shards.py` 產生，不進 git）。c8 在 `build_building_points.py` 只把清冊接到 `geo_level＝1`（精確門牌）比對到的棟上，鄰號或巷段比對（geo_level 2～3）的案件不掛旗標、只算進里層級筆數，所以直接照抄就是精確比對規則，不在這裡用字串重做。分片沒有該 `point_id`、或該筆沒有旗標，六欄都設 `null`。分片的 `quake_listed` 是整數 921，這裡轉成字串 `"921"` 給頁面的 `QUAKE_LISTED_LABELS` 用。
  - 結果【實測 2026-10-18，parquet 與分片同為 11:55 版】：海砂屋 mart 內 147 棟，分片也 147 棟，全部保留；黃單 32 棟，分片 32 棟，全部保留；分片內沒有 parquet 以外的 `point_id`。筆數記在 `meta.json` 的 `counts.list_flag_filter`（`source`、每旗標的 `in_mart`／`kept`／`dropped`／`added`／`shipped`）。
  - 清冊原文地址仍可能列多個門牌與樓層（「中坡南路120至136號」「永吉路120巷49、49之1、49之2、51、51之1、51之2號(1至5樓)」）；卡片照原文顯示，不另拆解。
  - 上一輪的字串過濾（「清冊原文正規化後 ＝ 棟 `address`」，`filter_exact_list_flags()`）只留作**退回方案**：`data/marts/shards/` 不存在時腳本印警告並改用它，結果會少很多（海砂屋只剩 14、黃單只剩 9，因為清冊原文常列多個門牌）。`meta.json` 的 `counts.list_flag_filter.rule` 會寫明當次用的是哪一條。分片比 parquet 舊時腳本也會印警告，請先重跑 `uv run python -X utf8 -m pipelines.build.build_address_shards`。
- 格式（欄位陣列加字典編碼，是縮減體積的規則，所有分片一致）：

```json
{
  "town_code": "63000090",
  "town_name": "南港區",
  "generated": "2026-10-18",
  "columns": ["point_id", "address", "addr_norm", "village_code", "lon", "lat", "..."],
  "enums": {"status": ["confirmed", "estimated", "undetermined"], "village_code": ["..."], "...": []},
  "items": [["5ce613329596", "三民路5號", null, 3, 121.56361, 25.0522, 1, true, 0, null, 2004, null, null, 3, 0, 5, 0, 0, 2, null, false, 1, 0, 1, null, null, null, null], ...]
}
```

- `items[i][j]` 對應 `columns[j]`。欄名在 `enums` 裡的，值是該欄 `enums` 陣列的索引（`null` 仍是 `null`）。`decodeShard()` 會還原成物件陣列，並補上 `town_code`、`town_name`。
- `addr_norm` 與 `address` 相同時存 `null`（209,348／209,350 筆相同），解碼後補回 `address`。
- `towns.json` 每筆的 `columns` 就是該片的欄位清單，可以先查有沒有某欄。

| 欄位 | 型別 | 說明（定義見 marts README「building_points」） |
|---|---|---|
| `point_id` | 字串 | 棟的編號 |
| `address` | 字串 | 正規化後的基本門牌，不含市、區、樓層 |
| `addr_norm` | 字串或 null | 地址正規化（規則見下） |
| `village_code` | 字典 | 里代碼 |
| `lon`、`lat` | 數值 | EPSG:4326，5 位小數 |
| `doorplate_units` | 整數 | 門牌筆數 |
| `on_main_road` | 布林 | 不在巷弄內 |
| `status` | 字典 | `confirmed`／`estimated`／`undetermined`。**注意**：鄰棟推估（`age_source` 為 `lvr_neighbor`，72,377 棟）在 mart 裡是 `estimated` 但 `built_year` 為空、只有 `built_year_min`／`max`；SPEC §10 要這種情況徽章仍顯示「未判定」加副標「有鄰棟線索」，頁面請用 `built_year === null && built_year_min !== null` 判斷，不要只看 `status` |
| `undetermined_reason` | 字典 | `no_sale_since_2012_no_permit`／`sale_without_built_year` |
| `built_year` | 整數或 null | 建成年（西元） |
| `built_year_min`、`built_year_max` | 整數或 null | 鄰棟推估的年份區間（K6 L2）。`built_year` 有值時也可能有 |
| `age_source` | 字典 | `permit`／`sea_sand_list`／`lvr`／`lvr_neighbor`／`none` |
| `age_conf` | 字典 | `high`／`medium`／`low`／`none` |
| `code_generation` | 字典 | `g1_pre1974` … `g6_2000_plus`。鄰棟推估的棟為 null |
| `structure_class` | 字典 | `rc`／`src_steel`／`brick_reinforced`／`brick`／`wood`／`other` |
| `status_structure` | 字典 | 構造的狀態 |
| `floors` | 整數或 null | 地上層數 |
| `lvr_building_type` | 字典 | 建物型態眾數 |
| `no_elevator_30plus` | 布林 | 建成年 ≤1996 且沒有電梯 |
| `liq_level_city2019` | 字典 | `high`／`medium`／`low`／`not_mapped` |
| `liq_level_national2026` | 字典 | `high`／`medium`／`low`／`none`／`not_mapped` |
| `liq_agreement` | 字典 | `both_high`／`one_high`／`neither_high`／`undetermined` |
| `soft_story_candidate` | 字典 | `A`／`B`／null。畫面只能寫「一樓軟弱層候選」 |
| `near_heritage_50m` | 布林 | 50 公尺內有文資點（文資是一個代表點，不是保存範圍；只當預檢，不是審查結果）。來源 `cultural-heritage-boch`，c8 2026-10-18 新增。為真時市民卡「這棟房子」區塊多一行文資句。parquet 沒有這欄時腳本印警告並略過，頁面不顯示。【實測 2026-10-18】6,388／209,350 棟為真；記在 `meta.json` 的 `counts.near_heritage_50m_buildings` |
| `sea_sand` | 字典 | `rebuild`／`retrofit`／null。只在精確地址比對後顯示；值來自 c8 分片（geo_level＝1 的棟才有，見上） |
| `sea_sand_list_address` | 字串或 null | 清冊原文地址，可能列多個門牌與樓層，照原文顯示 |
| `sea_sand_list_version` | 字典 | `115.3.25` |
| `quake_listed` | 字典 | `"921"`／`"331"`／`"403"`／null。黃單所屬地震；同樣只在精確比對後顯示，值同樣來自 c8 分片（分片存整數，這裡轉字串） |
| `quake_listed_address` | 字串或 null | 黃單清冊原文地址 |
| `quake_listed_version` | 字典 | `115.3.18` |

### 地址正規化 `addr_norm`

Python `normalize_address()` 與 JS `normalizeAddress()` 兩邊規則相同（14 筆測試案例逐字一致【實測 2026-10-18】），順序：

1. 去掉所有空白（含全形空白）。
2. 全形 ASCII 轉半形（`１２３－` → `123-`）。
3. 「台」→「臺」（與 `pipelines/address.py`、SPEC §3.3 同方向；mart 的 `address` 全是「臺」）。
4. 去掉開頭的「臺北市」，再去掉開頭的區名（12 個區）。
5. 段、巷、弄、號、樓、層前面與「之」後面的中文數字轉阿拉伯數字（「二段」→「2段」，「一百零五巷」→「105巷」，支援 1～999）。
6. 數字之間的連字號（`-`、`－`、`—`、`–`）→「之」。
7. 去掉樓層以後的部分（`N樓…`、`N層…`、`NF…`、`BN…`、`地下…`）。
8. 去掉所有「之N」（「12之3號」「12-3號」「12號之3」都併到「12號」，與逐棟表「棟」的定義一致；「8弄之3號」→「8弄3號」）。

與 SPEC §3.3 的差異：SPEC 寫連字號轉 `-`；這裡轉成「之」再去掉，因為 mart 的棟已把「之」號併入基本門牌，保留 `-` 會永遠比對不到。

查詢流程：`parseAddress(input)` 取區名 → 用 `towns.json` 找 `town_code` → `loadTown(town_code)` → `searchBuildings(records, input, 20)`，`exact` 是精確比對（可顯示 `sea_sand`），`similar` 是同路段開頭或包含字串的相近門牌（不顯示 `sea_sand`）。

## towns.json

12 個區的陣列，每筆：`town_code`、`town_name`、`n_villages`、`pop_total`、`n_buildings`、`file`（`buildings/<town_code>.json`）、`bytes`、`columns`（該片欄位清單）、`bbox`（`[minLon, minLat, maxLon, maxLat]`）、`center`（`[lon, lat]`）。

## meta.json

| 鍵 | 內容 |
|---|---|
| `generated` | 資料檔產生日 |
| `disclaimer` | 每頁底部第一行（SPEC §8） |
| `data_note` | 每頁底部第二行（SPEC §8，真實資料與推估的清單）。推估項寫「一樓軟弱層候選」，「軟弱層」不得單獨出現（SPEC §9） |
| `relative_note`、`composite_note`、`estimate_note` | 「相對於臺北市其他里」「等權合成，僅供對照」「推估」 |
| `factors` | 五因子：`key`、`label`、`field_raw`、`field_level`、`field_pct`、`definition`、`source`、`data_date`、`kind`（原始／推估） |
| `liq_versions`、`default_liq_version`、`public_default_liq_version` | 兩版液化的名稱與日期；內部原型預設 `national2026`，公開版預設 `city2019`（BD9） |
| `level_shares`、`level_note` | 5 級比例 1.6／5.6／15.8／31.8／45.2% 與說明 |
| `rank_interval_note` | 排名區間的算法說明 |
| `counts` | 里數、區數、S5 候選數、被總分藏起來的里數（兩版）、`share_top46 ≥ 0.9` 的里數（兩版）、棟數、有建成年的比例（棟、戶）、`status` 分布、`age_source` 分布、一樓軟弱層候選數、海砂屋棟數與黃單棟數（`sea_sand_buildings` 147、`quake_listed_buildings` 32）、`quake_listed_shipped`、`list_flag_filter`（當次用的規則 `rule`、來源 `source`、每個旗標的 `in_mart`／`kept`／`dropped`／`added`／`shipped`）、`shard_columns` |
| `data_dates` | 17 個來源的 `label`、`source`、`date`（含 `heritage`：文化資產，`cultural-heritage-boch`，2026-10-18 下載），給 `renderFooter()` 列在頁尾 |

## 資料日期（摘自 marts README）

里界 115/8/17 版；人口 115 年 9 月；液化城市版 soil.taipei 2019 版、全國版 2026（115/9/24 更新）；門牌 2026-10-02 版；使照 90～115 年；實價登錄里層級 114S4～115S3、逐棟 101S4～115S3；窄巷與搶救困難場所 2026-10-17 下載；計畫道路寬度 2021-03 版；海砂屋 115/3/25 版；黃單 115/3/18 版；危老 1151002 版。
