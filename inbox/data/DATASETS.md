# 資料索引（第 6 題）

> 由 `ops/export_public_repo.py` 產生，2026-10-22。每次匯出整份重寫，不要手改。
> 路徑都相對於匯出的資料夾（團隊 repo 的 `inbox/`）。

## 先看這裡

1. 最省事的用法：拿 `data/marts/` 的成品表。研究組的原型只讀這一層。欄位字典在 `data/marts/README.md`。
2. 要重算 marts：照 `pipelines/README.md` 跑。原始檔大多已在 `data/raw/`；不在的見第 4 節。
3. 畫面或 README 用到任何一份資料，都要標出處（第 5 節）。沒標出處，等於沒取得授權。
4. 這裡只有第 6 題用到的資料。其他題的原始檔可用 `uv run python -X utf8 -m pipelines.fetch.fetch_raw <slug>` 重抓。

## 1. 成品表 `data/marts/`

| 檔案 | 內容 | 公開時的條件 |
|---|---|---|
| `village_indicators.csv`、`.geojson` | 456 里 × 指標（人口、液化、屋齡、救災可及性、已知案件件數） | 全國 2026 版欄位（`*_national2026`）只當對照，畫面預設城市版 |
| `village_rankings.csv`、`.geojson` | 456 里的五因子分級與排名區間 | 同上 |
| `shards_public/<區碼>.json`、`index.json` | 逐門牌分片，12 區，給地址查詢用 | 海砂屋、黃單旗標只在精確門牌比對的棟上有值。不得做成可瀏覽的圖層、清單或地圖點（共識 BD10） |

## 2. 清洗後 `data/staged/`

| 檔案 | MB | 來源 slug | 產生程式 |
|---|---:|---|---|
| `base/house-number-coordinates.parquet` | 12.6 | house-number-coordinates | `pipelines/stage/stage_house_number_coordinates.py` |
| `base/village-boundary-nlsc.csv` | 0.0 | village-boundary-nlsc | `pipelines/stage/stage_village_boundary.py` |
| `base/village-boundary-nlsc.geojson` | 2.1 | village-boundary-nlsc | `pipelines/stage/stage_village_boundary.py` |
| `base/village-population-by-age.csv` | 2.1 | village-population-by-age | `pipelines/stage/stage_village_population.py` |
| `building-hazard/building-count.csv` | 0.0 | building-count | `pipelines/stage/stage_building_count.py` |
| `building-hazard/fire-access-lanes.csv` | 0.0 | fire-access-lanes | `pipelines/stage/stage_fire_access_lanes.py` |
| `building-hazard/soil-liquefaction.geojson` | 0.7 | soil-liquefaction | `pipelines/stage/stage_soil_liquefaction.py` |
| `hazard/fire-rescue-difficult-areas.csv` | 0.0 | fire-rescue-difficult-areas | `pipelines/stage/stage_fire_rescue_difficult_areas.py` |
| `hazard/liquefaction-boreholes-soil-taipei.geojson` | 1.2 | liquefaction-boreholes-soil-taipei | `pipelines/stage/stage_liquefaction_boreholes.py` |
| `hazard/liquefaction-geologycloud-taipei-basin.geojson` | 0.3 | liquefaction-geologycloud-taipei-basin | `pipelines/stage/stage_liquefaction_geologycloud_taipei_basin.py` |
| `hazard/narrow-lanes-red-yellow.csv` | 0.0 | narrow-lanes-red-yellow | `pipelines/stage/stage_narrow_lanes.py` |
| `hazard/road-width-planned.geojson` | 6.0 | road-width-planned | `pipelines/stage/stage_road_width.py` |
| `housing-stats/house-tax-housing-overview-by-tax-office.csv` | 0.0 | house-tax-housing-overview-by-tax-office | `pipelines/stage/stage_housing_overview.py` |
| `housing-stats/real-price-registration-lvr-all.parquet` | 16.8 | real-price-registration-lvr、lvr-history | `pipelines/stage/stage_real_price_registration.py` |
| `housing-stats/real-price-registration-lvr.csv` | 5.3 | real-price-registration-lvr | `pipelines/stage/stage_real_price_registration.py` |
| `housing-stats/use-permit-by-structure.csv` | 0.0 | use-permit-by-structure-57-94、use-permit-by-structure-95-plus | `pipelines/stage/stage_use_permit_by_structure.py` |
| `land/cultural-heritage.geojson` | 0.2 | cultural-heritage-boch | `pipelines/stage/stage_cultural_heritage.py` |
| `permits/building-permit-footprints.geojson` | 17.1 | building-permit-footprints | `pipelines/stage/stage_building_permit_footprints.py` |
| `permits/construction-permit-lots.csv` | 4.7 | construction-permit-summary-115、construction-permit-summary-historical | `pipelines/stage/stage_construction_permits.py` |
| `permits/construction-permits.csv` | 2.1 | construction-permit-summary-115、construction-permit-summary-historical | `pipelines/stage/stage_construction_permits.py` |
| `permits/use-permits.csv` | 2.1 | use-permit-summary-115、use-permit-summary-historical | `pipelines/stage/stage_use_permits.py` |

