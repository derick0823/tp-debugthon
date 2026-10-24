# code.gov.tw 再搜一次：第 6 題可用或可參考的政府開源程式

- 任務：`research/issue-06/data-search/BRIEF.md`，負責 code.gov.tw。統籌 debug-c1。
- 撰寫：debug-c2，2026-10-23 19:14～19:30。
- 證據等級：【實測】本輪親自查；【文件】引用文件；【推論】；【待確認】。
- 樣本與請求紀錄放在 `workspace/scratch/2026-10-23-code-gov-tw/`（不進 git）。

## 0. 一句話結論

1. **code.gov.tw 全站只有 58 筆公共程式，沒有一筆是耐震、老屋、都更、建物或液化的程式。**【實測】
2. 最有用的一筆是 **臺北城市儀表板**（Taipei City Dashboard）。它的資料管線設定檔就像一份「臺北市府在用哪些資料」的索引。我從裡面找到我們沒有的資料 15 筆，其中有一份**「屋齡 30 年以上」建物面圖**。下載後確認它是合併過的範圍遮罩，不是逐棟資料（見第 4 節）。【實測】
3. 程式本身大多只能參考，不能直接搬：城市儀表板是 AGPL-3 授權，搬進我們的 MIT 專案會改變授權。

## 1. 候選表

### 1.1 程式（code.gov.tw 登錄的公共程式）

依 BRIEF：「格式」改成「語言」，「粒度」改成「最後提交日」。最後提交日用 GitHub API 的 `pushed_at`【實測，19:16～19:17】。

