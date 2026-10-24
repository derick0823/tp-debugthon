# 健檢報告：還可以放什麼（對照手上的資料）

- 日期：2026-10-24。子代理盤點，只讀檔，沒有連外網。
- 三個參數：**門牌**（A）、**屋齡**（Y，住戶自己填）、**家裡有沒有長者**（E）。
- 已決定要放、這份不重複：老屋健檢、我的里排名卡、救災地圖＋演練檢核表、容積獎勵積木、建議行動與補助。
- 路徑都相對於 repo 根目錄，每個都確認過存在。`data/raw/extra/` 底下每份都有 `_manifest.json`（授權、欄位、注意事項）。
- 先講一個坑：`data/marts/shards/` 的分片只有 27 欄，**沒有** `lvr_has_elevator`、`no_elevator_30plus`、`lvr_building_type`、`doorplate_units`。要用電梯欄就從 `data/marts/building_points.parquet` 補欄，或重建分片。

## 1. 點子表

工作量：小＝30 分鐘內；中＝半天內；大＝今天做不完。

| # | 點子 | 給住戶回答什麼問題 | 參數 | 資料檔路徑 | 粒度 | 工作量 | 風險 |
|---|---|---|---|---|---|---|---|
| 1 | 你填的屋齡和我們推估的差多少 | 「我記得的屋齡，和公開資料推出來的一樣嗎？」 | Y＋A | `data/marts/building_points.parquet`（`built_year`、`built_year_min/max`、`age_source`、`age_conf`） | 棟 | 小 | 推估誤差：鄰棟借用只有區間，要顯示區間＋「依鄰棟推估」。使用者填的屋齡不存、不上傳 |
| 2 | 耐震規範世代（用你填的屋齡重算） | 「我家蓋的時候，耐震規定到哪一代？在 1999 線前還是後？」 | Y | 斷點定義：`data/marts/README.md`（building_points 第 3 點、`code_generation` 欄）；逐棟值同上 parquet | 棟 | 小 | 「申請年＝建成年－2」是推論。兩個屋齡不同時，兩個世代都顯示 |
| 3 | 構造：加強磚造或磚造 | 「我家是 RC 還是磚造？」 | A | `building_points.parquet`（`structure_class`、`status_structure`） | 棟 | 小 | 來自實價登錄眾數，寫「推估」 |
| 4 | 加裝電梯補助資格預檢 | 「我家能不能申請加裝電梯補助？有長者補多少？」 | A＋Y＋E | `building_points.parquet`（`floors`、`lvr_has_elevator`、`no_elevator_30plus`、`sea_sand`）；條件與金額：`research/issue-06/mvp-variants/renewal-calculator/assets/nextsteps.js` order 10（一般 50%、每座最高 300 萬；戶內有 65 歲以上 80%、每座最高 480 萬；屋齡 20 年以上；截止 2026-12-31 或經費用完） | 棟 | 小（不含管委會）；中（含 #5） | 「住宅使用過半」「已領建築許可」我們查不到，要列成「請自己確認」。電梯欄不在分片（見上方坑） |
| 5 | 本棟有沒有報備管委會 | 「要申請補助或都更，我們有沒有可以出面的組織？」 | A | `data/raw/extra/permits/building-committees-taipei/本市管理組織資料.csv`（管委會設置地址）＋`pipelines/address.py` | 棟 | 中 | 地址比對率未知。只顯示「有／沒查到」，不顯示管委會名稱清單 |
| 6 | 最近一處「適合避難弱者」的收容所 | 「地震後，家裡長輩可以去哪裡？多遠？」 | A＋E | `data/raw/extra/hazard/shelters-nfa/Shelter.xml`（`adaptForWeaker`、`lat`、`lon`、`disastertype`）；去重後的說明在 `research/issue-06/mvp-variants/rescue-drill-map/data/drill_extra.json` 的 `meta` | 棟→處所 | 小 | 臺北 1,422 列是 476 處重複約三次，要先去重（適合避難弱者且含震災 119 處）。直線距離，不是步行路線 |
| 7 | 本里震災收容所處數與容納人數 | 「我們里的收容所夠不夠全里的人？」 | A | `data/raw/extra/hazard/shelters-taipei-edu/115年臺北市避難收容處所一覽表(1150224).ods`（震災、服務里別、容納人數）；`data/marts/village_indicators.csv`（`pop_total`） | 里 | 小（rescue-drill-map 已算） | 檔內有聯絡人姓名、電話欄，**不得帶出**。容納人數÷人口只能說「相對於臺北其他里」 |
| 8 | 家門口最近的消防栓 | 「火災時，水源離我家多遠？」 | A | `data/raw/extra/hazard/fire-hydrants-taipei-water/大臺北地區消防栓清冊1150915.csv`（WGS84 經緯度） | 棟 | 小 | 直線距離，不是水帶拉的路線。要先篩掉新北市 |
| 9 | 你家這條巷是不是列管窄巷／消防通道 | 「消防車進得來嗎？」 | A | `data/staged/hazard/narrow-lanes-red-yellow.csv`、`data/staged/building-hazard/fire-access-lanes.csv`、`research/issue-06/mvp-variants/rescue-drill-map/data/narrow_lanes.geojson` | 棟（巷名比對） | 小～中 | 巷名比對是推估；只說「這條巷在清冊上」，不畫全市窄巷清單 |
| 10 | 你家比本里幾 % 的房子老 | 「我家在里裡面算老嗎？」 | Y＋A | `building_points.parquet`（同 `village_code` 的 `built_year` 分布）；里比例：`village_indicators.csv`（`bld_share_pre_policy_1999`、`bld_share_pre1982`） | 里 | 小 | 只用有實際年份的棟（不含鄰棟區間），要寫有年份的棟數 |
| 11 | 本里近 25 年改建了多少 | 「鄰居有人在改建嗎？我們是不是落後了？」 | A | `village_indicators.csv`（`new2001_units_share`、`lvr_share_newbuild`） | 里 | 小 | 都是推估；樣本小的里要加註 |
| 12 | 本里、同路段已有的危老與都更案件數 | 「附近有人走過這條路嗎？」 | A | `village_indicators.csv`（`weilao_active_est`）；`data/raw/extra/renewal/dangerous-old-building-rebuild-approved-cases/`（路段）；`research/issue-06/mvp-variants/uro-cases/out/uro-review-case-villages.csv` | 里／路段 | 小～中 | 危老 96% 只寫到路段，里值是期望值。只給件數，不列案名 |
| 13 | 都更每一階段大約多久 | 「走都更要等幾年？」 | 無 | `research/issue-06/mvp-variants/uro-cases/out/stage-durations.csv`（中位天數、p25～p75） | 全市 | 小 | 168 案、只算第一次擬訂，要寫樣本 |
| 14 | 本里負擔力：平均所得對自備款 | 「重建要出的錢，大約是我們里幾年的所得？」 | A | `data/raw/extra/housing-stats/income-tax-village-taipei-109-112/112年度綜稅各類所得金額各縣市鄉鎮村里統計表-臺北市.csv`；試算器已做（`renewal-calculator`） | 里 | 小（重用） | 授權「推定」待確認；是平均不是中位數 |
| 15 | 更新前市價（同區、同里成交中位） | 「我家現在大約值多少？」 | A | `research/issue-06/mvp-variants/renewal-calculator/data/prices.json`、`data/staged/housing-stats/real-price-registration-lvr.csv` | 區／里 | 小（重用） | 小樣本里不穩。不顯示本棟單筆成交 |
| 16 | 重建期間住哪：最近的社會住宅 | 「拆掉重蓋那幾年，長輩住哪？」 | A＋E | `research/issue-06/mvp-variants/uro-cases/out/social-housing.csv`（`lat`、`lon`、`progress`）；中繼 4 步驟：`research/issue-06/mvp-variants/consent-simulator/`（不能都更分頁）；卡片文字：`nextsteps.js` order 17「重建期間住哪」 | 棟→設施 | 小 | 社宅不保證給中繼使用，只能寫「選項」；只列已完工的 |
| 17 | 重建限制：50 公尺內文資、附近受保護樹木 | 「重建會不會卡到古蹟或老樹？」 | A | `building_points.parquet`（`near_heritage_50m`、`heritage_n_50m`）；`data/raw/extra/land/protected-trees-taipei/r000-a7c2db0d.csv`（經緯度） | 棟 | 小 | 文資是代表點，不是保存範圍；只當預檢 |
| 18 | 坡地：土石流影響範圍、人工邊坡 | 「我家在山邊，除了地震還要注意什麼？」 | A | `data/raw/extra/hazard/debris-flow-areas-moa/debris-flow-areas-shp.zip`、`data/raw/extra/hazard/artificial-slopes-taipei-pwd/臺北市山坡地人工邊坡位置圖.zip` | 棟 | 中（shp 點在面內、全國檔要裁） | 多數住戶結果是「不在範圍」，只在命中時顯示 |
| 19 | 兩版液化圖一致嗎、附近有幾個鑽孔 | 「液化這個結果有多可靠？」 | A | `building_points.parquet`（`liq_agreement`）；`village_indicators.csv`（`borehole_n`、`borehole_pl_median`） | 棟／里 | 小 | 全國 2026 版要標「經濟部地礦中心 2026，僅供對照」（`data/marts/README.md` 第 6 件事） |
| 20 | 本里有多少長者住在無電梯的老屋 | 「像我們家這樣的長者，里裡有多少？」 | A＋E | `data/raw/extra/base/segis-silver-index-113-village/140015-housing.zip`（住宅狀況 21 格：屋齡×電梯×樓層×構造）；對照 `village_indicators.csv`（`no_elevator_30plus_n`） | 里 | 中 | SEGIS 授權待確認；沒有現成指數，要自己算並標「推算」 |
| 21 | 最近的長照喘息據點 | 「照顧長輩累了，附近有誰可以幫忙？」 | A＋E | `data/raw/extra/base/ltc-respite-providers-taipei/`（4 份 CSV，Big5） | 據點 | 中（只有地址，要比對門牌） | 有聯絡窗口與手機欄，**不得進產品與 git**；住宿式混有新北市機構 |
| 22 | 長輩修房子、居家簡易修繕、扶手止滑補助 | 「長輩住的家，有沒有小錢可以先修？」 | E | `research/issue-06/mvp-variants/renewal-calculator/assets/nextsteps.js`（order 12～14：扶手止滑無障礙、長輩修房子、長輩居家簡易修繕） | 全市 | 小 | 部分要低收或中低收；我們不問所得，寫「若符合」 |
| 23 | 使用分區（住三、商二…） | 「我家這塊地是什麼分區？容積大概多少？」 | A | `data/raw/extra/land/zoning-taipei/`（r000、r001 zip，shp） | 棟 | 中 | 點在面內可能落在分區界線；接 bonus-translator 時寫「預估」 |
| 24 | 官方的本里疏散避難圖 | 「市府有沒有畫過我們里的避難圖？」 | A | `data/raw/extra/hazard/evacuation-maps-{shilin,xinyi,beitou,neihu}-village/`（`FILE_URL`） | 里 | 小 | 只有士林、信義、北投、內湖 4 區；其他區顯示「本區未提供」 |

