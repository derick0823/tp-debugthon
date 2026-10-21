# R2c：文資建物怎麼進耐震排序，前線怎麼分流

- 任務：R2c（任務板）。負責：國際debug-38。交件：2026-10-18。
- 起點：使用者 10/18 轉述的訪談 F1（文資保存會卡住重建或補強）、F4（外包前線接電話，10 分鐘內答不出來才轉承辦），見 `solutions/briefs/user-2026-10-18-interview-addendum.md`【訪談】。
- 方法：2 個子研究員查一手來源，先讀 R2、R4-INTL 既有案例再補查。

## 1. 文資建物在耐震排序裡怎麼處理

**一句話：四國都沒有把文資建物剔出風險清單。差別在後續：延後期限、降低標準，或另走一條文化部門的軌道。**【推論】

| 地方 | 文資怎麼進排序 | 誰決定 | 數字 | 來源 |
|---|---|---|---|---|
| 紐西蘭 | **不排除、可延後。** 判定標準一樣是 34% NBS，一樣上公開登錄，登錄有「文資狀態」欄位（5 類）。Category 1 歷史建物可申請延長最多 10 年；2026 新法把所有建物的延長上限改成 15 年，文資的優勢變小【文件；優勢變小是推論】 | 地方政府核准延長；動到文資清單要另申請資源同意 | Heritage EQUIP 基金 2016 年起 4 年 1,200 萬紐幣，屋主出配合款，已結束【文件】 | R2 `cases/nz-earthquake-prone-buildings.md`；Ministry for Culture and Heritage, Built heritage support |
| 義大利 | **換一套標準。** 受保護文資「任何情況下都可以只做改善（miglioramento）」，不必達標（adeguamento）（NTC 2018 §8.4）。2011 文資耐震指引分三級評估，第一級是區域尺度、涵蓋所有受保護文資【文件】 | 文資上的任何工程都要文資監管局長（soprintendente）許可（D.Lgs. 42/2004 第 21 條） | 指引 2011-05-27 生效【文件】 | D.Lgs. 42/2004 第 21、29 條；NTC 2018 第 8 章 |
| 日本 | **另走文化廳的軌道，自己排優先順序。** 國寶、重要文化財不適用建築基準法（第 3 條），改用文化廳 1999 年耐震診斷指針。優先做「不特定的人會進入」的國寶與重文【文件】 | 所有者自主診斷，都道府縣教育委員會指導；地方歷史建築要條例加建築審查會同意 | 2019-11 調查：4,080 棟中 62.2% 完成耐震對策；不特定的人會進入的 1,872 棟只完成 45.1%【文件】 | 文化廳 耐震對策現況調查（2019-11-30）、耐震診斷指針（1999-04-08） |
| 洛杉磯、舊金山 | **不排除、不延後，改用替代標準。** 洛杉磯的軟弱層與磚造條例規定，合格歷史建物適用加州歷史建築法規（CHBC），地震力可打折【文件；打折係數待確認】。舊金山先對約 100 棟軟弱層轉角建物做文資普查，事先標出補強時要保留的特徵，用來加速審查【文件】 | 建管單位執行；舊金山規劃局做文資審查 | 沒有文資案量統計 | LA Ord. 183893；SF Planning Historic Resource Survey FAQ（2014-06） |

## 2. 前線怎麼分流

**一句話：四地的前線都有三樣東西：業務單位維護的標準問答、用地址查得到的公開案件畫面、一條寫明的轉出線。**【推論】

