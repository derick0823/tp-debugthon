# pipelines：產生共用資料的程式

規則見 `ops/CONVENTIONS.md` 第 3 節。新增程式時，在下面對應的表加一列。

執行方式（從 repo 根目錄）：

```sh
uv sync                                                   # 第一次先建環境
uv run python -X utf8 -m pipelines.<層>.<檔名> [參數]
```

## fetch：下載 → `data/raw/`

| 程式 | 用途 | 輸入 | 輸出 | 網路 |
|---|---|---|---|---|
| `fetch/fetch_raw.py` | 依 catalog 下載官方資料 | `data/catalog.json` | `data/raw/<組>/<slug>/` | 要 |
| `fetch/fetch_grb.py` | 抓政府研究資訊系統（GRB）書目與摘要，不抓全文 | `data/manual/grb_keywords.csv` | `data/raw/extra/research/grb/` | 要 |
| `fetch/fetch_abri_list.py` | 抓建研所「研究成果」標題清單，不抓 PDF | — | `data/raw/extra/research/abri/` | 要 |
| `fetch/file_grb_fulltext.py` | 把人工從 GRB 下載的全文對回計畫、改名、搬進 fulltext；加 `--move` 才搬 | `<下載資料夾>`、`data/manual/grb_picks.csv` | `data/raw/extra/research/fulltext/`、`MANIFEST.csv` | 不要 |
| `fetch/fetch_abri_pdfs.py` | 找 GRB 清單裡建研所有的報告 PDF；加 `--download` 才下載。GRB 全文要驗證碼，由人手動下載 | `data/staged/grb/grb_list.csv` | `data/raw/extra/research/abri/pdf_links.csv`、`data/raw/extra/research/fulltext/`（含 `MANIFEST.csv`） | 要 |
| `fetch/fetch_lvr_history.py` | 第 6 題：實價登錄歷史季別 101S1～114S3，全國 zip 只留臺北市檔；一次一檔、間隔 10 秒、可續跑 | — | `data/raw/extra/housing-stats/lvr-history/<季>/`、`_manifest.json` | 要 |
| `fetch/fetch_heritage_boch.py` | 第 6 題：文化部文資局文化資產清單（古蹟、歷史建築、紀念建築、聚落），有經緯度；一次一檔、間隔 5 秒 | — | `data/raw/extra/land/cultural-heritage-boch/`、`_manifest.json` | 要 |

## stage：清洗 → `data/staged/`

