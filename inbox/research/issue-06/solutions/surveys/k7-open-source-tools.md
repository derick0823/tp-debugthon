# K7：24 小時內做得出來的開源工具盤點

- 日期：2026-10-18
- 作者：debug-40 子 agent
- 問題：S1 里層級可解釋風險儀表板、S2 地址查詢「我家危險嗎」、S3 市場缺口地圖、S5 救災可及性清單，四個候選產品在 24 小時黑客松內，用哪些開源工具最保險。資料是靜態的 456 個里加約 21 萬棟門牌點。部署到內網 Linux VM `10.30.1.10`，前端最好是靜態檔。
- 結論三句：
  1. 456 個里的 GeoJSON 只有 1.3 MB，不需要圖磚，Leaflet 或 MapLibre 直接讀 GeoJSON 就夠，權重滑桿在瀏覽器裡用 JavaScript 重算加權和即可。
  2. 21 萬棟門牌點是唯一需要「靜態資料工程」的地方。純靜態走法是把門牌表切成「區＋路」分片 JSON 給 S2 查、再用 tippecanoe 切成 PMTiles 畫點。有後端走法是用 FastAPI 包 repo 現有的 `pipelines/address.py`，不要碰 TGOS。
  3. GitHub 上查到的 6 個風險儀表板專案沒有一個能直接改皮上線。可借的是 Portland 權重滑桿的互動模式與 FEMA NRI 的分級方法，畫面自己寫比改別人的快。

## 0. 前提：資料規模與限制

| 項目 | 數字 | 證據 |
|---|---|---|
| 里層級 mart | `village_indicators.geojson` 1.3 MB、`village_rankings.geojson` 1.0 MB、CSV 148 KB | 【實測】2026-10-18 `du -sh data/marts/*` |
| 門牌表 | `house-number-coordinates.parquet` 13 MB，1,157,763 筆（每層一筆），13 欄 | 【實測】2026-10-18 `pyarrow.parquet.read_metadata` |
| 門牌「棟」數 | 以 town_code＋road＋lane＋alley＋no 去重得 210,377 棟 | 【實測】2026-10-18 pyarrow group_by |
| 已有地址比對器 | `pipelines/address.py` 的 `Geocoder` 與 `parse_address`，不連網，四級比對 | 【文件】repo 檔案 docstring |
| 部署目標 | `10.30.1.10`，細節由 K8 盤點 | 【文件】`solutions/BOARD.md` K8 列 |
| 瀏覽器能不能連外網載 CDN | 不知道 | 【待確認】等 K8。保險做法是把所有 JS 與 CSS 下載進 repo 一起部署，不依賴 CDN |

結論：里層級不需要任何圖磚或資料庫。只有 21 萬棟門牌點需要想辦法，下面各節都圍著這件事。

## 1. 地圖前端

