# 美國 FEMA：快速目視篩檢（FEMA P-154）

- 檔名代號：us-fema-p154-rapid-visual-screening
- 查核日：2026-10-17
- 對應痛點：
  - P1：沒有逐棟構造資料時，P-154 用「站在路邊看 15～30 分鐘」補第一輪資料。
  - P5：P-154 把結果寫成「倒塌機率的數量級」，並且明說是近似值。分數的意義清楚，不同人算的結果可以比較。
- 解法類別：資料、技術
- 制度起始年：1988（第 1 版）；最近一次重大變動：2015（第 3 版）

## 一句話

一棟 15～30 分鐘、一張表、一個分數；分數低於 2 就送詳細評估。

## 背景痛點

- 市府要排補強優先序，但不可能每棟都做結構詳評。【文件】[1]
- 需要一個便宜、快速、非工程師也能做的方法，先把明顯沒問題的排除，把可疑的挑出來。【文件】[1]
- P-154 的定位是「篩檢」，不是「評估」。分數低只代表「值得請技師細看」，不代表一定危險。【文件】[1]

## 做法

1. **規劃**：決定篩檢範圍、地震區等級、基準年（benchmark year），訓練篩檢員。【文件】[1]
2. **出發前蒐集資料**：建照、稅籍、地質圖、街景，每棟 15～75 分鐘。【文件】[1]
3. **現場目視**：站在街上看外觀，填 Level 1 表，每棟 15～30 分鐘。能進室內多 15～30 分鐘。【文件】[1]
4. **選做 Level 2**：再多 5～15 分鐘，看更細的不規則與碰撞。【文件】[1]
5. **算分數**：基本分加減修正分，得到最終分數。【文件】[1]
6. **比對門檻**：低於門檻（預設 2.0）或有其他危險，就建議做詳細結構評估（ASCE/SEI 41-13）。【文件】[1]

## 機制細節

### 分數怎麼算

- **最終 Level 1 分數 SL1 ＝ 基本分 ＋ 所有適用的 Level 1 修正分**。【文件】[1]
- **基本分**依兩件事決定：【文件】[1]
  - 地震區：5 種表格（Very High、High、Moderately High、Moderate、Low），每種有自己的基本分。
  - 建物類型：17 種 FEMA 建物類型，加上「Do Not Know（不知道）」。
    - 木造：W1、W1A、W2
    - 鋼構：S1（抗彎構架）、S2（斜撐）、S3（輕鋼）、S4（鋼構加 RC 剪力牆）、S5（鋼構加無筋磚填充牆）
    - 混凝土：C1（抗彎構架）、C2（剪力牆）、**C3（RC 構架加無筋磚填充牆）**
    - 預鑄：PC1（tilt-up）、PC2
    - 加筋磚造：RM1、RM2
    - 無筋磚造：URM
    - 組合屋：MH
- 基本分適用的是「有耐震規範、但在基準年之前」的建物。【文件】[1]
- **Level 1 修正分**（表格上的欄位）：【文件】[1]
  - 嚴重垂直不規則（Severe Vertical Irregularity）—— **軟弱層屬於這一類**
  - 中度垂直不規則（Moderate Vertical Irregularity）
  - 平面不規則（Plan Irregularity）
  - 規範前（Pre-Code）：減分
  - 基準年後（Post-Benchmark）：加分
  - 土壤 A 或 B 類：加分
  - 土壤 E 類（1～3 層）、土壤 E 類（超過 3 層）：減分
- 在手冊附錄表格的文字摘錄中，嚴重垂直不規則的修正分約在 −1.0 到 −1.4 之間。【文件】[1]（摘錄無法確認是哪一個地震區的表）
- 有最低分（minimum score）的下限，避免加減到不合理。【文件】[1]
- **Level 2**：先算「調整後基準分」S′ ＝ SL1 − Level 1 垂直不規則分 − Level 1 平面不規則分，再用 Level 2 更細的修正分重算。【文件】[1]

### 分數代表什麼

- 最終分數 S 是「在風險目標最大考量地震（MCER）下的倒塌機率」的對數。【文件】[1]
  - S ＝ 2：倒塌機率約 1/100。
  - S ＝ 3：倒塌機率約 1/1,000。
