# data.taipei 再搜一次：第 6 題還有沒有可用的資料（2026-10-23）

- 搜尋者：debug-b9（原 ee）。依 `BRIEF.md`。只看詮釋資料，沒有下載任何資料檔。
- 證據等級：表中的欄位、格式、更新頻率、最後更新、授權，都是 `dataset.view` 回傳的詮釋資料【實測，2026-10-23 19:16～19:20】。「對哪個原型有用」與「建議」是【推論】。
- 已有的來源：`data/catalog.json` 與 `data/raw/extra/_sources.csv` 中 data.taipei 的來源約 45 筆。我用資料集 id 逐筆比對「我們有沒有」。

## 1. 候選資料集（24 筆，我們沒有的 23 筆）

| 名稱 | 網址 | 提供機關 | 授權 | 格式 | 更新頻率／最後更新 | 粒度 | 對哪個原型或 Day 2 哪一頁有用 | 我們有沒有 | 建議與理由 |
|---|---|---|---|---|---|---|---|---|---|
| 臺北市公寓大廈組織報備查詢 | https://data.taipei/dataset/detail?id=d665fc9b-0f60-4d53-bd43-971ae8755680 | 都發局建管處 | 政府資料開放授權條款第 1 版 | CSV，約 8.2 MB | 不定期／2026-10-05 | 棟（執照號碼、管委會設置地址） | `consent-tracker`、`consent-simulator`：這棟有沒有管委會，是整合難度的代理指標；`renewal-calculator` 的替代路卡 | 無 | **主用**。逐棟、有執照號碼可以接使照摘要。欄位：執照號碼、核發日期、行政區代碼、行政區、管委會名稱、管委會設置地址 |
| 臺北市可供避難收容處所一覽表 | https://data.taipei/dataset/detail?id=aaf97773-3631-40e2-b3cc-da87bf2ce1d5 | 教育局 | 同上 | CSV，88 KB | 不定期／2026-09-14 | 點（門牌）＋服務里別 | `rescue-drill-map` 檢核表：「本里的震災收容所」；`priority-ranking` | 無 | **主用**。有「震災」欄、「服務里別」、容納人數、無障礙設施。**含聯絡人與管理人的姓名、電話，使用時要刪掉這幾欄** |
| 114年臺北市可供避難收容處所一覽表 | https://data.taipei/dataset/detail?id=f327232d-9230-44d0-bf0c-df151802da32 | 社會局 | 同上 | CSV，399 筆 | 不定期／2025-06-16 | 點＋服務里別 | 同上 | 無 | 備用。欄位同上但沒有聯絡人欄；資料較舊。和教育局版的差異待確認 |
| 大臺北地區消防栓分布點位圖 | https://data.taipei/dataset/detail?id=c106a00b-5a21-4393-b213-475a0ece9f2b | 北水處 | 同上 | CSV，30,481 筆，約 3.8 MB | 每 3 月／2026-09-15 | 點（TWD97 與 WGS84） | `rescue-drill-map`：每條列管窄巷離最近的消防栓多遠；`priority-ranking` 的救災因子 | 無 | **主用**。逐點有座標、型式。範圍含新北部分里，要用臺北市界篩 |
| 臺北市防空疏散避難設施資料集 | https://data.taipei/dataset/detail?id=70a6216e-3730-4d1d-b334-62fca2dd71cd | 警察局 | 同上 | CSV，約 3 MB | 每 3 月／2026-10-06 | 點（緯經度、村里別） | `rescue-drill-map` 補充：地下避難空間 | 無 | 備用。是防空用途，不是震災收容；地震時地下空間未必適合 |
| 臺北市防空避難處所清冊 | https://data.taipei/dataset/detail?id=29a13836-028e-430d-bf5d-18ad3850f178 | 都發局建管處 | 同上 | CSV，約 430 KB | 不定期／2025-10-27 | 點（地址） | 同上 | 無 | 備用。有「是否優先緊急避難」「是否依無障礙規範檢討」 |
| 臺北市士林區各里簡易疏散避難地圖資訊 | https://data.taipei/dataset/detail?id=4f58b1f2-f8ac-4f97-908b-a1303f57625e | 士林區公所 | 同上 | CSV（圖檔連結） | 不定期／2026-03-04 | 里 | `rescue-drill-map`：選里時附上官方疏散地圖連結 | 無 | 備用。只有圖檔網址。搜尋另看到信義（ed642d05）、北投（d76ca4fd）、內湖（00880bf8）三區版本；其他 8 區有沒有【待確認】 |
| 臺北市已核准自行劃定更新單元案件 | https://data.taipei/dataset/detail?id=4bf19a69-86e7-40cb-93e2-a45dc7037f34 | 都發局更新處 | 同上 | CSV，27 KB | 不定期／資源 2024-06-13 | 案（行政區、案名） | `uro-cases`、`priority-ranking`：這一區已經有人在動 | 無 | 備用。只到 2024-06，而且沒有里或地號欄，要從案名解析 |
| 臺北市消防安全檢查重大不合格場所 | https://data.taipei/dataset/detail?id=871874fc-c3b8-4752-aa56-76101395589d | 消防局 | 同上 | CSV | 每 1 月／2026-10-19 | 點（場所地址） | `rescue-drill-map` 可加註 | 無 | 備用。多為營業場所，和老舊住宅關係弱 |
| 臺北市公共管線圖資_自來水系統消防栓 | https://data.taipei/dataset/detail?id=75e76c74-1934-431a-8831-690f0a254784 | 工務局 | 同上 | XML，約 20 MB | 不定期／2026-02-23 | 點 | 同消防栓 | 無 | 不用。和北水處版重複，格式較難用、檔案大 |
| 臺北市防空疏散避難設施（統計） | https://data.taipei/dataset/detail?id=53094bc6-b89e-4ae0-b4e0-6f237aedd9c0 | 主計處 | 同上 | CSV | 每 1 年／2026-05-04 | 市 | — | 無 | 不用。全市總數 |
| 臺北市防空避難設備資料集 | https://data.taipei/dataset/detail?id=6f9e3b81-2824-47c7-b438-d50ec7d1c7b7 | 警察局 | 同上 | CSV | 每 1 年／2026-01-09 | 分局 | — | 無 | 不用。分局總數 |
| 臺北市身心障礙人口數（102 年以後） | https://data.taipei/dataset/detail?id=4ea0cc26-72ff-4726-aff5-2a6555f11282 | 主計處 | 同上 | CSV，468 筆 | 每 1 年／2026-05-07 | 市（年齡別） | — | 無 | 不用。沒有里或區 |
| 臺北市老人長期照顧、安養機構與老人公寓、老人住宅概況 | https://data.taipei/dataset/detail?id=808c1eb5-53e6-4d3c-bfb6-3b37412f7b32 | 社會局 | 同上 | CSV | 不定期／2026-09-21 | 市（年月） | — | 無 | 不用。全市總數。搜尋另看到一份機構逐筆清單（含地址），詮釋資料未查【待確認】 |
| 臺北市消防安全設備檢修申報 | https://data.taipei/dataset/detail?id=c625425a-2f71-4bca-8533-6afb1d0d14b7 | 消防局 | 同上 | CSV | 不定期／2026-09-17 | 區 | — | 無 | 不用。區層級申報率 |
| 臺北市違章建築處理資料 | https://data.taipei/dataset/detail?id=9623086f-9211-4d6e-ae2e-2392633b931c | 都發局建管處 | 同上 | CSV | 不定期／2026-10-05 | 市（年度） | — | 無 | 不用。年度件數 |
| 臺北市建築管理按月別 | https://data.taipei/dataset/detail?id=fc1c186b-732d-4915-97ad-29cf0c869feb | 主計處 | 同上 | CSV，92 筆 | 每 1 月／2026-09-22 | 市（月） | — | 無 | 不用。已有逐案建照、使照摘要 |
| 臺北市土地及建物登記管理 | https://data.taipei/dataset/detail?id=c1850321-58c7-4fd8-a474-c6585ddfc6c2 | 地政局 | 同上 | CSV | 每 1 年／2026-03-27 | 市（工作項目） | — | 無 | 不用 |
| 臺北市政府消防局 EOC 開放資料專區 | https://data.taipei/dataset/detail?id=ef1813fb-6685-4841-a5c0-6e2acb2c0650 | 消防局 | **詮釋資料寫「依菸酒管理法相關規定」**（看起來是登錄錯誤） | 6 個資源 | 不定時／2026-06-17 | — | — | 無 | 不用。只在災害應變中心二級以上開設時才有資料；授權欄要先問清楚 |
| 「臺北防災 立即go」防災手冊 | https://data.taipei/dataset/detail?id=fc5c9391-873e-4a34-9ba9-7350cabd1442 | 消防局 | 同上 | CSV（下載網址） | 不定期／2025-06-16 | — | `design-kit`、`rescue-drill-map`：可以放官方手冊連結 | 無 | 不用當資料；可當「下一步」連結 |
| 臺北市災害通報一覽表 | https://data.taipei/dataset/detail?id=a9ff987d-3552-443f-8aed-3be10aac0a9d | 消防局 | 同上 | CSV | 不定期／2026-01-15 | 區（單位電話） | — | 無 | 不用 |
| 提升臺北市耐災韌性 | https://data.taipei/dataset/detail?id=7bda0a93-81f7-41dc-94a5-2810ce429799 | 消防局 | 未填 | PDF | —／2021-01-28 | — | — | 無 | 不用。出國或交流報告 |
| 臺北市建築管理雙年刊 | https://data.taipei/dataset/detail?id=55a65f6f-d74d-47cf-bc97-779c6c21d6e2 | 都發局建管處 | 未填 | PDF | —／2015-03-02 | — | — | 無 | 不用。2015 年刊物，資源大小 0 |
| 臺北市現有營造建築物棟數 | https://data.taipei/dataset/detail?id=7889e8a0-a71e-44e0-95c7-2213a7db1474 | 主計處 | 同上 | CSV，50 筆 | 每 1 年／2026-02-26 | 市 | — | `building-count` | 已有 |

