# 國際：綜合指標方法學（OECD/JRC 手冊、JRC COIN、INFORM 風險指數）

- 檔名代號：intl-composite-index-methods
- 查核日：2026-10-17
- 對應痛點：
  - P1：市府要「科學化排序」，但權重怎麼定沒有客觀答案。方法學正本告訴我們怎麼把主觀選擇攤開。
  - P5：正規化、權重、加總方法一換，排名就變。這和「液化圖換版本，前 46 名里只重疊 24 個」是同一類問題。
- 解法類別：資料、技術
- 制度起始年：OECD/JRC 手冊 2008（2005 工作文件版）；JRC COIN 2016 正式成立（工作始於 2003）；INFORM 2014 前後首版；最近一次重大變動：2026（INFORM 協調權移交 UNDP）

## 一句話

方法學正本的共識：權重沒有客觀答案，所以要公開、可調、附排名區間；彼此不相關的維度可以選擇不合成。

## 背景痛點

- 綜合指標（composite indicator）把很多指標壓成一個分數，好溝通、好排名【文件】[1]。
- 但 OECD/JRC 手冊在第一章就列出缺點：可能傳遞誤導的政策訊息、引人做出過度簡化的結論、被拿來支持預設立場、權重選擇會變成政治爭議、可能**掩蓋某些維度的嚴重失敗**【文件】[1]。
- 統計學界一直有兩派。「合成派」認為一個總分能抓到現實、能吸引媒體與決策者；「不合成派」認為建好指標組就該停，因為權重是任意的【文件】[4]。
- 歐盟 JRC 因此成立綜合指標與計分板能力中心（COIN），替各國際指數做「統計稽核」【文件】[2][3]。

## 做法

1. **OECD/JRC《綜合指標建構手冊》（Handbook on Constructing Composite Indicators，2008）**：十個步驟，從理論框架到視覺化。每一步都要留文件【文件】[1]。
2. **JRC COIN 十步口袋指南與統計稽核**：把手冊變成可檢查的門檻值。COIN 已連續 15 年稽核 WIPO 全球創新指數（GII）【文件】[2][3]。
3. **INFORM 風險指數**：歐盟 JRC 與聯合國機構合作的全球人道危機風險指數。191 國、約 50 個指標，0～10 分，三個維度用幾何平均組合【文件】[5][6]。

## 機制細節

### OECD/JRC 手冊的十步（Table 1）

| 步驟 | 要做什麼 | 對我們的意義 |
|---|---|---|
| 1 理論框架 | 定義要量什麼、分幾個子群 | 先講清楚「風險」是指倒塌、救不到人、還是兩者 |
| 2 資料選擇 | 檢查品質、覆蓋率；資料少時可用代理變數 | 屋齡只有區層級，要標「代理」 |
| 3 缺值處理 | 補值並量化補值的可靠度 | 2001 年前使照缺值怎麼補要寫明 |
| 4 多變量分析 | 主成分、相關、分群，比對資料結構與理論框架 | **相關係數檢查在這一步** |
| 5 正規化 | 選方法；處理離群值與偏態 | 百分位或 min-max |
| 6 權重與加總 | 選權重與加總法；討論相關與「可補償性」 | 算術 vs 幾何 |
| 7 不確定性與敏感度分析 | 測試換指標、換正規化、換權重、換加總法 | 排名區間 |
| 8 回到資料 | 拆解總分，看誰在推動結果 | 每個里的因子分解 |
| 9 與其他指標連結 | 和既有指標比對 | 和海砂屋、黃單比對（R1 已發現不吻合） |
| 10 視覺化 | 呈現方式會影響解讀 | 儀表板設計 |

- 來源：【文件】[1] Table 1。

### 正規化方法（手冊 Table 3）

