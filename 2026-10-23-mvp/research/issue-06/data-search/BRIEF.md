# 三個政府網站再搜一次：第 6 題還有沒有可用的資料或程式（2026-10-23 19:15）

統籌：debug-c1。回報對象同。

## 為什麼

使用者問：data.taipei、data.gov.tw、code.gov.tw 我們都找過了嗎？`data/catalog.json` 有 39 筆來源（data.taipei 19、data.gov.tw 10、code.gov.tw 0），但有不少是其他題目的。第 6 題是否搜齊，沒有人逐站確認過。

## 分工

| session | 網站 | 找什麼 |
|---|---|---|
| b9 | <https://data.taipei> | 臺北市的資料集 |
| debug-42 [3a734b] | <https://data.gov.tw> | 中央與他縣市的資料集（臺北能用的、或可當對照的） |
| debug-c2 | <https://code.gov.tw> | 政府開源程式碼：可以直接用或參考的程式 |

## 先讀（知道我們已經有什麼）

1. `docs/issues/06-seismic-old-buildings.md`：題目。
2. `data/catalog.json`、`data/raw/extra/_sources.csv`、`docs/extra-data.md`：已登記與已下載的來源。
3. `research/issue-06/mvp-variants/README.md`：六個原型各要什麼資料。
4. `research/issue-06/peer-analysis/2026-10-23-etblue-issue-analysis.md`：別隊用了哪些資料。

## 搜尋的方向

關鍵字至少涵蓋：耐震、老屋、危老、都更、海砂屋、建照、使照、門牌、建物、樓層、構造、屋齡、土壤液化、斷層、消防、救災、窄巷、避難、高齡、獨居、身障、里、容積、公寓大廈、管委會、補強、補助、地籍、實價登錄。code.gov.tw 另外找：地址比對、門牌、GIS、地圖、建管、耐震評估、都更試算。

## 紀律（不能破）

- 一次一個請求，間隔 4 秒以上；非 200 就停，回報。整輪最多 80 個請求。
- 優先用網站的搜尋 API 或資料集詮釋資料（metadata），不要爬整站。
- 這一輪**只看詮釋資料，不下載資料檔**。單一樣本檔小於 5 MB 才可以抓來看欄位，放 `workspace/scratch/`（不進 git）。
- 不登入、不填表、不碰需要申請的資料。
- 不要改 `data/catalog.json`（只有 debug-83 改）。不要 commit。

## 產出

`research/issue-06/data-search/2026-10-23-<網站>.md`（`data-taipei`、`data-gov-tw`、`code-gov-tw`）。

1. 一張表，一列一筆候選：

   | 名稱 | 網址 | 提供機關 | 授權 | 格式 | 更新頻率／最後更新 | 粒度（棟／點／里／區） | 對哪個原型或 Day 2 哪一頁有用 | 我們有沒有（catalog slug 或「無」） | 建議（主用／備用／不用）與理由 |

2. 搜了哪些關鍵字、各得幾筆、請求總數（【實測】附時間）。
3. 最後一段「最該補的 3 筆」：為什麼、補了改哪個畫面、要花多久。

code.gov.tw 的表把「格式」改成「語言」、「粒度」改成「授權與最後提交日」。

## 回報

完成後 SendMessage 給 debug-c1 一行：路徑＋「候選 N 筆，其中我們沒有的 M 筆，最該補：…」。卡住 20 分鐘也回報。