搜尋結果裡還有幾類，沒有計入上表：

- 市府公報裡的法規與函釋 PDF，例如「協助老舊建築物更新增設電梯補助作業規範」「老屋健檢案件申請及補助費用作業要點」「建築物外牆飾面剝落申請修繕及補助費用作業要點」「危老都更推動師培訓執行計畫」。這些是規定，不是資料集，可以給 `renewal-calculator` 的替代路卡當出處【推論】。
- 沒有找到的：耐震初評或老屋健檢的**案件**資料、增設電梯補助的核准名單、里層級的身障人口、防災公園與救災路線圖層。

## 2. 搜了什麼、請求總數

**對 data.taipei 的請求：28 個**（1 個 404、27 個 200），時間 19:15:23～19:20:50【實測】。逐筆紀錄在 `workspace/scratch/2026-10-23-data-taipei/requests.csv`（不進 git）。

| 段落 | 請求 | 結果 |
|---|---|---|
| 1. 猜搜尋端點 `dataset.list` | 1 | 404。網址猜錯，不是被擋。依紀律停下，回報統籌 |
| 2. 找搜尋端點：首頁、入口 JS、資料集頁分塊 | 3 | 都是 200。搜尋函式在另一個分塊（`9briHQ1p.js`），統籌給的 3 個請求額度已用完，沒有再抓 |
| 3. `GET dataset.view` 逐筆查詮釋資料 | 24 | 都是 200，間隔 4.5 秒 |