- **排名（ranking）**：不受離群值影響；但失去絕對水準資訊【文件】[1]。
- **z 分數**：平均 0、標準差 1；極端值影響較大【文件】[1]。
- **min-max**：壓到 [0,1]；離群值會扭曲；也會把變化很小的指標拉寬，讓它在總分裡影響過大【文件】[1]。
- **類別尺度（例如依百分位給分）**：會丟掉很多變異資訊；原始分數變化小時，百分位分組會「強迫分類」【文件】[1]。
- 手冊建議：先處理離群值，再正規化【文件】[1]。

### 權重：權重不等於重要性

- 手冊明說：在線性與幾何加總中，**權重表示的是指標之間的取捨（trade-off），不是重要性係數**【文件】[1] Table 4 註 4。
- 手冊列的權重法：等權（EW）、主成分／因子分析（PCA/FA）、資料包絡（BOD）、未觀察成分（UCM）、預算分配（BAP）、層級分析（AHP）、聯合分析（CA）【文件】[1]。
- **主成分分析的前提是指標彼此相關。手冊明寫：「指標之間沒有相關時，這些方法無法估出權重。」**【文件】[1]
- 預算分配法：給專家 N 點去分配。指標 10～12 個以內最適合，太多會造成專家「認知壓力」【文件】[1]。
- 高度相關的指標會「重複計算」：兩個共線指標權重各 w1、w2，等於同一件事拿了 w1+w2【文件】[1]。

### 加總：可補償性（compensability）

- 線性加總：一項低分可以被另一項高分**完全且固定地補償**【文件】[1]。
- 幾何加總：低分項的補償能力較弱，所以低分的單位更有動機改善最弱的一項【文件】[1]。
- 手冊：如果不同目標同樣正當，例如「經濟成長不能補償社會凝聚的損失」，**線性和幾何都不適合**，要用非補償的多準則方法【文件】[1]。
- 手冊也說：沒有客觀的權重與加總法，不代表綜合指標無效，前提是整個過程透明【文件】[1]。

### JRC COIN 的相關係數門檻（統計一致性）

- 指標與總分的相關係數【文件】[2][3]：
  - `r > 0.95`：這個指標主導了框架。
  - `-0.3 < r < 0.3`：這個指標在框架裡「代表性不足」，像雜訊。r = 0.3 等於只解釋 9% 變異。
  - `r < -0.3`：和總分負相關，方向衝突。
- COIN 指南還要求檢查：總分和人口數或 GDP 相關是否大於 0.6，避免指數其實只是在量規模【文件】[2]。
- COIN 指南第 6 步明寫：「考慮要加總到哪一層」【文件】[2]。也就是可以只加總到維度，不做總分【推論】。
- JRC 在 GII 稽核中強調：統計一致性是必要、不是充分條件；弱相關不代表概念上不適合，只代表它對總分貢獻的資訊少【文件】[3]。

### 不確定性與敏感度分析：排名區間

- 手冊建議：把結果以「排名 + 不確定性區間」呈現【文件】[1]。
- 做法：用蒙地卡羅同時隨機改變多個建構選擇（納入哪些指標、正規化、權重、加總法），每次重算排名【文件】[1]。
- 輸出：每個單位的**中位數排名**，以及**第 5 到第 95 百分位排名區間**【文件】[1]。
- 整體穩定度用「平均排名位移」：`R_S = (1/M) × Σ |Rank_ref(c) − Rank(c)|`，M 是單位數【文件】[1]。
- 手冊的案例（技術成就指數 TAI，23 國）【文件】[1]：
  - 中位數排名與原始排名常常不一致。
  - 平均排名位移 R_S 的平均值接近 3 名，標準差略高於 1 名。
  - 用非補償多準則加總時，平均位移可達 9 名。
  - 影響最大的是「加總方法」與「納入哪些指標」；考慮交互作用後，權重與專家選擇也變重要。正規化方法的影響幾乎為 0。
  - 作者結論：若專家對建構方式沒有共識，TAI 不是穩健的指標。
- 敏感度分析（Sobol' 指數）回答「哪一個選擇造成最多不確定性」【文件】[1][7]。

