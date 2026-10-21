# 第 6 題任務板

- 只有協調者 `debug-40` 改這份。研究者要更新，用 `SendMessage` 傳給 `debug-40`。
- 狀態：✅ 完成、🟡 進行中、⚪ 待做、🔴 缺口或卡住、📦 保留（想過，不聚焦）。
- 「輪到誰」就是現在該動的人。寫 `使用者` 的，要等使用者回來。
- 更新：2026-10-18 下午。方向共識成立（`decisions/2026-10-18-consensus.md`）。研究任務全部完成（R1～R4、R4-SI、G1～G3、K5～K9）。原型第一版已 commit，第二輪修正中。原型已上 VM（10.30.1.10:8015）。使用者 10/18 晚補五件訪談事實（文資、薪水、12 區各 1 承辦、外包前線 10 分鐘規則、每人約 100 案），派出 R4-ADD、R1d、R2c。等使用者的事：GitHub 決定（延後）、13 份 GRB 驗證碰。

## 編號對照

| 前綴 | 意思 | 正本 |
|---|---|---|
| R1～R4 | 研究任務。R4＝city-workflow（使用者 10/18 交代） | `research/README.md` |
| N1～N5 | 使用者 10/18 提的新參數：N1 法規限制當參數、N2 建商誘因、N3 文書往返的信任成本、N4 文資保存（訪談 F1）、N5 資訊安全（另一位公務員提醒） | `data-patterns/2026-10-18-user-ideas-relay.md`、`solutions/briefs/user-2026-10-18-interview-addendum.md` |
| U1～U6 | 使用者 10/18 給整合者的指示 | `briefs/debug-83-2026-10-18.md` |
| K | 協調者自己的任務 | 本檔 |
| BD | 協調者的決定（和 `IDEAS.md` 的 D 編號無關） | 本檔、`decisions/` |

## 研究任務

