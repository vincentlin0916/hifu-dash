# HIFU Dash

互動式 HIFU 展示小遊戲。玩法類似 Geometry Dash：玩家控制藍色「超音波焦點」跳躍，避開血管、神經與器官，目標是命中腫瘤。

## 使用情境

- 醫學會展示
- 醫院衛教
- 投資人簡報
- 展場互動

## 執行方式

直接用瀏覽器開啟 `index.html` 即可。

若要用本機伺服器預覽：

```bash
python3 -m http.server 8000
```

然後打開 `http://localhost:8000`。

## 操作

- `Space` / `ArrowUp`：跳躍
- 滑鼠點擊或觸控：跳躍或開始遊戲

## 核心訊息

HIFU 的價值不只是輸出能量，而是把能量精準送到腫瘤，同時避開正常組織。

## 專案規劃

完整 MVP、Unity 架構、第二階段關卡編輯器與第三階段 AI 自動生成關卡規劃請見：

[PROJECT_PLAN.md](PROJECT_PLAN.md)
