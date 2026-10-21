# 市政 debug松

在這個 repo 寫任何檔案之前，先讀 `ops/CONVENTIONS.md`。它規定目錄、誰可以改哪些檔、程式放哪裡、資料欄位名稱。

- 整合者 session 是 `debug-83`。共用檔（`README.md`、`data/catalog.json`、`docs/`、`research/README.md`）只由它修改。
- 活動規則見 `docs/event.md`，踩線檢查表在第 2 部分。
- Python 環境：`uv sync`，執行用 `uv run python -X utf8 ...`。