找資料集 id 改用一般搜尋引擎（限定 data.taipei 網域），沒有對 data.taipei 發請求。共 15 次搜尋，每次回約 10 個連結：

| 關鍵字組 | 找到的資料集候選（不含公報 PDF） |
|---|---|
| 耐震、建築物 | 3（列管建築物、建照套繪、棟數，都已有）＋耐災韌性報告、建管雙年刊 |
| 危老、都更、老舊建築 | 0 個資料集；公報規定 PDF 約 8 份 |
| 公寓大廈、管委會、報備（2 次） | 1（管委會報備清冊） |
| 避難收容、防災、疏散 | 7（兩版收容處所、防空 3 筆、士林與信義疏散地圖、EOC） |
| 身障、高齡、長照、里 | 4（身障人口、長照概況、身障調查、白皮書） |
| 耐震評估、補強、補助 | 0 個新資料集（海砂屋統計已有） |
| 消防栓、分隊、救災 | 6（兩份消防栓、防災手冊、通報一覽、檢修申報、重大不合格） |
| 都更地區、更新單元 | 1（已核准自行劃定更新單元） |
| 違建、外牆、公安檢查 | 1（違建處理統計） |
| 斷層、地質敏感、山崩 | 0 |
| 社宅、增設電梯補助 | 1（包租代管統計，和第 6 題無關，沒有列入） |
| 老屋健檢、耐震初評 | 1（建築管理按月別） |
| 房屋稅、構造、樓層、屋齡 | 1（土地及建物登記管理） |
| 防災公園、救災路線 | 3（北投、內湖疏散地圖；防空避難設備） |

