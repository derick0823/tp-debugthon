# 非官方補充資料（第 6 題為主）

- 這些資料**不在官方活動頁的清單上**，是我們自己找的。Demo 和 README 要和官方資料分開說明。
- 2026-10-17 由背景 agent 搜尋並下載。下面的內容是它的報告，路徑已改成新位置。
- 證據標籤：【實測】＝下載並檢查過；【文件】＝引自網頁或 metadata；【推論】＝判斷。

## 目前狀態與待辦

1. 檔案在 `data/raw/extra/<組>/<slug>/`。組別對照見下一節。
2. **還沒登記到 `data/catalog.json`**，所以 `pipelines/fetch/fetch_raw.py` 還不能重抓這些資料。
3. 每份資料的來源網址與授權記在 `data/raw/extra/_sources.csv`。那份檔案裡的路徑還是舊的 `issue-06-extra\<slug>`，請用 slug 對照。
4. 有些資料夾裡混了衍生檔（`*.parsed.csv`、`*.flat.csv`、`*.utf8.csv`、`extracted/`、`.pgw`）。依架構，衍生檔應該放 `data/staged/`。解析程式目前不在 repo 裡。

## 組別對照

| 組 | slug |
|---|---|
| `extra/base/` | village-boundary-nlsc、village-boundary-taipei-civil、district-boundary-taipei、house-number-coordinates、elderly-living-alone-stats |
| `extra/hazard/` | liquefaction-boreholes-soil-taipei、liquefaction-geologycloud-taipei-basin、liquefaction-national-gsmma-2026、active-faults-gsmma-wms、earthquake-listed-buildings、fire-rescue-difficult-areas、fire-listed-buildings-by-floor、narrow-lanes-red-yellow、road-width-planned |
| `extra/permits/` | construction-permit-summary-115、construction-permit-summary-historical、use-permit-summary-115、use-permit-summary-historical、building-permit-footprints、demolition-permit-by-structure |
| `extra/housing-stats/` | use-permit-by-structure-57-94、use-permit-by-structure-95-plus、building-floor-area-by-structure、house-tax-housing-overview-by-tax-office、household-housing-type-by-district、real-price-registration-lvr、lvr-history |
| `extra/renewal/` | dangerous-old-building-rebuild-approved-cases、sea-sand-houses-full-list、sea-sand-houses-list、sea-sand-houses-stats、urban-renewal-bonus-stats、urban-renewal-city-land-completed、urban-renewal-city-land-progress、urban-renewal-finance-led |
| `extra/research/` | grb（政府研究資訊系統的書目與摘要）、abri（建研所研究成果清單）。這組是**研究報告書目**，不是資料集。由任務 011 的程式產生，見 `pipelines/README.md` |

建研所「研究成果」2,859 筆都有不需驗證碼的 PDF 連結【實測，debug-aa，2026-10-17】。任何研究任務要找建研所報告，直接查 `data/raw/extra/research/abri/abri_list.csv`。

## 最重要的五個發現

1. **各行政區屋齡有了。** 「臺北市房屋概況」按 12 個稅捐分處（等於 12 區）分樓層與「未滿 30 年／30 年以上」。12 區加總和官方 `building-count` 的 113、114 年逐欄相同，所以單位是棟，雖然表頭寫「戶」【實測】。
2. **2001 年（民國 90 年）以後的建物有逐棟屋齡與構造。** 建築執照套繪圖（10,052 個輪廓）可以接上建造執照（7,974 個中 7,972 個接得上），再接到使用執照（6,466 個）。接完有竣工日期、構造、層數、地址【實測】。90 年以前的逐棟執照沒有開放。
3. **實價登錄每筆交易都有建築完成年月、主要建材、完整門牌。** 臺北市一年約 1.8 萬筆建物交易【實測】。可以用來估各里的屋齡與構造分布，當作模擬資料的校準依據。
4. **全國版土壤液化圖在 115/9/24 改版**，包括臺北市。向量資料已取得【實測】。它和 soil.taipei 的城市版在空間上差很多（見「土壤液化」一節）。
5. **危老核准案件（1,059 案）與海砂屋完整列管清冊（158 案）**在建管處網站有 PDF。已轉成 CSV，筆數和文件總計一致【實測】。

## 資料清單

### base：界圖與定位

**village-boundary-nlsc：村里界圖（內政部國土測繪中心）**