| 編號 | 任務 | 負責 | 狀態 | 輪到誰 | 等什麼 | 期限 | 產出 |
|---|---|---|---|---|---|---|---|
| R1 | 驗證 H1～H7，建里層級共用表 | c8 | ✅ 10/17 | — | — | — | `data-patterns/report.md`、`data/marts/village_indicators.csv` |
| R1b | 產品資料層：逐棟表、S1 五因子排名＋隨機權重排名區間、S5 候選清單 | c8 | ✅ 10/18（commit 0fa4aab） | — | — | — | `data/marts/building_points.*`（209,350 棟，status＋undetermined_reason、規範世代 g1～g6、構造、兩版液化一致度、海砂屋、黃單、軟弱層候選 A 1,109／B 2,792）；`data/marts/village_rankings.*`（5 因子 5 級＋排名區間：城市版只有 5 個里在 ≥90% 抽樣進前 46，72 個里被等權總分藏起來）；S5 候選 37 里附 s5_reason。欄位字典 `data/marts/README.md`【實測】 |
| R1c | 實價登錄歷史季檔，52 季 404 MB（臺北從 101S4 起） | c8 | ✅ 10/18 | — | — | — | `data/marts/building_points.{parquet,csv,_lite.geojson}`。有建成年的門牌：戶數 62.7%、棟數 33.6%（70,326／209,350）【實測】。未判定多是小棟透天、老公寓，不是隨機缺漏【推論】 |
| R2 | 世界各國怎麼處理老屋耐震 | 國際debug-38 | ✅ 10/17 | — | — | — | `world-practices/report.md`，12 國 30 案 |
| R2b | 民眾申請端：老屋健檢、初評／詳評、補強與重建補助的資格、文件、金額、時程、入口 | 國際debug-38 | ✅ 10/18 | — | — | — | `world-practices/taipei-assistance/report.md`（2433867）；下一步卡片定稿 `taipei-assistance/next-step-card.md`（c4c1aa2） |
| R3 | 臺灣政府與學界研究報告，58 份 | debug-aa | ✅ 10/18 | — | — | — | `gov-reports/report.md` |
| R3b | 耐震規範斷點年表 | debug-aa | ✅ 10/18 | — | — | — | `gov-reports/report.md` §2.2 |
| R3c | 一樓軟弱層候選的定義：判準、公開欄位、來源頁碼 | debug-aa | ✅ 10/18 | c8（R1b 實作） | — | — | `gov-reports/soft-story-spec.md`（commit afb37ff） |
| R4 | city-workflow：都發局作業流程與資訊流（Q1～Q5＋N2＋N3） | debug-aa 主責 | ✅ 10/18 主體完成（c77181b）；待補 13 份 GRB（等使用者輸入驗證碼） | 使用者（驗證碼） | — | — | `city-workflow/report.md`（三側＋G1、G3、承辦人欄位、K9 綜整；§9.1 列 100 天可加的五條） |
| R4-TW | 臺灣側：Q1～Q4、N2、N3、N1 法條解讀 | debug-aa | ✅ 10/18 併入 R4 report.md | — | — | — | `city-workflow/2026-10-18-tw-rules-and-workflow.md`、`n1-parameters.md`、`2026-10-18-reply-fields.md` |
| R4-INTL | 國外側：Q1～Q4、N2、N3（民間代辦成立的前提）。Q5 📦 保留 | 國際debug-38 | ✅ 10/18（180b2bb） | — | — | — | `world-practices/city-workflow/report.md`（G3 國外側 §5.5、江東區漏斗 §7） |
| R4-DATA | 資料驗證：Q4、Q2、Q5、N1 圖層盤點 | c8 | ✅ 10/18（f0992f7） | — | — | — | `data-patterns/city-workflow-data.md`：危老有效案 85% 有建照（中位 390 天）、完工 23%；建管處陳情月約 3,250 件；見鼠非集中於工地 |
| C1～C4 | Codex | — | 🔴 結案 | — | — | — | 不跑 Codex【U1】。C1／C2 → R3b；C3 → K5；C4 → R1c＋K6 |
| G1 | 公開的副作用：房價、標籤化、法律責任 → S2 免責與措辭 | debug-aa、國際debug-38、c8 | ✅ 10/18 | — | — | — | `city-workflow/g1-disclosure-wording.md`；`world-practices/city-workflow/g1-portland.md`（主因是強迫表意）；`data-patterns/g1-price-effect.md`（2016 公開後高潛勢區相對約 −5%，不顯著，2019 後消失【實測】） |
| G2 | 資料授權與轉載表 | debug-83 | ✅ 10/18（3c6df8a） | — | — | — | `docs/data-licenses.md`（§6 公開／內部清單） |
| G3 | 屋主之間談不攏：產權整合與同意門檻 | debug-aa、國際debug-38、c8 | ✅ 10/18 | — | — | — | `city-workflow/n1-parameters.md` §2（第 13～22 列）、`2026-10-18-g3-consent-and-parking.md`：**都更條例 §7 迅行劃定可把同意門檻降到過半，市府自己能做**【實測】；`data-patterns/g3-consent-threshold.md`；R4-INTL §5.5 |
| SH | 門牌分片（BD10 修正版）＋L2 鄰棟借用 | c8 | ✅ 10/18（b4c5499） | — | — | — | `pipelines/build/build_address_shards.py`；內部版 25 欄 74 MB、公開版 23 欄 61 MB（不進 git）。L2 補 72,377 棟：有年份的棟 33.6% → 68.2%、戶 62.7% → 85.1%；L2 只給區間＋信心 low【實測】 |
| K9 | 核對市府既有圖層 | 國際debug-38 | ✅ 10/18（f53a888） | — | — | — | `city-workflow/taipei-existing-layers.md`：劃定計畫 9 項指標加權、輸出二分；沒有高齡與軟弱層；審議地圖可公開看但無下一步、無下載 |
| R4-SI | 都更、危老申請後的場勘 | debug-aa | ✅ 10/18（be293c0） | — | — | — | `city-workflow/2026-10-18-site-inspection.md`：24 個場勘驗證項目，資料有 6、部分 9、沒有 9【實測】；法規明文要到場的集中在建管端，都更審查端沒有條文【實測】；建議「場勘前預檢」當 BD13 附加用途 |
| R4-SI-INTL | 國外用資料、影像、遠端查核取代或縮短現場勘查的做法 | 國際debug-38 | ✅ 10/18（7dc68b8） | — | — | — | `world-practices/city-workflow/site-inspection-intl.md` |
| R4-ADD | 五件訪談事實查證 | debug-aa | ✅ 10/18（eafe16c） | — | — | — | `city-workflow/2026-10-18-interview-addendum-check.md`。F3 對不上：更新事業科標區承辦約 24 人（每區 2～8 人，多為聘用）。F5 部分對上：全市累計報核 1,184 件；每人在審中位數約 26、最多約 37。F4 部分對上：協助檢核服務案 712.8 萬／年；電話 10 分鐘規則無文件；都更處已發包「都市更新 QA 線上客服系統」140 萬，A6 要避開重複。F1 對上：古蹟排除危老與自劃單元；暫定古蹟 6 個月可延一次（文資法 §20）；最傷的是潛在文資。結論：減壓重點是每件案子的往返輪數，不是案件數【實測＋推論】 |
| R4-SEC | 資安與個資的法規短文：資通安全管理法分級、個資法對地址查詢與紀錯的適用、開放授權顯名 | debug-aa | 🟡 | debug-aa | — | 10/19 12:00 | `city-workflow/2026-10-18-security-and-privacy.md` |
| R1d | 文資落點＋承辦負擔核對 | c8 | ✅ 10/18（7d4c987） | — | — | — | `data-patterns/r1d-heritage-workload.md`。文資局開放資料 566 處落點（97%）；mart 新欄 `heritage_sites_n`、`near_heritage_50m`（6,388 棟）。穩定前段 5 里有 3 里含文資；S5 37 里有 24 里含文資（170 處，大稻埕最多）【實測】。都更申請 204～262 件／年 × 審 2.5～3.5 年 → 存量 510～920 案、每人 42～76 案；「100 多案」要含事業概要、變更等口徑才對得上【實測＋推論】 |
| R2c | 國外：文資建物在耐震排序裡怎麼處理；前線分流與升級規則 | 國際debug-38 | ✅ 10/18（c003d1a） | — | — | — | `world-practices/city-workflow/heritage-and-frontline-intl.md`：文資標出來另走程序、不剔除；前線轉出線畫在「能不能就這個案子下判斷」（Belfast 15 分鐘上限）；每次答覆要自動留紀錶（Haringey 教訓）；首爾 120 一次處理率 90%、標準問答 9,909 種【文件】 |