| 工具 | 授權 | 版本與狀態 | 給我們什麼 | 24 小時上手 | 風險 | 網址 |
|---|---|---|---|---|---|---|
| MapLibre GL JS | BSD-3-Clause【文件】 | v6.6.0（2026-08）。v6 於 2026-07-22 發布，只出 ESM、強制 WebGL2。v5 最後版本 5.24.0（2026-04）【文件】 | 向量圖磚、PMTiles 原生協定、21 萬點流暢、deck.gl 可疊 | 中。要用 `<script type="module">`，舊範例多半是 v5 的 UMD 寫法 | 內網舊電腦沒 WebGL2 就白屏。保險是釘 v5.24.0 的 UMD 版 | https://maplibre.org/news/2026-08-02-maplibre-newsletter-jul-2026/ 、https://github.com/maplibre/maplibre-gl-js |
| Leaflet | BSD-2-Clause【文件】 | 穩定版仍是 1.9.4。2.0 只有 alpha（2025-05、2025-08），GitHub releases 無穩定 2.0【文件】 | 456 個里的 choropleth 一小時內做完。範例最多。NCREE「臺灣地震動分布評估系統」就是 Leaflet 加 TGOS 定位【文件】 | 低 | 21 萬點用 SVG 或 Canvas 畫會卡。點資料得用 Leaflet.VectorGrid 或 protomaps-leaflet 讀 PMTiles | https://github.com/Leaflet/Leaflet/releases 、https://seaport.ncree.org/smap |
| deck.gl | MIT【文件】 | v9.4.0（2026-09-05）。官方 `@deck.gl/maplibre` 支援 MapLibre v4.5.1、v5、v6 的 interleaved 模式【文件】 | ScatterplotLayer 畫 21 萬點不費力、GeoJsonLayer 做 choropleth | 中偏高。API 多，與 MapLibre 版本要對 | 兩套渲染器疊起來除錯成本高。只在 S2 要同時畫 21 萬點與里界時才值得 | https://github.com/visgl/deck.gl/releases 、https://deck.gl/docs/api-reference/maplibre/overview |
| Kepler.gl | MIT【文件】 | 3.1.x（2025-01），2026 年無新版。Open Hub 顯示近 12 個月 commit 數下降 49%【文件】 | 拖一個 CSV 進 demo app 就能看 21 萬點與 456 里，適合「今晚先看一眼」的探索 | 低（用 demo app）、高（嵌進自己的頁面） | 做不出因子分開與權重滑桿。狀態是 Redux 大物件。只當探索工具，不當產品 | https://github.com/keplergl/kepler.gl 、https://docs.kepler.gl/changelog |
| Felt（商業，只記） | 商業 SaaS | 2026-10-13 新定價：Team 方案 199 美元／月（年繳）、免費 Personal 不能上傳自己的資料檔。自架只有 Enterprise 的 VPC 選項【文件】 | 快速做好看的分享地圖 | 低 | 雲端服務，放不進內網 VM。免費版不能上傳資料。不符部署目標 | https://felt.com/pricing 、https://felt.com/blog/felts-new-pricing |

建議：S1、S3、S5 用 Leaflet 1.9.4 或 MapLibre v5 UMD，兩者都 10 分鐘可跑。S2 若要畫全部 21 萬棟，用 MapLibre 讀 PMTiles。不要同時引入 deck.gl 與 Kepler.gl。

## 2. 向量圖磚與靜態資料

| 工具 | 授權 | 給我們什麼 | 24 小時上手 | 風險 | 網址 |
|---|---|---|---|---|---|
| PMTiles | 參考實作 BSD-3-Clause，規格 CC0【文件】 | 單一檔案裝整組圖磚，靜態伺服器用 HTTP Range 讀。MapLibre 加 `pmtiles` 套件兩行註冊 `pmtiles://` 協定【文件】 | 低 | 伺服器必須支援 Range 與 CORS。Python `http.server` 不支援 Range（見第 6 節） | https://github.com/protomaps/PMTiles 、https://docs.protomaps.com/pmtiles/maplibre |
| tippecanoe（felt fork） | BSD-2-Clause【文件】 | 把 GeoJSON、FlatGeobuf、CSV 切成 MBTiles 或直接輸出 `.pmtiles`。2.0.0 等同 Mapbox 原版 1.36.0【文件】 | 中。Windows 沒有原生 build，要在 VM、WSL 或 podman 容器裡跑 | 21 萬點切磚參數（`-zg --drop-densest-as-needed`）要試幾次。GeoParquet 不能直接讀，先用 GeoPandas 轉 `.fgb` | https://github.com/felt/tippecanoe |
| GeoParquet | 規格開放，Apache 專案【文件】 | 規格目前 v2.0.0-rc.1，GeoPandas 與 DuckDB spatial 可讀寫【文件】。repo 已用 GeoPandas，`to_parquet` 直接出 | 低 | 瀏覽器端沒有原生讀法，要配 DuckDB-WASM 或 loaders.gl。只當資料交換格式 | https://geoparquet.org/ |
| DuckDB-WASM | MIT【文件】 | 瀏覽器內跑 SQL，基於 DuckDB v1.5.6，spatial 延伸用 `INSTALL spatial; LOAD spatial;` 在瀏覽器裡載【文件】。可用 Range 讀遠端 Parquet 的一小段 | 中 | 首次載入約 3.2 MB wasm，spatial 延伸再多幾 MB，從 extensions.duckdb.org 抓。內網不能連外就要自架延伸檔。GeoArrow 幾何在 WASM 尚未支援，2025-10 的實作用 WKB 繞過【文件】 | https://github.com/duckdb/duckdb-wasm 、https://developmentseed.org/blog/2025-10-08-spatial-access-lab |
| FlatGeobuf | BSD-2-Clause【文件】 | 內建 Hilbert R-tree 索引，瀏覽器用 Range 只抓視窗內的要素。JS 參考實作直接餵 Leaflet 或 MapLibre | 低 | Range 觸發 CORS preflight。21 萬點整檔約數十 MB，拉全部不划算，只適合「畫目前視窗」 | https://github.com/flatgeobuf/flatgeobuf 、https://unpkg.com/flatgeobuf@4.4.0/README.md |