- 來源：https://data.gov.tw/dataset/7438 。下載網址 `https://www.tgos.tw/tgos/VirtualDir/Product/a04697c8-64db-450a-a105-3eb471c45abd/村(里)界(TWD97經緯度).zip`
- zip 21.6 MB，內含 `VILLAGE_NLSC_1150817.shp`，UTF-8，TWD97 經緯度。另切出臺北市 `taipei-villages-nlsc-1150817.geojson`（2.1 MB）。
- 全國 7,986 里，臺北市 456 里【實測】。
- 欄位：VILLCODE（11 碼）、COUNTYNAME、TOWNNAME、VILLNAME、TOWNCODE（8 碼）。
- 接合：VILLCODE 對人口檔的 11 碼區域代碼；TOWNCODE＋里名對消防通道、狹小巷道、門牌。
- 版本 115/8/17。授權：政府資料開放授權條款第 1 版【文件】。
- 建議當作主要的里界圖層。

**village-boundary-taipei-civil：臺北市里界圖（民政局）**

- 來源：https://data.taipei/dataset/detail?id=6b17b31d-4e16-495e-95b1-9fd1f47c80d8
- zip 521 KB，`G97_A_CAVLGE_P.shp`，EPSG:3826，456 個面。
- 欄位：TNAME、VNAME、CPTVID（舊式 10 碼）、AREA。
- 注意：區碼和人口檔不同（中正區這裡是 63005，人口檔是 63000050）。要用「區名＋里名」接【實測】。

**district-boundary-taipei：臺北市區界圖（民政局）**

- 來源：https://data.taipei/dataset/detail?id=1601ef3a-c253-4988-b047-943d9e786143
- 12 個面，EPSG:3826，版本 20220915。全市面積 268.55 km²【實測】。

**house-number-coordinates：臺北市門牌位置數值資料（民政局）**

- 來源：https://data.taipei/dataset/detail?id=b7c8e724-1e98-45ee-a0bd-f3840623ed97
- CSV 125 MB，UTF-8，1,157,763 筆（各樓層各一筆），456 里都有【實測】。
- 欄位：鄉鎮市區代碼（8 碼）、村里、鄰、街路段、巷、弄、號（全形數字）、橫座標、縱座標（TWD97 TM2）。版本 20261002，每月更新。
- 用途：把只有地址的資料（消防、巷道、危老、海砂屋、使照、實價登錄）落到里。

**elderly-living-alone-stats：臺北市獨居老人（tsis）**

- 只有全市層級，27 列【實測】。

### hazard：災害與救災

**liquefaction-boreholes-soil-taipei：土壤液化分析鑽井（soil.taipei）**

- 來源：https://data.taipei/dataset/detail?id=83f22108-d69a-456b-b663-7b26833cd3de 。下載網址 https://soil.taipei/Taipei2019/Main/pages/Taipei_hole_97.GeoJSON （另一份把 97 換成 84）
- 3,979 個鑽孔。欄位：proj_name、hole_point、wt_depth（地下水位）、depth、PL（液化潛能指數）。PL 中位數 7.5，PL>15 有 1,099 孔【實測】。
- soil.taipei 10/31 關站，這份已先保存。

**liquefaction-national-gsmma-2026：全國版土壤液化潛勢 2026（經濟部地礦中心）**

- 入口：https://liquefaction.gsmma.gov.tw 。實際取資料用網站背後的 ArcGIS 服務：`https://gis.liquid.net.tw/arcgis/rest/services/P04032/Soil_cgs_2026/MapServer/0/query?...&f=geojson`
- GeoJSON 2.0 MB，EPSG:4326，與臺北相交 7 個大面。欄位 TYPE（HIGH、MED、LOW、NOT）、Yr=2026【實測】。
- 授權：網站有政府網站資料開放宣告，但這個 ArcGIS 服務本身沒有標示授權【推論】。

**liquefaction-geologycloud-taipei-basin：臺北盆地液化潛勢（舊全國版）**

- 來源：https://data.gov.tw/dataset/28691 。3 個 JSON，每級一個 MultiPolygon，EPSG:4326。版本應為 110 年【推論】。

**土壤液化三版比較（裁到臺北市界，km²）【實測】**

市界不同，面積會差 0～0.5 km²。下表的市界可能是民政局區界（268.55 km²）【推論】。用內政部里界聯集（269.85 km²）裁切時，全國版高潛勢是 23.25 km²【實測，R1】。R1 的共用表用的是內政部里界。