BRIEF 列的關鍵字裡，地籍、實價登錄、門牌、窄巷、容積、液化，我們的 catalog 已經有對應來源，這輪沒有再搜。

## 3. 最該補的 3 筆

| 順位 | 資料集 | 為什麼 | 補了改哪個畫面 | 要花多久【推論】 |
|---|---|---|---|---|
| 1 | 公寓大廈組織報備查詢 | 「這棟有沒有管委會」是逐棟的整合難度訊號。沒有管委會的老公寓，同意書要一戶一戶找，正是 G3 同意門檻的痛點。目前沒有任何原型有這一欄 | `consent-tracker`、`consent-simulator`：輸入地址後顯示「本棟有／沒有報備管委會」；`data/marts/` 加一欄 `has_management_committee` | 約 2 小時：下載 8 MB CSV（要另外取得同意，因為超過這輪的 5 MB 上限），用 `pipelines.address` 比對管委會設置地址到門牌與里，再寫進 mart。執照號碼可以另外接使照摘要，但我們的使照摘要只有 90 年以後的 |
| 2 | 可供避難收容處所一覽表（教育局） | 有「震災」欄與「服務里別」，可以直接回答「這個里震後去哪裡」。演練檢核表現在沒有收容所這一項 | `rescue-drill-map` 右欄檢核表加一項：「本里的震災收容所 N 處、可容納約 M 人」，附無障礙有無 | 約 1 小時。要刪掉聯絡人與管理人的姓名、電話欄 |
| 3 | 大臺北地區消防栓分布點位圖 | 有座標，每 3 個月更新。可以算每條列管窄巷離最近消防栓的距離，把「救災進不去」從巷寬一項，擴大到「進得去也接不到水」 | `rescue-drill-map` 窄巷清單每列加「最近消防栓 ○○ m」；`priority-ranking` 的救災因子可加一個子項 | 約 1.5 小時：用 EPSG:3826 算最近距離。窄巷的位置是門牌中心（推估），距離也只能標「推估」 |

## 4. 待確認

1. 教育局版與社會局 114 年版收容處所名單的差異，以及哪一份是現行版。
2. 其他 8 區有沒有「各里簡易疏散避難地圖」資料集。
3. 搜尋時看到的長照機構逐筆清單（含地址），詮釋資料還沒查。
4. 消防局 EOC 專區的授權欄寫「依菸酒管理法相關規定」，應是登錄錯誤，要問消防局。
5. 管委會清冊的執照號碼涵蓋哪些年份。如果含 90 年以前的使照，比對門牌之外，還可以接其他使照資料。

## 5. 已下載（2026-10-23）

- 範圍：上表建議是「主用」「備用」的全部（主用 3、備用 6），另加搜尋時看到的信義、北投、內湖三區疏散地圖清單（和士林版同屬一列「備用」）。共 12 筆，合計 15.62 MB。
- **更正**：19:22 回報統籌時寫「備用 7、不用 13」，正確是**備用 6、不用 14**（另 1 筆已有）。
- 請求：第 29～52 號，共 24 個（每筆 1 個 `dataset.view` ＋ 1 個下載），全部 200，沒有轉址；今晚 data.taipei 合計 52 個請求【實測，19:39～19:41，`workspace/scratch/2026-10-23-data-taipei/requests.csv`】。
- 每個資料夾都有 `_manifest.json`（出處、機關、授權、更新頻率、sha256）。承辦人姓名、電話、Email 沒有寫進 manifest。
- 和 code.gov.tw 清單的重疊：D12（收容處所，同一個 id）由本清單下載。D13 消防栓的 id 是 `679a0801`，和本清單的 `c106a00b` 不同，可能是不同版本【待確認】。