| # | 名稱 | 網址 | 提供機關 | 授權 | 語言 | 更新頻率／最後更新（code.gov.tw） | 最後提交日 | 對哪個原型或 Day 2 哪一頁有用 | 我們有沒有 | 建議與理由 |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | 臺北城市儀表板 | <https://github.com/taipei-doit/Taipei-City-Dashboard>（code.gov.tw 登錄的 `tpe-doit` 已轉址） | 臺北市政府資訊局 | AGPL-3（`LICENSE` 檔頭【實測】；GitHub API 顯示 NOASSERTION） | Python、Vue.js、Go、PostgreSQL | 上架 2024-12-01 | 2026-10-22 | 資料索引（見 1.2）；`priority-ranking`、`rescue-drill-map` 的地圖呈現可參考；Day 2「未來需要的資源」可寫「接進城市儀表板」 | 無 | **主用，當資料索引與設計參考。不搬程式碼。** 177 個資料管線的 `job_config.json` 寫了中文名稱、來源網址、機關、敏感度 |
| P2 | 城市儀表板的 `transform_address.py` | 同上，`Taipei-City-Dashboard-DE/dags/utils/transform_address.py`（40 KB） | 臺北市政府資訊局 | AGPL-3 | Python | 同上 | 同上 | `pipelines/address.py` 的正規化規則可對照：中文數字轉換、全半形、判斷是否臺北市、區里對應表 | 無 | **參考。** 只讀不抄。我們的地址比對精確率已有 86%～99%【文件，`data-patterns/report.md` 第 14 行】 |
| P3 | 地址標準寫法 API | <https://github.com/moistat/adrid-moi-gov>；示範 <https://adrid.moi.gov.tw/> | 內政部 | MPL-2.0（code.gov.tw）；GitHub API 顯示 NOASSERTION | Java、Spring Boot | 上架 2025-09-16 | 2025-08-27 | 試算器與進度板的地址輸入：把使用者打的地址轉成標準寫法再比對 | 無 | **備用。** API 路徑名稱含 `api-key-resource`，可能要申請金鑰【待確認】。BRIEF 規定不碰要申請的服務，這輪沒有測 |
| P4 | 災害影響評估平臺 | <https://github.com/tainancity/tainanthon2024-water-resource-map-application> | 臺南市政府 | MIT | Python | 上架 2024-12-25 | 2024-12-19 | `rescue-drill-map`：在地圖上畫一塊範圍，自動算面積、戶數、人口。可以借來做「圈一塊算高齡人數」 | 無 | **備用。** MIT 可以直接用，但它是淹水情境 |
| P5 | 臺南淹水避難點警示及引導 | <https://github.com/tainancity/tainanthon2024-floodguard> | 臺南市政府 | MIT（GitHub）；code.gov.tw 未填 | HTML、JS、Python | 上架 2025-10-14 | 2025-07-14 | S5 救災可及性：避難路徑規劃＋民眾回報路況 | 無 | **不用。** 淹水專用，避難路線不是我們的主題 |
| P6 | 城市通架構／城市通服務（TownPass） | <https://github.com/taipei-doit/TownPass>、<https://github.com/taipei-doit/TownPass-Services> | 臺北市政府資訊局 | 架構：GPL-3.0（GitHub）／AGPL-3.0（code.gov.tw），兩邊不一致；服務：GitHub 無授權檔 | Dart、Flutter；Vue.js | 上架 2025-02-20 | 架構 2026-10-17；服務 2025-01-09 | Day 2「未來需要的資源」：做成台北通的一個服務，就有現成的登入與推播 | 無 | **之後。** Day 2 前來不及接；寫進推廣計畫 |
| P7 | publiccode.yml 標準與編輯器 | <https://github.com/moda-gov-tw/publiccodeyml-publiccode.yml>、<https://github.com/moda-gov-tw/italia-publiccode-editor> | 數位發展部 | 標準 CC0（已封存，最後提交 2023-11-08）；編輯器 AGPL-3.0 | YAML | 上架 2022-12-01 | 2023-11-08 | 交件：在 repo 根目錄放 `publiccode.yml`，作品之後可以登錄 code.gov.tw | 無 | **主用，成本最低。** 約 30 分鐘。由整合者決定放不放 |
| P8 | 公部門開源軟體應用參考手冊 | <https://github.com/moda-gov-tw/Sector_Open_Source_Software_Playbook> | 數位發展部 | 未填 | 文件 | 上架 2026-04-16 | 未查 | 交件 README 的授權段：MIT 與 AGPL 怎麼選 | 無 | **參考。** |
| P9 | 數位憑證皮夾 發行端／驗證端 | <https://github.com/moda-gov-tw/TWDIW-official-app> | 數位發展部 | 未填 | Java | 上架 2026-01-28 | 未查 | `consent-tracker` 的未來版：同意書簽署時的身分驗證 | 無 | **之後。** 後端隊友的長期選項 |
| P10 | 資料檢核及安全處理系統 | <https://github.com/moda-gov-tw/data-validation-and-security-processing-system> | 數位發展部 | MIT | Java | 上架 2024-12-25 | 未查 | 個資遮罩 | 無 | **不用。** 我們不存個資 |
| P11 | 災防資料彙整系統（後端） | <https://github.com/shuanowenLiou/tainan-ai-driven-data-hub-main-20251113T060529Z-1-001> | 數位發展部 | 未填 | Vue.js | 上架 2026-05-06 | 未查 | 無 | 無 | **不用。** 災時局處上傳統計表，和第 6 題無關 |

其他 47 筆是身分驗證、文書、碳排、通訊、學校網站等，和第 6 題無關【實測，逐筆看過名稱與類型】。

### 1.2 資料（從城市儀表板的資料管線與地圖檔找到）

這些是**資料**，不是程式。它們是我從 P1 的檔案樹與 47 個 `job_config.json` 檔頭找到的【實測，19:17～19:25】。data.taipei 上的資料，詳細欄位與授權要看 b9 的 `2026-10-23-data-taipei.md`。