### 21 萬棟門牌點的三條路

| 路線 | 做法 | 工時 | 適合 |
|---|---|---|---|
| A 分片 JSON | 用 pandas 把門牌表依 `town_code＋road` 分成約數百個 JSON，每個只有該路的巷弄號、里代碼與座標。S2 輸入地址後只載一個分片 | 2～3 小時 | 純靜態 S2 查詢。不畫全部點 |
| B PMTiles | GeoPandas 出 `.fgb`，tippecanoe 切 `.pmtiles`，MapLibre 顯示。屋齡與狀態欄位進圖磚屬性 | 3～4 小時（含裝 tippecanoe） | S2 要畫「附近海砂屋與危老案」與整區點雲 |
| C DuckDB-WASM 讀 Parquet | 13 MB parquet 直接放靜態目錄，瀏覽器 SQL 查地址 | 2 小時寫，但首載慢 | 展示「無後端也能 SQL」。不建議當主線 |

A 與 B 可以同時做，互不依賴。C 當備案。

## 3. 儀表板框架

| 工具 | 授權 | 版本 | 給我們什麼 | 需不需要伺服器 | 24 小時上手 | 風險 | 網址 |
|---|---|---|---|---|---|---|---|
| 純 HTML＋ECharts | Apache-2.0【文件】 | 6.1.0（2026-05-19）【文件】 | 長條、排名、散佈圖。中文字型與繁中文件齊全 | 不用 | 低 | 地圖部分用 Leaflet 另做，不要用 ECharts 的 geo 元件畫里界 | https://github.com/apache/echarts/releases |
| 純 HTML＋Plotly.js | MIT【文件】 | 4.1.2（2026-10-05）【文件】 | 同上，另有 choroplethmapbox 可直接用 MapLibre 畫面 | 不用 | 低 | bundle 約 3 MB。版本 4 剛出，範例多為 2.x | https://github.com/plotly/plotly.js/releases |
| Observable Framework | ISC【文件】 | 1.13.4（2026-03-02）【文件】 | 靜態站產生器。data loader 可以是 Python，build 時跑一次把 mart 算成 JSON，頁面用 Markdown 加 JS 寫 | 不用（build 後是靜態檔） | 中 | 要裝 Node。Markdown 內嵌 JS 的 reactive 寫法要半天熟。權重滑桿用 `Inputs.range` 內建 | https://github.com/observablehq/framework/releases |
| Evidence | MIT【文件】 | GitHub 10,051 commits，未見停維護公告【文件】 | SQL 寫報表，build 成靜態站，瀏覽器內用 DuckDB-WASM 再查 | 不用 | 中 | 地圖元件弱，自訂 Leaflet 要繞。CLI 有 opt-in telemetry | https://github.com/evidence-dev/evidence |
| Streamlit | Apache-2.0【文件】 | Snowflake 維護 | 滑桿、下拉、表格 30 分鐘做完。folium 已在 repo 依賴裡，直接嵌地圖 | 要（`streamlit run` 常駐 Python） | 低 | 每次滑桿動都回伺服器重算，多人同時用會卡。不是靜態檔 | https://github.com/streamlit/streamlit |
| Panel（HoloViz） | BSD-3-Clause【文件】 | `panel convert app.py` 可轉成 Pyodide 靜態頁【文件】 | 同 Streamlit，且有靜態選項 | 不用（convert 後） | 中偏高 | Pyodide 首載要抓整個 Python runtime，內網不能連外就要自架。相容性限制多 | https://github.com/holoviz/panel |

