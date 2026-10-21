# Codex 研究任務

給 Codex 的 prompt 在 `prompts/`，一份一個任務，可以直接整份貼給 Codex。結果放 `results/`。

| 編號 | 主題 | prompt | 結果 |
|---|---|---|---|
| C1 | 臺灣法規與制度盤點 | `prompts/c1-taiwan-policy.md` | `results/c1-taiwan-policy.md` |
| C2 | 臺灣既有的耐震評估方法與權重 | `prompts/c2-assessment-methods.md` | `results/c2-assessment-methods.md` |
| C3 | 臺灣既有的同類專案、報導、作品 | `prompts/c3-prior-work.md` | `results/c3-prior-work.md` |
| C4 | 逐棟屋齡與構造的替代資料與推估技術 | `prompts/c4-building-age-proxies.md` | `results/c4-building-age-proxies.md` |

## 怎麼用

1. 每份 prompt 開一個 Codex 對話。4 份彼此獨立，可以同時跑。
2. 如果 Codex 在這個 repo 裡執行，它會自己把結果寫到 `results/`。
3. 如果 Codex 不能寫檔，把它的回覆存成 `results/<同名>.md`，或丟進 `workspace/inbox/`，整合者再歸位。
4. 結果一律【文件】【推論】標示，整合者會抽查來源。
