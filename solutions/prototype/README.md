# 第 6 題賽前設計原型

- 這是設計原型，給隊伍與決策者看畫面、核數字、排 Demo 腳本。不是交件的產品。產品程式依活動規則在 Day 1（10/23）之後寫到 `app/`。
- 規格：`SPEC.md`。決策依據：`../decisions/2026-10-18-consensus.md`。方案書：`../proposals/2026-10-18-proposal.md`。
- 建置：2026-10-18，協調者 debug-40 的子 agent。純靜態 HTML＋CSS＋原生 JavaScript，地圖用 Leaflet 1.9.4（`assets/vendor/`），底圖 OpenStreetMap。

## 三個頁面

| 頁 | 給誰 | 看什麼 |
|---|---|---|
| `index.html` | 市民 | 選區、輸入地址，看這棟與這個里的風險卡、下一步卡片。網址可帶 `?t=<區碼>&q=<地址>&e=1` 直接開結果 |
| `city.html` | 市府 | 456 里地圖，五因子各自分級、權重滑桿、排名區間、液化版本切換、四張清單（穩定前段、被總分藏起來、救災可及性候選、高齡化最快） |
| `brief.html?v=<里代碼>` | 承辦人 | 一頁里況說明（可列印）與府函段落（可複製）。多個里用逗號分隔 |

## 資料

`data/` 由 `scripts/build_prototype_data.py` 從 `data/marts/` 產生，每次整份重寫：

```sh
uv run python -X utf8 research/issue-06/solutions/prototype/scripts/build_prototype_data.py
```

- `data/` 底下全部**不進 git**（`ops/CONVENTIONS.md` §4a-1：原型從 `data/marts/` 讀，不另存資料快照）。跑上面的指令約 10 秒就有：`villages.geojson`（456 里，1.3 MB）、`towns.json`、`meta.json`、`buildings/<區碼>.json`（12 片，約 34 MB）。
- 列管旗標（海砂屋 147 棟、黃單 32 棟）來自 c8 的分片，只有精確門牌比對（geo_level＝1）的棟才有。
- 欄位與規則見 `data/README.md`。這是**內部版**：含逐棟全國 2026 版液化等級。公開版依 `docs/data-licenses.md` §6 要改讀 `data/marts/shards_public/` 或在腳本過濾。

## 本機看

```sh
cd research/issue-06/solutions/prototype
python -X utf8 -m http.server 8765
```

開 http://localhost:8765/ 。直接用檔案開（file://）不行，因為頁面用 fetch 讀 JSON。

## 放上內網 VM（10.30.1.10）

目前版本：http://10.30.1.10:8015/ （2026-10-18 部署，容器 `debug06-proto`，`nginx:alpine`，檔案在 `/home/localadmin/debug06-proto/site`）。

部署腳本在 `workspace/scratch/deploy_proto_vm.sh`（不進 git）。開組內 VPN 後，在 Git Bash 跑：

```sh
bash "C:/Users/abrahamdong/Documents/repos-recon/市政debug松/workspace/scratch/deploy_proto_vm.sh"
```

腳本會自己挑空的 port、用 tar 經 ssh 推檔、起 `nginx:alpine` 容器、驗三頁回 200，最後印網址。協調者的 session 沒有 ssh 權限，所以這一步要人跑。

## 已知限制

- 等權時滑桿加權的排名與 marts 的 `composite_rank` 有少數里差 1～2 名，原因是百分位並列值處理不同。右欄同時顯示兩個排名。
- 手機寬度用 375 px 的 iframe 驗過不橫捲，沒有真機截圖。
- 液化預設已是 city2019（2026-10-18 晚改，和公開版一致）；全國 2026 版可切換當對照。公開版前還要改兩處：分片改公開版、底圖與字體確認能連外。
- 不加任何追蹤或分析工具（硬規則）。
