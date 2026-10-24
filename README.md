# 模擬市民－都更人生｜小水滴大浪潮

市政 debug 松第 6 題「危老耐震如何查，風險評級怎麼找」。

隊伍：小水滴大浪潮（Abraham、Derick、Chai）

## 這是什麼

給臺北老公寓住戶的一條路線，四段都用開放資料：

1. **危老健檢報告**：輸入地址、屋齡、家中有沒有長者，產出風險分數、各項風險、附近收容所與醫院、後續行動建議與補助。
2. **都更試算機**：輸入坪數，算重建前後的資產增值，以及施工期間的生活成本。
3. **新家許願池**：勾選想要的社區樣貌與設施。
4. **障礙情境模擬器**：都更前要準備什麼、會遇到什麼困難、怎麼解決；模擬住戶同意的變化。

## 怎麼跑

純靜態網站，不需要後端。

```bash
cd 2026-10-23-mvp
python -m http.server 8778
```

瀏覽器開 <http://127.0.0.1:8778/research/issue-06/mvp-variants/>。不能直接雙擊 `index.html`，頁面用 `fetch` 讀資料檔。

部署：`Dockerfile`（nginx）或 GitHub Pages（`.github/workflows/deploy-pages.yml`），兩者都把 `2026-10-23-mvp/` 當網站根目錄。

## 資料夾

```text
2026-10-23-mvp/
  research/issue-06/mvp-variants/   首頁與各模組
    health-report/                  危老健檢報告（v1.html 主版、print.html 列印版）
    renewal-calculator-v2/          都更試算機
    rooftop-vision/                 新家許願池
    consent-simulator/              障礙情境模擬器
    其他資料夾                       救災地圖、健檢排序、容積翻譯機、同意書進度板、法規地圖等原型
  research/issue-06/solutions/prototype/   逐棟資料與 Leaflet（地圖頁共用）
  data/marts/                       里層級指標
```

## 資料與界線

- 來源：臺北市政府資料開放平臺（data.taipei）、內政部、文化部文化資產局、都市更新審議資料、內政部社會經濟資料服務平台（SEGIS）等，依各資料集授權使用（多為政府資料開放授權條款第 1 版）。
- 逐棟屋齡、軟弱層都是推估、候選；風險分數是團隊自訂的計分，不是官方評估或鑑定。
- 地震、海砂屋列管等已知案件，只在輸入確切門牌時顯示旗標，不提供可瀏覽的清單；清冊地址原文已清空。
- 全國版液化潛勢等授權尚未確認的欄位已清空。
- 不含任何個人資料。

## 用到的開源套件與 AI 工具

活動規則：「可用開源套件與 AI 工具，須於 README 註明」。

| 類別 | 名稱 | 用在哪 |
|---|---|---|
| 前端 | Leaflet（附檔在 `solutions/prototype/assets/vendor/`）；其餘是原生 HTML、CSS、JavaScript | 各模組頁面 |
| 地圖底圖 | OpenStreetMap | 地圖頁 |
| 資料處理 | Python（pandas、geopandas 等） | 開放資料清理與彙總 |
| 影片 | Remotion 4、edge-tts | 示範影片剪輯、字幕、AI 語音 |
| AI 工具 | Claude Code（Anthropic Claude）、OpenAI Codex、Azure OpenAI GPT-5.5 | 研究、資料處理、程式、查核、翻譯 |

## 授權

程式碼授權與資料釋出範圍，活動結束後由團隊決定；資料依原始授權。