| # | 名稱 | 網址 | 提供機關 | 授權 | 格式 | 更新頻率／最後更新 | 粒度 | 對哪個原型或 Day 2 哪一頁有用 | 我們有沒有 | 建議與理由 |
|---|---|---|---|---|---|---|---|---|---|---|
| D1 | 屋齡 30 年以上建物面（`bld_2d_older_than_30.geojson`） | P1 repo，`Taipei-City-Dashboard-FE/public/mapData/`，54,984,918 bytes | 未寫來源【待確認】 | 跟著 repo 是 AGPL-3；資料本身的授權【待確認】 | GeoJSON（MultiPolygon，CRS84） | 2024-01-30 一次加入，之後沒更新【實測，commits API】 | 棟 | 市民卡的「屋齡與規範世代」；驗證我們的逐棟屋齡推估；S4 論述 | 無 | **備用（驗證用）。** 屬性只有一欄 `都更機會`＝「大於30年」，不是確切屋齡【實測，檔頭 4 KB】。**19:43 下載全檔後更正：整個檔只有 1 個 feature，是 43,581 塊多邊形合成的；相鄰建物已被合併，不是逐棟資料，只能當範圍遮罩**【實測】 |
| D2 | 高液化且 20 年以上建物面（`bld_2d_in_soil_liquid.geojson`） | 同上，9,425,701 bytes | 同上 | 同上 | GeoJSON | 同上 | 棟 | `priority-ranking` 的液化因子；市民卡 | 無 | **備用。** 屬性 `都更機會`＝「高液化且大於20年」。用的是哪一版液化圖【待確認】 |
| D3 | 已在都更範圍／不在都更範圍建物面（`bld_2d_in_renew`、`bld_2d_no_renew`） | 同上，6.2 MB、13.3 MB | 同上 | 同上 | GeoJSON | 同上 | 棟 | `priority-ranking` 公辦分頁 | 無 | **不用（先）。** 我們已有都更審議案件 466 案；`no_renew` 的屬性沒有抽樣 |
| D4 | `condemned_building.geojson` | 同上，37,772 bytes（全檔已抓） | 未寫 | 同上 | GeoJSON 點 | 同上 | 點（有地址、面積） | 待判斷 | 無 | **不用，先查清楚。** 屬性是面積、行政區、地址，看不出是危險建物還是閒置建物【待確認】 |
| D5 | 臺北市老舊聚落分布圖（DAG `R0021`） | <https://data.taipei/dataset/detail?id=e51e44ee-ddfd-492e-b936-8d08ece0e3d0> | 工務局 | 依 data.taipei【待確認】 | shp | 每年 6 月 | 面 | `rescue-drill-map`、`priority-ranking`：山邊老舊聚落，對應 R1 的「下一波雙老」（士林、北投、內湖） | 無；b9 也沒列 | **主用。** 公開資料、和第 6 題直接相關 |
| D6 | 臺北市市有公用未利用土地清冊（`R0067`） | <https://data.taipei/dataset/detail?id=020bc1fc-34ff-4caa-ab1b-4267bd0bf386> | 財政局 | 依 data.taipei | API | 每年 3 月 | 筆（地號） | `priority-ranking` 公辦都更分頁；ETBlue 提到的中繼住宅 | 無；b9 沒列 | **主用。** `priority-ranking/README.md` 第 101 行寫「公辦分頁沒有算公有地」，這筆剛好補上 |
| D7 | 市有尚未利用建物／非公用閒置建物清冊（`R0068`、`R0069`） | <https://data.taipei/dataset/detail?id=feaa5be3-0c43-4f0b-a46f-8a57cfd75d7a> | 財政局 | 依 data.taipei | csv | 每年 3、9 月 | 棟 | 同 D6；中繼住宅候選 | 無；b9 沒列 | **主用。** 同 D6 |
| D8 | 臺北市公有土地資料（`R0056`） | <https://data.taipei/dataset/detail?id=ca644935-035e-4ecf-bd93-3d8df351bdb7> | 地政局 | 依 data.taipei | csv | 每月 | 筆 | 同 D6 | 無；b9 沒列 | **備用。** 比 D6 範圍大，要篩 |
| D9 | 臺北市山坡地人工邊坡位置圖（`R0020`） | <https://data.taipei/dataset/detail?id=7945f811-9b77-4d89-92ec-d94c827888ca> | 工務局 | 依 data.taipei | shp | 每年 12 月 | 點或面 | 坡地老舊聚落的複合風險（對應 peer-c2 C6 的「坡地與地震複合型災害」） | 無 | **備用。** |
| D10 | 土石流潛勢溪流與影響範圍（`R0018`、`R0019`） | <https://data.gov.tw/dataset/167440>、<https://data.gov.tw/dataset/167441> | 農業部 | 依 data.gov.tw | zip | 每月 | 線、面 | 同 D9 | 無；debug-42 有提到 1 次 | **備用。** 交給 debug-42 判斷 |
| D11 | 修繕住宅貸款利息補貼受理情形 | <https://data.taipei/dataset/detail?id=6297943a-1e71-480d-967c-635855df66fe> | 都發局 | 依 data.taipei | 表 | 管線寫到 111 年 | 全市年度 | `renewal-calculator` 替代路：修繕貸款利息補貼 | 無 | **不用。** 只有全市戶數，而且資料停在 111 年 |
| D12 | 可供避難收容處所一覽表（`R0017`） | <https://data.taipei/dataset/detail?id=aaf97773-3631-40e2-b3cc-da87bf2ce1d5> | 教育局（管線標籤） | 依 data.taipei | ods | 每年 4 月 | 點 | `rescue-drill-map` | 無；**b9 已列為最該補第 2 名** | 照 b9 |
| D13 | 大臺北地區消防栓分布點位圖（`R0075`） | <https://data.taipei/dataset/detail?id=679a0801-8cb0-4c64-91ad-952c1b9e5e84> | 北水處 | 依 data.taipei | csv | 每年 1 月 | 點 | `rescue-drill-map` | 無 | **19:43 更正：不是 b9 那份。** 這個 id 實際是消防局的「臺北市消防水源」行政區統計（112 年 7～12 月），不是點位；儀表板設定檔標錯名稱【實測，詮釋資料】。點位版是 b9 已載的北水處 `c106a00b`。這份已照常下載，只能做區層級對照 |
| D14 | 都更公劃地區、自劃單元、都市計畫劃定更新地區（`R0062`～`R0066`） | 來源寫「都發局地形圖數值圖檔供應系統」，內部 GeoJSON | 都發局 | `sensitivity: private` | GeoJSON | 每月 3 日 | 面 | 無法用 | 無 | **不用，寫進 S4。** 市府內部每月都在更新更新地區的範圍圖，但沒有公開。這可以當「100 天開放建議」的一項 |
| D15 | EOC 最新受損情形資料 | `https://tfd.blob.core.windows.net/blobfs/data/T-SAGEDamageCaseData.json`（沒有測） | 消防局 | 未寫 | JSON API | 每 5 分鐘 | 點 | 之後：震後即時災情 | 無 | **之後。** 平時沒有地震資料 |

