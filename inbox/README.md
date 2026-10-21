# inbox：研究組整理的資料與研究

這個資料夾是研究組在賽前整理的東西，從研究 repo 匯出（2026-10-22）。**只是參考資料，不代表隊伍的目錄、架構或分工。**要用哪些、要不要搬出去、怎麼搬，由隊伍決定。

## 裡面有什麼

| 資料夾 | 內容 |
|---|---|
| `data/` | 第 6 題用到的開放資料：原始下載檔、清洗後的表、里層級成品表、公開版門牌分片。索引在 `data/DATASETS.md` |
| `research/issue-06/` | 研究報告、決策紀錄、方案書、原型畫面（`solutions/prototype/`） |
| `pipelines/` | 從原始檔算出成品表的程式 |
| `docs/` | 活動規則、題目、資料授權表、作品說明草稿（`docs/submission/README.md`） |
| `ops/` | 研究 repo 的規範與待辦 |

## 從哪裡開始看

1. `research/issue-06/solutions/handoff/2026-10-21-backend-engineer.md`：5 分鐘的導覽。
2. `data/DATASETS.md`：每份資料是什麼、誰提供、出處怎麼標。

## 要注意

- 這個資料夾會被下一次匯出整份覆蓋。要改哪個檔，請複製到 `inbox/` 外面再改。
- 路徑都相對於 `inbox/`。要跑程式，先 `cd inbox`，再 `uv sync`。
- 沒放進來的資料與原因，見 `data/DATASETS.md` 第 4 節。