- 手冊明說：這個估計「基於有限的觀測與分析資料，倒塌機率是近似值」。【文件】[1]
- 預設門檻（cut-off score）是 2.0。重要或緊急設施可以用更高的門檻。【文件】[1]
- 分數高只表示倒塌機率低，不表示震後能繼續營運。【文件】[1]

### 什麼情況要送詳細評估

只要符合任一項：【文件】[1]

- 最終分數低於門檻。
- 不知道建物類型。
- 有和鄰棟碰撞的可能。
- 鄰棟有東西會掉下來。
- 有地質災害（液化、坡地）或土壤 F 類。
- 有明顯損壞或劣化。

### 誰可以做

- Level 1 可以由很多人做：土木與結構技師、建築師、設計專業人員、建管人員、營造廠、設施管理人員、消防員、建築與工程科系學生等。【文件】[1]
- 篩檢員訓練每人 6～8 小時。【文件】[1]
- Level 2 與門檻判斷建議由有耐震設計經驗的設計專業人員處理。【文件】[1]（摘錄文字的上下文不完整，確切資格要求【待確認】）

### 一棟要多久、要花多少

| 項目 | 時間 | 來源 |
|---|---|---|
| 篩檢員訓練 | 每人 6～8 小時 | [1] |
| 出發前資料蒐集與審閱 | 每棟 15～75 分鐘 | [1] |
| 現場 Level 1 | 每棟 15～30 分鐘 | [1] |
| 進入室內 | 每棟再加 15～30 分鐘 | [1] |
| Level 2 | 每棟再加 5～15 分鐘 | [1] |
| 品質檢核 | 每棟 5～10 分鐘 | [1] |
| 資料後處理 | 每棟 15～30 分鐘 | [1] |
| 行政費用 | 總成本 10% | [1] |
| 建檔系統開發 | 總成本 2～5% | [1] |

### 手冊的範例

- 一棟 S2（鋼構斜撐）建物，沒有不規則，不適用基準年加分，土壤 D 類不調整。最終 SL1 ＝ 2.0。【文件】[1]
- 篩檢員記錄「從四面看過外觀，但沒進室內」。這個「檢視範圍（Extent of Review）」欄位要填。【文件】[1]

## 成效數字

| 指標 | 數字 | 資料日期 | 證據 | 來源編號 |
|---|---|---|---|---|
| 現場篩檢時間 | 每棟 15～30 分鐘 | 2015 | 【文件】 | 1 |
| 出發前資料準備 | 每棟 15～75 分鐘 | 2015 | 【文件】 | 1 |
| 篩檢員訓練 | 每人 6～8 小時 | 2015 | 【文件】 | 1 |
| 預設門檻對應的倒塌機率 | S ＝ 2.0 → 約 1/100 | 2015 | 【文件】 | 1 |
| 建物類型數 | 17 種（另加「不知道」） | 2015 | 【文件】 | 1 |
| 與其他目視篩檢法比較 | FEMA 154 每棟 15～30 分鐘；加拿大 NRCC 法約 1 小時 | 2022 | 【文件】 | 3 |
| CAPSS 抽樣街訪規模（目視法應用例） | 14 區、約 840 棟、約 2,000 張照片 | 2010 | 【文件】 | 5 |
| P-154 分數與實際震損的吻合度 | 本輪未取得一手驗證數字 | — | 【待確認】 | — |

## 批評與失敗

- **分數本身是近似**：手冊自己承認倒塌機率是近似值，基於有限資料。【文件】[1]
- **看不到室內就會漏**：目視只能看外觀。西雅圖 URM 清冊驗證發現，很多「看起來像磚造」的其實是磚貼面。【文件】[4]
  - 舊金山 CAPSS 抽樣也承認，臨街面被封起來的建物看不出和鄰棟有沒有縫。【文件】[5]
- **費時**：每棟 15～30 分鐘看起來不多，但加上前置、後處理、交通，大規模做還是很貴。回顧研究建議用機器學習、模糊邏輯改良。【文件】[3]
- **「不知道」類型會變多**：外觀看不出構造時只能填 Do Not Know，直接被送去詳評，篩檢效果打折。【文件】[1]【推論】
- **準確率研究**：學界有多篇用震後資料檢驗 P-154 的研究，本輪未能逐篇取得原文與數字。【待確認】

