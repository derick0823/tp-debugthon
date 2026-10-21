# 008 把非官方補充資料登記進 catalog

- 負責：Claude
- 為什麼：`data/raw/extra/` 的 34 份資料是背景 agent 手動抓的，還沒登記到 `data/catalog.json`，所以腳本不能重抓，隊友也找不到來源。

## 步驟

1. 每份資料在 `data/catalog.json` 加一筆，`official` 設為 `false`。
2. 讓 `pipelines/fetch/fetch_raw.py` 支援 `raw/extra/` 的路徑。
3. 把混在 raw 資料夾裡的衍生檔（`*.parsed.csv`、`*.flat.csv`、`*.utf8.csv`、`extracted/`）搬到 `data/staged/`。
4. 把解析 PDF、XML 的程式從 scratchpad 收進 `pipelines/`，否則衍生檔無法重現。
5. `data/raw/extra/_sources.csv` 裡的舊路徑（`issue-06-extra\...`）更新或刪除。

6. R1 已經寫好其中 20 份的清洗程式（`pipelines/stage/`）。登記 catalog 時，slug 要和那些程式用的一致。
7. 把 `data/marts/village_indicators` 登記成 mart。
8. 海砂屋與危老的 PDF 解析程式在 `workspace/archive/2026-10/agent-scripts-issue-06-extra/`，要收進 `pipelines/fetch/` 或 `pipelines/stage/`。海砂屋解析有「一」變成「㇐」的錯誤，收進來時一起修。
   - ✅ 危老：2026-10-18 c8 收進 `pipelines/stage/stage_dangerous_old_building_cases.py`（commit 613dbe5），封存區的 `parse_weilao.py` 已被取代。
   - ⬜ 海砂屋：還沒收。

9. 危老核准清冊有兩版 PDF（1,059 案、1,088 案），見 `docs/extra-data.md`。收解析程式時要能處理兩版，catalog 要能記版本。來源頁會換檔案網址，抓取要從來源頁找「核准案件一覽表」的連結，不要寫死檔案網址。

10. 新來源 `lvr-history`（實價登錄 52 季，`pipelines/fetch/fetch_lvr_history.py`）也要登記。

## 完成條件

- 刪掉 `data/raw/extra/` 後，跑腳本能完整重建。

## 紀錄

- 2026-10-17：建立任務。資料說明見 `docs/extra-data.md`。