**我們已經有的**（管線也有用到，不列入候選）：當年度與歷年建造執照摘要、使用執照摘要（`R0057`～`R0060`）、火災搶救困難地區（`R0033`）、海砂屋列管案件、都市計畫使用分區【實測，依 `data/raw/extra/_sources.csv`、`data/catalog.json` 比對資料集 id】。

## 2. 搜了什麼、請求多少

### 2.1 做法

1. 抓 code.gov.tw 首頁與 JS bundle，找出網站的 API【實測】。
2. 找到開放資料端點 `/api/OpenDataSet/PublicProgramInfoData/json`，一次拿到全部 58 筆詮釋資料（67 KB）。所以關鍵字搜尋在本機做，不用每個關鍵字發一次請求。
3. 用列表 API `/api/PublicProgramInfo/queryList` 確認網站總數 `recordsTotal` 也是 58，所以開放資料就是全站。
4. 對候選 repo 查 GitHub API 的最後提交日與授權。
5. 對 P1 抓一次檔案樹（1,461 個路徑），再讀相關檔案的前幾 KB。

### 2.2 關鍵字與命中筆數

搜尋欄位：程式名稱＋說明＋類型＋提供機關。全站 58 筆【實測，19:15】。

| 關鍵字 | 命中 | 關鍵字 | 命中 |
|---|---|---|---|
| 耐震、老屋、危老、都更、都市更新、海砂屋 | 各 0 | 消防 | 2（消防設備自行申報、無人機搜救，都不相關） |
| 建照、使照、門牌、建物、建築、樓層、構造、屋齡 | 各 0 | 避難 | 1（P5） |
| 土壤液化、液化、斷層、地震 | 各 0 | 災害 | 3（P4、P5、P11） |
| 救災、窄巷、防災 | 各 0 | 地址 | 1（P3） |
| 高齡、長者、獨居、身障 | 各 0 | 地圖、圖資 | 各 9 |
| 里、容積、公寓大廈、管委會、補強、補助、地籍、實價 | 各 0 | 評估 | 3（早療評估 2、P4 1） |
| GIS、TGOS、建管、試算 | 各 0 | 臺北／台北 | 5／2 |
| 無障礙 | 1（網站無障礙，不相關） | 定位 | 2（不相關） |

