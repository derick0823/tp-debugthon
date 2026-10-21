# 美國：FEMA 國家風險指數（National Risk Index）與社會脆弱度指標（SoVI、CDC/ATSDR SVI）

- 檔名代號：us-fema-national-risk-index-sovi
- 查核日：2026-10-17
- 對應痛點：
  - P1：NRI 是「沒有逐棟資料，只用普查區（census tract）統計做全國排序」的正規做法，和臺北只有里、區資料的處境相同。
  - P5：NRI 換一次社會脆弱度資料源，超過一半的郡數值就變了。這就是「版本不一，排名跟著變」。
  - P4：SVI 有「65 歲以上」「身心障礙」「無車」等變數，是高齡、行動不便者重疊區的標準算法。
- 解法類別：資料、技術
- 制度起始年：SoVI 2003；CDC/ATSDR SVI 2011；NRI 2020（完整網站 2021）；最近一次重大變動：2025（NRI v1.20 換社會脆弱度資料源、併入 RAPT 平台）

## 一句話

美國把危害損失、社會脆弱度、韌性分開算、分開顯示，再用有上下限的係數相乘；即使這樣，GAO 仍批評它沒做敏感度分析。

## 背景痛點

- 美國有 18 種天然災害，地方政府要排減災補助的優先順序，但各州資料格式不同【文件】[1][2]。
- 研究早就發現：同樣的災害，窮人、老人、沒車的人受害更重。只看財產損失，會把資源排給有錢地區【文件】[5]。
- 所以 FEMA 要一個全國一致、能比較到普查區的「相對風險」排名【文件】[1]。
- 2022 年《社區災害韌性區法》（Community Disaster Resilience Zones Act）要求 FEMA 提供公開風險產品，並依風險、社會脆弱度、韌性劃設「韌性區」。FEMA 指定 NRI 為法定產品【文件】[2][4]。

## 做法

1. **NRI**：每個普查區算三個元件，分開公布，再組成總風險【文件】[1]。
   - 預期年損失（Expected Annual Loss，EAL）：危害頻率 × 曝險 × 歷史損失率，單位是美元。
   - 社會脆弱度（Social Vulnerability，SV）。
   - 社區韌性（Community Resilience，CR）。
2. **SoVI**（Cutter、Boruff、Shirley 2003）：42 個郡層級變數，用因子分析縮成 11 個因子，解釋約 76% 變異，再相加【文件】[5]。
3. **CDC/ATSDR SVI**：16 個人口普查變數，分 4 個主題，全部用百分位排名，再相加【文件】[6]。
4. 地震的 EAL 直接用 Hazus 的年化地震損失（FEMA P-366），所以 NRI 的地震部分其實是一個工程模型的輸出【文件】[1]。Hazus 的細節見 `intl-gem-openquake-hazus.md`。

## 機制細節

### NRI 的公式（v1.20，2025 年 12 月技術文件）

- 風險值 = EAL × 社區風險係數（Community Risk Factor，CRF）【文件】[1]。
- CRF 的算法【文件】[1]：
  1. 社區風險比 = SV ÷ CR。
  2. 把這個比值換成全國百分位。
  3. 用三角分布的反函數（最小 0.5、眾數 1、最大 2）把百分位映射成係數。
- 所以社會脆弱度和韌性**最多只能把損失放大 2 倍、縮小一半**。FEMA 評估過 [0,2]、[0,5]、[0.5,2]、[0.2,5]、[1,5] 幾種範圍，以及對數常態、PERT 等分布，最後選 [0.5,2] 三角分布【文件】[1]。
- 這不是「乘法 vs 加權加總」的二選一。它是**以損失為主體，社會因子當有上下限的調整係數**【推論】。
- 舊版（2021 年以前）的公式是 EAL × SV ÷ CR，直接相乘除【文件】[1][4]。改版原因是直接相乘除會讓社會因子影響過大或過小【推論】。

### 正規化：三種元件用不同方法

| 元件 | 轉換 | 分數 | 5 級怎麼切 |
|---|---|---|---|
| 風險、EAL | 先開立方根（壓偏態）再 min-max 到 0～100 | 全國百分位 | k-means 分群，5 群由低到高命名 |
| 社會脆弱度 | — | 全國百分位 | 固定五分位：0–20、20–40、40–60、60–80、80–100 |
| 社區韌性 | — | 全國百分位 | 固定五分位 |

- 來源：【文件】[1]。
- 5 級名稱：Very Low、Relatively Low、Relatively Moderate、Relatively High、Very High【文件】[1]。
- 技術文件明說：分數是**全國相對排名，不是絕對量測**；別的社區變了，你的分數也會變【文件】[1]。
- 分級在郡和普查區各算一次。一個普查區可以是 Very High，而它所在的郡是 Very Low【文件】[1]。

