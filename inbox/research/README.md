# 研究任務索引

規則見 `ops/CONVENTIONS.md`。本檔只由整合者（debug-83）更新。

## 第 6 題：先看這三份

| 想知道什麼 | 看哪份 | 誰維護 |
|---|---|---|
| **現在誰在做什麼、卡在哪**（即時狀態） | [issue-06/solutions/BOARD.md](issue-06/solutions/BOARD.md) | 協調者 debug-40 |
| 痛點、假設、解法方向，以及研究驗證後的結論 | [issue-06/PLAN.md](issue-06/PLAN.md) | 整合者 debug-83 |
| 想過的所有議題：聚焦哪些、保留哪些、不做哪些 | [issue-06/IDEAS.md](issue-06/IDEAS.md) | 整合者 debug-83（依協調者的決定） |

## 角色

| session | 角色 |
|---|---|
| debug-83 `[6b8364]` | 整合者：共用檔、架構、把決定落地成正本 |
| debug-40 `[5203fd]` | 協調者：拆解問題、做判斷、維護任務板、做方案。協定見 [issue-06/solutions/README.md](issue-06/solutions/README.md) |
| 現況研究 c8 `[86c407]` | 研究者：資料分析 |
| 國際debug-38 `[c2d1cd]` | 研究者：國外案例 |
| debug-aa `[04db5b]` | 研究者：臺灣政府報告、市府流程 |

## 研究任務

狀態以任務板為準。這裡只列任務在哪裡。

| 編號 | 任務 | 負責 | 位置 |
|---|---|---|---|
| R1 | 用手上資料找規律、建里層級共用表 | 現況研究 c8 | [data-patterns/](issue-06/data-patterns/)：[report.md](issue-06/data-patterns/report.md)；共用表 `data/marts/village_indicators.csv` |
| R2 | 世界各國的做法（12 國 30 案） | 國際debug-38 | [world-practices/](issue-06/world-practices/)：[report.md](issue-06/world-practices/report.md)；[網頁版](https://claude.ai/artifact/SncLqJJaVAaYs2e3aPsPYW) |
| R3 | 臺灣政府與學界的研究報告（58 份） | debug-aa | [gov-reports/](issue-06/gov-reports/)：[report.md](issue-06/gov-reports/report.md)、[shortlist.md](issue-06/gov-reports/shortlist.md)；過程見 [ops/backlog/done/011](../ops/backlog/done/011-grb-research-reports/README.md) |
| R4 | 都發局的作業流程、資訊流、承辦人負擔；建商誘因、文書信任成本 | 主責 debug-aa。臺灣側 debug-aa、國外側 debug-38、資料側 c8 | [city-workflow/](issue-06/city-workflow/README.md)：[report.md](issue-06/city-workflow/report.md)（綜整，2026-10-18 完成）、`n1-parameters.md`（法規參數表） |
| C1～C4 | 臺灣法規、評估方法、既有作品、屋齡推估 | ~~Codex~~ | **2026-10-18 使用者決定不跑 Codex。** C1、C2 已由 R3 補上；C3（既有作品）、C4（屋齡推估方法）由協調者的 K5、K6 接手。prompt 保留在 [codex/prompts/](issue-06/codex/prompts/) |

## 協調者的調查

協調者 debug-40 用子 agent 做，審過才 commit。

| 編號 | 主題 | 位置 |
|---|---|---|
| K5 | 臺灣既有的同類作品（原 Codex C3） | [solutions/surveys/k5-prior-work-taiwan.md](issue-06/solutions/surveys/k5-prior-work-taiwan.md) |
| K6 | 屋齡推估方法（原 Codex C4） | [solutions/surveys/k6-building-age-methods.md](issue-06/solutions/surveys/k6-building-age-methods.md) |
| K7 | 可用的開源工具 | [solutions/surveys/k7-open-source-tools.md](issue-06/solutions/surveys/k7-open-source-tools.md) |
| K8 | 部署到 VM 的路徑 | 見任務板。內含內網主機與帳號資訊，放在 `workspace/notes/`，不進 repo |

## 編號對照

不同檔案各有自己的編號，引用時要帶檔名，不要混用。

| 編號 | 意思 | 在哪份檔 |
|---|---|---|
| P1～P7 | 痛點（**只在 PLAN 用**，議題庫不用 P 開頭） | `PLAN.md` 第 2 節 |
| F1～F5 | 使用者 10/18 轉述的訪談補充 | `issue-06/solutions/briefs/user-2026-10-18-interview-addendum.md` |
| H1～H7 | 資料規律假設 | `PLAN.md` 第 3 節 |
| S1～S5 | 解法方向 | `PLAN.md` 第 4 節 |
| R1～R4 | 研究任務 | 本檔 |
| A～E 開頭（A1、D3…） | 議題 | `IDEAS.md` |
| BD1～BD7 | 協調者的決定 | `solutions/BOARD.md` |
| K1～K8 | 協調者的工作 | `solutions/BOARD.md` |
| N1～N5 | 使用者提的參數 | `IDEAS.md` 的 D6、D3、D7、D12、A9 |
| U1～U6 | 使用者 10/18 的指示 | 整合者給協調者的訊息 |

## 決策流程

使用者要「四個 AI 有共識，並說明原因」。流程：

1. 協調者 debug-40 在 10/19 22:00 前，把決策草案放在 [issue-06/solutions/decisions/](issue-06/solutions/decisions/)。
2. 四個 session 各自回覆「同意」或「異議＋理由」。
3. 協調者寫成決策紀錄。
4. 整合者把結果落地到 `IDEAS.md` 與 `PLAN.md`。

## 參考資源

- 建研所報告：`data/raw/extra/research/abri/abri_list.csv` 有 2,859 筆，都有不需驗證碼的 PDF 連結。
- 已下載的 58 份報告全文：`data/raw/extra/research/fulltext/`，對照表 `MANIFEST.csv`。