### 2.3 請求總數

| 主機 | 請求數 | 備註 |
|---|---|---|
| code.gov.tw | 4 | 首頁、bundle、開放資料 JSON、列表 API |
| api.github.com | 11 | 7 個 repo 的詮釋資料、1 個檔案樹、2 個檔案的提交紀錄；另有 1 個 301 |
| raw.githubusercontent.com | 59 | 2 個 SQL 範例、1 個 LICENSE 檔頭、4 個 GeoJSON（3 個只抓前 4 KB）、52 個 `job_config.json` 與程式檔頭 |
| **合計** | **74** | 上限 80。時間 19:14:47～19:25:31。每次間隔 5 秒以上，不平行 |

**一次非 200**：第 6 個請求 `api.github.com/repos/tpe-doit/Taipei-City-Dashboard` 回 301。我照紀律先停，讀回應內容是「Moved Permanently」（repo 改名為 `taipei-doit`）。GitHub 文件建議跟隨轉址，所以我加上跟隨轉址後繼續。這是我的判斷，統籌可以否決。

**下載的樣本**（都小於 5 MB，放 `workspace/scratch/2026-10-23-code-gov-tw/`）：`dashboard-demo.sql`（2.4 MB）、`dashboardmanager-demo.sql`、`condemned_building.geojson`、3 個 GeoJSON 檔頭、52 個設定檔頭、`request-log.csv`。

## 3. 最該補的 3 筆

| 順位 | 項目 | 為什麼 | 補了改哪個畫面 | 要花多久【推論】 |
|---|---|---|---|---|
| 1 | 市有未利用土地與建物清冊（D6、D7） | `priority-ranking` 的「公辦都更候選」分頁自己寫了「沒有算公有地」。市府辦公辦都更或找中繼住宅，第一步就是看附近有沒有市有地。b9 沒有列到 | `priority-ranking` 公辦分頁：每個候選里加一句「本里或鄰里有市有未利用土地 N 筆、建物 M 棟」 | 約 2 小時：下載、比對地號或地址到里、寫進 `village_indicators`。資料由 b9 那一側確認授權 |
| 2 | 臺北市老舊聚落分布圖（D5） | 工務局公開的面資料，直接對應題目的「屋老」，也對應 R1「下一波雙老」在士林、北投、內湖。我們的窄巷與液化因子抓不到山邊聚落 | `rescue-drill-map` 右欄：本里是否有老舊聚落；`priority-ranking` 可當救災因子的子項 | 約 1 小時：shp 疊里界算面積比例 |
| 3 | 城市儀表板的「屋齡 30 年以上建物面」（D1） | 這是逐棟資料，可以檢查我們逐棟屋齡推估的覆蓋率（我們的建成年只覆蓋 33.6% 的棟【文件，`city-workflow/2026-10-18-site-inspection.md` 第 150 行】）。它也改變 S4 的說法：市府自己的公開 repo 已經放了逐棟的「30 年以上」分類，只是沒有確切年份與構造 | 市民卡「屋齡與規範世代」：我們沒有建成年的棟，可以改標「市府圖層：30 年以上」；S4 說法改成「請開放確切建成年與構造，不只是 30 年門檻」 | 約 3 小時。**要先過兩關**：(1) 55 MB 超過這輪上限，下載要統籌或使用者同意；(2) 來源與資料授權【待確認】。確認前只能當驗證，不能上公開畫面。**19:43 下載後更正**：這個檔是合併後的範圍遮罩，不是逐棟資料（見 D1 列）。它只能回答「某個點落在 30 年以上建物範圍內嗎」，不能給單棟補屋齡。上面「市民卡改標」的用法要降級成「點落在遮罩內就標『市府圖層：30 年以上範圍』」；S4 的說法也改成「市府公開 repo 只有 30 年以上的合併範圍」 |

另外一件成本很低的事：在交件 repo 放 `publiccode.yml`（P7），約 30 分鐘。這讓作品可以登錄 code.gov.tw，也可以寫進 Day 2「未來需要的資源」的推廣計畫。由整合者 debug-83 決定。

