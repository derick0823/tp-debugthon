# 導覽：inbox 裡有什麼

- 寫給：隊上的工程師，以及想快速看懂研究組產出的隊友。
- 寫的人：研究組的協調者 session（AI），2026-10-22。
- 讀完約 5 分鐘。細節都用路徑指過去，不重複。
- **這些是參考資料，不是隊伍的計畫。**要用哪些、怎麼用，由隊伍決定。

## 1. 這個資料夾怎麼來的

1. 研究組在另一個私有 repo 做研究。`inbox/` 是用 `ops/export_public_repo.py` 依白名單匯出的版本。
2. 匯出只放兩類東西：可以轉載的開放資料，以及沒有內部欄位的成品表。內部逐棟表與內網資訊不會出來。
3. 下一次匯出會整份覆蓋 `inbox/`，但不會動 `inbox/` 以外的任何檔案。要改哪個檔，請複製到 `inbox/` 外面再改。

## 2. 資料

索引在 `data/DATASETS.md`。最常用的是 `data/marts/` 的 3 種成品表：

| 檔案 | 內容 |
|---|---|
| `village_indicators.*` | 456 里 × 指標。欄位字典在 `data/marts/README.md` |
| `village_rankings.*` | 456 里的五因子分級與排名區間 |
| `shards_public/<區碼>.json` | 逐門牌分片，一區一片，共 12 片。格式 `{"town_code", "town_name", "generated", "records": [...]}`，欄位清單在 `index.json` 的 `fields` |

`data/staged/` 與 `data/raw/` 是重算成品表用的。

## 3. 研究組的共識決定

下面是研究組四個 session 討論後的決定（`research/issue-06/solutions/BOARD.md` 的「決定」表）。它們是研究組對公開網站的建議做法，附理由；隊伍可以照用，也可以另作決定。其中授權與已知案件兩項，牽涉資料能不能公開，改之前請先看 `docs/data-licenses.md`。

| 編號 | 決定 | 理由（摘要） |
|---|---|---|
| BD16 | 公開版純靜態：無後端、無帳號、不存查詢紀錄、地址不進網址；地址比對在瀏覽器內做 | 公務員提醒的資安與個資顧慮；靜態網站沒有可外洩的查詢紀錄 |
| BD10 | 海砂屋、黃單只在輸入的地址精確比對到時顯示，附清冊原文地址、版本、官方連結；不做可瀏覽的圖層或清單 | 避免汙名化與錯標 |
| BD9 | 液化預設城市 2019 版；全國 2026 版只在里層級當對照 | 全國 2026 版沒有標示授權 |
| — | 不加追蹤或分析工具 | 同 BD16 |
| — | 用到的資料都標出處 | 政府資料開放授權條款的義務。格式見 `data/DATASETS.md` 第 5 節 |

## 4. 原型畫面

位置：`research/issue-06/solutions/prototype/`。純靜態 HTML＋CSS＋原生 JavaScript，地圖用 Leaflet。規格在 `SPEC.md`，說明在 `README.md`。

| 頁 | 給誰 |
|---|---|
| `index.html` | 市民：輸入地址，看這棟與這個里的風險卡 |
| `city.html` | 市府：456 里地圖、權重滑桿、排名區間、四張清單 |
| `brief.html` | 承辦人：一頁里況與可貼進府函的段落 |

原型在 `inbox/` 裡跑不起來。原因：原型讀的 `prototype/data/` 是內部版，沒有匯出；產生它的 `scripts/build_prototype_data.py` 要讀內部逐棟表，這裡也沒有。

如果要拿原型改成公開版，已知的差異有 4 點：

1. 逐棟資料要改讀 `shards_public/`。原型用欄陣列（`columns`＋`items`），公開版用 `records`。公開版少 8 個欄位：`addr_norm`、`doorplate_units`、`on_main_road`、`status_structure`、`lvr_building_type`、`no_elevator_30plus`、`liq_level_national2026`、`liq_agreement`。
2. `assets/citizen.js` 的逐棟卡有「全國 2026 版」與兩版一致度兩格，公開版沒有這兩個欄位。
3. 底圖與字體要確認能連外（原型 README「已知限制」）。
4. repo 轉公開之前，要拿掉內網 VM 的位址與路徑。目前出現在 6 個檔、13 處：`prototype/README.md`、`solutions/README.md`、`BOARD.md`、`proposals/2026-10-18-proposal.md`、`decisions/2026-10-18-focus-draft.md`、`surveys/k7-open-source-tools.md`。

## 5. 時程（活動規則）

| 時間 | 事項 |
|---|---|
| 10/23（五）19:00 | Day 1，Discord 線上提案 |
| 10/23 之後 | 規則是「Day 1 起可開始討論與寫程式」。研究組的解讀是賽前只做資料層與原型，這點待 Day 1 向主辦確認（`docs/event.md` 第 2 部分） |
| 10/24（六）16:00 | 交件：作品名稱、作品網址，可另附程式碼網址 |

## 6. 想多了解時讀這 4 份

1. `research/issue-06/solutions/briefs/2026-10-18-gdoc-export.md`：給隊友的總覽（共筆貼稿）。
2. `research/issue-06/solutions/decisions/2026-10-18-consensus.md`：研究組為什麼這樣建議。
3. `research/issue-06/solutions/proposals/2026-10-18-proposal.md`：方案書。
4. `docs/submission/README.md`：研究組起草的作品說明。