| 地方 | 前線能答什麼 | 什麼時候轉出 | 用什麼支援前線 | 數字 | 來源 |
|---|---|---|---|---|---|
| 紐約 311 → 建築局 | 一般資訊、報案說明；幫建築局預約審圖 | 要出勤的開服務請求自動送建築局；涉及特定建物的違規、許可、使用執照，轉該區建築局辦公室 | 311 每個知識條目對到一個機關；建築局 BIS 系統可用地址查投訴、違規、許可 | 2018 年建築局相關電話 217,600 通：開服務請求 40%、預約 31%、當場答 12%、轉建築局 9%【實測，Socrata API 2026-10-18】 | NYC Open Data wewp-mm3p；DOB Get Building History |
| 英國 值班規劃員（Belfast、West Lindsey） | 要不要申請、簡單案件怎麼做、流程、鄰居怎麼表示意見；不拘束日後審查 | **每次原則上不超過 15 分鐘**；複雜的轉付費申請前諮詢；審理中的案件找承辦 | 沒找到前線專用知識庫 | West Lindsey：email 2 個工作天內回、申請前諮詢 21 天內回【文件】 | Belfast Duty Planner Service；West Lindsey 服務標準 |
| 英國 Haringey 的教訓 | 值班規劃員的口頭建議平時沒有記錄，後來吵「當初說可以」 | 改成付費書面申請前諮詢，2015-12 有 147 件；代價是工作量變重【文件】 | — | — | Haringey Regulatory Committee, 2015-12-22 |
| 新加坡 URA | 大部分改成民眾自己查：地圖可查 2000 年後所有規劃許可、1990 年後的規劃決定免費查；店屋用途從付費等 7 天變成當場免費查【文件】 | 要容積、高度等規劃指引走正式申請；其他用書面表單或專線 | URA SPACE 地圖 | 沒有轉接比例 | URA Continuous Improvements（2020-10-21） |
| 首爾 120 | 九成當場解決，一成交給承辦（2010）【文件】 | 具體門檻沒找到【待確認】 | 標準問答 9,909 種（市府 4,910、各區 4,999），和局處合辦檢查累計更新 14,732 筆，**每季整理高頻問題**；2017 年起擴大客服查行政資料的權限【文件】 | 一次處理率 90%（2010-10） | 首爾市議會 120 茶山財團業務報告（2025-09，p.15） |

## 3. 對 A6（里況段落產生器、前線 10 分鐘問答）的啟示【推論】

1. **轉出線畫在「能不能就這個案子下判斷」**：前線用 A6 答「一般規定＋這個里或這個地址的公開現況」，只要問到「我的案子能不能過」就轉承辦。紐約、Belfast 都這樣畫，Belfast 的 15 分鐘上限和臺北的 10 分鐘同一量級。
2. **每次答覆要自動留紀錄**：A6 產出的段落要帶資料版本與日期，並存一份「當時給了哪一段」。Haringey 的教訓是口頭建議沒記錄就會起爭議。
3. **文資當欄位標出來，不要拿來剔除**：A6 的里況段落與 S1 的排序，都把「是否涉及文資」列成一個屬性，並寫出下一步要找哪個機關（例如文化局）。國外沒有一國把文資剔出風險清單，而是標出來後另走程序。

## 來源

各國詳細來源見本頁表中所列，以及：
- R2 `cases/nz-earthquake-prone-buildings.md`
- R4-INTL `cases/us-nyc-311-and-council-requests.md`、`cases/kr-seoul-120-dasan.md`、`cases/uk-member-enquiries-casework.md`
- 文化庁 国宝・重要文化財建造物の耐震対策現況調査結果，https://www.bunka.go.jp/koho_hodo_oshirase/hodohappyo/91957301.html
- Belfast City Council, Duty Planner Service，https://www.belfastcity.gov.uk/planning-and-building-control/planning/applying-for-planning-permission/duty-planner-service
- West Lindsey District Council, Planning Team customer service standards，https://www.west-lindsey.gov.uk/planning-building-control/planning/planning-team-customer-service-standards
- Haringey Regulatory Committee, Planning Services 2015 review，https://www.minutes.haringey.gov.uk/documents/s82916/sept_2015_report_template_with_guidance.pdf
- URA, Continuous Improvements to URA Services，https://www.ura.gov.sg/guidelines/best-practices/continuous-improvements-in-ura-services/
- 서울특별시의회 제332회 임시회 120다산콜재단 주요업무보고，https://mas.smc.seoul.kr/attach/record/SEOUL/appendix/a11/A0069643.pdf
- NYC Open Data, 311 Call Center Inquiry（wewp-mm3p），https://data.cityofnewyork.us/resource/wewp-mm3p.json
