# #7 自由題：你看見的市政 bug

- 官方標籤：自選
- 來源：https://puma.taipei/hackathon#issues （2026-10-17 抓取）

## 官方原文

> 你也可以自己找題目。以下是政策組的備選方向和起手資料：

## 官方列出的備選方向與資料

| 官方備選方向 | 官方資料標題 | 官方標示 | catalog slug |
|---|---|---|---|
| 颱風、豪雨、淹水預警 | 雨量站即時資料 | data.taipei · API | `rain-gauges-realtime` |
| 淹水預警 | 雨水下水道水位監測站 | data.taipei · CSV | `storm-sewer-water-level-stations` |
| 捷運總體檢 | 各站分時進出量 | data.taipei · CSV | `metro-station-hourly-od` |
| 幼兒園不適任人員查核透明化 | 教育局專區 | 教育局 | `doe-kindergarten-staff-check` |
| （不限方向） | 臺北市資料大平臺（全部資料集） | data.taipei | `data-taipei-portal` |

## 官方標示的資料缺口

官方頁面在本題沒有標示資料缺口。

## 資料實測紀錄

2026-10-17 用 `pipelines/fetch/fetch_raw.py` 下載後逐檔檢查。全部【實測】。

| slug | 實際內容 | 筆數 | 位置欄位 |
|---|---|---|---|
| `rain-gauges-realtime` | 雨量即時 API，**只是一個時間點的快照**（2026-10-17 13:30） | 42 站 | 只有站號、站名 |
| `storm-sewer-water-level-stations` | 水位監測站清單，沒有水位數值 | 233 站 | 經緯度、行政區 |
| `metro-station-hourly-od` | 見第 2 題的說明 | — | 站名 |
| `doe-kindergarten-staff-check` | 只存了教育局查核專區網頁 | — | — |

注意事項：

1. 雨量 API 的網址帶有官方 metadata 公開的 `dataKey`。這把 key 是官方公開的，不是我們的憑證。
2. 水位監測站這份只有站點位置，沒有水位讀數。
