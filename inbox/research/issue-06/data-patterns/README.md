# R1 任務書：用手上資料找出第 6 題的規律

- 交辦人：整合者 debug-83
- 期限：**2026-10-20（二）22:00**
- 專案根目錄：`C:\Users\abrahamdong\Documents\repos-recon\市政debug松`

## 開工前先讀（依序）

1. `ops/CONVENTIONS.md`：目錄、誰可以改哪些檔、程式放哪、欄位名稱。**一定要先讀。**
2. `research/issue-06/PLAN.md`：痛點假設 P1～P5、規律假設 H1～H7、解法方向 S1～S5。
3. `docs/issues/06-seismic-old-buildings.md`：官方資料的實測結果。
4. `docs/extra-data.md`：34 份非官方補充資料的說明與位置。

每份原始資料的筆數、欄位、編碼已經查過，寫在 3、4 兩份文件。**不要重查**，直接用。

## 要交的東西

### 交付 1：清洗程式與里層級共用表

1. 每份要用的資料集，寫一支清洗程式放 `pipelines/stage/`，輸出到 `data/staged/<組>/<slug>.*`。
2. 寫 `pipelines/build/build_village_indicators.py`，輸出：
   - `data/marts/village_indicators.csv`：456 里一里一列。
   - `data/marts/village_indicators.geojson`：同上，加里界幾何（EPSG:4326）。
   - `data/marts/README.md`：欄位字典。每欄寫定義、來源 slug、資料年份、是原始值還是推估值。
3. 在 `pipelines/README.md` 的索引表加上你新增的程式。

共用表至少要有這些指標（能做到多少算多少，做不到的寫原因）：

| 類別 | 指標 |
|---|---|
| 人口 | 總人口、65 歲以上人數與比例、80 歲以上比例（115 年 9 月） |
| 液化 | 城市版高、中、低潛勢面積占里面積比例；全國 2026 版同樣三項 |
| 屋齡 | 所在區的 30 年以上棟數比例（房屋概況 115 年度）；2001 年後新建執照的建物面積占比（套繪圖）；實價登錄推估的建成年中位數、1982 年前與 1999 年前建成比例，附樣本數 |
| 構造 | 實價登錄的加強磚造、磚造比例，附樣本數 |
| 救災 | 消防通道列管數、狹小巷道數、搶救困難場所數、計畫道路寬度小於 6 公尺的長度比例 |
| 已知案例 | 海砂屋案數、地震黃單數、危老核准案數（能落到里就落到里，不能就落到區） |

注意：

- 里界建議用內政部版 `data/raw/extra/base/village-boundary-nlsc/`，它的代碼和人口檔一致。
- 只有地址的資料，用門牌座標 `data/raw/extra/base/house-number-coordinates/` 定位。地址比對的成功率要寫進報告。
- 消防通道清冊有一格多個里、錯字（葫州里→葫洲里）、全形空白，見 `docs/issues/06-seismic-old-buildings.md`。
- 液化城市版 class 1＝高、2＝中、3＝低【推論，證據強】。

### 交付 2：研究報告 `research/issue-06/data-patterns/report.md`

1. 最前面寫 5 行以內的摘要。
2. H1～H7 每一個寫一節：結論（成立、不成立、證據不足）、證據（數字、表、圖的路徑）、信心程度。
3. 另外寫你在資料裡看到、但 PLAN.md 沒想到的規律。
4. 寫資料的限制：樣本偏誤、尺度不一致、年份不一致。
5. 最後一節「給整合者」：要更正的文件、要新增到 catalog 的資料、你對解法方向 S1～S5 的看法。

分析用的程式放 `research/issue-06/data-patterns/scripts/`，圖表放 `research/issue-06/data-patterns/out/`（單檔小於 2 MB）。

## 不要做的事

- 不要改共用檔：`README.md`、`data/catalog.json`、`docs/`、`research/README.md`、`research/issue-06/PLAN.md`。要改的寫進報告「給整合者」。
- 不要做最終的加權模型或 App。H3 可以做一個簡單的排名敏感度比較，但不要定權重。
- 不要對任何政府網站高頻抓取。需要新資料，先在報告裡提出。
- 不要在輸出裡放逐筆個資（例如見鼠地圖的說明文字、照片）。

## 回報

- 做完時，用 `SendMessage` 傳給 `debug-83`，只寫報告路徑和 3 行摘要。
- 卡住超過 30 分鐘，或發現文件寫錯，也傳訊息。