## 整合與協調

| 編號 | 任務 | 負責 | 狀態 | 輪到誰 | 等什麼 | 期限 | 產出 |
|---|---|---|---|---|---|---|---|
| INT | 共用檔、`IDEAS.md` 議題庫（聚焦／保留／不做）、PLAN 收斂版、mart 輸出契約、登記協調者、git 紀律進 CONVENTIONS | debug-83 | 🟡 5 項決定已落地 | debug-83 | K2 決策草案 | 10/21 | `research/issue-06/IDEAS.md` |
| K1 | 收四個 session 的狀態簡報 | debug-40 | ✅ 10/18 | — | — | — | `briefs/` |
| K2 | 問題拆解樹＋聚焦／保留／不做 決策草案，每項附理由 | debug-40 | ✅ 10/18 草案已發 | 四個 session | — | — | `decisions/2026-10-18-focus-draft.md` |
| K2b | 共識：四個 session 回 Q-A～Q-G，協調者寫成決策紀錄 | 四個 session | ✅ 10/18 四票齊 | debug-83（落地 IDEAS、PLAN） | — | — | `decisions/2026-10-18-consensus.md` |
| K3 | 方案文件，給使用者（投資者視角） | debug-40 | ✅ 10/18 第一版 | 使用者 | 原型網址補上 | — | `proposals/2026-10-18-proposal.md` |
| K4 | 畫面原型：市民入口、市府入口、一頁里況＋府函段落 | debug-40 | ✅ 已上 VM：http://10.30.1.10:8015/ （組內 VPN；容器 debug06-proto，nginx:alpine，2026-10-18）。本機預覽 http://localhost:8777/ | 使用者（看畫面、給意見） | — | — | `solutions/prototype/`；部署腳本 `workspace/scratch/deploy_proto_vm.sh`（不進 git）。待補：VM wiki 登錄冊與 vm_log |
| K4b | 原型第三版：文資進市民卡、市府清單、一頁里況與府函段落；複製附時間戳 | debug-40 | ✅ 10/18（92d95b2），已重新部署到 http://10.30.1.10:8015/ | 使用者（看畫面） | — | — | 145 個里含文資、6,388 棟 50 公尺內有文資【實測】 |
| K10 | 共筆匯出：給隊友的 Google Doc 貼稿（9 個分頁、7 張表、7 張截圖） | debug-40（寫）、debug-fc（貼） | ✅ 10/18（d288dad）；debug-fc 已貼完 9 個分頁與 7 張表 | 使用者（手動插入 7 張截圖） | Drive 分享工具不能設「知道連結者可檢視」，API 插圖要公開網址 | — | `solutions/briefs/2026-10-18-gdoc-export.md`、`gdoc-images/`；之後只改哪一頁就告訴 debug-fc 重寫那一頁 |
| K11 | 給 FIND 專案 session 的研究導覽（使用者要評估寫一篇文章） | c8 | ✅ 10/19（99a63e6） | FIND session | — | — | `data-patterns/2026-10-19-research-inventory-for-find.md`：成熟度、可引用數字、限制、寫作角度；對外版本指向 `solutions/briefs/2026-10-18-gdoc-export.md`。方案與共識問協調者，以共識紀錄與方案書為入口 |
| K5 | C3 範圍：臺灣既有同類專案、報導、黑客松作品 | debug-40（子 agent） | ✅ 10/18 | — | — | — | `surveys/k5-prior-work-taiwan.md` |
| K6 | C4 範圍：逐棟屋齡與構造的推估方法（資料抓取歸 R1c） | debug-40（子 agent） | ✅ 10/18 | — | — | — | `surveys/k6-building-age-methods.md` |
| K7 | 開源工具盤點：風險評級、地址查詢、地圖前端，24 小時內可用 | debug-40（子 agent） | ✅ 10/18 | — | — | — | `surveys/k7-open-source-tools.md` |
| K8 | 10.30.1.10 部署路徑盤點（只讀，不動機器） | debug-40（子 agent） | ✅ 10/18 | — | — | — | `workspace/notes/2026-10-18-k8-vm-deploy-path.md`（不進 git：內網主機、port、帳號資訊不放進可能公開的 repo） |
| 009 | GitHub：隊友開了私有 repo derick0823/tp-debugthon | 使用者 | 🟡 10/22 改成全部放在團隊 repo 的 `inbox/`，根目錄不放任何檔（使用者：不要打亂隊友原本的計畫）。本機 commit ff1cea1，未 push。10/21 晚白名單擴大：加第 6 題開放授權的原始檔 34 份、staged 21 檔、公開版門牌分片、`data/DATASETS.md` 索引、導覽文件。不放：授權待確認或未標授權的 4 份、逐址列管清單 2 份、研究報告 PDF、session 簡報與訪談紀錄。團隊 repo 約 300 MB | 使用者（確認後 push） | — | — | 匯出程式 `ops/export_public_repo.py`；工程師入口 `solutions/handoff/2026-10-21-backend-engineer.md`。轉公開前：清 6 檔 13 處內網 VM 位址 |

