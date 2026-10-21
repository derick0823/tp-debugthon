# 003 確認衛生局夜市專區的新網址

- 負責：你
- 為什麼：第 3 題官方列的「臺北市食材登錄平台：夜市專區」舊網址壞了，新網址從 Claude 這邊連不上。

## 現況

- 官方頁列的舊網址：https://foodtracer.taipei.gov.tw/Front/Nightmarket 。SSL 憑證和網域不符。
- 你找到的新網址：https://foodtracer.health.gov.taipei/?aspxerrorpath=/Front/Nightmarket
- 2026-10-17 Claude 從本機連新網址：第一次回 200（只有 668 bytes），之後伺服器直接斷線，Chrome 也顯示錯誤頁。
- 網址裡的 `aspxerrorpath` 表示舊路徑在新網站上找不到，被導到錯誤處理頁【推論】。所以夜市專區在新網站上可能換了路徑。

## 步驟

1. 用你的瀏覽器打開新網站首頁 https://foodtracer.health.gov.taipei/ 。
2. 找「夜市」相關的選單或頁面。
3. 找到的話，把那一頁的網址貼給 Claude，或把網址和截圖丟進 `workspace/inbox/`。
4. 找不到的話，也告訴 Claude。這本身就是一個發現：官方給的資料來源失效。

## 完成條件

- 知道夜市專區現在的網址，或確認它已經不存在。
- Claude 更新 `data/catalog.json` 和 `docs/issues/03-rats.md`。

## 紀錄

- 2026-10-17：建立任務。