建議：S1 的因子分開、權重滑桿、排名區間，三者都只是「對 456 列做加權和再排序」。純 HTML 加 ECharts 加 Leaflet，一個檔案就能做完。Observable Framework 是第二選擇，適合要寫很多說明文字的方案頁。Streamlit 只在「有後端」組合裡用。

## 4. 複合指標與權重敏感度

先說分工：BOARD 的 R1b（c8）已包含「權重蒙地卡羅排名區間」【文件】`solutions/BOARD.md` R1b 列。本節只評估工具，不重做。

| 工具 | 授權 | 給我們什麼 | 24 小時上手 | 風險 | 網址 |
|---|---|---|---|---|---|
| COINr（R） | MIT【文件】 | 複合指標全流程：正規化、加權、彙總、global sensitivity analysis，有專門的 Sensitivity vignette。CRAN 1.1.14（2024-05-21）【文件】 | 高。專案環境是 Python（uv），沒有 R | 多一套語言。只值得當方法參考 | https://cran.r-project.org/web/packages/COINr/index.html |
| SALib（Python） | MIT【文件】 | Sobol、Morris、FAST 等敏感度分析。1.5.2（2025-10-12），GitHub 2026-03 仍有 push【文件】 | 低。`uv add SALib` | 它算的是「哪個權重最影響分數」，不是「排名會跑到哪」。排名區間要自己寫 | https://github.com/SALib/SALib |
| 專門的 rank stability 套件 | 查不到 | 搜到的都是 R 套件（giniCI、compindexR）與論文，Python 沒有現成的「加權和排名穩定度」套件【文件】 | 自己寫 30 行 numpy：Dirichlet 抽 1 萬組權重、算排名、取 5% 與 95% 分位 | 無 | https://rdrr.io/cran/compindexR 、https://link.springer.com/article/10.1007/s00355-018-1132-6 |
| FEMA National Risk Index 方法文件 | 公部門文件 | Risk ＝ EAL（期望年損失）× 社會脆弱度（放大因子）× 社區韌性（縮小因子）。所有分數用 min-max 壓到 0～100，EAL 先開立方根去偏斜。等級「Very Low」到「Very High」是相對的，用 k-means 或 natural breaks 分，沒有固定門檻【實測】2026-10-18 用 pdfplumber 讀 Primer 第 5～9 頁 | 低（只讀方法） | 它是乘法式，不是加權和。借它的「分級相對化」與「每個分量分開呈現」就好。NRI 網頁應用已下線【文件】 | https://www.fema.gov/sites/default/files/documents/fema_national-risk-index_primer.pdf 、https://www.fema.gov/sites/default/files/documents/fema_national-risk-index_technical-documentation.pdf |
| OpenQuake engine（只記） | AGPL-3.0【文件】 | 完整地震危害與風險計算 | 高 | 要 exposure model（NRML）、fragility 或 vulnerability 曲線、hazard 輸入三樣都備齊才能跑【文件】。24 小時內做不到。AGPL 對自架沒問題，但沒有理由用 | https://docs.openquake.org/oq-engine/LTS/manual/user-guide/configuration-file/risk-common-config.html |

對 S1 的具體建議：

1. 離線（Python）：c8 的 R1b 算出每個里的 `rank_p05`、`rank_p50`、`rank_p95`，寫進 mart。
2. 線上（JS）：滑桿改權重時，瀏覽器只重算加權和與排名，不重算蒙地卡羅。區間用離線的值顯示，並標「區間是在預設權重附近抽樣算的」。
3. 分級用相對法（五等分或 natural breaks），畫面上寫明「相對於臺北市其他里」。這是 FEMA 的做法，也避免被問「幾分算危險」。

## 5. 臺灣地址比對