### INFORM 風險指數的結構

- 風險 = 危害與曝險^(1/3) × 脆弱度^(1/3) × 因應能力不足^(1/3)，三維度等權幾何平均【文件】[5]。
- INFORM 方法文件說：用這個形式，總分**對脆弱度與因應能力不足更敏感**，而這兩項是減災行動最能改變的「內部力量」【文件】[5]。
- 0～10 分，越高越糟。指標用 min-max 正規化到 0～10；極度偏態的指標（例如曝險人數）先取對數【文件】[5]。
- 低層用算術平均，部分危害類別用幾何平均【文件】[5]。
- **5 級切點固定**：用 2011～2015 五年、191 國的資料做階層分群，定出每個類別、維度、總分的 5 級門檻，之後年度沿用。這讓不同年份可以比較【文件】[5]。
- **分維度呈現**：每國的風險剖面同時列總分、3 個維度、6 個類別與趨勢圖，並和同區域、同所得組比較【文件】[6]。
- 地方版（INFORM Subnational）：同一套方法套到省、市或村層級，由當地夥伴開發、全球團隊驗證。DRMKC 網站列出 23 個地方或區域模型【文件】[6]。

### 維度彼此不相關時怎麼辦（回應 R1 的 ρ≈0）

方法學正本給的選項，由保守到積極：

1. **不做總分，只到維度**：COIN「考慮要加總到哪一層」【文件】[2]；UNECE 2025 指引引用 Stiglitz、Sen、Fitoussi 的建議，不同領域不應合成單一分數【文件】[4]。
2. **非補償加總**：手冊說不同目標同樣正當時，用多準則方法，不用線性或幾何【文件】[1]。
3. **幾何平均或「條件式」結構**：INFORM 用幾何平均，任一維度接近 0，總分就低【文件】[5]。適合「沒有危害就沒有風險」的邏輯【推論】。
4. **類型學（剖面）取代指數**：Tate 等（2025）用分群得出 6 種脆弱度剖面，主張總指數會誤導【文件】[8]。Rufat 等（2019）發現剖面組態比主流總指數有更高構念效度【文件】[9]。
5. **雙變量地圖（bivariate map）**：Tate 等（2021）用雙變量局部空間自相關（bivariate LISA）找出「高洪水曝險 × 高社會脆弱度」熱點【文件】[10]。

- 注意：手冊說 PCA 在指標不相關時算不出權重【文件】[1]。所以「用 PCA 定權重」對我們不可行【推論】。

## 成效數字

| 指標 | 數字 | 資料日期 | 證據 | 來源編號 |
|---|---|---|---|---|
| INFORM 涵蓋國家 | 191 國 | 2016 方法文件；UNDP 頁面 | 【文件】 | [5][11] |
| INFORM 指標數 | 約 50 個 | UNDP 頁面（未標日期） | 【文件】 | [11] |
| INFORM 地方模型 | DRMKC 網站列 23 個 | 2026-10-17 查核 | 【文件】 | [6] |
| INFORM 最新版 | INFORM Risk Mid 2026 | 2026 | 【文件】 | [6] |
| JRC COIN 稽核 GII | 連續第 15 年 | 2025 | 【文件】 | [3] |
| TAI 案例排名位移 | 平均約 3 名；非補償加總下可達 9 名（23 國）；正規化的一階 Sobol' 指數 0.000 | 2008 | 【文件】 | [1] |
| COIN 口袋指南建議 | 每維度 5～7 個指標、最少 3 個；每個指標與國家資料覆蓋率至少 65% | 2026 查核 | 【文件】（經搜尋摘要轉述） | [2] |

## 批評與失敗