| slug | 路徑 | 檔數 | 大小 | 授權狀態 | 備註 |
|---|---|---|---|---|---|
| building-committees-taipei | `data/raw/extra/permits/building-committees-taipei/` | 1 | 8.20 MB | 已查（詮釋資料頁） |  |
| shelters-taipei-edu | `data/raw/extra/hazard/shelters-taipei-edu/` | 1 | 88.6 KB | 已查（詮釋資料頁） | 含個資欄（聯絡人、管理人姓名電話），不得進產品與 git；實際是 ODS |
| fire-hydrants-taipei-water | `data/raw/extra/hazard/fire-hydrants-taipei-water/` | 1 | 3.79 MB | 已查（詮釋資料頁） | 含新北部分里 |
| shelters-taipei-social-114 | `data/raw/extra/hazard/shelters-taipei-social-114/` | 1 | 77.9 KB | 已查（詮釋資料頁） |  |
| air-raid-shelters-taipei-police | `data/raw/extra/hazard/air-raid-shelters-taipei-police/` | 1 | 2.98 MB | 已查（詮釋資料頁） |  |
| air-raid-shelters-taipei-building-admin | `data/raw/extra/hazard/air-raid-shelters-taipei-building-admin/` | 1 | 0.43 MB | 已查（詮釋資料頁） |  |
| evacuation-maps-shilin-village | `data/raw/extra/hazard/evacuation-maps-shilin-village/` | 1 | 7.2 KB | 已查（詮釋資料頁） | 只有圖檔連結清單 |
| evacuation-maps-xinyi-village | `data/raw/extra/hazard/evacuation-maps-xinyi-village/` | 1 | 10.9 KB | 已查（詮釋資料頁） | 只有圖檔連結清單 |
| evacuation-maps-beitou-village | `data/raw/extra/hazard/evacuation-maps-beitou-village/` | 1 | 5.7 KB | 已查（詮釋資料頁） | 只有圖檔連結清單 |
| evacuation-maps-neihu-village | `data/raw/extra/hazard/evacuation-maps-neihu-village/` | 1 | 9.9 KB | 已查（詮釋資料頁） | 只有圖檔連結清單 |
| self-delineated-renewal-units-taipei | `data/raw/extra/renewal/self-delineated-renewal-units-taipei/` | 1 | 26.8 KB | 已查（詮釋資料頁） | 75 案，含地段地號與範圍圖 PDF 連結 |
| fire-inspection-major-failures-taipei | `data/raw/extra/hazard/fire-inspection-major-failures-taipei/` | 1 | 0.4 KB | 已查（詮釋資料頁） | 4 筆，Big5 |

可以直接貼進 `data/raw/extra/_sources.csv` 的列（欄位 `dir,title,dataset_page,direct_url,retrieved,license`）：