### 社會脆弱度與韌性的資料源

- v1.20（2025 年 12 月）社會脆弱度改用美國普查局「社區韌性估計」（Community Resilience Estimates，CRE）的 10 個變數：所得貧窮比、單一或無照顧者家戶、居住擁擠、溝通障礙、無業、身心障礙、無健保、**65 歲以上**、無車、無寬頻【文件】[1]。
- FEMA FAQ 寫：社會脆弱度指標「現在符合本屆政府的優先事項」【文件】[3]。這代表**指標選擇會隨政治改變**【推論】。
- 社區韌性用南卡大學的 BRIC（Baseline Resilience Indicators for Communities），49 個指標、6 類。**BRIC 只有郡層級**，FEMA 直接把郡的分數指定給郡內每個普查區【文件】[1]。

### CDC/ATSDR SVI 的算法（2022 版）

- 16 個變數，4 個主題：社經地位、家戶特性、種族與族裔、住宅類型與交通【文件】[6]。
- 步驟【文件】[6]：
  1. 每個變數算全國百分位（Excel `PERCENTRANK.INC`，0～1）。
  2. 主題分數 = 該主題變數百分位相加，再算一次百分位。
  3. 總分 = 4 個主題的和，再算一次百分位。
  4. 旗標（flag）：任一變數 ≥ 第 90 百分位記 1。主題旗標 = 該主題旗標數加總。
- 這是**等權加總 + 百分位**。百分位讓不同單位的變數可以相加，也讓極端值不會主導【推論】。

### 分開呈現的設計

- NRI 網站與資料下載，EAL、SV、CR、總風險各有自己的值、分數與 5 級【文件】[1]。使用者可以只看其中一個【推論】。
- SVI 同時公布 16 個變數百分位、4 個主題百分位、總百分位與旗標數【文件】[6]。旗標讓人看到「總分中等，但某一項極端」的地方【推論】。

## 成效數字

| 指標 | 數字 | 資料日期 | 證據 | 來源編號 |
|---|---|---|---|---|
| NRI 涵蓋災害種類 | 18 種 | 2025-12 | 【文件】 | [1][2] |
| CDRZ 第一輪劃設 | 483 個普查區 | 2023-09-06 | 【文件】 | [4] |
| CDRZ 公眾意見 | 600 則以上，整理成 152 個行動項目，2025 年 4 月完成 14 項 | 2025-04 | 【文件】 | [2] |
| NRI 設計參與專家 | 約 80 人，分 3 個工作小組 | 2026-09（GAO 報告） | 【文件】 | [2] |
| 換社會脆弱度資料源後數值改變的郡 | 超過一半 | 2025（GAO 2026 報告） | 【文件】 | [2] |
| SoVI 原始模型 | 42 變數 → 11 因子，解釋約 76% 變異 | 2003 | 【文件】 | [5] |
| Tate 2012 引用數 | Scopus 511 次 | 2026 查核 | 【文件】 | [7] |

## 批評與失敗

1. **沒做敏感度分析**：GAO 2026 年 9 月報告指出，FEMA 2025 年換社會脆弱度資料源時沒做敏感度分析。超過一半的郡數值改變，但 FEMA 沒評估總風險分數怎麼變。GAO 建議要一致地做敏感度分析並公開；國土安全部**不同意**這條建議【文件】[2]。
2. **使用者不知道怎麼用**：GAO 指出 FEMA 沒想清楚使用者要怎麼把分數變成減災決策，也沒說明 NRI、RAPT、Hazus 三個工具怎麼搭配【文件】[2]。
3. **權重爭議**：使用者反映高估或低估風險、人口稀少地區代表性差、社會脆弱度「等權重」不合理【文件】[2]。
4. **生態謬誤（ecological fallacy）**：BRIC 只有郡層級，卻直接套到普查區。同一郡的所有普查區韌性一樣【文件】[1]。這等於把區平均當成每個里的值【推論】。
5. **SoVI 不穩定**：Spielman 等（2020）發現，同一地點、同一份資料，用 SoVI 的方法算多次，結果可以差很多；而且指數常和理論相反，例如失業率上升時脆弱度反而下降。作者建議**不要用 SoVI 做政策決策**【文件】[8]。
6. **權重與正規化會改變排名**：Tate（2012）用全域敏感度分析比較三種設計。演繹型（deductive）最受轉換方法影響；階層型（hierarchical）最受權重影響；歸納型（inductive，如 SoVI）最受指標組合與分析尺度影響【文件】[7]。
7. **外部效度弱**：Rufat 等（2019）用颶風 Sandy 的實際結果檢驗 4 種社會脆弱度模型。總指數對「申請住宅補助人數」解釋力好，但對「財產損失」解釋力差。最有解釋力的是「行動與功能需求、年齡、交通、住宅」這幾個分項。**用加權或「剖面（profile）」組態的模型，構念效度比主流總指數高**【文件】[9]。CDC 研究者有回應文質疑其結論【文件】[9]。
8. **政治風險**：CDC/ATSDR SVI 2025 年初從 CDC 網站下架，之後依法院命令恢復【待確認：只找到資料平台 mySidewalk 的轉述，沒找到判決原文】。NRI 2025 年改版時移除種族相關變數的方向，FAQ 用「符合本屆政府優先事項」說明【文件】[3]。