1. **手冊自己承認**：「綜合指標方法的每一個環節都可被批評」（引 Booysen 2002）【文件】[3]。
2. **權重是取捨，不是重要性**：使用者以為「液化權重 30%」代表液化占 30% 重要性。在線性加總下，實際影響還取決於各指標的變異與相關【文件】[1][7]。Paruolo、Saisana、Saltelli（2013）專文討論名目權重與實際重要性的落差【待確認：只讀到二手轉述，未讀原文】。
3. **正規化改變排名**：min-max 會放大變化小的指標；z 分數放大極端值【文件】[1]。Tate（2012）發現演繹型社會脆弱度指數最受轉換方法影響【文件】見 `us-fema-national-risk-index-sovi.md` [7]。
4. **INFORM 的幾何平均有代價**：手冊指出幾何加總對低分單位較不利；低分國家偏好線性加總【文件】[1]。INFORM 方法文件也用衣索比亞與奈及利亞說明：兩國算術平均幾乎相同，換成幾何平均後排名就分開了【文件】[5]。
5. **統計一致性不等於有效**：相關係數高只代表內部一致，不代表量到真實風險【文件】[3]。我們的 R1 已發現：海砂屋 70% 落在合成分數偏低的里（AUC 0.37）【文件】PLAN.md R1 結果。
6. **OECD/JRC 手冊 2008 年後沒有改版**【待確認：搜尋未找到新版，但不能排除】。2023～2026 的新方法散在 COIN 工具、R 套件與稽核報告裡。

## 最新動態（2023～2026）

- 2023-09：JRC 綜合指標訓練週，含 COINr（R 套件）與穩健性分析課程【文件】[12]。
- 2025：JRC COIN 第 15 次稽核 GII；2026 年版 GII 也有 JRC 稽核附錄【文件】[3]。
- 2025-09：聯合國歐洲經濟委員會（UNECE）福祉衡量指引第 4 章專談綜合指標，把「合成派 vs 不合成派」並列，並把不確定性與敏感度分析列為必要步驟【文件】[4]。
- 2026-01：INFORM 整體協調由聯合國人道事務協調廳（OCHA）移交聯合國開發計畫署（UNDP）危機局，JRC 仍是科學主導【文件】[6]。
- 2026：INFORM Risk Mid 2026 釋出；INFORM Severity 方法於 2026-02-02 更新【文件】[6]。
- COINr 套件在 CRAN 維護中（1.1.x 版）【文件】[12]。

## 對臺北的可轉移性

- 可以借：
  - 十步清單當我們的方法章節目錄【推論】。
  - COIN 的相關係數門檻，直接用來檢查各因子與總分【推論】。
  - 手冊的「中位數排名 + 5～95 百分位區間」做法【推論】。
  - INFORM 的「總分 + 維度 + 類別一起列，附趨勢」的剖面卡片【推論】。
- 不能直接借（為什麼）：
  - INFORM 用 5 年資料定固定切點。我們只有一個時間斷面，無法定「跨年可比」的固定門檻【推論】。
  - PCA 定權重：因子之間不相關時算不出來【文件】[1]。
  - Sobol' 全域敏感度需要大量模擬，3 人 1 週做不完。先做簡化版：隨機權重 + 換液化版本 + 換正規化【推論】。
- 前提條件：
  - 每個因子都要先有里層級值，方向一致（越高越危險）【推論】。
  - 要先決定「風險」的理論框架：倒塌風險與救災困難是兩件事。R1 發現窄巷與液化互相獨立【文件】PLAN.md R1 H5。
- 對應解法方向：S1（一句為什麼）：方法學正本要求的「權重透明、可調、附排名區間、可拆解」正好是 S1 儀表板的規格書。

## 可以直接抄的設計細節

### A. 開工第一步：相關係數表（照手冊第 4 步、COIN 門檻）

1. 對每對因子算 Spearman ρ（里層級，n≈456）。
2. 對每個因子算它和暫定總分的相關。
3. 標記規則（COIN）：
   - `ρ > 0.95`：主導，考慮刪一個或降權。
   - `-0.3 < ρ < 0.3`：和總分幾乎無關。**不要硬合成**，改用下面 B 的方案。
   - `ρ < -0.3`：方向衝突，回頭檢查定義。
