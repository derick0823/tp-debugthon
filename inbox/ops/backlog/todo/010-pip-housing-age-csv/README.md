# 010 下載內政部的各區平均屋齡（可選）

- 負責：你
- 急不急：不急，可選。已經有稅捐處的各區屋齡（30 年分界），這份只是補「平均屋齡」。
- 為什麼：下載要靠網頁上的 JavaScript 表單，程式模擬兩次都失敗。

## 步驟

1. 用瀏覽器開 https://pip.moi.gov.tw/Publicize/Info/E3030
2. 點「供給」→「房屋稅籍住宅類數量」→ 按 CSV 下載。
3. 同一頁再找「房屋稅籍住宅類平均屋齡」，也按 CSV 下載。
4. 兩個檔丟進 `workspace/inbox/`，Claude 再搬到 `data/raw/extra/housing-stats/`。

## 完成條件

- 兩個 CSV 在 `workspace/inbox/` 或已歸位。

## 紀錄

- 2026-10-17：建立任務。