| 工具 | 授權或條件 | 給我們什麼 | 24 小時上手 | 風險 | 網址 |
|---|---|---|---|---|---|
| TGOS 全國門牌地址定位服務（單筆 API） | 要 TGOS 會員、申請後取 API Key，以 Domain 或 IP 驗證。個人只能用一般圖資【文件】 | 單筆地址轉座標 | 中。申請與審核時間不在我們手上 | 內網 VM 的 IP 要登記。活動當天才申請來不及。前端直接呼叫會把 key 曝露 | https://api.tgos.tw/TGOS_MAP_API/docs/site/web/Application 、https://api.tgos.tw/TGOS_MAP_API/docs/site/web/Intro |
| TGOS 批次地址比對 | 會員申請、審核通過取 key，每日 1 萬筆【文件】 | 離線批次 | 中 | 21 萬棟要 21 天。不適用 | https://www.gov.tw/News_Content_2_371654 |
| 內政部與民政局門牌座標開放資料 | 開放資料 | repo 已下載 `house-number-coordinates`（125 MB CSV，1,157,763 筆，每月更新），已 stage 成 parquet，`pipelines/address.py` 已有四級比對【文件】`docs/extra-data.md` | 已完成，不重做 | 比對率見 R1 報告 H7 節。S2 的「未判定」就是 `geo_level` 0 與 4 | https://data.taipei/dataset/detail?id=b7c8e724-1e98-45ee-a0bd-f3840623ed97 |
| taiwan-address-normalizer | MIT【文件】 | 台／臺、全半形、舊縣市名、郵遞區號、樓層正規化。明說「不是地理編碼服務」 | 低 | 0 星、3 個 commit、尚未上 PyPI【文件】。只能借它的正規化規則，不要把它當依賴 | https://github.com/ted622622/taiwan-address-normalizer |
| zipcodetw | MIT | 地址找郵遞區號，不拆門牌 | 低 | 對本題沒用 | https://pypi.org/project/zipcodetw |
| OpenCC | Apache-2.0 | 繁簡與地區用詞轉換 | 低 | 本題輸入都是繁中，不需要 | https://github.com/BYVoid/OpenCC |

結論：S2 不要碰 TGOS。地址正規化沿用 `address.py` 的 `parse_address`（已處理中文數字、全形）。若要前端純靜態查詢，把 `parse_address` 的規則用 JavaScript 重寫一次（路、段、巷、弄、號、之），約 80 行。

## 6. 內網靜態部署

| 方式 | 授權 | 支援 Range | 24 小時上手 | 風險 | 網址 |
|---|---|---|---|---|---|
| nginx 容器（podman） | BSD-2-Clause | 預設開，`max_ranges` 不限【文件】 | 低。`podman run -d -p 8080:80 -v ./dist:/usr/share/nginx/html:ro,Z docker.io/library/nginx:alpine` | 要加 CORS 標頭才能跨域讀 PMTiles。`.pmtiles` 與 `.parquet` 的 MIME 要補 | https://nginx.org/en/docs/http/ngx_http_core_module.html#max_ranges |
| caddy 容器（podman） | Apache-2.0【文件】 | `file_server` 回 206，支援 `precompressed`（gzip、zstd、br）與 `browse`【文件】 | 低。Caddyfile 三行 | 內網沒有網域就要關自動 HTTPS（`:80` 開頭即可） | https://github.com/caddyserver/caddy 、https://caddyserver.com/docs/caddyfile/directives/file_server |
| Python `http.server` | PSF | 不支援。不送 `Accept-Ranges`，CPython issue #86809 未修【文件】 | 最低 | PMTiles、FlatGeobuf、DuckDB-WASM 遠端 Parquet 全部失效。只能用來冒煙測試純 GeoJSON 版 | https://packages.guix.gnu.org/packages/python-rangehttpserver |
| GitHub Pages（備援） | 服務條款 | 【待確認】官方限制頁沒寫 Range | 低 | 站台上限 1 GB、每月 100 GB 流量軟限制、單檔超過 100 MiB 被擋【文件】。遠端 repo 尚未建立（BOARD 009 列） | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits 、https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github |

VM 本身的 podman 版本、開放的 port、是否能連外，交給 K8。本節只確認「選 nginx 或 caddy 都行，不要用 http.server 當正式服務」。

## 7. GitHub 上現成的風險儀表板專案