## 決定

| 編號 | 問題 | 決定 | 理由 |
|---|---|---|---|
| BD1 | 方向何時定、誰定 | 使用者不拍板。10/19 22:00 協調者出決策草案，10/20 12:00 四個 session 回「同意／異議＋理由」，協調者寫成決策紀錄。 | 使用者要「四個 AI 有共識，而且說明原因」【使用者，c8 轉述】 |
| BD2 | Codex C1～C4 | 結案，不等。C1／C2 由 R3b 補；C3 → K5；C4 → R1c＋K6。 | 使用者 U1 不跑 Codex；缺口已有人接。 |
| BD3 | Q5 除鼠 | 📦 保留，不聚焦。R4-INTL 1 段＋2 來源；R4-DATA 上限 1 小時。 | 與「排優先順序」關係較遠【推論】。但使用者想過，簡報要能說「想過」【U5】。 |
| BD4 | R2b 與 R4-Q1 的邊界 | R2b＝民眾申請端；Q1＝市府內部處理端。 | 同一流程兩端，各一人，不重工。debug-aa 提，協調者採納。 |
| BD5 | 一樓軟弱層因子 | debug-aa 寫定義（R3c），c8 實作（R1b）。 | 一人寫規格、一人算，避免兩人都算。 |
| BD6 | c8 的順序 | R1c → R1b → R4-DATA。 | 逐棟表是 S1、S2、S4 共用的底，不論方向都用得到。 |
| BD7 | 實價登錄歷史季檔 | 同意抓，5 個條件。 | 見 `decisions/2026-10-18-lvr-history-fetch.md`。使用者 U2 已同意。 |
| BD8 | K8 的檔放哪 | 放 `workspace/notes/`，不進 git。 | 內容有內網主機、帳號、port 表。repo 交件時可能公開。 |
| BD9 | 液化預設版本 | 全國 2026 版預設，城市版可切換，顯示一致度（待共識 Q-B）。 | soil.taipei 10/31 關站後只剩全國版是官方來源；兩版前 46 名只重疊 24 個。 |
| BD9（修正） | 液化版本 | 內部原型預設全國 2026 版可切換；公開版預設城市 2019 版，全國版只放里層級對照並連官方站。 | 全國 2026 ArcGIS 無授權標示【實測 debug-83】；城市版與鑽孔較一致（ρ 0.82 對 0.74）【實測 c8】。 |
| BD10（修正） | 已知案件（海砂屋、黃單）怎麼顯示 | 兩者同一種處理：只在精確門牌比對時顯示清冊原文地址＋版本＋官方頁連結；不做可瀏覽圖層；里層級給件數。 | 官方已公開到門牌的正式清冊；波特蘭是清冊有錯；汙名化風險來自可瀏覽地圖；屋主查不到列管會失去最有價值的一項。 |
| BD11 | 問題樹新增 G1、G2、G3 | 登記並指派（見研究任務表）。 | 四個 session 的 Q-G 回覆。 |
| BD12 | 逐棟表推估階梯（K6 §10） | 採 age_source、age_conf、年份差降級、L2 鄰棟借用（年份區間、信心 low）；不採排除新成屋、構造機率先驗。 | c8 10/18 的評估，見共識紀錄 §2。 |
| BD13 | A6 輕量版的形狀 | 「一頁里況說明」改成「里況段落產生器」：多選里、輸出可貼進府函的句子、附統計截止日與來源、推估類不進公文；列印版保留。 | debug-aa 讀 16 則書面質詢答復：答復是約 900 字的文字段落，常寫日期、法條、件數、措施、金額，只有 1 則用里層級數字【實測】。 |
| BD14 | 排序的政策出口 | 方案加「迅行劃定」：穩定前段的里當都更條例 §7 迅行劃定候選，門檻降到過半。寫進 100 天與市府入口的穩定前段清單說明。 | debug-aa 10/18 讀都更條例 §7、§37【實測】：§7 第 1 項第 2 款「為避免重大災害之發生」，走都市計畫程序，不用修中央法。 |
| BD15 | 場勘前預檢 | 當 BD13 府函段落產生器的附加用途，不另做產品。只用窄巷清冊、規範世代、無電梯、海砂屋與黃單列管、危老與都更案重疊這些有把握的項目；不用推估屋齡判斷合法建物或舊違章。 | debug-aa R4-SI：24 項中資料有 6、部分 9；國外做法是「先篩、帶著問題去」，不取代到場（韓國航照篩 2,834 件、現場 85 件）【實測＋文件】。 |
| BD16 | 資安與個資原則（N5） | 公開版純靜態、無後端、無帳號、不存查詢紀錄、地址不進網址；地址比對在瀏覽器內做；只用開放資料與官方已公開清冊的彙總；不做可瀏覽逐棟列管圖；第三方（底圖、GitHub Pages）的紀錄照實寫；內部完整資料不離開隊內；市府採用時依資通安全管理法與個資法辦理（100 天）。 | 使用者 10/18 轉述公務員提醒；與 BD9、BD10 一致。 |