## 2. 16:00 前推薦做的前 5 條

1. **#1＋#2 屋齡差距與耐震世代**：「屋齡」這個參數只有在這裡才真的有用；欄位都在分片裡，算差值、套斷點就好。
2. **#4 加裝電梯補助資格預檢**：「有長者」直接把補助從 50%／300 萬拉到 80%／480 萬，是報告裡最具體的一筆錢；先不做管委會比對。
3. **#6＋#7 長者友善避難所與本里收容容量**：rescue-drill-map 已經去重、落里，搬過來就能用，回答「地震後長輩去哪」。
4. **#8＋#9 最近消防栓與巷道列管**：消防栓、窄巷資料 rescue-drill-map 都清好了，逐棟只差一段距離計算，住戶一看就懂。
5. **#10 你比本里幾 % 的房子老**：同一里的年份分布就在 parquet 裡，一行比例接得上「我的里排名卡」，讓排名從「里」落到「我家」。

次選（時間夠再做）：#22 長輩小額修繕卡（純文字重用 nextsteps.js）、#16 最近社宅、#19 液化可靠度。

## 3. 不建議做的點子

| 點子 | 原因 |
|---|---|
| 本里獨居老人人數 | `data/raw/extra/base/elderly-living-alone-stats/` 只有全市×性別，沒有里 |
| 消防列管建築物按樓層 | `data/raw/extra/hazard/fire-listed-buildings-by-floor/` 只到區 |
| 普查的空閒住宅、住進現宅時間、所有權屬 | `data/raw/extra/housing-stats/census-2020-taipei-tables/` 只到區；授權待確認 |
| SEGIS 區屋齡級距 | `segis-house-age-by-town-114q4` 只到區。可拿來校正推估，不放報告 |
| 用內政大數據模擬資料講「你們里的長者」 | `moi-bigdata-sim-*` 是合成個體，住戶會當成真實統計；授權未標 |
| 離活動斷層多遠 | `active-faults-gsmma-wms` 只有 WMS 截圖（png＋pgw），不能逐址算距離，誤差大 |
| 最近的防空避難設施 | 防空用途，不是震災收容所，放在地震報告會誤導 |
| 附近市有閒置地、閒置建物、公有土地 | 會變成可瀏覽的土地清單；公有土地要地號比對，今天做不完 |
| 已核准自行劃定更新單元 | 只到 2024-06，沒有里或地號欄，要解案名 |
| 消防安全檢查重大不合格場所 | 只有 4 筆營業場所，跟住宅無關 |
| 海砂屋、黃單的周邊地圖或「附近幾棟」 | 協調者決定 BD10：只在輸入確切地址時顯示本棟，不做可瀏覽圖層 |
| 列出隔壁幾號的屋齡、構造 | 會變成逐棟可瀏覽清單，等於反查鄰居 |
| 收集住戶填的屋齡回頭校正 | 要個資同意與儲存機制，今天做不完；這版只在瀏覽器裡算 |
| 一個總分「健康分數」 | 國外正在放棄單一總分（`research/issue-06/world-practices/report.md` 摘要第 1 點，紐西蘭案例）；排名卡已經處理權重不確定 |
| 本里 65 歲以上喪偶人數（獨居代理） | `village-pop-marital-education-moi` 解壓後 1.2 GB 未處理；「喪偶＝獨居」是推論 |
| 老舊聚落 | `old-settlements-taipei-pwd` 是 CAD 轉出的 shp，沒有屬性欄，命中也說不出是哪個聚落 |