| 專案 | 授權 | 最後更新 | 技術 | 可借什麼 | 不能直接改皮的原因 | 網址 |
|---|---|---|---|---|---|---|
| BPSTechServices/pdx_vulnerability_map_app（Portland 市府） | MIT【文件】 | 頁面未顯示日期，15 commits、12 星【文件】 | R Shiny、tidycensus | 「使用者調整每個指標權重、地圖立即變色」就是 S1 要的互動。看它的 UI 配置 | R 語言、資料來自美國普查 API | https://github.com/BPSTechServices/pdx_vulnerability_map_app |
| usds/justice40-tool（美國 CEJST） | CC0-1.0【文件】 | 2025-03-27 封存，145 星【文件】 | 前端在 `client/`，框架頁面未標 | 多因子、每個因子分開標「是否超過門檻」的呈現方式。資料字典與方法文件寫法 | 已封存、原站 2025-01 下線。程式量大 | https://github.com/usds/justice40-tool |
| WFP-VAM/prism-app（世界糧食計畫署） | MIT【文件】 | 1,049 commits、75 星【文件】 | React、TypeScript、Redux、MapLibre、deck.gl、Python API | 「災害圖層疊社經脆弱度」的架構，與 MapLibre 加 deck.gl 的整合寫法 | 要跑 Python API 與 WFP 登入。設定檔驅動，改成臺北資料要半天以上 | https://github.com/WFP-VAM/prism-app |
| henok256/resiliencemap | MIT【文件】 | 80 commits、11 星【文件】 | FastAPI、PostGIS、Leaflet、Docker Compose | 「FastAPI 加 Leaflet 加固定權重複合分數」正是「有後端」組合的骨架。權重寫在 `docs/methodology.md`（洪水 30%、地震 20%、風暴 20%、野火 20%、社會脆弱 10%） | 權重固定，資料來源全是美國機關 API | https://github.com/henok256/resiliencemap |
| GFDRR/thinkhazard（世界銀行） | GPL-3.0【文件】 | 1,878 commits，未封存【文件】 | Pyramid、PostGIS、Celery、Redis | 「每個災害一個等級、附建議」的頁面結構 | 元件太多，GPL 對自架沒問題但沒必要 | https://github.com/GFDRR/thinkhazard |
| azh2/Social-Vulnerability-R | 【待確認】 | 2022-05【文件】 | R、Leaflet | 社會脆弱度指數的指標組合 | 老、R 語言 | https://github.com/topics/social-vulnerability |

臺灣先例（非開源，只記）：NCREE「臺灣地震動分布評估系統」用 Leaflet 畫圖、TGOS 做地址定位【文件】https://seaport.ncree.org/smap 。這證明「Leaflet 加地址查詢」在臺灣的政府單位已被接受。

結論：沒有一個能直接改皮。原因有三：語言（R）、資料來源綁美國 API、需要後端。建議自己寫，借 Portland 的滑桿互動與 FEMA 的相對分級。

## 8. 建議的技術組合

### 組合甲：最保險（純靜態）

| 層 | 選擇 | 理由 |
|---|---|---|
| 資料 | `data/marts/*.geojson`、`*.csv` 直接用。門牌表切「區＋路」分片 JSON（路線 A）。可選 PMTiles（路線 B） | 已有 mart 契約（CONVENTIONS 4a）。分片 JSON 不需要 Range |
| 地圖 | Leaflet 1.9.4（S1、S3、S5）。S2 若畫全市點改 MapLibre v5.24 UMD 加 pmtiles | 範例最多、最不會踩版本坑 |
| 圖表 | ECharts 6.1 | 繁中文件、Apache-2.0 |
| 互動 | 原生 `<input type="range">` 加 60 行 JS 算加權和與排名 | 不需要框架 |
| 部署 | nginx 或 caddy 容器，podman | 支援 Range、一行指令 |
| JS 與 CSS | 全部下載進 `app/vendor/`，不用 CDN | 內網連外狀況不明 |

工時估計（兩人並行，含除錯）：