## 3. 原始下載檔 `data/raw/`

原樣保存，不手改。每個資料夾的 `_meta*.json` 是入口網站的 metadata，`_manifest.json` 記錄下載時間與 sha256。

| 資料夾 | 名稱 | 提供機關 | 授權 | 讀它的程式 |
|---|---|---|---|---|
| `base/village-population-by-age` | [臺北市各里人口數按年齡分](https://data.taipei/dataset/detail?id=a6394e3f-3514-4542-87bd-de4310a40db3) | 臺北市政府民政局 | 依政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_village_population.py` |
| `building-hazard/building-count` | [臺北市現有營造建築物棟數（含屋齡別）](https://data.taipei/dataset/detail?id=7889e8a0-a71e-44e0-95c7-2213a7db1474) | 臺北市政府主計處 | 依政府資料開放授權條款-第1版 | `pipelines/stage/stage_building_count.py`、`pipelines/stage/stage_housing_overview.py` |
| `building-hazard/fire-access-lanes` | [臺北市消防通道清冊（搶救困難地區）](https://data.taipei/dataset/detail?id=7a800e92-eb22-461f-b29d-8def2127a1bc) | 臺北市政府消防局 | 依政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_fire_access_lanes.py` |
| `building-hazard/soil-liquefaction` | [臺北市土壤液化潛勢圖](https://data.taipei/dataset/detail?id=ec40e067-930f-4058-b7dc-71399d5f3147) | 臺北市政府工務局 | 依政府資料開放授權條款-第1版 | `pipelines/build/build_building_points.py`、`pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_soil_liquefaction.py` |
| `event/open-data-license` | [政府資料開放授權條款](https://data.gov.tw/license) | 國家發展委員會 | 授權條款本文 | — |
| `extra/base/district-boundary-taipei` | [臺北市區界圖](https://data.taipei/dataset/detail?id=1601ef3a-c253-4988-b047-943d9e786143) | 臺北市政府民政局 | 政府資料開放授權條款-第1版 | — |
| `extra/base/elderly-living-alone-stats` | [臺北市獨居老人(106年以後)](https://data.taipei/dataset/detail?id=d4833dcf-0cd1-455e-99b9-ba3bbf23fbe9) | 臺北市政府主計處 | 政府資料開放授權條款-第1版 | — |
| `extra/base/village-boundary-nlsc` | [村里界圖(TWD97經緯度) 1150817](https://data.gov.tw/dataset/7438) | 內政部國土測繪中心 | 政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_building_permit_footprints.py`、`pipelines/stage/stage_cultural_heritage.py`⋯ |
| `extra/base/village-boundary-taipei-civil` | [臺北市里界圖](https://data.taipei/dataset/detail?id=6b17b31d-4e16-495e-95b1-9fd1f47c80d8) | 臺北市政府民政局 | 政府資料開放授權條款-第1版 | — |
| `extra/hazard/fire-listed-buildings-by-floor` | [臺北市列管建築物(消防)](https://data.taipei/dataset/detail?id=f4c37044-5ce0-4c80-9175-69c4f9fee585) | 臺北市政府消防局 | 政府資料開放授權條款-第1版 | — |
| `extra/hazard/fire-rescue-difficult-areas` | [臺北市火災搶救困難地區](https://data.taipei/dataset/detail?id=0f322478-e09b-46af-8019-caeaa79678d7) | 臺北市政府消防局 | 政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_fire_rescue_difficult_areas.py` |
| `extra/hazard/liquefaction-boreholes-soil-taipei` | [臺北市土壤液化分析鑽井圖層資料](https://data.taipei/dataset/detail?id=83f22108-d69a-456b-b663-7b26833cd3de) | 臺北市政府工務局 | 政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_liquefaction_boreholes.py` |
| `extra/hazard/liquefaction-geologycloud-taipei-basin` | [土壤液化潛勢圖資群組(臺北盆地 高/中/低)](https://data.gov.tw/dataset/28691) | 經濟部地質調查及礦業管理中心 | 政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_liquefaction_geologycloud_taipei_basin.py` |
| `extra/hazard/narrow-lanes-red-yellow` | [臺北市狹小巷道清冊(紅黃區)](https://data.taipei/dataset/detail?id=95c2eed3-8253-4dce-bf8e-1d6a01517514) | 臺北市政府消防局 | 政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_narrow_lanes.py` |
| `extra/hazard/road-width-planned` | [臺北市道路寬度](https://data.taipei/dataset/detail?id=068be2c7-eea1-4303-91f8-fbf50c9b2aec) | 臺北市政府都市發展局 | 政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_road_width.py` |
| `extra/housing-stats/building-floor-area-by-structure` | [臺北市現有營造建築物總面積](https://data.taipei/dataset/detail?id=4acdfaf9-7b20-452a-b584-46cc699b0317) | 臺北市政府主計處 | 政府資料開放授權條款-第1版 | — |
| `extra/housing-stats/house-tax-housing-overview-by-tax-office` | [臺北市房屋概況(113/114/115)](https://data.taipei/dataset/detail?id=b2faa7a0-1f4c-4264-be61-b016252c3c6c) | 臺北市稅捐稽徵處 | 政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_housing_overview.py` |
| `extra/housing-stats/household-housing-type-by-district` | [臺北市家庭住宅及主要設備概況－行政區別按年別](https://data.taipei/dataset/detail?id=4672b96f-1212-4977-a4be-36f224188de8) | 臺北市政府主計處 | 政府資料開放授權條款-第1版 | — |
| `extra/housing-stats/use-permit-by-structure-57-94` | [臺北市核發營造建築物使用執照按構造別(57年至94年)](https://data.taipei/dataset/detail?id=36f804c0-d85c-4040-a67a-7e2d3633412d) | 臺北市政府主計處 | 政府資料開放授權條款-第1版 | `pipelines/stage/stage_use_permit_by_structure.py` |
| `extra/housing-stats/use-permit-by-structure-95-plus` | [臺北市核發營造建築物使用執照按構造別(95年以後)](https://data.taipei/dataset/detail?id=ee2b4e19-7a58-4186-9ac8-05e16ba59e09) | 臺北市政府主計處 | 政府資料開放授權條款-第1版 | `pipelines/stage/stage_use_permit_by_structure.py` |
| `extra/land/cadastral-sections-taipei` | [臺北市數值地籍地段圖](https://data.gov.tw/dataset/157685) | 臺北市政府地政局土地開發總隊 | 依政府資料開放授權條款-第1版 | — |
| `extra/land/cultural-heritage-boch` | [文化部文化資產局 文化資產個案（古蹟、歷史建築、紀念建築、聚落），含經緯度](https://data.gov.tw/dataset/6246) | 文化部文化資產局 | 政府資料開放授權條款-第1版（6246、6965 已查；紀念建築、聚落兩類是推論） | `pipelines/fetch/fetch_heritage_boch.py`、`pipelines/stage/stage_cultural_heritage.py` |
| `extra/land/cultural-heritage-taipei` | [臺北市文化資產（含直轄市定古蹟及國定古蹟）](https://data.gov.tw/dataset/121275) | 臺北市政府文化局 | 依政府資料開放授權條款-第1版 | — |
| `extra/land/protected-trees-taipei` | [臺北市受保護樹木](https://data.gov.tw/dataset/121274) | 臺北市政府文化局 | 依政府資料開放授權條款-第1版 | — |
| `extra/land/zoning-taipei` | [臺北市都市計畫使用分區圖（主計、細計）](https://data.gov.tw/dataset/156197) | 臺北市政府都市發展局 | 依政府資料開放授權條款-第1版 | — |
| `extra/permits/building-permit-footprints` | [臺北市建築執照套繪圖](https://data.taipei/dataset/detail?id=af067fb6-9e47-4f4c-a484-e72eba161319) | 臺北市建築管理工程處 | 政府資料開放授權條款-第1版 | `pipelines/build/build_village_indicators.py`、`pipelines/stage/stage_building_permit_footprints.py` |
| `extra/permits/construction-permit-summary-115` | [臺北市115年度建造執照摘要](https://data.taipei/dataset/detail?id=d8834353-ff8e-4a6c-9730-a4d3541f2669) | 臺北市建築管理工程處 | 政府資料開放授權條款-第1版 | `pipelines/stage/stage_construction_permits.py` |
| `extra/permits/demolition-permit-by-structure` | [臺北市營造建築物核發拆除執照構造別](https://data.taipei/dataset/detail?id=a5d5a31b-4166-4b43-ad7b-59eff1fe3126) | 臺北市建築管理工程處 | 政府資料開放授權條款-第1版 | — |
| `extra/permits/use-permit-summary-115` | [臺北市115年度使用執照摘要](https://data.taipei/dataset/detail?id=0816f991-e6c8-4da0-a789-d022fee1462b) | 臺北市建築管理工程處 | 政府資料開放授權條款-第1版 | `pipelines/stage/stage_use_permits.py` |
| `extra/renewal/sea-sand-houses-stats` | [臺北市海砂屋列管案件(統計)](https://data.taipei/dataset/detail?id=9617a04f-dd29-460c-a5ee-e4df2b0b4573) | 臺北市政府主計處 | 政府資料開放授權條款-第1版 | — |
| `extra/renewal/urban-renewal-bonus-stats` | [臺北市都市更新容積獎勵案件統計表](https://data.taipei/dataset/detail?id=cda6b568-0035-420b-bd05-6ca9bfd4bda0) | 臺北市都市更新處 | 政府資料開放授權條款-第1版 | — |
| `extra/renewal/urban-renewal-city-land-completed` | [臺北市市有土地參與都市更新完工或結案案件表](https://data.taipei/dataset/detail?id=377f9ac7-521d-4247-b552-0075012d10fe) | 臺北市政府財政局 | 政府資料開放授權條款-第1版 | — |
| `extra/renewal/urban-renewal-city-land-progress` | [臺北市市有土地參與都市更新案件進度表](https://data.taipei/dataset/detail?id=560b633f-4ca7-4e37-957a-53879eccf5ea) | 臺北市政府財政局 | 政府資料開放授權條款-第1版 | — |
| `extra/renewal/urban-renewal-finance-led` | [臺北市政府財政局主導辦理都市更新案件進度表](https://data.taipei/dataset/detail?id=9a241082-4bd8-49e2-ab56-bcbf8e04f51f) | 臺北市政府財政局 | 政府資料開放授權條款-第1版 | — |

## 4. 第 6 題用到、但不在這個 repo 的資料

| slug | 為什麼不放 | 要用時 |
|---|---|---|
| [house-number-coordinates](https://data.taipei/dataset/detail?id=b7c8e724-1e98-45ee-a0bd-f3840623ed97) | 原始檔單檔 119 MB，超過 GitHub 單檔上限 | staged 版已放：`data/staged/base/house-number-coordinates.parquet` |
| [real-price-registration-lvr](https://data.gov.tw/dataset/18703) | 原始檔 100 MB | staged 版已放：`data/staged/housing-stats/real-price-registration-lvr*.{csv,parquet}` |
| lvr-history | 原始檔 401 MB、968 個檔 | staged 版已放（同上）；重抓：`pipelines/fetch/fetch_lvr_history.py` |
| [construction-permit-summary-historical](https://data.taipei/dataset/detail?id=e20ea68e-c79d-4882-a2f9-2f3eeb45384b) | 原始檔單檔 87 MB | staged 版已放：`data/staged/permits/construction-permit*.csv` |
| [use-permit-summary-historical](https://data.taipei/dataset/detail?id=c876ff02-af2e-4eb8-bd33-d444f5052733) | 原始檔單檔 65 MB | staged 版已放：`data/staged/permits/use-permits.csv` |
| [earthquake-listed-buildings](https://data.taipei/dataset/detail?id=f98010ed-281d-4334-9596-ca7d740cc06f) | 逐址列管清單。共識 BD10：不提供可瀏覽的清單 | `data/marts/shards_public/` 在精確門牌比對的棟上帶 `quake_listed` 旗標；里層級件數在 `village_indicators` |
| [sea-sand-houses-list](https://data.taipei/dataset/detail?id=c6f1a88f-5d99-4fc2-8271-f3adb59f87c2) | 逐址列管清單（市有建物 5 筆）。共識 BD10 | 同上，旗標 `sea_sand` |
| sea-sand-houses-full-list | 建管處 PDF，未標開放授權；只能彙總到里（data-licenses §4） | 同上，旗標 `sea_sand`；里層級件數在 `village_indicators` |
| dangerous-old-building-rebuild-approved-cases | 建管處 PDF，未標開放授權；只發布彙總數字（data-licenses §4） | 里層級件數在 `village_indicators` |
| liquefaction-national-gsmma-2026 | 授權待確認（data-licenses §4） | 里層級比例 `*_national2026` 在 `village_indicators`，只當對照；官方查詢 https://liquefaction.gsmma.gov.tw |
| grb | 研究報告清單，授權沒查；產品用不到 | 研究結論在 `research/issue-06/` |
| abri | 研究報告 PDF，著作權沒查 | 同上 |
| fulltext | 研究報告全文 PDF（425 MB），著作權沒查 | 同上 |
| [active-faults-gsmma-wms](https://data.gov.tw/dataset/6697) | WMS 截圖，程式沒有用到 | — |

## 5. 出處標示

政府資料開放授權條款第 1 版要求標示出處，格式如下（`docs/data-licenses.md` §2）：

```text
提供機關／單位 [年份] [開放資料釋出名稱與版本號]
此開放資料依政府資料開放授權條款 (Open Government Data License) 進行公眾釋出，
使用者於遵守本條款各項規定之前提下，得利用之。
政府資料開放授權條款：https://data.gov.tw/license
```

本 repo 原始檔的提供機關：內政部國土測繪中心、國家發展委員會、文化部文化資產局、經濟部地質調查及礦業管理中心、臺北市建築管理工程處、臺北市政府主計處、臺北市政府地政局土地開發總隊、臺北市政府工務局、臺北市政府文化局、臺北市政府民政局、臺北市政府消防局、臺北市政府財政局、臺北市政府都市發展局、臺北市稅捐稽徵處、臺北市都市更新處。

另外兩份要注意：

- 文化部文化資產局的紀念建築、聚落兩類，授權和古蹟、歷史建築相同是推論，沒有逐一查證。
- 底圖 OpenStreetMap 要標「© OpenStreetMap contributors」（ODbL）。