4. 把這張表放進儀表板的「方法」分頁。

### B. 因子不相關時的三種呈現（擇一或並列）

1. **維度分開、不給總分**（COIN「加總到哪一層」）：
   - 三張並排小地圖：建物老化、液化、高齡。各自 5 級。
   - 每個里一張「剖面卡」：三個因子的百分位長條，加 90 百分位旗標。
2. **雙變量地圖（3 × 3）**：
   - X 軸：建物老化百分位，三分位（低／中／高）。
   - Y 軸：高齡百分位，三分位。
   - 9 種顏色。液化另做圖層疊加或切換。
   - 好處：看得到「老屋高、高齡低」和「兩者皆高」的差別，總分看不到【推論】。
3. **類型學（剖面）**：
   - 規則式分類，不用分群演算法，好解釋。例如：
     - A 型「雙老 + 液化」：三者皆 ≥ 第 67 百分位。
     - B 型「雙老、非液化」。
     - C 型「液化、屋新人輕」。
     - D 型「下一波雙老」：高齡成長率高、屋齡 30～45 年（R1 的內湖、士林、北投）。
   - 每一型配一個建議行動（健檢、公辦都更、液化自主檢查、防災演練）【推論】。

### C. 一定要給總分時：權重可調 + 排名區間

1. **正規化**：預設百分位（排名法，不怕離群值）；提供切換到 min-max，讓使用者看排名怎麼變【文件】[1]。
2. **加總**：提供兩個選項並列：
   - 算術加權平均：`S = Σ w_i × p_i`（可補償）。
   - 幾何加權平均：`S = Π p_i^{w_i}`（低分項補償弱；任一因子接近 0 則總分低）。p 用 0.01 下限避免 0【推論】。
3. **權重滑桿**：3～5 個因子各一條，總和自動正規化到 1。旁邊寫「權重是取捨，不是重要性」【文件】[1]。
4. **預設權重三組**：等權；市府版（屋齡偏重）；救災版（高齡與窄巷偏重）。用預算分配法請 3～5 位里長或專家各分 100 點，取中位數【文件】[1]（BAP）。
5. **排名區間（簡化蒙地卡羅）**：
   - 跑 1,000 次。每次隨機抽：權重（Dirichlet，α=1）、液化版本（城市版／全國版）、正規化（百分位／min-max）、加總（算術／幾何）。
   - 每個里輸出：中位數排名、第 5 與第 95 百分位排名。
   - 排行榜每一列畫一條橫線（區間）加一個點（中位數），照手冊 Figure 18 的樣式【文件】[1]。
   - 全體穩定度：`R_S = 平均 |參考排名 − 模擬排名|`，在頁首顯示一個數字【文件】[1]。
6. **「穩定前 N 名」清單**：只列「第 95 百分位排名仍在前 50」的里。這是給市府排優先順序最安全的名單【推論】。

### D. 分級與用語

- 5 級：很低、相對低、中等、相對高、很高。切點用固定五分位【推論】，或照 INFORM 用自然斷點再四捨五入成好記的數字【文件】[5]。
- 每張圖下方固定一句：「分數是全市相對排名，不是絕對危險程度。」

## 來源