```csv
building-committees-taipei,臺北市公寓大廈組織報備查詢,https://data.taipei/dataset/detail?id=d665fc9b-0f60-4d53-bd43-971ae8755680,https://data.taipei/api/dataset/d665fc9b-0f60-4d53-bd43-971ae8755680/resource/b879cc87-7f42-4911-8093-d1f055ea9c45/download,2026-10-23,政府資料開放授權條款-第1版
shelters-taipei-edu,臺北市可供避難收容處所一覽表,https://data.taipei/dataset/detail?id=aaf97773-3631-40e2-b3cc-da87bf2ce1d5,https://data.taipei/api/dataset/aaf97773-3631-40e2-b3cc-da87bf2ce1d5/resource/4c92dbd4-d259-495a-8390-52628119a4dd/download,2026-10-23,政府資料開放授權條款-第1版
fire-hydrants-taipei-water,大臺北地區消防栓分布點位圖,https://data.taipei/dataset/detail?id=c106a00b-5a21-4393-b213-475a0ece9f2b,https://data.taipei/api/dataset/c106a00b-5a21-4393-b213-475a0ece9f2b/resource/b9f8154d-c627-48a8-b3ef-512ed9cde9e7/download,2026-10-23,政府資料開放授權條款-第1版
shelters-taipei-social-114,114年臺北市可供避難收容處所一覽表,https://data.taipei/dataset/detail?id=f327232d-9230-44d0-bf0c-df151802da32,https://data.taipei/api/dataset/f327232d-9230-44d0-bf0c-df151802da32/resource/3f20cc14-91a9-41de-8d03-6e019ec4d82c/download,2026-10-23,政府資料開放授權條款-第1版
air-raid-shelters-taipei-police,臺北市防空疏散避難設施資料集,https://data.taipei/dataset/detail?id=70a6216e-3730-4d1d-b334-62fca2dd71cd,https://data.taipei/api/dataset/70a6216e-3730-4d1d-b334-62fca2dd71cd/resource/3bd658e7-8e8a-446b-8df5-89b2b896ff97/download,2026-10-23,政府資料開放授權條款-第1版
air-raid-shelters-taipei-building-admin,臺北市防空避難處所清冊,https://data.taipei/dataset/detail?id=29a13836-028e-430d-bf5d-18ad3850f178,https://data.taipei/api/dataset/29a13836-028e-430d-bf5d-18ad3850f178/resource/ffad9f86-a4f9-4743-8f18-632557d2e887/download,2026-10-23,政府資料開放授權條款-第1版
evacuation-maps-shilin-village,臺北市士林區各里簡易疏散避難地圖資訊,https://data.taipei/dataset/detail?id=4f58b1f2-f8ac-4f97-908b-a1303f57625e,https://data.taipei/api/dataset/4f58b1f2-f8ac-4f97-908b-a1303f57625e/resource/c9b89178-6fbc-4a56-b586-2476090fedbb/download,2026-10-23,政府資料開放授權條款-第1版
evacuation-maps-xinyi-village,臺北市信義區各里簡易疏散避難地圖資訊,https://data.taipei/dataset/detail?id=ed642d05-1b2b-42eb-a679-838f8a689350,https://data.taipei/api/dataset/ed642d05-1b2b-42eb-a679-838f8a689350/resource/4e6f0014-a675-4e3a-a9e8-8d8d61706fb6/download,2026-10-23,政府資料開放授權條款-第1版
evacuation-maps-beitou-village,臺北市北投區各里簡易疏散避難地圖資訊,https://data.taipei/dataset/detail?id=d76ca4fd-55ad-48c6-8ba1-18a2ffd3ac24,https://data.taipei/api/dataset/d76ca4fd-55ad-48c6-8ba1-18a2ffd3ac24/resource/6d4ef9f8-7699-46ca-877c-ddc28ed7da04/download,2026-10-23,政府資料開放授權條款-第1版
evacuation-maps-neihu-village,臺北市內湖區各里簡易疏散避難地圖資訊,https://data.taipei/dataset/detail?id=00880bf8-8f57-4929-a7f8-a7c954685013,https://data.taipei/api/dataset/00880bf8-8f57-4929-a7f8-a7c954685013/resource/53ef21b7-9b4b-4343-a6b7-3e10e3cb2f69/download,2026-10-23,政府資料開放授權條款-第1版
self-delineated-renewal-units-taipei,臺北市已核准自行劃定更新單元案件,https://data.taipei/dataset/detail?id=4bf19a69-86e7-40cb-93e2-a45dc7037f34,https://data.taipei/api/dataset/4bf19a69-86e7-40cb-93e2-a45dc7037f34/resource/8b7a3b60-a45a-4d0f-96df-2529dd04d6cc/download,2026-10-23,政府資料開放授權條款-第1版
fire-inspection-major-failures-taipei,臺北市消防安全檢查重大不合格場所,https://data.taipei/dataset/detail?id=871874fc-c3b8-4752-aa56-76101395589d,https://data.taipei/api/dataset/871874fc-c3b8-4752-aa56-76101395589d/resource/d417e957-7205-451e-bf45-a31db78f6ec8/download,2026-10-23,政府資料開放授權條款-第1版
```
