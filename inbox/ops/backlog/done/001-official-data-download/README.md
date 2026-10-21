# 001 下載 7 題官方資料

- 負責：Claude
- 為什麼：先掌握官方給的所有資料，避免之後換題要重找。

## 完成條件

- 活動頁列出的每個來源都登記在 `data/catalog.json`。
- 能下載的都下載到 `data/raw/<組>/<slug>/`，並寫好 `_manifest.json`。
- 每題的實測結果寫進 `docs/issues/`。

## 紀錄

- 2026-10-17：catalog 登記 33 筆。用 `pipelines/fetch/fetch_raw.py` 下載完成，約 850 MB。無法用程式下載的 5 筆列在 `README.md` 的「要人工處理的資料」。
