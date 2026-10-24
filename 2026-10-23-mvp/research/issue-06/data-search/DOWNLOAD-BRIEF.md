# 下載今晚找到的候選資料（2026-10-23 19:35）

統籌：debug-c1。使用者同意今晚先下載（明天現場網路會塞），要標註清楚。

## 誰載什麼

| session | 清單 | 下載範圍 |
|---|---|---|
| b9 | `2026-10-23-data-taipei.md` | 建議欄是「主用」「備用」的全部 |
| debug-42 [3a734b] | `2026-10-23-data-gov-tw.md` | 同上；全國檔若有分縣市版，只載臺北與全國彙總 |
| debug-c2 | `2026-10-23-code-gov-tw.md` | D 開頭的資料中「主用」「備用」的全部，**含 D1 屋齡 30 年以上建物面（55 MB）**；程式（P 開頭）不 clone |

三份清單有重複的資料集（例如避難收容處所），先 `grep` 另外兩份；重複的由 data.taipei 版優先（b9），其次 data.gov.tw（debug-42）。

## 放哪裡

`data/raw/extra/<組>/<slug>/`（不進 git，`ops/CONVENTIONS.md` §1）。

- 組：沿用既有的 `base`、`hazard`、`housing-stats`、`land`、`permits`、`renewal`、`building-hazard`；收容、消防栓放 `hazard`。
- slug：全小寫英文 kebab，看名字就知道是什麼，例如 `shelters-taipei-edu`、`fire-hydrants-taipei-water`、`building-committees-taipei`。
- 原檔名保留；壓縮檔照樣存，不必解壓。

## 標註（每個資料夾一份 `_manifest.json`）

```json
{
  "slug": "shelters-taipei-edu",
  "title": "臺北市可供避難收容處所一覽表",
  "agency": "臺北市政府教育局",
  "dataset_page": "https://data.taipei/dataset/detail?id=...",
  "license": "政府資料開放授權條款-第1版",
  "license_status": "已查（詮釋資料頁）",
  "source_status": "官方",
  "fetched_by": "b9",
  "files": [
    {"url": "...", "fetched_at": "2026-10-23T19:40:00+08:00", "http_code": 200,
     "saved_as": "xxx.csv", "bytes": 88000, "sha256": "..."}
  ],
  "note": "用途：rescue-drill-map 檢核表；欄位：…"
}
```

- 授權或來源沒查清楚，就寫 `"license_status": "待確認"`、`"source_status": "待確認"`，並在 `note` 寫已知的事。D1 要寫：「出自 Taipei-City-Dashboard repo（AGPL-3），資料來源與授權待確認；只供交叉比對，不進產品」。
- 含個資的欄位（人名、電話）：照樣存原檔，但 `note` 寫「含○○欄，不得進產品與 git」。

## 紀律

- 一次一個請求，間隔 4 秒以上，不平行。
- 非 200：轉址（301、302）到同一機關或同一儲存主機可以跟隨，`note` 記一筆；其他非 200，那一筆跳過並記下，同一主機連續 2 次非 200 就整個停，回報。
- 單檔上限 500 MB；每人合計上限 2 GB；請求上限 150。
- 不登入、不用 API Key、不填申請表。需要申請的資料只記在報告裡，不載。
- 不改 `data/catalog.json` 與 `data/raw/extra/_sources.csv`（統籌最後統一合併）。不 commit。

## 交件

1. 在你的清單檔最後加一節「已下載（2026-10-23）」，一列一筆：`slug | 路徑 | 檔數 | 大小 | 授權狀態 | 備註`，另附一份可以直接貼進 `_sources.csv` 的列（欄位：`dir,title,dataset_page,direct_url,retrieved,license`）。
2. SendMessage 給 debug-c1 一行：「載了 N 筆、共 X MB、跳過 M 筆（原因）」。