| 版本 | 高 | 中 | 低 | 其他 |
|---|---|---|---|---|
| soil.taipei 城市版（官方第 6 題列的那份） | 22.31 | 49.40 | 28.05 | 只涵蓋平地 |
| 全國 2026 版 | 22.72 | 42.09 | 63.57 | NOT 140.18（山區） |
| geologycloud 舊全國版 | 26.73 | 35.03 | 65.42 | — |

- 城市版 class 對應：鑽孔 PL 中位數 class 1 是 18.9、class 2 是 8.1、class 3 是 0，所以 **1＝高、2＝中、3＝低**【推論，證據強】。
- 高潛勢面積相近，位置不同。城市版 class 1 裡的鑽孔，在全國版只有 410 孔是 HIGH、467 孔是 MED。城市版 class 3（低）裡有 14 孔被全國版判成 HIGH【實測】。

**active-faults-gsmma-wms：活動斷層分布圖 2021（WMS 截圖）**

- PNG（1100×1300）＋ `.pgw` world file（EPSG:4326），QGIS 可直接疊。看得到山腳斷層【實測】。
- 地礦中心只有 WMS 圖片，WFS 沒有 feature type，沒有向量檔【實測】。山腳斷層沒有劃入「活動斷層地質敏感區」【實測】。

**earthquake-listed-buildings：921、331、403 地震列管建築物（黃單）**

- 來源：https://data.taipei/dataset/detail?id=f98010ed-281d-4334-9596-ca7d740cc06f
- 36 筆：921 有 22、403 有 8、331 有 6；北投 8 筆最多。欄位：行政區、行政區代碼、建築地點、備註【實測】。
- 「行政區代碼」的 3 碼其實是**郵遞區號**（100、103⋯），不是行政區代碼。另有 2 列把「信義路四段」寫成「信義區路四段」【實測，R1】。

**fire-rescue-difficult-areas：火災搶救困難地區場所清冊**

- 411 筆。評分等級 1 等 81、2 等 330；認定項目代碼 1～9（代碼意義 metadata 沒有說明）；8 碼區編號、地址、場所名稱【實測】。

**narrow-lanes-red-yellow：狹小巷道清冊（紅黃區）**

- Big5，附 utf8。273 筆（紅區 196、黃區 77）。欄位：行政區代碼（8 碼）、分隊、巷道名稱、寬度（公尺）【實測】。

**fire-listed-buildings-by-floor：消防列管建築物（行政區×樓層）**

- 13 列，Big5，附 utf8【實測】。

**road-width-planned：臺北市道路寬度 SHP（都發局）**

- 來源：https://data.taipei/dataset/detail?id=068be2c7-eea1-4303-91f8-fbf50c9b2aec
- 22,676 條線，EPSG:3826。欄位 road_width（8M 6,249、6M 5,096、4M 802…）、angle【實測】。
- **這些線是寬度標註線，不是道路中心線。**每條橫跨道路，線長等於路寬（相關係數 0.999999）。不能用來算路網長度【實測，R1，`stage_road_width.py`】。
- 注意：這是都市計畫路寬，未必包含既成巷道【文件】。

### permits：建照與使照

**construction-permit-summary-historical／-115：建造執照摘要**

- 歷年（90～114 年）：https://data.taipei/dataset/detail?id=e20ea68e-c79d-4882-a2f9-2f3eeb45384b 。XML 91 MB，9,043 筆，起造人已遮蔽【實測】。
- 115 年度：https://data.taipei/dataset/detail?id=d8834353-ff8e-4a6c-9730-a4d3541f2669 。XML 2.2 MB。

**use-permit-summary-historical／-115：使用執照摘要**

- 歷年（90～114 年）：https://data.taipei/dataset/detail?id=c876ff02-af2e-4eb8-bd33-d444f5052733 。XML 68 MB，攤平成 `use-permit-90-114.flat.csv`。8,762 筆，25 筆沒有地址【實測】。
- 欄位：執照號碼、發照日期、原核發執照、建造類別、構造種類、棟數、地上／地下層數、戶數、建物高度、竣工日期、地址、地段號。
- metadata 寫「114 年以前」，實際只有 90 年起【實測】。
- 115 年度：https://data.taipei/dataset/detail?id=0816f991-e6c8-4da0-a789-d022fee1462b 。184 筆，每月更新。

**building-permit-footprints：建築執照套繪圖（建管處）**

- 來源：https://data.taipei/dataset/detail?id=af067fb6-9e47-4f4c-a484-e72eba161319
- `taipei_1151005.shp`，EPSG:3826，10,052 個面。欄位 bud_floor（層數）、bud_const（構造）、budatt_no（執照號碼）。
- 只有 90 年以後的執照【實測】。

