# #1 把三千棵樹種回來

- 官方標籤：環境、樹蔭公平 Shade Equity、GIS
- 來源：https://puma.taipei/hackathon#issues （2026-10-17 抓取）

## 官方原文

> 2025 年台北有 3,164 棵樹被移除。市府說明多為病蟲害或自然死亡，但東門市場附近一棵約 40 年、原本計畫移植保留的茄苳樹，卻遭到「誤砍」。台北一年移除三千棵樹，我們要如何找出城市空間把樹種回來，達到樹蔭公平？可參考新加坡「見縫插樹」。

## 官方列出的資料

| 官方標題 | 官方標示 | catalog slug |
|---|---|---|
| 臺北市行道樹及公園樹木分布圖 | data.gov.tw · CSV/JSON | `street-park-trees` |
| 臺北市人行道固定設施物＿樹穴 | data.gov.tw | `sidewalk-tree-pits` |
| 臺北市人行道範圍圖 | data.taipei · JSON | `sidewalk-area` |
| 臺北市公園基本資料 | data.taipei · JSON | `parks` |
| 臺北市行道樹路燈資訊網（含移樹履歷查詢） | 公園處 | `tree-lamp-portal` |

## 官方標示的資料缺口

> 逐年移除紀錄與原因未完整開放 → 可用模擬資料

## 資料實測紀錄

2026-10-17 用 `pipelines/fetch/fetch_raw.py` 下載後逐檔檢查。全部【實測】。座標系 EPSG:3826 就是 TWD97 TM2。

| slug | 實際內容 | 筆數 | 位置欄位 |
|---|---|---|---|
| `street-park-trees` | 3 個 CSV：行道樹、公園樹木、樹穴 | 行道樹 90,395；公園樹木 72,011；樹穴 2,260 | TWD97X／Y |
| `sidewalk-tree-pits` | GeoJSON，樹穴與花圃的面 | 56,720 | 多邊形，EPSG:3826 |
| `sidewalk-area` | GeoJSON，人行道的面，含長度與寬度 | 15,053 | 多邊形，EPSG:3826；`Town_N` 是 8 碼區代碼 |
| `parks` | JSON，公園清單與介紹 | 813 | 經緯度 |
| `tree-lamp-portal` | 只存了網站首頁 | — | — |

注意事項：

1. 行道樹有 `SurveyDate`（調查日期）欄位，沒有移除日期或移除原因。這和官方標示的缺口一致。
2. data.gov.tw 這份資料同時提供 XML、JSON、CSV 三種格式。我們只下載 CSV。
