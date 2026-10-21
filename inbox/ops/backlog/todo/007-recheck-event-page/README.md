# 007 開賽前重抓活動頁並比對

- 負責：Claude
- 期限：2026-10-23（五）19:00 Day 1 開場前
- 為什麼：`docs/event.md` 的規則原文是 2026-10-17 抓的。官方頁可能在開賽前修改規則、題目或資料清單。

## 步驟

1. 跑 `uv run python -X utf8 -m pipelines.fetch.fetch_raw event-hackathon-page`，抓新版頁面。
2. 和 2026-10-17 的版本比對文字差異。
3. 有差異就更新 `docs/event.md`、`docs/issues/`、`data/catalog.json`，並在這裡記下改了什麼。
4. 順便確認「市長，你給我聽好了」資料有沒有釋出（任務 005）。

## 完成條件

- 比對完成，差異已更新到文件。

## 紀錄

- 2026-10-17：建立任務。