## 4. 已下載（2026-10-23）

- 依 `DOWNLOAD-BRIEF.md`，使用者經統籌 debug-c1 同意。下載 D 開頭「主用」「備用」的全部，加上 D13（b9 轉告兩份 id 不同，照指示比對後下載）。
- 時間 19:39～19:43。請求 18 個：詮釋資料 8 個、檔案 10 個。全部 200，每次間隔 4.5 秒以上，不平行【實測】。
- 轉址 2 次：農業部兩個 zip 從 `GetOpenDataFile.aspx` 302 到同主機的 `/Upload/` 路徑，已跟隨，記在 `_manifest.json` 的 `files[].redirected_to` 與 `note`。
- 合計 10 檔、85,651,352 bytes（約 85.7 MB）。每個資料夾都有 `_manifest.json`（含 sha256）。
- 沒有下載：D3（不用）、D4（不用，意義未明）、D11（不用）、D12（b9 已載）、D14（市府內部資料，不公開）、D15（之後）。
- 下載紀錄：`workspace/scratch/2026-10-23-code-gov-tw/download-log.csv`；程式：同資料夾 `fetch_d.py`（一次性，不進 `pipelines/`）。

| slug | 路徑 | 檔數 | 大小 | 授權狀態 | 備註 |
|---|---|---|---|---|---|
| old-settlements-taipei-pwd | `data/raw/extra/hazard/old-settlements-taipei-pwd/` | 1 | 22 KB | 已查：政府資料開放授權條款第 1 版 | D5。CAD 轉出的 shp（zip），TWD97，Big5 |
| city-unused-land-taipei-finance | `data/raw/extra/land/city-unused-land-taipei-finance/` | 1 | 3.7 KB | 同上 | D6。63 筆，115 年 9 月版，Big5 |
| city-unused-buildings-taipei-finance | `data/raw/extra/land/city-unused-buildings-taipei-finance/` | 1 | 2.6 KB | 同上 | D7。58 筆，含門牌與建築完成日期（市有建物，不是個資），Big5 |
| public-land-taipei-land | `data/raw/extra/land/public-land-taipei-land/` | 1 | 15.2 MB | 同上 | D8。地政局 blob 主機的 `publand.csv`，Big5，每月更新 |
| artificial-slopes-taipei-pwd | `data/raw/extra/hazard/artificial-slopes-taipei-pwd/` | 1 | 3.8 MB | 同上 | D9。shp（zip），TWD97 |
| debris-flow-streams-moa | `data/raw/extra/hazard/debris-flow-streams-moa/` | 1 | 1.3 MB | 已查：data.gov.tw license 代碼 1 | D10。113 年度 1,736 條，全國檔，沒有分縣市版 |
| debris-flow-areas-moa | `data/raw/extra/hazard/debris-flow-areas-moa/` | 1 | 0.9 MB | 同上 | D10。影響範圍圖，全國檔 |
| fire-water-sources-stats-taipei-tfd | `data/raw/extra/hazard/fire-water-sources-stats-taipei-tfd/` | 1 | 546 B | 已查：政府資料開放授權條款第 1 版 | D13。消防局行政區統計，不是點位；和 b9 的北水處點位版 `c106a00b` 不同 |
| citydashboard-buildings-over-30y | `data/raw/extra/building-hazard/citydashboard-buildings-over-30y/` | 1 | 55.0 MB | **待確認** | D1。出自 Taipei-City-Dashboard repo（AGPL-3），資料來源與授權待確認；只供交叉比對，不進產品。1 個 feature、43,581 塊多邊形，是合併後的範圍遮罩 |
| citydashboard-buildings-liquefaction-over-20y | `data/raw/extra/building-hazard/citydashboard-buildings-liquefaction-over-20y/` | 1 | 9.4 MB | **待確認** | D2。同 D1 的限制。單一 Feature、10,431 塊多邊形 |

**可以直接貼進 `data/raw/extra/_sources.csv` 的列**（欄位 `dir,title,dataset_page,direct_url,retrieved,license`；`dir` 照既有列只寫 slug）：