| 工作 | 時數 |
|---|---|
| 匯出腳本：mart 轉前端用 JSON、門牌分片、PMTiles | 3 |
| S1 頁：里界 choropleth、因子開關、權重滑桿、排名區間長條 | 5 |
| S2 頁：地址輸入、JS 正規化、查分片、顯示液化兩版、屋齡、窄巷、附近海砂屋與危老、已確認／推估／未判定三色 | 6 |
| S3 與 S5 頁：清單加地圖，重用 S1 元件 | 3 |
| 部署、CORS、MIME、冒煙測試 | 2 |
| 緩衝 | 3 |
| 合計 | 22 |

風險：

1. 內網瀏覽器沒 WebGL2 時 MapLibre v6 白屏。對策是用 v5 UMD 或只用 Leaflet。
2. 門牌分片 JSON 總量（210,377 棟）約 10 到 20 MB，單一分片通常小於 100 KB【推論】，使用者一次只載一片。
3. 排名區間是離線算的，滑桿改權重後區間不會跟著動。畫面要寫清楚。

### 組合乙：較強（有後端）

| 層 | 選擇 | 理由 |
|---|---|---|
| 後端 | FastAPI 包 `pipelines/address.py` 的 `Geocoder`，加 DuckDB 查 parquet | 比對邏輯已存在、不用重寫 JS 正規化。可即時算蒙地卡羅排名區間 |
| 前端 | 同組合甲的靜態頁，S2 改呼叫 `/api/locate?addr=` | 畫面不重做 |
| 部署 | podman 兩個容器（nginx 靜態、uvicorn API），nginx 反向代理 `/api/` | 同源，不碰 CORS |
| 替代 | 時間不夠就用 Streamlit 一支 app 全包 | 30 分鐘有滑桿與表格 |

工時估計：

| 工作 | 時數 |
|---|---|
| FastAPI：`/locate`、`/village/{code}`、`/rank?weights=` 三個端點，含 Dockerfile | 4 |
| 前端同組合甲，S2 改接 API | 12 |
| podman compose、反向代理、健康檢查 | 3 |
| 緩衝 | 3 |
| 合計 | 22 |

風險：

1. 多一個常駐 Python 程序。VM 重開要自動起（K8 確認有沒有 systemd 權限）。
2. Geocoder 載 13 MB parquet 進記憶體，首次啟動約數秒【推論】。
3. 展示時若 API 掛了，S2 整頁沒輸出。對策是前端同時保留路線 A 的分片 JSON 當 fallback。

### 選哪個

- 10/23 提案前只需要畫面能動：組合甲。
- 10/24 交件要「地址查詢準確率與 repo 一致」：組合乙，但前端仍要先能靜態跑。
- 兩套前端相同，先做甲，乙是加一層 API，不是重做。

## 9. 查了但沒找到

| 項目 | 結果 |
|---|---|
| Python 的「加權和排名穩定度」現成套件 | 查不到。只有 R 的 giniCI、compindexR 與論文 |
| Leaflet 2.0 穩定版 | 沒有。GitHub releases 最新穩定仍是 1.9.4 |
| GitHub Pages 是否支援 Range | 官方限制頁沒寫。【待確認】 |
| FEMA NRI 原始碼 | 沒有開源。只有方法文件與 OpenFEMA 資料 |
| 直接改皮就能用的中文風險儀表板開源專案 | 沒有。臺灣查到的都是地震速報（TREM）或政府網站，不是可改的指標儀表板 |
| deck.gl、Plotly.js、ECharts 釋出頁的年份 | GitHub 頁面只顯示月日，年份為 2026 是【推論】 |

## 給協調者

1. 組合甲是底線，先做。乙只是在甲上加一層 API。
2. 需要 K8 回答兩件事：VM 內瀏覽器能不能連外網（決定要不要 vendor JS）、podman 能不能開機自起（決定乙的風險）。
3. R1b 的蒙地卡羅排名區間請 c8 直接寫進 mart 欄位（`rank_p05`、`rank_p50`、`rank_p95`），前端不重算。
4. tippecanoe 在 Windows 沒有原生版。切 PMTiles 建議在 VM 上或 podman 容器裡跑一次，輸出檔進 repo 的 `data/marts/` 或 `app/data/`。
5. 建議 pin 版本：Leaflet 1.9.4、MapLibre 5.24.0（UMD）或 6.6.0（ESM）、ECharts 6.1.0、pmtiles JS 最新 3.x、tippecanoe 2.x。
