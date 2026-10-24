/*
 * nextsteps.js  Data for the "下一步" cards on the citizen page (SPEC §6.3).
 * Source: research/issue-06/world-practices/taipei-assistance/next-step-card.md,
 * the 17-row "卡片表", copied verbatim on 2026-10-18. Do not edit the text here;
 * edit the source document and copy again.
 *
 * Fields (one object per row):
 *   order        the "順序" column, used to pick and sort cards
 *   title        卡片標題
 *   what         這是什麼
 *   who          誰可以申請
 *   general      一般戶 column ("—" means the item is for elderly households only)
 *   elderly      高齡戶 column ("同左" means same as general)
 *   deadline     截止 column, verbatim (may contain 【待確認】, replaced on render)
 *   entry_text   入口 column without the URL
 *   entry_url    the first URL in the 入口 column, or null
 *   source       來源 column
 *   deadline_date  ISO date parsed from 截止 when it is a real deadline, else null.
 *                  Added for the "快截止" rule; not part of the source table.
 *
 * Rule 5 of the source: cells marked 【待確認】 render as 「請洽窗口確認」.
 *
 * Local edits on 2026-10-24 (debug-7b, review fixes; not yet in next-step-card.md):
 *   order 2  peer M1 (初評 1.2 萬 / 1.5 萬 + 審查費), M2 (過半同意 marked 待確認), M4 (詳評 30%, 40 萬)
 *   order 3  r3-7b #4 (乾式鋼板補強 cost reference)
 *   order 4  r3-7b #1 (透天 50 萬), #2 (花蓮 113-04-03 專案 1,500 萬 only), #3 (central cap 待確認)
 *   order 10 peer M5 (電梯補助作業規範第四點第 1、4、6 款)
 * Sources: gov-reports/verify/r3-7b.md "MVP 影響"; peer-analysis/2026-10-23-etblue-issue-analysis.md §4.
 * The upstream card table must be synced by its owner before the next verbatim copy.
 */

'use strict';

const NEXT_STEPS_DATA_DATE = '2026-10-18';