## 最新動態（2023～2026）

- **用街景與 AI 自動化 RVS** 是這幾年的主流研究方向。只列摘要，技術細節由另一組做。
  - Yu 等人（2020，Earthquake Engineering and Engineering Vibration）：用街景影像加深度學習分類，自動辨識軟弱層建物。建了大型建物影像資料庫，並用半自動方式標註。【文件】[6]
  - Aravena Pelizari 等人（2021，ISPRS Journal of Photogrammetry and Remote Sensing）：用街景影像與深度學習，自動判斷建物的耐震相關屬性。【文件】[7]
  - Ruggieri 等人（2021，Automation in Construction）：用機器學習做既有建物的脆弱度分析。【文件】[8]
  - Bektaş 與 Kegyes-Brassai（2022，Sustainability）：回顧各國傳統 RVS 方法，建議用機器學習與模糊邏輯改良。【文件】[3]
- 2023～2026 年 FEMA 是否發布 P-154 第 4 版或新的電子工具，本輪未查到。【待確認】

## 對臺北的可轉移性

- 可以借：
  - **「篩檢不是評估」的定位**。我們的模型也該明講：分數高只代表「值得優先請技師看」。【推論】
  - **分數＝倒塌機率數量級**的表達方式。比「綜合指數 73 分」好解釋，也不會讓人以為很精準。【推論】
  - **修正分的結構**：建物類型基本分 ＋ 不規則 ＋ 年代 ＋ 土壤。對應到臺北：構造 ＋ 一樓店面或騎樓 ＋ 建成年 ＋ 液化潛勢。【推論】
  - **檢視範圍欄位**：記錄「從幾面看、有沒有進室內」。我們的資料也該記「這個里的值是推估、抽樣、還是全查」。【推論】
- 不能直接借（為什麼）：
  - P-154 的基本分是用美國建物與美國地震危害算的，不能直接套在臺北。【推論】
  - 臺灣已有自己的耐震初評制度，P-154 只能當方法參考。臺灣制度由其他研究組負責，本檔不展開。【推論】
  - 黑客松 10/24 前不可能真的上街篩檢幾千棟。【推論】
- 前提條件：
  - 要有一份候選建物名單（地址＋建成年）當篩檢母體。【推論】
  - 若用街景，要先處理影像授權與個資。【推論】
- 對應解法方向：
  - **S1**：把 P-154 的「基本分＋修正分」改成里層級：每個里的老公寓戶數當基本，再依液化、一樓店面比例、窄巷加減。各因子分開顯示，正好是 S1 要的形狀。
  - **S2**：地址查詢頁可以給一張「自己看自家」的簡化 Level 1 檢核表，例如一樓是不是大面開口、有沒有加蓋、旁邊有沒有緊貼的建物。讓屋主自己初篩，再決定要不要申請老屋健檢。
  - **S4**：P-154 的時間與成本表，可以拿來估「臺北若要逐棟篩檢老公寓要花多少人時」，寫進資料債清單。

## 可以直接抄的設計細節

**1. 分數轉倒塌機率的對照**（直接用在儀表板說明文字）【文件】[1]

| 分數 S | 倒塌機率（MCER 下） | 建議 |
|---|---|---|
| ≥ 3 | 約 1/1,000 以下 | 低優先 |
| 2～3 | 約 1/100～1/1,000 | 中優先 |
| < 2 | 約 1/100 以上 | 建議詳細評估 |

臺北 MVP 不能宣稱這是倒塌機率，只能借用「對數尺度、門檻值、近似值警語」的呈現方式。【推論】

**2. 臺北版里層級「篩檢分數」草案**【推論】

```text
里分數 = 基本分（依該里老公寓的構造與年代組成）
       + 修正分：液化中高潛勢 (−)
       + 修正分：一樓店面或騎樓比例高 (−)，對應 P-154「嚴重垂直不規則」
       + 修正分：1999 年後新建比例高 (+)，對應 P-154「基準年後」
       + 修正分：窄巷或消防通道不足 (−)
低於門檻 → 列入「優先老屋健檢」名單
```

