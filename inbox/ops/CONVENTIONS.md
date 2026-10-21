# 專案規範

這份是本專案的規範正本。任何 session（Claude、Codex）在這個 repo 寫檔之前，先讀這份。

## 1. 目錄

```text
README.md                入口
CLAUDE.md                指向這份規範
ops/
  CONVENTIONS.md         本檔
  backlog/               待辦：todo/ waiting/ done/，每個任務一個資料夾
docs/                    事實與規格（官方規則、題目、資料說明）
  event.md
  issues/0N-*.md
  extra-data.md
research/                研究：問題、分析、結論
  README.md              研究任務索引
  issue-06/
    PLAN.md              第 6 題的假設、研究結論、方向修正
    IDEAS.md             議題庫：想過的每個議題與狀態
    solutions/           協調者工作區：任務板、決策紀錄、方案
    <任務>/              每個研究任務一個資料夾
data/
  catalog.json           資料來源登記表（正本）
  raw/<組>/<slug>/       原樣下載，永不手改            不進 git
  raw/extra/<組>/<slug>/ 非官方來源的原始資料           不進 git
  staged/<組>/<slug>.*   清洗後，一份資料集一組檔        不進 git
  marts/                 合併後的共用表（例如里×指標）   進 git
  manual/                人工編輯的輸入（例如勾選清單）  進 git
  simulated/             模擬資料，一律和真實資料分開   進 git
pipelines/               產生共用資料的程式
  common.py              共用路徑與讀檔函式
  address.py             地址比對到里（門牌表）
  fetch/                 → data/raw/
  stage/                 → data/staged/
  build/                 → data/marts/
app/                     產品程式（靜態網站）。依活動規則 Day 1（10/23）之後建立
docs/submission/         交件材料。README.md 是給投票者與主辦看的作品說明草稿；
                         第一次推上 GitHub 時取代根目錄 README，工作區 README 改放 docs/
workspace/               不進 git
  inbox/                 使用者丟東西的地方
  scratch/               一次性程式與暫存
  archive/YYYY-MM/       用完的中繼檔
```

## 2. 誰可以寫哪裡

本專案同時有多個 session 在寫。為了不互相覆蓋，分成「整合者」與「研究者」。

- **整合者**：session `debug-83`。只有整合者改這些共用檔：
  - `README.md`、`CLAUDE.md`、`ops/CONVENTIONS.md`
  - `data/catalog.json`
  - `docs/` 底下所有檔案
  - `research/README.md`、`research/issue-06/PLAN.md`
- **研究者**：其他 session 與 Codex。可以寫：
  - 自己被指派的 `research/issue-06/<任務>/` 資料夾。
  - `pipelines/` 底下照第 3 節規則新增程式，並更新該層的 README 索引。
  - 新增 `ops/backlog/` 任務資料夾，或搬動自己負責的任務。
- **研究者要改共用檔時**：寫在自己報告的「給整合者」一節，或用 `SendMessage` 傳給 `debug-83`。不要直接改。
- **協調者**：session `debug-40`。拆解問題、做判斷、維護任務板 `research/issue-06/solutions/BOARD.md`、做給決策者看的方案。協定見 `research/issue-06/solutions/README.md`。
  - 開始新工作之前先看任務板。板上沒有的工作，先傳給 `debug-40` 登記。
  - 協調者的決定，由整合者落地到共用檔（`PLAN.md`、`IDEAS.md` 等）。

### session 之間的訊息

- 使用者要求省 token：訊息用精簡格式，例如鍵值條列、編號引用（P1、S2、R3）、路徑代替內容。給人看的文件仍照第 7 節寫完整的中文。
- 一個議題一則訊息。大東西放檔案，訊息只給路徑。
- 證據等級照第 7 節標示。

## 2a. git 紀律

- 2026-10-18 協調者在本機 `git init`。遠端還沒有（見 `ops/backlog/todo/009-github-setup/`）。
- 自己的檔案自己 commit。**只 `git add` 自己負責的路徑，不要 `git add -A`。**
- commit message 用英文，前綴標誰做的：

  | 前綴 | 誰 |
  |---|---|
  | `[R1]` | 現況研究 c8 `[86c407]` |
  | `[R2]` | 國際debug-38 `[c2d1cd]` |
  | `[R3]`、`[R4]` | debug-aa `[04db5b]` |
  | `[INT]` | 整合者 debug-83 |
  | `[COORD]` | 協調者 debug-40 |

- 一個議題一個 commit。討論的結論先落地成檔案，再 commit。

## 3. 程式放哪裡

**依用途分，不依題目分。**

| 用途 | 放哪裡 | 進 git |
|---|---|---|
| 下載資料 | `pipelines/fetch/` | ✅ |
| 清洗一份資料集 | `pipelines/stage/` | ✅ |
| 合併成共用表 | `pipelines/build/` | ✅ |
| 回答一個研究問題的分析 | `research/<題>/<任務>/scripts/` | ✅ |
| 跑一次就丟 | `workspace/scratch/` | ❌ |

判斷方法：**別人會不會用到它的輸出？** 會，放 `pipelines/`。只有這個研究任務用，放研究資料夾。