const NEXT_STEPS = [
  {
    order: 1,
    title: '先問免費顧問',
    what: '危老重建推動師與工作站，免費說明你家能不能走危老、要準備什麼',
    who: '任何臺北市屋主',
    general: '免費',
    elderly: '同左',
    deadline: '常態',
    entry_text: '臺北市建管處「危老重建」頁；市民專線 1999',
    entry_url: 'https://cmo.gov.taipei/cp.aspx?n=023341AF71C3812D',
    source: '[S5] 建管處危老頁（115-10-13）',
    deadline_date: null,
  },
  {
    order: 2,
    title: '耐震初評',
    what: '專業機構看你這棟樓的耐震能力，給一個分數。初評有疑慮時做詳評：市府補評估費 30%，每棟最高 40 萬元',
    who: '1999 年底前申請建照的合法建物；是否要整棟過半所有權人同意、住宅占 2/3 以上【待確認】，依中央與北市補助規定',
    general: '市府每棟最高補 1.2 萬元（3,000 m² 以上 1.5 萬元），另補審查費 1,000 元；你大約自付 3,000～8,000 元（整棟分攤）',
    elderly: '同左',
    deadline: '受理中',
    entry_text: '建管處使用科，同上頁；1999',
    entry_url: 'https://cmo.gov.taipei/cp.aspx?n=023341AF71C3812D',
    source: '[5][7] 北市危老辦法（112-07-21）§9 第 2 項第 1、2 款、評估收費標準（115 年版）',
    deadline_date: null,
  },
  {
    order: 3,
    title: '臺北市補強補助',
    what: '初評顯示需要補強、而且補強划算時，市府補一半工程費。工程費參考：乾式鋼板補強約每平方公尺 1 萬 8,000 元（試驗研究的參考值，依個案而異）',
    who: '住宅占 1/3 以上；初評結果「需補強但具改善效益」，或貼黃單；不是海砂屋',
    general: '補 50%，每案最高 1,200 萬元',
    elderly: '同左（策略地區、整建住宅等：補 80%，最高 2,000 萬元）',
    deadline: '2026-12-31，經費用完提前停',
    entry_text: '臺北市都市更新處；(02)2781-5696 #3093',
    entry_url: 'https://uro.gov.taipei/News_Content.aspx?n=9CAC69257CFAC70E&sms=1635F69C7777535B&s=8860150E93FF8321',
    source: '[11][12][13] 補助規範（114-12-08）、115 年度公告（115-07-01）；工程費參考：GRB 12879484 p.82、p.84',
    deadline_date: '2026-12-31',
  },
  {
    order: 4,
    title: '中央弱層補強',
    what: '中央的補強補助，針對一樓等弱層。113 年 4 月 3 日花蓮震災張貼危險標誌的住宅另有專案規定，上限提高到每棟 1,500 萬元（特殊個案最高 2,250 萬元）；一般申請不適用',
    who: '公寓大廈或住商混合；初評 R＞30，或詳評須補強，或貼危險標誌',
    general: '集合住宅每棟最高 450 萬元、透天每件最高 50 萬元；補 45%，初評 R＞45 補到至多 85%',
    elderly: '同左',
    deadline: '制度持續；臺北本年度受理期間、中央 115 年起的計畫是否調整上限【待確認】',
    entry_text: '私有建築物耐震弱層補強資訊網；建管處使用科',
    entry_url: 'https://privatebuilding.ncree.org.tw/',
    source: '[8][9][10] 主動輔導要點（111-10-17）、資訊網（2026-07-29 公告）；GRB 16583227 p.78～79',
    deadline_date: null,
  },
  {
    order: 5,
    title: '危老重建',
    what: '30 年以上、耐震不足的老屋，拆掉重蓋可以多拿容積',
    who: '合法建物，且：評估未達最低等級；或屋齡 30 年以上、耐震不足且補強不划算或沒有電梯。全體所有權人都要同意',
    general: '容積最多 1.3 倍基準容積；地價稅、房屋稅減免',
    elderly: '同左',
    deadline: '申請期限 2027-05-31（刪除落日的修法還在立法院）',
    entry_text: '建管處「危老重建計畫審查」',
    entry_url: 'https://cmo.gov.taipei/cp.aspx?n=BD86021F233DC407',
    source: '[S1][S4][S6] 危老條例（112-12-06）、北市辦法、建管處書表頁（115-10-02）',
    deadline_date: '2027-05-31',
  },
  {
    order: 6,
    title: '防災型都更',
    what: '耐震不足的老屋用都更重建，容積獎勵 30%',
    who: '基地 1,000 m² 以上；耐震 ID＜0.35（1974-02-15 前申請建照的免鑑定）；同意比率依都更條例',
    general: '危險建物獎勵 30%',
    elderly: '同左',
    deadline: '2029-03-28',
    entry_text: '臺北市都市更新處；(02)2781-5696',
    entry_url: 'https://uro.gov.taipei/',
    source: '[S18] 防災型都更懶人包（114-05-09）',
    deadline_date: '2029-03-28',
  },
  {
    order: 7,
    title: '請市府來辦都更（7599）',
    what: '鄰居 75% 有意願，就能請市府的住都中心當實施者',
    who: '公告更新地區、基地 2,000 m² 以上、私有所有權人或戶數 75% 以上有意願',
    general: '市府出錢請團隊試算',
    elderly: '同左',
    deadline: '每年 1/1～8/31 收件；2026 年已截止，下一輪 2027-01-01 起【推論】',
    entry_text: '7599 專區；(02)2781-5696 #7599',
    entry_url: 'https://uro.gov.taipei/News_Content.aspx?n=BB6B171E7164F2ED&s=4553574C52DC6453&sms=EC399FD855697A57',
    source: '[S16][S17] 7599 計畫（113-01-02）、專區（115-10-18）',
    deadline_date: null,
  },
  {
    order: 8,
    title: '危險建物由市府辦都更（575）',
    what: '海砂屋、紅黃單或極危險建物，市府住都中心當實施者',
    who: '列管須拆的海砂屋；紅黃單；或 ID＜0.35 經公告。過半意願',
    general: '不是現金；市府代為推動',
    elderly: '同左',
    deadline: '受理中',
    entry_text: '都市更新處 (02)2781-5696 #7599、#3093',
    entry_url: null,
    source: '[20] 575 專案計畫（115-04-29 修訂）',
    deadline_date: null,
  },
  {
    order: 9,
    title: '海砂屋鑑定與拆除補助',
    what: '懷疑或已列管海砂屋時，鑑定、拆除、補強都有補助',
    who: '鑑定：1995-01-23 前申報勘驗、同意戶數 50% 以上。拆除與補強：已列管',
    general: '鑑定依面積補 30～145 萬元；拆除每戶 20 萬元；補強每戶 10 萬元；重建容積放寬 30%',
    elderly: '同左',
    deadline: '鑑定依年度預算（本年度經費【待確認】）；拆除、補強常設',
    entry_text: '建管處「列管建築物」；1999 轉 8399',
    entry_url: 'https://cmo.gov.taipei/cp.aspx?n=4B7B63655A6565E9',
    source: '[18][19][21] 鑑定補助計畫（114-03 修）、問答集（113-12）',
    deadline_date: null,
  },
  {
    order: 10,
    title: '公寓加裝電梯',
    what: '6 樓以下沒電梯的公寓，加裝電梯的工程補助',
    who: '屋齡 20 年以上；住宅使用達全棟一半以上；整棟不是單一所有權人；不是列管須拆除的海砂屋；已領增設電梯建築許可；管委會或過半住戶推派代表申請',
    general: '補 50%，每座最高 300 萬元',
    elderly: '補 80%，每座最高 480 萬元（戶內有 65 歲以上即可）',
    deadline: '2026-12-31 或經費用完',
    entry_text: '電梯補助專區；(02)2781-5696',
    entry_url: 'https://uro.gov.taipei/News_Content.aspx?n=9CAC69257CFAC70E&s=E06839FCF0BC62E8&sms=1635F69C7777535B',
    source: '[S20][S21][S22] 作業規範（114-10-31）第四點、115 年度公告（115-07-01）',
    deadline_date: '2026-12-31',
  },
  {
    order: 11,
    title: '外牆、耐震整建維護',
    what: '都更「整建維護」：不拆房子，補外牆、補強、加電梯',
    who: '管委會等；公告更新地區同意比率 3/4 以上，自劃單元 4/5 以上',
    general: '補 50%，最高 1,200 萬元',
    elderly: '同左（整宅、策略地區 80%，最高 2,000 萬元）',
    deadline: '2026-12-31',
    entry_text: '整建維護專區',
    entry_url: 'https://uro.gov.taipei/News_Content.aspx?n=9CAC69257CFAC70E&sms=1635F69C7777535B&s=87FE50B52A67F152',
    source: '[S13][S15] 115 年度審查原則（115-07-01）',
    deadline_date: '2026-12-31',
  },
  {
    order: 12,
    title: '家裡扶手、止滑、無障礙',
    what: '長照 2.0 的居家無障礙改善',
    who: '65 歲以上、經照管專員評估長照需要 2 級以上',
    general: '—',
    elderly: '3 年最多 4 萬或 6 萬元（居家改善 2 萬元為限）；一般戶自付 30%，低收入戶 0%',
    deadline: '常態',
    entry_text: '1966 長照專線',
    entry_url: 'https://1966.gov.tw/LTC/cp-6453-69940-207.html',
    source: '[S25][S26] 長照給付辦法（114-06-19）',
    deadline_date: null,
  },
  {
    order: 13,
    title: '長輩修房子補助',
    what: '低收、中低收長輩的住屋修繕補助',
    who: '65 歲以上、設籍並實住臺北 6 個月以上、低收或中低收',
    general: '—',
    elderly: '每年每人最多 10 萬元（屋齡未滿 20 年 8 萬元）',
    deadline: '常態',
    entry_text: '臺北市社會局；1999 #6966～6968',
    entry_url: 'https://dosw.gov.taipei/cp.aspx?n=12347C47E1B178D4',
    source: '[S27] 社會局頁（115-09-30）',
    deadline_date: null,
  },
  {
    order: 14,
    title: '長輩居家簡易修繕',
    what: '到府評估，裝扶手、止滑',
    who: '65 歲以上、設籍實住臺北；獨居、雙老優先',
    general: '—',
    elderly: '金額【待確認】',
    deadline: '常態',
    entry_text: '臺北扶老・軟硬兼施；伊甸基金會 0800-894580',
    entry_url: 'https://dosw.gov.taipei/cp.aspx?n=76F7E830BB2122A4',
    source: '[S28] 社會局頁（115-09-30）',
    deadline_date: null,
  },
  {
    order: 15,
    title: '查最新液化潛勢',
    what: 'soil.taipei 10/31 關站，改到經濟部查',
    who: '任何人',
    general: '免費',
    elderly: '同左',
    deadline: '常態；全國版 2026-09-24 更新',
    entry_text: '經濟部地礦中心',
    entry_url: 'https://liquefaction.gsmma.gov.tw',
    source: '[24]（115-09-24 版）',
    deadline_date: null,
  },
  {
    order: 16,
    title: '液化自主檢查 6 條',
    what: '自己對照 6 條，看房子有沒有異狀',
    who: '任何人',
    general: '免費',
    elderly: '同左',
    deadline: '文件可引用，無專責窗口',
    entry_text: '行政院',
    entry_url: 'https://www.ey.gov.tw/Page/9277F759E41CCD91/73230eb1-6211-41d5-8d24-473f769bc6f3',
    source: '[23]（105-03-14）',
    deadline_date: null,
  },
  {
    order: 17,
    title: '重建期間住哪',
    what: '重建時可以由實施者幫你申請市府中繼住宅',
    who: '重建基地的合法建物所有權人，北北基桃沒有其他自有住宅',
    general: '市價計租',
    elderly: '同左',
    deadline: '視空屋數',
    entry_text: '由實施者或起造人向都發局申請；規定',
    entry_url: 'https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL095061',
    source: '[S29] 中繼住宅原則（109-09-16）',
    deadline_date: null,
  },
];

window.NEXT_STEPS = NEXT_STEPS;
window.NEXT_STEPS_DATA_DATE = NEXT_STEPS_DATA_DATE;