```csv
old-settlements-taipei-pwd,臺北市老舊聚落分布圖,https://data.taipei/dataset/detail?id=e51e44ee-ddfd-492e-b936-8d08ece0e3d0,https://data.taipei/api/dataset/e51e44ee-ddfd-492e-b936-8d08ece0e3d0/resource/af078346-d7e2-4547-98ab-2ea7a525a1c9/download,2026-10-23,政府資料開放授權條款-第1版
city-unused-land-taipei-finance,臺北市市有尚未利用土地供給資料清冊,https://data.taipei/dataset/detail?id=020bc1fc-34ff-4caa-ab1b-4267bd0bf386,https://data.taipei/api/dataset/020bc1fc-34ff-4caa-ab1b-4267bd0bf386/resource/15c3dde7-b6db-4a66-84c2-098236b84512/download,2026-10-23,政府資料開放授權條款-第1版
city-unused-buildings-taipei-finance,臺北市市有尚未利用建物供給資料清冊,https://data.taipei/dataset/detail?id=feaa5be3-0c43-4f0b-a46f-8a57cfd75d7a,https://data.taipei/api/dataset/feaa5be3-0c43-4f0b-a46f-8a57cfd75d7a/resource/fe2b491e-31fb-4ea3-97d9-959206942582/download,2026-10-23,政府資料開放授權條款-第1版
public-land-taipei-land,臺北市公有土地資料,https://data.taipei/dataset/detail?id=ca644935-035e-4ecf-bd93-3d8df351bdb7,https://tpland.blob.core.windows.net/blobfs/publand.csv,2026-10-23,政府資料開放授權條款-第1版
artificial-slopes-taipei-pwd,臺北市山坡地人工邊坡位置圖,https://data.taipei/dataset/detail?id=7945f811-9b77-4d89-92ec-d94c827888ca,https://data.taipei/api/dataset/7945f811-9b77-4d89-92ec-d94c827888ca/resource/e7a23ebc-f56b-424f-8073-f2469dc99c6d/download,2026-10-23,政府資料開放授權條款-第1版
debris-flow-streams-moa,113年度1736條土石流潛勢溪流圖,https://data.gov.tw/dataset/167440,https://data.moa.gov.tw/OpenData/GetOpenDataFile.aspx?id=I88&FileType=SHP&RID=32743,2026-10-23,政府資料開放授權條款-第1版
debris-flow-areas-moa,113年度1736條土石流潛勢溪流影響範圍圖,https://data.gov.tw/dataset/167441,https://data.moa.gov.tw/OpenData/GetOpenDataFile.aspx?id=I89&FileType=SHP&RID=37086,2026-10-23,政府資料開放授權條款-第1版
fire-water-sources-stats-taipei-tfd,臺北市消防水源,https://data.taipei/dataset/detail?id=679a0801-8cb0-4c64-91ad-952c1b9e5e84,https://data.taipei/api/dataset/679a0801-8cb0-4c64-91ad-952c1b9e5e84/resource/1823a45d-bcaa-4dd5-baf8-cdcf5d34be79/download,2026-10-23,政府資料開放授權條款-第1版
citydashboard-buildings-over-30y,臺北城市儀表板 bld_2d_older_than_30（屋齡30年以上建物範圍）,https://github.com/taipei-doit/Taipei-City-Dashboard/tree/develop/Taipei-City-Dashboard-FE/public/mapData,https://raw.githubusercontent.com/taipei-doit/Taipei-City-Dashboard/develop/Taipei-City-Dashboard-FE/public/mapData/bld_2d_older_than_30.geojson,2026-10-23,待確認（repo 為 AGPL-3；只供交叉比對）
citydashboard-buildings-liquefaction-over-20y,臺北城市儀表板 bld_2d_in_soil_liquid（高液化且20年以上建物範圍）,https://github.com/taipei-doit/Taipei-City-Dashboard/tree/develop/Taipei-City-Dashboard-FE/public/mapData,https://raw.githubusercontent.com/taipei-doit/Taipei-City-Dashboard/develop/Taipei-City-Dashboard-FE/public/mapData/bld_2d_in_soil_liquid.geojson,2026-10-23,待確認（repo 為 AGPL-3；只供交叉比對）
```
