# n8n Factory - 企業旗艦版 導覽

我們已將 **n8n Factory** 進化為一個強大的 **LINE Bot 與名單管理** 平台。此系統可以處理複雜的對話流程、自動化網頁爬蟲，並即時可視化您的自動化業務流程。

## 已實作的核心功能

### 1. 智慧型機器人處理器 (場景 1 & 3)
- **API 端點**: `POST /bot/command`
- **對話狀態機**: 追蹤使用者在多步驟對話中的進度（例如 `/winwin` 指令）。
- **名單生成**: 根據 LINE 互動與文字輸入，在資料庫中自動建立或更新名單。

### 2. 戰略名單管理 (場景 5)
- **名單儀表板**: 專為監控潛在客戶 (Leads) 增長而設計的視圖。
- **動態狀態**: 追蹤客戶從 `new` (新)、`in-progress` (處理中) 到 `completed` (已完成) 的進程。
- **元數據存儲**: 以結構化 JSON 格式存儲擷取的自定義資訊（如「興趣」或「產業」）。

### 3. 自動化爬蟲與排程 (場景 2 & 4)
- **爬蟲服務**: 獨立的 Python 工作程式 (`scraper.py`)，可由 n8n 觸發以監控網頁。
- **任務追蹤**: 直接從儀表板監控後台任務的狀態。

### 4. 進階分析
- **互動監控**: 機器人活動的可視化圖表。
- **性能指標**: 即時統計爬蟲準確度與 API 延遲。

## 系統架構圖 (Architecture Diagram)

1. **LINE 使用者** --> **n8n Webhook**
2. **n8n** --> **FastAPI (`/bot/command`)**
3. **FastAPI** --> **SQLite 資料庫**
4. **SQLite** --> **React 儀表板**
5. **n8n 定時任務 (Cron)** --> **Python 爬蟲** --> **資料庫**

---

## 如何測試機器人邏輯

您可以在 `toby` 環境中使用以下指令模擬 LINE Bot 互動：

```bash
# 模擬發送 /help 指令
curl -X POST http://localhost:8000/bot/command \
     -H "Content-Type: application/json" \
     -d '{"uid": "user_123", "username": "Toby", "message": "/help"}'
```

請在儀表板的 **Live System Logs** 中查看即時反應！

---

> [!IMPORTANT]
> **資料庫位置**: 您的資料存儲在 `backend/data.db` (SQLite)。此檔案將在首次執行時自動建立。

> [!TIP]
> 要新增更多機器人指令，只需更新 `backend/main.py` 中的邏輯。儀表板會自動反映新捕捉到的名單數據。