**3. 每筆資料必帶的「檢視範圍」欄位**【文件】[1]【推論】

- P-154 原欄位：外觀看了幾面、是否進入室內、是否看過圖說、土壤資料來源、地質災害資料來源。
- 臺北版：`data_source`（實價登錄／稅籍／抽樣／全查）、`sample_n`（樣本數）、`as_of`（資料日期）、`confidence`（高／中／低）。

**4. 送詳評的觸發條件清單**（屋主自評表可以照抄）【文件】[1]

- 看不出是什麼構造。
- 和隔壁緊貼、樓層不同高。
- 外牆有明顯裂縫或鋼筋外露。
- 位在液化或山坡地區。
- 一樓整面開口（店面、車庫）。

**5. 抽樣設計參考**（CAPSS 的實際做法）【文件】[5]

- 每個分區 30 棟街角、30 棟中段，用統計判斷 30 棟已足夠估比例。
- 臺北若用街景抽樣，每里至少 30 棟才有意義的比例估計；樣本不足的里要在地圖上標出來。【推論】

## 來源

1. FEMA P-154, Rapid Visual Screening of Buildings for Potential Seismic Hazards: A Handbook, Third Edition，Federal Emergency Management Agency（Applied Technology Council 編撰），https://www.fema.gov/sites/default/files/2020-07/fema_earthquakes_rapid-visual-screening-of-buildings-for-potential-seismic-hazards-a-handbook-third-edition-fema-p-154.pdf，資料日期 2015-01，存取 2026-10-17（以全文摘錄方式取得，未逐頁通讀）
2. FEMA P-155, Rapid Visual Screening of Buildings for Potential Seismic Hazards: Supporting Documentation, Third Edition，FEMA，https://www.fema.gov/sites/default/files/2020-07/fema_earthquakes_rapid-visual-screening-of-buildings-for-potential-seismic-hazards-supporting-documentation-third-edition-fema-p-155.pdf，資料日期 2015-01，存取 2026-10-17（下載被擋，僅確認存在；P-154 手冊指向此文件說明計分依據）
3. Bektaş, N. & Kegyes-Brassai, O. Conventional RVS Methods for Seismic Risk Assessment for Estimating the Current Situation of Existing Buildings: A State-of-the-Art Review，Sustainability 14(5):2583，https://doi.org/10.3390/su14052583，資料日期 2022-02-23，存取 2026-10-17
4. Report to Policy Committee on URM List Validation，Seattle Department of Construction and Inspections，https://www.seattle.gov/documents/Departments/SDCI/Codes/ChangesToCodes/UnreinforcedMasonry/ReportToPolicyCommitteeURMListValidation.pdf，資料日期 2016，存取 2026-10-17
5. Potential Earthquake Impacts: Technical Documentation (ATC-52-1A)，Applied Technology Council for San Francisco DBI，https://sfgov.org/sfc/sites/default/files/ESIP/FileCenter/Documents/9752-atc521a.pdf，資料日期 2010，存取 2026-10-17
6. Yu, Q., Wang, C., McKenna, F., Yu, S. X., Taciroglu, E., Cetiner, B., Law, K. H. Rapid visual screening of soft-story buildings from street view images using deep learning classification，Earthquake Engineering and Engineering Vibration 19:827–838，https://doi.org/10.1007/s11803-020-0598-2，資料日期 2020-10，存取 2026-10-17（僅讀摘要）
7. Aravena Pelizari, P., Geiß, C., Aguirre, P., Santa María, H., Merino Peña, Y., Taubenböck, H. Automated building characterization for seismic risk assessment using street-level imagery and deep learning，ISPRS Journal of Photogrammetry and Remote Sensing 180，https://doi.org/10.1016/j.isprsjprs.2021.07.004，資料日期 2021-10，存取 2026-10-17（僅確認書目）
8. Ruggieri, S., Cardellicchio, A., Leggieri, V., Uva, G. Machine-learning based vulnerability analysis of existing buildings，Automation in Construction 132:103936，https://doi.org/10.1016/j.autcon.2021.103936，資料日期 2021-12，存取 2026-10-17（僅確認書目）