`pipelines/` 根目錄**只放被其他程式 import 的共用函式庫**（例如 `common.py`、`address.py`），不放可以直接執行的程式。

每支程式都要遵守：

1. 檔名用 snake_case 英文，例如 `stage_village_population.py`。
2. 開頭的 docstring 寫：用途、Usage（完整執行指令）、Input、Output、要不要網路。
3. 新增程式時，在同一層的 `README.md` 索引表加一列。
4. 從 repo 根目錄執行：
   - `pipelines/` 底下：`uv run python -X utf8 -m pipelines.<層>.<檔名>`
   - 研究資料夾：`uv run python -X utf8 research/<題>/<任務>/scripts/<檔名>.py`
5. 用 `from pipelines.common import RAW, STAGED, MARTS` 取得路徑，不要寫死絕對路徑。
6. 要新套件就 `uv add <套件>`，不要另外 pip install。
7. 程式產生的檔案，每次執行都整份重寫。人工編輯的東西放 `data/manual/`，不要放在程式會覆蓋的位置。

## 4. 資料規則

1. `data/raw/` 原樣保存，不手改。所有轉換寫成程式。
2. `data/staged/` 的格式：
   - 表格：UTF-8 的 CSV；超過 50 MB 用 Parquet。
   - 空間：GeoJSON 或 GeoParquet，座標系 EPSG:4326。要算面積、距離時轉 EPSG:3826（TWD97，公尺）。
3. 行政區欄位一律用這組名稱：

   | 欄名 | 內容 | 例 |
   |---|---|---|
   | `town_code` | 區代碼 8 碼 | `63000050` |
   | `town_name` | 區名 | `中正區` |
   | `village_code` | 里代碼 11 碼 | `63000050001` |
   | `village_name` | 里名 | `幸福里` |

   這組代碼和「各里人口數」、內政部村里界圖（VILLCODE、TOWNCODE）一致。

4. 真實資料與模擬資料分開。模擬資料只放 `data/simulated/`，檔案開頭或旁邊的 README 寫明怎麼產生的。
5. 不使用真實個資。逐筆民眾通報（例如見鼠地圖）的精確點位、文字、照片，對外展示前要彙總到里或區。

## 4a. App 與方案畫面的資料契約

App、儀表板、方案畫面**只讀 `data/marts/`**，不讀 `raw/` 或 `staged/`。這樣資料層和畫面可以分頭做。

1. 每張 mart 一組檔：CSV（UTF-8）＋ GeoJSON（EPSG:4326）。超過 50 MB 另出 Parquet，並給畫面一份精簡版。
   - **進 git 的檔案單檔不超過 10 MB。**超過的版本（例如 `building_points.csv`、`building_points_lite.geojson`）列進 `.gitignore`，由 `pipelines/build/` 的程式重新產生。至少要有一個 10 MB 以下的版本進 git（通常是 Parquet），讓沒跑建置的人也拿得到資料。
   - **本機 repo 是私有的，可以放內部資料；公開的只有白名單上的檔案。**哪些 mart 是內部、哪些可公開，見 `docs/data-licenses.md` 第 6 節。原型、畫面要用資料時，從 `data/marts/` 讀，不要另存一份資料檔進 git。公開方式見 `ops/backlog/todo/009-github-setup/`。
2. 欄位字典寫在 `data/marts/README.md`，由 mart 的作者維護。新增或改欄位時同步更新。
3. 每一列都要有空間鍵：里層級用 `village_code`；逐棟或逐點用 `point_id`，加 `village_code`。
4. 逐棟或逐點的資料，加 `status` 欄，值只能是：
   - `confirmed`：官方清冊有列（例如海砂屋、地震列管）。
   - `estimated`：我們推估的（例如從實價登錄推屋齡）。
   - `undetermined`：資料不夠，判不出來。這是正式類別，不能省略。
5. 有版本差異的因子，欄名帶版本，例如 `liq_high_share_city2019`、`liq_high_share_national2026`。
6. 每張 mart 的 README 寫明各欄的來源 slug 與資料日期，畫面上要能顯示。
7. 不放個資。逐筆民眾通報要先彙總。

## 5. 已查證的事不要重查

- 每份原始資料的筆數、欄位、編碼、座標系，已寫在 `docs/issues/` 與 `docs/extra-data.md`。先讀那裡。
- 文件寫錯了，修正文件（研究者請告訴整合者），不要只在自己的程式裡默默處理。

## 6. 命名

- 資料夾、Markdown 檔：英文小寫 kebab，例如 `data-patterns/`。
- Python 檔：snake_case。
- 有日期的檔：`YYYY-MM-DD-<主題>.md`。
- 不用中文檔名、空格、`final`、`最新`、`(1)`。

## 7. 研究報告的寫法

- 語言：繁體中文（台灣用語）。識別字、程式碼註解、commit message 用英文。
- 每個主張標證據等級：`【實測】`（本輪親自查的，附方式與時間）、`【文件】`（引用來源，附網址）、`【推論】`、`【待確認】`。
- 不要把【推論】當事實往下推。
- 大東西放檔案，訊息只給路徑。

## 8. 絕不放進 repo 或訊息

- 任何憑證：token、密碼、API key、cookie。金鑰放 `~/.config/<service>/.env`。
- 報名資料等個資。