**demolition-permit-by-structure：拆除執照按構造別**

- 109～114 年，data.taipei CSV【實測】。

### housing-stats：住宅統計

**house-tax-housing-overview-by-tax-office：臺北市房屋概況（稅捐處）**

- 來源：https://data.taipei/dataset/detail?id=b2faa7a0-1f4c-4264-be61-b016252c3c6c
- 113、114、115 年度三檔，每年 12 列（12 分處＝12 區）。
- 欄位：平房～16 層以上，未滿 30 年，30 年以上。單位是棟（見「最重要的五個發現」第 1 點）。
- 例：115 年度萬華區 30 年以上 23,848 棟、未滿 30 年 826 棟。
- 114 年度檔多 13 個空欄【實測，R1】。

**household-housing-type-by-district：家庭住宅及主要設備概況（主計處）**

- 來源：https://data.taipei/dataset/detail?id=4672b96f-1212-4977-a4be-36f224188de8
- Big5，附 utf8。208 列，98～113 年各區。欄位：建築式樣比例、住宅所有權、每戶人數等。

**use-permit-by-structure-57-94／-95-plus、building-floor-area-by-structure（tsis）**

- 使照按構造別：57～94 年 39 列、95 年起 21 列。可當「某年代新建物是哪種構造」的先驗分布。
  - 57～62 年各構造的「棟數」欄都是 0，總棟數全記在「其他／棟數」。這 6 年只能用件數與面積分構造，63 年起正常【實測，R1】。
- 現有建物總面積按構造：65～114 年，51 列。

**real-price-registration-lvr：不動產實價登錄（內政部地政司）**

- 來源：https://data.gov.tw/dataset/18703 。季檔網址 `https://plvr.land.moi.gov.tw//DownloadSeason?season=115S3&type=zip&fileName=lvr_landcsv.zip`（季別可換）。不需要登入。
- 4 季（114S4～115S3）全國 zip，臺北市檔已解到 `taipei-<季別>/`。
- 臺北市有建物的買賣 18,235 筆，其中 17,800 筆有「建築完成年月」【實測】。其中 11 筆無法解析成日期（2 筆位數不對、9 筆日期不存在），可用 17,789 筆【實測，R1】。
- **28.9% 是 2024 年後建成的新成屋。**推估屋齡前要排除，否則屋齡會被低估【實測，R1】。
- 主要建材：鋼筋混凝土造 14,804、鋼骨造 1,095、加強磚造 793、磚造 79。
- 建成年代：民國 50 年代 558、60 年代 3,384、70 年代 3,422、80 年代 1,707、90 年代 1,968、100 年以後 6,736。
- 限制：只有交易過的建物，偏向住宅，有樣本偏誤【推論】。但這是唯一含 2001 年以前屋齡與建材的逐址開放資料。

**lvr-history：不動產實價登錄歷史季檔（c8 補抓，2026-10-18）**

- 位置：`data/raw/extra/housing-stats/lvr-history/`，每季一個資料夾（101S4～114S3，共 52 季），合計 404 MB。
- 抓取程式：`pipelines/fetch/fetch_lvr_history.py`。來源與 `real-price-registration-lvr` 相同（內政部地政司季檔，不需登入），低頻抓取。
- 用途：讓更多建物有逐棟的推估屋齡。結果在 `data/marts/building_points.*`，每棟標 `status`（`confirmed`／`estimated`／`undetermined`）。
- 使用者 2026-10-18 同意補抓，協調者任務板編號 R1c。

### land：土地與限制（2026-10-18 新增）

協調者裁決抓取（BD15）。用途：法規限制參數（N1）、危老地號落位（S3）、基地面積（G3）、場勘前預檢、重建可行性的硬限制。**已登記在 `data/catalog.json`**（`official: false`），可以用 `pipelines.fetch.fetch_raw` 重抓。全部是政府資料開放授權條款第 1 版。實測都在 2026-10-18 由整合者用 geopandas 讀檔【實測】。