1. Handbook on Constructing Composite Indicators: Methodology and User Guide，OECD／歐盟執委會 JRC，ISBN 978-92-64-04345-9，https://www.oecd.org/en/publications/handbook-on-constructing-composite-indicators-methodology-and-user-guide_9789264043466-en.html （PDF：https://www.oecd.org/content/dam/oecd/en/publications/reports/2008/08/handbook-on-constructing-composite-indicators-methodology-and-user-guide_g1gh9301/9789264043466-en.pdf ），資料日期 2008，存取 2026-10-17【實測：2026-10-17 下載 PDF，用 pdftotext 轉文字後查閱 Box 1、Table 1、Table 3、Table 4、第 1.6～1.7 節與 TAI 案例】
2. 10 Step Pocket Guide to Composite Indicators and Scoreboards，JRC COIN，https://knowledge4policy.ec.europa.eu/sites/default/files/10-step-pocket-guide-to-composite-indicators-and-scoreboards.pdf ，資料日期未標（工具頁 2025-12-04 更新），存取 2026-10-17（經全文擷取工具讀取片段）
3. Appendix II – JRC statistical audit of the 2025 Global Innovation Index，WIPO／JRC，https://www.wipo.int/web-publications/global-innovation-index-2025/en/appendix-ii-joint-research-centre-jrc-statistical-audit-of-the-2025-global-innovation-index.html ；2026 版 https://www.wipo.int/web-publications/global-innovation-index-2026/en/appendix-ii-joint-research-centre-jrc-statistical-audit-of-the-2026-global-innovation-index.html ；JRC COIN 簡報 https://www.itu.int/itu-d/meetings/wp-content/uploads/IPS/documents/12/4_JRC-COIN_for_ITU-1.pdf ，資料日期 2025～2026，存取 2026-10-17
4. Guidelines on measurement of well-being, Chapter 4 Composite Indicators，UNECE，https://w3.unece.org/Stories/2025/09/wellbeing/webpage6.html ，資料日期 2025-09，存取 2026-10-17
5. INFORM Risk Concept and Methodology Version 2016，JRC DRMKC，https://drmkc.jrc.ec.europa.eu/inform-index/Portals/0/InfoRM/Publications/INFORM%20Risk%20Concept%20and%20Methodology%20Version%202016.pdf ，資料日期 2016，存取 2026-10-17（經全文擷取工具讀取片段）
6. INFORM 首頁與 INFORM Subnational Risk，JRC DRMKC，https://drmkc.jrc.ec.europa.eu/inform-index ；https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Subnational-risk ；國家剖面範例 https://drmkc.jrc.ec.europa.eu/Inform-Index/Portals/0/InfoRM/CountryProfiles/JPN.pdf ，資料日期 2026，存取 2026-10-17
7. Saisana, Saltelli & Tarantola, Uncertainty and Sensitivity Analysis Techniques as Tools for the Quality Assessment of Composite Indicators, JRSS-A 168(2):307–323，https://academic.oup.com/jrsssa/article-abstract/168/2/307/7084307 ，資料日期 2005，存取 2026-10-17（只讀摘要）
8. Tate, Rufat, Rahman & Hoover, Beyond indices: Profiles of social vulnerability for flood risk reduction, IJDRR 118:105250，https://collaborate.princeton.edu/en/publications/profiles-of-social-vulnerability-for-flood-risk-reduction/ ，資料日期 2025，存取 2026-10-17（只讀摘要）
9. Rufat et al., How Valid Are Social Vulnerability Models?, Annals of the AAG 109(4)，https://collaborate.princeton.edu/en/publications/how-valid-are-social-vulnerability-models-3/ ，資料日期 2019，存取 2026-10-17（只讀摘要）
10. Tate et al., Flood exposure and social vulnerability in the United States, Natural Hazards，https://tate.scholar.princeton.edu/publications/flood-exposure-and-social-vulnerability-united-states ，資料日期 2021，存取 2026-10-17（只讀搜尋摘要，雙變量 LISA 方法未讀原文）
11. INFORM (Index for Risk Management)，UNDP Geneva，https://www.undp.org/geneva/inform-index-risk-management ，資料日期未標，存取 2026-10-17
12. 2023 JRC Week on Composite Indicators and Scoreboards，JRC，https://knowledge4policy.ec.europa.eu/composite-indicators/2023-jrc-week-composite-indicators-scoreboards_en ；COINr 套件說明 https://stat.ethz.ch/CRAN/web/packages/COINr/refman/COINr.html ，資料日期 2023～2026，存取 2026-10-17
