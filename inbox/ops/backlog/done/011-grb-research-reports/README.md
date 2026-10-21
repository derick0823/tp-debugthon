# 011 下載第 6 題相關的政府研究報告（GRB＋建研所）

- 負責：Claude 抓書目與排序；你挑報告、輸入驗證碼下載。
- 急不急：黑客松前要讀完一批，10-20 前完成第一批下載。
- 為什麼：資料已經有了，缺的是「政府和學界已經做過什麼」。範圍包含耐震評估方法、臺北在地研究、法規、國外做法。

## 來源

1. **GRB 政府研究資訊系統**（https://www.grb.gov.tw）：書目與摘要用程式抓。全文下載前有驗證碼，由人手動下載。程式不解驗證碼。
2. **內政部建築研究所「研究成果」**（https://www.abri.gov.tw/News.aspx?n=807&sms=9489）：2,859 筆，每筆有直接的 PDF 連結，沒有驗證碼【實測 2026-10-17】。GRB 清單上對得到建研所標題的計畫，改從這裡下載。

工作法沿用 `中企署數位生態/runbooks/2026-10-14_GRB政府研究資訊系統取用工作法.md`。

## 檔案

| 是什麼 | 位置 |
|---|---|
| 關鍵字表（61 個詞，分 A～G 組） | `data/manual/grb_keywords.csv` |
| GRB 書目抓取 | `pipelines/fetch/fetch_grb.py` → `data/raw/extra/research/grb/` |
| 建研所標題清單 | `pipelines/fetch/fetch_abri_list.py` → `data/raw/extra/research/abri/abri_list.csv` |
| 排序清單 | `pipelines/stage/stage_grb_list.py` → `data/staged/grb/grb_list.xlsx` |
| 人工勾選（重跑不會蓋掉） | `data/manual/grb_picks.csv` |
| 讀完後的研究結論 | `research/issue-06/gov-reports/report.md` |
| 全文（不進 git） | `data/raw/extra/research/grb/fulltext/`（還沒建） |

## 步驟

1. ✅ 探關鍵字筆數，選定 61 個詞。
2. ✅ 抓建研所標題清單。
3. ✅ 抓 GRB 書目與明細（5,237 個計畫）。
4. ✅ 做排序清單，給你看總量。
5. ✅ 勾選 58 份。
6. ✅ 建研所 33 份程式下載；GRB 25 份使用者輸入驗證碼下載。
7. ✅ 歸檔、改檔名、核對檔數與重複檔。
8. ✅ 讀報告，寫 `research/issue-06/gov-reports/report.md`。

## 之後的延伸（這一輪不做）

- 研究者自己的資料：從清單的「計畫主持人」找常出現的人，再查他們的論文、實驗室網站、公開資料。

## 完成條件

- 第一批報告已下載並歸檔，檔數和清單一致。

## 紀錄

- 2026-10-17：建立任務。關鍵字探測、建研所清單完成，GRB 明細抓取中。
- 2026-10-17：依 `ops/CONVENTIONS.md` 把程式搬到 `pipelines/fetch/`、`pipelines/stage/`，關鍵字表搬到 `data/manual/`。
- 2026-10-17 15:28：GRB 明細抓完，5,237 / 5,237，0 筆遺漏（1 筆第一次失敗，重跑補上）。有全文 4,136 筆。排序改成以標題為主（第一版用摘要標籤計分，智慧建築、BIM 排到前面）。分數 ≥10 有 305 筆，其中 69 筆對得到建研所。等使用者看清單。
- 2026-10-17：使用者選「Claude 分主題精選」＋「建研所的先下載」。精選 34 份（7 個主題）＋建研所批次 24 份，共 58 份：33 份走建研所、25 份（26 個檔）要在 GRB 輸入驗證碼。勾選寫在 `data/manual/grb_picks.csv`，給人讀的版本在 `research/issue-06/gov-reports/shortlist.md`。新增 `pipelines/fetch/fetch_abri_pdfs.py`（先列連結，`--download` 才下載）。等使用者確認後下載。
- 2026-10-18：使用者確認。建研所 33 份背景下載中。GRB 25 份的詳目頁已在 Chrome 開成 25 個分頁，依主題排序；808012 有「全文下載2」。使用者回來後輸入驗證碼。下載前 `~/Downloads` 已有 3 個舊的 `RRPG108*.pdf`，歸檔時排除。
- 2026-10-18：建研所 33 份下載完成，0 失敗，0 重複，0.31 GB，在 `data/raw/extra/research/fulltext/`（`MANIFEST.csv` 有對照）。前 3 頁標題核對：28 份通過；5 份人工看過都不是掛錯檔。其中 12876653 字型編碼壞掉、12111457 是掃描檔，文字抽不出來，讀之前要轉圖或 OCR。已填進 `grb_picks.csv` 的「已下載」與「備註」。
- 2026-10-18：使用者在 GRB 下載完 26 個檔（25 個計畫）。新增 `pipelines/fetch/file_grb_fulltext.py`，依計畫系統編號（`RR` 開頭的檔）或國科會計畫編號（數字開頭的檔）對回計畫，26 / 26 全對上，已從 `~/Downloads` 搬到 `fulltext/`。58 份全部到齊，59 個檔，0 重複，0.45 GB。抽不出可用文字的 14 份：GRB 掃描 6、GRB 字型亂碼 6、建研所 2，讀的時候改用整頁轉圖。下一步：讀報告，寫 `research/issue-06/gov-reports/report.md`。
- 2026-10-18：58 份由 4 個背景 agent 讀完，每份有筆記卡（`research/issue-06/gov-reports/notes/`）。R3 報告完成：`research/issue-06/gov-reports/report.md`。抽查 4 個關鍵數字都找得到原文。任務完成，搬到 `done/`。