| slug | 內容 | 筆數 | 要注意 |
|---|---|---|---|
| `zoning-taipei` | 都市計畫使用分區，主計與細計各一個 zip（data.gov.tw 156197） | 主計 3,840 面；細計 15,518 面 | **屬性是 Big5 編碼**，讀檔要指定 `encoding='big5'`。**沒有 .prj 座標系檔**；座標範圍 X 29.5～32.0 萬、Y 275.9～279.1 萬，符合 TWD97 TM2（EPSG:3826）【推論，依座標範圍】。分區前幾名：住3、商三特、公、住2 |
| `cadastral-sections-taipei` | 數值地籍地段圖（data.gov.tw 157685） | 589 個小段 | **只有小段的邊界，沒有每一筆地號的邊界。**欄位：段代碼、地段名、行政區。EPSG:3826。危老案的地號可以落到小段（比現在的「路段」細），但仍不是逐筆 |
| `cultural-heritage-taipei` | 文化資產，含市定與國定古蹟（data.gov.tw 121275） | 581 筆 | **沒有座標，也沒有地址**，只有名稱、類別、所在行政區。**要位置請改用 `cultural-heritage-boch`** |
| `cultural-heritage-boch` | 文化部文化資產局開放資料 v2：古蹟、歷史建築、紀念建築、聚落（data.gov.tw 6246、6965） | 全國：古蹟 1,065、歷史建築 1,789、紀念建築 25、聚落 21；臺北 566 處 | **有經緯度。**由 c8 的 `pipelines/fetch/fetch_heritage_boch.py` 抓（catalog 的抓取方式是 `script`，`fetch_raw` 會跳過）。清洗後在 `data/staged/land/cultural-heritage.geojson`。**文化景觀（臺北 10 處）不在這 4 類，仍然沒有位置**【c8 實測，2026-10-18】 |
| `protected-trees-taipei` | 受保護樹木（data.gov.tw 121274） | 3,873 棵 | 有經緯度與地址，可以直接用 |

### renewal：危老、海砂屋、都更

**dangerous-old-building-rebuild-approved-cases：危老重建核准案件（建管處 PDF）**

- 來源頁：建管處「危老重建計畫審查」 https://cmo.gov.taipei/cp.aspx?n=BD86021F233DC407 ，頁面上的「核准案件一覽表」。檔案會隨時間更新，網址也會換。
- **版本**（兩版都保留在同一個資料夾）：

  | 檔名 | 案數 | 統計截止 | 取得 | 原始網址 |
  |---|---|---|---|---|
  | `approved-cases-1150210.pdf` | 1,059 | 115-02-28 | 2026-10-17 | https://www-ws.gov.taipei/001/Upload/845/relfile/-1/845/c091f79b-e452-4147-a571-72bb161d5a3b.pdf |
  | `approved-cases-1151002.pdf` | 1,088 | 115-09-30（頁面標示資料更新 115-10-02） | 2026-10-18 | https://www-ws.gov.taipei/001/Upload/845/relfile/-1/845/965b9875-f798-4738-be6f-8a997ec4225f.pdf |

  兩版的案數與截止日都是從 PDF 第一頁標題讀出【實測，2026-10-18，整合者】。新版是 debug-aa 發現的。
- 解析程式：`pipelines/stage/stage_dangerous_old_building_cases.py` 直接讀兩版 PDF，輸出加 `list_version` 欄【c8，2026-10-18，commit 613dbe5】。
- 兩版的失效案數：1150210 版 1,059 案中 177 案失效；1151002 版 1,088 案中 189 案失效【實測，c8】。
- **哪裡用哪一版**：
  - 共用表 `data/marts/village_indicators` 用新版 1151002。
  - R1 報告與它的 h4、h7 分析固定用舊版 1150210，報告裡的數字不變。
  - 引用數字時一律寫明版本。
- 失效原因：危老施行細則第 7 條規定，核准後 180 日內要申請建照，否則失效。清冊裡「失其效力」的案件可能是這個原因【推論，debug-aa，出處 `research/issue-06/city-workflow/2026-10-18-tw-rules-and-workflow.md`】。
- 107/7/6～115/2/10，76 頁，解析成 1,059 列，序號沒有缺號【實測】。
- 欄位：序號、基地面積、行政區、地號、位置（多半只有路段）、核准日期、總獎勵額度。
- 各區：中山 149、大安 125、士林 123……南港 15。這些數字**含失效案**。
- **177 案在位置欄標「失其效力」，有效 882 案**【實測，R1，`stage_dangerous_old_building_cases.py`】。
- 位置 96% 只寫到路段，無法落到里。要落到里得用地號對地籍圖。
- 授權：網站公開文件，沒有另外標示開放授權【推論】。

**sea-sand-houses-full-list：海砂屋完整列管清冊（建管處 PDF，115.3.25 版）**