## 最新動態（2023～2026）

- 2023-09：FEMA 依 NRI 劃設第一輪 483 個社區災害韌性區【文件】[4]。
- 2024-05：CDC/ATSDR 發布 SVI 2022 版文件，仍是 16 變數、4 主題【文件】[6]。
- 2024-09：NRI 技術審查小組第一次開會；海嘯、內陸洪水是第一批正式專家審查的危害【文件】[2]。
- 2025-12：NRI v1.20 發布，社會脆弱度改用普查局 CRE；NRI 網站併入 RAPT（韌性分析與規劃工具），不是停用【文件】[1][2]。
- 2026-05：GAO 確認 FEMA 沒有更新 NRI 的計畫【文件】[2]。
- 2026-09：GAO-26-107894 報告，3 項建議，國土安全部同意 2 項（使用指引、使用者回饋），不同意 1 項（敏感度分析）【文件】[2]。
- 2025：Tate、Rufat 等發表〈超越指數：洪災的社會脆弱度剖面〉，用分群得出 6 種脆弱度剖面，其中 2 種是「高社會脆弱度 + 高洪水曝險」。主張總指數太粗、會誤導【文件】[10]。

## 對臺北的可轉移性

- 可以借：
  - 「各元件分開算、分開顯示、各自分級」的資料結構【推論】。
  - SVI 的「百分位 + 等權加總 + 90 百分位旗標」算法。里層級逐歲人口可以直接算「65 歲以上比例」「75 歲以上比例」的全市百分位【推論】。
  - NRI 的「有上下限的調整係數」：用屋齡與液化算主體風險，高齡只能把分數放大或縮小在一個範圍內【推論】。
  - GAO 的批評清單，可以直接變成我們的「方法限制」頁【推論】。
- 不能直接借（為什麼）：
  - NRI 的 EAL 以美元損失為主體。臺北沒有逐棟構造與價值，算不出可信的損失金額【推論】。
  - k-means 分 5 級需要幾萬個單位才穩。臺北只有 456 個里（數字待 R1 確認），分群結果容易被少數極端值拉走【推論】。
  - BRIC 那種「郡值套到普查區」的做法，就是我們「區層級 30 年以上棟數套到每個里」的同一個問題。要標出來，不能假裝是里層級資料【推論】。
- 前提條件：
  - 每個因子要先有里層級值。區層級的資料要在介面上標「區值」【推論】。
  - 要先做相關係數檢查。R1 已發現液化和「高齡 × 老屋」幾乎無關（ρ≈0），所以不宜硬合成一個總分【文件】PLAN.md 第 2、3 節 R1 結果。
- 對應解法方向：
  - S1（主要）：NRI 和 SVI 都是「因子分開、分級公開」的儀表板，正好是 S1 的形狀。
  - S5：SVI 的「65 歲以上、身心障礙、無車」旗標，可以當救災可及性的人口側指標。
  - S4：GAO 指出的「換資料源沒做敏感度分析」，可以當我們資料債清單的國際對照。

## 可以直接抄的設計細節

1. **百分位正規化（照 SVI）**：
   - 每個因子 `p_i = PERCENTRANK.INC(全市里的值, 本里值)`，0～1。
   - 方向一致：越高越危險。韌性類因子用 `1 - p`。
   - 好處：不同單位可以相加；不怕極端值；市民看得懂「比全市 85% 的里高」。
2. **旗標（照 SVI）**：任一因子 `p_i ≥ 0.90` 記一面旗。地圖上用小圖示標出「某一項特別極端」的里，即使總分不高也看得到【推論】。
3. **調整係數（照 NRI 的 CRF）**：
   - 主體 = 建物側分數（屋齡、構造、液化）。
   - 係數 = 人口側（高齡）比值的百分位，映射到 0.8～1.25 之類的有限範圍。
   - 介面上寫清楚「高齡最多放大 25%」。這比「高齡權重 30%」好懂【推論】。範圍要做敏感度分析再定。
