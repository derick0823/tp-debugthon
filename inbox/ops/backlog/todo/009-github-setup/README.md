# 009 準備 GitHub repo

- 負責：你決定，Claude 準備
- 為什麼：交件時作品網址要能公開打開（GitHub Pages）。也可以另附程式碼網址。隊友要能 clone 下來用。

## 要決定的事

1. **用哪一種方式公開**（見下一節，整合者建議方案 B）。
2. repo 名稱（英文 kebab）。
3. 放個人帳號還是開 organization。
4. 授權：官方建議 MIT 或 CC BY 4.0，同意才會被ㄅ級分收錄，不同意不影響參加。本隊規劃程式 MIT、資料 CC BY 4.0（`docs/data-licenses.md`）。

## ⚠ 這個本機 repo 不能直接公開

2026-10-18 整合者掃描 git 歷史【實測】，有兩類檔案不能公開：

| 路徑 | 在哪裡 | 為什麼不能公開 |
|---|---|---|
| `data/marts/building_points.csv`（48.8 MB） | 歷史（commit `0fa4aab`，之後 `c6aab0a` 移出追蹤） | 內部資料：逐棟帶全國 2026 版液化等級（授權待確認）與未過濾的海砂屋欄位 |
| `data/marts/building_points_lite.geojson`（23.2 MB） | 歷史（同上） | 同上 |
| `data/marts/building_points.parquet`（約 8 MB，歷史裡 4 個版本） | **目前仍在追蹤** | 同上。依 `docs/data-licenses.md` 第 6 節屬於內部 |
| `research/issue-06/solutions/prototype/data/buildings/*.json`（12 片，約 27 MB） | 歷史（commit `5c1be48`，之後 `6c8ecfc` 移出追蹤） | 原型用的舊內部版分片：帶 `liq_level_national2026`、`liq_agreement`、未依精確比對過濾的 `sea_sand` |

理由見 `docs/data-licenses.md` 第 4、6 節（全國 2026 版授權待確認；已知案件依共識 BD10 只在精確比對時揭露）。

## 兩種公開方式

| | A：清理這個 repo 的歷史後直接公開 | B：本機 repo 維持私有，另建一個乾淨的公開 repo（**整合者建議**） |
|---|---|---|
| 做法 | 用 `git filter-repo` 刪掉上表的檔案，再 push | 依白名單把可以公開的檔案複製到新 repo，從一個乾淨的 commit 開始 |
| 風險 | 會改寫所有 session 的歷史。5 個 session 都要停手；任何一個沒同步，就可能把舊歷史推回去 | 兩個 repo 要同步。用一支匯出程式依白名單產生，每次交件前跑一次 |
| 內部資料 | 從歷史刪掉，本機也找不回 | 留在私有 repo，研究過程完整保留 |
| GitHub Pages | 從公開 repo 發布 | 從公開 repo 發布（gh-pages 分支只放建置產物） |

**白名單草案**（方案 B，交件前由整合者寫成匯出程式）：

- `app/`、`pipelines/`、`pyproject.toml`、`uv.lock`
- `docs/`（`docs/submission/README.md` 當新 repo 的根 README）
- `data/catalog.json`、`data/marts/README.md`、`data/marts/village_indicators.*`、`data/marts/village_rankings.*`
- `research/`，但排除 `research/issue-06/solutions/prototype/data/`
- 不含：`data/marts/building_points*`、`data/marts/shards/`、`workspace/`、`data/raw/`、`data/staged/`
- 門牌分片公開版 `data/marts/shards_public/` 不進 repo，由建置步驟產生後直接放上 gh-pages

## 步驟

1. 你選 A 或 B，決定 repo 名稱與帳號。
2. （B）整合者寫匯出程式，依白名單產生公開 repo 的內容，並檢查沒有內部欄位。
3. 你建 repo，或授權 Claude 用 `gh` 建。
4. push；設定 GitHub Pages。

## 完成條件

- 公開 repo 與 GitHub Pages 都打得開。
- 公開 repo 的歷史與檔案都不含上表的內部資料（整合者用程式掃描確認）。
- 隊友能 clone，並能用 `pipelines/fetch/fetch_raw.py` 重抓資料。

## 紀錄

- 2026-10-17：建立任務。你說等本機準備好再談。
- 2026-10-18：記錄 `0fa4aab` 的大檔。
- 2026-10-18：debug-40 回報原型分片曾進 git。整合者掃描歷史，發現 `building_points.parquet` 也是內部資料且仍在追蹤。結論：本機 repo 不能直接公開，提出方案 A、B。
- 2026-10-18：使用者選「先不決定」，等產品做好、接近交件再決定。協調者 debug-40 支持方案 B。在決定之前，**不要把本機 repo 推上任何公開的地方**。