- 下載網址：https://www-ws.gov.taipei/001/Upload/845/relfile/-1/845/7e3d3798-d6ab-4f35-b720-44854dec092c.pdf
- 158 列。欄位：序號、行政區、地點（完整門牌）、使照號碼（前三碼是民國年）、列管戶數、列管分類。
- 須拆除重建 151 案、可加勁補強 7 案、7,424 戶，和清冊總計一致【實測】。使照年份集中在 64～78 年。
- 轉檔問題：parsed CSV 至少 3 列把「一」轉成筆畫字元「㇐」（U+31D0）。地址比對前要替換【實測，R1】。

**sea-sand-houses-list：海砂屋列管清冊（市有建物，data.taipei）**

- 來源：https://data.taipei/dataset/detail?id=c6f1a88f-5d99-4fc2-8271-f3adb59f87c2 。只有 5 筆【實測】。

**sea-sand-houses-stats：海砂屋列管案件統計（tsis）**

- 106～114 年，每年件數與戶數【實測】。

**urban-renewal-*：都市更新四份（財政局、更新處）**

- `urban-renewal-finance-led`：財政局主導的都更案，11 案。最接近「公辦都更」名單的開放資料【實測】。
- `urban-renewal-city-land-progress`：市有土地參與都更進度，271 案，115/3/31 版。
- `urban-renewal-city-land-completed`：已完工或結案，168 案。
- `urban-renewal-bonus-stats`：都更容積獎勵統計，2002～2025，全市，24 列。

## 找到但沒下載的資料

1. **內政部不動產資訊平台「房屋稅籍住宅類平均屋齡」「房屋稅籍住宅類數量」**
   - 位置：https://pip.moi.gov.tw/Publicize/Info/E3030 →「供給」→「房屋稅籍住宅類數量」→ CSV。
   - 原因：下載要靠 JS 送出含驗證 token 的表單，程式模擬兩次都只拿到 HTML【實測】。
   - 人工步驟：用瀏覽器開，按兩個 CSV 下載，放到 `data/raw/extra/housing-stats/housing-stock-avg-age-pip/`。
2. **國土測繪中心三維建物與建物輪廓向量**：要申購，有使用限制【文件】。黑客松時程內不建議。
3. **使照、建照影像存根** https://img2.gov.taipei/ ：只能逐筆查【文件】。
4. **臺北市山崩與地滑地質敏感區 SHP**：https://www.gsmma.gov.tw/uploads/1695430371158mPuItawW.rar 。不在題目因子內，沒下載。
5. **臺北市土地使用分區**（https://data.taipei/dataset/detail?id=a132a433-db7c-4387-8085-83e6a093b17f ）與**數值地籍地段圖**：要把地號落到地圖時才需要。

6. **GEM 全球曝險模型 v2026.0.0 臺灣版**（R2 提供，2026-10-17）
   - 位置：https://github.com/gem/global_exposure_model/tree/main/East_Asia/Taiwan
   - 公開的只有摘要：`summaries/Exposure_Summary_Adm1.csv`（縣市層級）、`Exposure_Summary_Taxonomy.csv`。**臺北市只有一個總數**：住宅 242,883 棟、2,516,722 人【實測，R2】。
   - 模型把住宅分成 4 個耐震設計等級（無、低、中、高），是用建造期間與構造套對照表推估的，不是調查【文件】。全臺住宅 48.6% 被歸為「無耐震設計」，可能偏高【推論，R2】。
   - 更細的空間版本要向 GEM 申請。
   - **授權 CC BY-NC-SA 4.0：不能商用，衍生成果必須用同樣授權。**和活動建議的 MIT、CC BY 4.0 衝突。要用的話，只能當對照數字引用，不要把它的資料併進我們開源的資料集【推論】。
   - 它的住宅資料來源是主計總處 2020 年人口及住宅普查，見 backlog 任務 012。

## 找過但判斷沒有開放的資料

- 90 年以前的逐筆使照、建照摘要【實測】。
- 臺北市逐棟房屋稅籍（新北市有，臺北市沒有）【實測】。
- 老屋健檢、耐震初評、耐震補強的補助名單：data.taipei 沒有任何含「耐震」的資料集【實測】。可能因為涉及個資【推論】。
- 403 地震 2,140 件安全疑慮建物清單：只有文件提到數字【文件】，開放的只有 36 筆黃單。
- 公辦都更推動地區或基地的完整清單：只有簡報與計畫書 PDF【實測】。
- 全國危老核准案件開放資料集：沒有【實測】。
- 山腳斷層向量檔：只有 WMS 圖片【實測】。