4. **分級切點**：
   - 單一因子用固定五分位（20/40/60/80），和 NRI 的 SV、CR 一樣【文件】[1]。
   - 不要用 k-means，里數太少【推論】。
   - 5 級名稱照 NRI：很低、相對低、中等、相對高、很高。強調「相對」【文件】[1]。
5. **分開呈現（回應 R1 的 ρ≈0 發現）**：
   - 首頁不放總分。放三張並排小地圖：建物老化、液化、高齡。每張各自 5 級【推論】。
   - 每個里的資訊卡列出各因子百分位與旗標，總分放在最後、可收合。
   - 參考 Rufat 2019 的結論：「剖面」比總指數有效度。可以把里分成幾種組合，例如「老屋 + 高齡、非液化」「液化 + 新屋」「三者皆高」【文件】[9]【推論】。
6. **說明頁要有的句子**（照 NRI 技術文件）：
   - 「分數是全市相對排名，不是絕對危險程度。」
   - 「別的里資料更新，本里分數也會變。」
   - 「區層級資料以區值代入，同區各里相同。」
7. **方法限制頁**：照 GAO 三項建議各寫一段：怎麼用、敏感度分析結果、回饋管道【推論】。

## 來源

1. National Risk Index Technical Documentation（v1.20），FEMA，https://www.fema.gov/sites/default/files/documents/fema_national-risk-index_technical-documentation.pdf ，資料日期 2025-12，存取 2026-10-17（經全文擷取工具讀取片段）
2. GAO-26-107894：FEMA National Risk Index 評估報告，美國政府課責署（GAO），https://files.gao.gov/reports/GAO-26-107894/index.html ，資料日期 2026-09，存取 2026-10-17
3. National Risk Index FAQ，FEMA，https://www.fema.gov/sites/default/files/documents/fema_national-risk-index_faq-page-documentation.pdf ，資料日期 2025，存取 2026-10-17；另見 NRI 資料頁 https://www.fema.gov/about/openfema/data-sets/national-risk-index-data 與 RAPT 頁 https://hazards.fema.gov/nri/determining-risk （頁面更新 2026-08-18）
4. Response to Community Disaster Resilience Zones RFI，FEMA，https://www.fema.gov/sites/default/files/documents/fema_cdrz-rfi-summary-response.pdf ，資料日期 2023，存取 2026-10-17
5. Cutter, Boruff & Shirley, Social Vulnerability to Environmental Hazards, Social Science Quarterly 84(2):242–261, DOI 10.1111/1540-6237.8402002，https://ideas.repec.org/a/bla/socsci/v84y2003i2p242-261.html ，資料日期 2003，存取 2026-10-17
6. CDC/ATSDR SVI 2022 Documentation，CDC/ATSDR，https://svi.cdc.gov/map/data/docs/SVI2022Documentation_5.17.2024.pdf （另見 https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html ），資料日期 2024-05-17，存取 2026-10-17
7. Tate, Social vulnerability indices: a comparative assessment using uncertainty and sensitivity analysis, Natural Hazards 63(2):325–347, DOI 10.1007/s11069-012-0152-2，https://tate.scholar.princeton.edu/publications/social-vulnerability-indices-comparative-assessment-using-uncertainty-and-sensitivity ，資料日期 2012，存取 2026-10-17（只讀摘要）
8. Spielman et al., Evaluating social vulnerability indicators: criteria and their application to the Social Vulnerability Index, Natural Hazards 100(1):417–436, DOI 10.1007/s11069-019-03820-z，https://pubs.usgs.gov/publication/70208758 ，資料日期 2020，存取 2026-10-17（只讀摘要）
9. Rufat, Tate, Emrich & Antolini, How Valid Are Social Vulnerability Models?, Annals of the AAG 109(4)，https://halshs.archives-ouvertes.fr/halshs-02485376v1/file/Rufat_2019_How_Valid_Are_Social_Vulnerability_Models.pdf ；CDC 回應文 https://stacks.cdc.gov/view/cdc/174257/cdc_174257_DS1.pdf ，資料日期 2019，存取 2026-10-17
10. Tate, Rufat, Rahman & Hoover, Beyond indices: Profiles of social vulnerability for flood risk reduction, International Journal of Disaster Risk Reduction 118:105250, DOI 10.1016/j.ijdrr.2025.105250，https://collaborate.princeton.edu/en/publications/profiles-of-social-vulnerability-for-flood-risk-reduction/ ，資料日期 2025，存取 2026-10-17（只讀摘要）