| 程式 | 用途 | 輸入 | 輸出 | 網路 |
|---|---|---|---|---|
| `stage/stage_grb_list.py` | 合併 GRB 結果、排序、對建研所標題 | `data/raw/extra/research/{grb,abri}/`、`data/manual/grb_{keywords,picks}.csv` | `data/staged/grb/grb_list.{csv,xlsx}`、`grb_summary.json` | 不要 |
| `stage/stage_village_boundary.py` | 第 6 題：內政部里界，456 里，算面積 | `raw/extra/base/village-boundary-nlsc/` | `staged/base/village-boundary-nlsc.{geojson,csv}` | 不要 |
| `stage/stage_village_population.py` | 第 6 題：各里逐月人口，分年齡段 | `raw/base/village-population-by-age/` | `staged/base/village-population-by-age.csv` | 不要 |
| `stage/stage_house_number_coordinates.py` | 第 6 題：門牌表正規化，供地址比對 | `raw/extra/base/house-number-coordinates/` | `staged/base/house-number-coordinates.parquet` | 不要 |
| `stage/stage_soil_liquefaction.py` | 第 6 題：城市版液化圖，class 轉 high/medium/low | `raw/building-hazard/soil-liquefaction/` | `staged/building-hazard/soil-liquefaction.geojson` | 不要 |
| `stage/stage_liquefaction_national_gsmma_2026.py` | 第 6 題：全國 2026 版液化圖，裁到市界 | `raw/extra/hazard/liquefaction-national-gsmma-2026/` | `staged/hazard/liquefaction-national-gsmma-2026.geojson` | 不要 |
| `stage/stage_liquefaction_geologycloud_taipei_basin.py` | 第 6 題：舊全國版液化圖，裁到市界 | `raw/extra/hazard/liquefaction-geologycloud-taipei-basin/` | `staged/hazard/liquefaction-geologycloud-taipei-basin.geojson` | 不要 |
| `stage/stage_liquefaction_boreholes.py` | 第 6 題：液化鑽孔 PL，標上里 | `raw/extra/hazard/liquefaction-boreholes-soil-taipei/` | `staged/hazard/liquefaction-boreholes-soil-taipei.geojson` | 不要 |
| `stage/stage_fire_access_lanes.py` | 第 6 題：消防通道清冊，拆多里、修錯字 | `raw/building-hazard/fire-access-lanes/` | `staged/building-hazard/fire-access-lanes.csv` | 不要 |
| `stage/stage_narrow_lanes.py` | 第 6 題：狹小巷道紅黃區，巷名落里 | `raw/extra/hazard/narrow-lanes-red-yellow/` | `staged/hazard/narrow-lanes-red-yellow.csv` | 不要 |
| `stage/stage_fire_rescue_difficult_areas.py` | 第 6 題：搶救困難場所，地址落里 | `raw/extra/hazard/fire-rescue-difficult-areas/` | `staged/hazard/fire-rescue-difficult-areas.csv` | 不要 |
| `stage/stage_earthquake_listed_buildings.py` | 第 6 題：地震黃單，地址落里 | `raw/extra/hazard/earthquake-listed-buildings/` | `staged/hazard/earthquake-listed-buildings.csv` | 不要 |
| `stage/stage_road_width.py` | 第 6 題：計畫道路寬度標註線，標上里 | `raw/extra/hazard/road-width-planned/` | `staged/hazard/road-width-planned.geojson` | 不要 |
| `stage/stage_sea_sand_houses.py` | 第 6 題：海砂屋完整清冊，地址落里 | `raw/extra/renewal/sea-sand-houses-full-list/` | `staged/renewal/sea-sand-houses-full-list.csv` | 不要 |
| `stage/stage_dangerous_old_building_cases.py` | 第 6 題：危老核准案，直接解析各版 PDF（取代 `parse_weilao.py`），加 `list_version`，標失效案，路段落里 | `raw/extra/renewal/dangerous-old-building-rebuild-approved-cases/approved-cases-*.pdf` | `staged/renewal/dangerous-old-building-rebuild-approved-cases.csv` | 不要 |
| `stage/stage_use_permits.py` | 第 6 題：使照摘要 90～115 年，地址落里 | `raw/extra/permits/use-permit-summary-{historical,115}/` | `staged/permits/use-permits.csv` | 不要 |
| `stage/stage_building_permit_footprints.py` | 第 6 題：建照套繪圖，落里並接使照竣工年 | `raw/extra/permits/building-permit-footprints/` | `staged/permits/building-permit-footprints.geojson` | 不要 |
| `stage/stage_real_price_registration.py` | 第 6 題：實價登錄買賣（含建物），地址落里。CSV 只放最近 4 季；全部季別（101S4 起）放 `real-price-registration-lvr-all.parquet` | `raw/extra/housing-stats/real-price-registration-lvr/` | `staged/housing-stats/real-price-registration-lvr.csv` | 不要 |
| `stage/stage_housing_overview.py` | 第 6 題：房屋概況，12 區×樓層×屋齡 | `raw/extra/housing-stats/house-tax-housing-overview-by-tax-office/` | `staged/housing-stats/house-tax-housing-overview-by-tax-office.csv` | 不要 |
| `stage/stage_building_count.py` | 第 6 題：官方建物棟數表，全市逐年 | `raw/building-hazard/building-count/` | `staged/building-hazard/building-count.csv` | 不要 |
| `stage/stage_use_permit_by_structure.py` | 第 6 題：使照按構造別，全市逐年 | `raw/extra/housing-stats/use-permit-by-structure-{57-94,95-plus}/` | `staged/housing-stats/use-permit-by-structure.csv` | 不要 |
| `stage/stage_construction_permits.py` | 第 6 題：建造執照摘要 90～115 年；備註標危老、都更旗標；地號長表（接危老清冊） | `raw/extra/permits/construction-permit-summary-{historical,115}/` | `staged/permits/construction-permits.csv`、`construction-permit-lots.csv` | 不要 |
| `stage/stage_petition_categories.py` | 陳情系統類別資料 105/11～115/09，新舊兩種格式合併（111/03 起有受理機關與結案時間） | `raw/civic/petition-categories/` | `staged/civic/petition-categories.parquet` | 不要 |
| `stage/stage_cultural_heritage.py` | 第 6 題：臺北市文資點位（座標，缺漏時用地址比對），標上里 | `raw/extra/land/cultural-heritage-boch/` | `staged/land/cultural-heritage.geojson` | 不要 |

`grb_list.xlsx` 每次執行都重寫。人勾的「要下載」「已下載」「備註」存在 `data/manual/grb_picks.csv`（欄位 `GRB系統id, 要下載, 已下載, 備註`），程式執行時併回清單。

第 6 題的 stage 程式有先後順序：

1. 先跑 `stage_village_boundary`、`stage_house_number_coordinates`。其他程式要用里界與門牌表。
2. `stage_use_permits` 要在 `stage_building_permit_footprints` 之前跑。
3. 其餘順序不限。全部跑完約 6 分鐘。

只有地址的清單用共用模組 `pipelines/address.py` 比對到里。比對等級 `geo_level`（0～4）的定義寫在該檔檔頭。

## build：合併 → `data/marts/`

| 程式 | 用途 | 輸入 | 輸出 | 網路 |
|---|---|---|---|---|
| `build/build_building_points.py` | 第 6 題逐棟表，209,350 棟；建成年、規範世代、構造、兩版液化、海砂屋、黃單、軟弱層候選，每棟標 confirmed／estimated／undetermined | 上面第 6 題的 staged 檔（含 `real-price-registration-lvr-all.parquet`） | `data/marts/building_points.{parquet,csv}`、`building_points_lite.geojson` | 不要 |
| `build/build_village_indicators.py` | 第 6 題里層級共用表，456 里×66 欄 | 上面第 6 題的 staged 檔、`data/marts/building_points.parquet` | `data/marts/village_indicators.{csv,geojson}`；欄位字典在 `data/marts/README.md` | 不要 |
| `build/build_village_rankings.py` | 第 6 題 S1 排名區間（5 因子分級、隨機權重）與 S5 候選，兩版液化各一套 | `data/marts/village_indicators.csv` | `data/marts/village_rankings.{csv,geojson}` | 不要 |
| `build/build_address_shards.py` | 第 6 題 S2 地址查詢的門牌分片，一區一片、16 欄（規格 BD10），不進 git | `data/marts/building_points.parquet` | `data/marts/shards/<town_code>.json`、`index.json` | 不要 |

第 6 題的 build 要依這個順序執行：`build_building_points` → `build_village_indicators` → `build_village_rankings`。`build_address_shards` 只需要 `build_building_points` 先跑。
