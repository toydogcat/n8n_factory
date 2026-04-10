# n8n Factory - 核心中心大腦 (Backend Brain)

這是整個自動化系統的邏輯核心 (Brain)，負責協調 n8n 的訊息處理、線索管理與後台控制。

## 🧠 核心邏輯

後端透過 FastAPI 提供高效的 RESTful API 與 WebSocket 接口：

- **LINE Bot 命令分流**: 接收 n8n 轉發的訊息，判斷意圖並返回處理指令。
- **線索生命週期管理**: 使用 SQLAlchemy 管理 SQLite 資料庫，記錄 Lead 的狀態變更。
- **n8n 雙向通信**: 
    - `接收`: n8n 呼叫 `/bot/command` 進行邏輯運算。
    - `發送`: 後端呼叫 n8n Webhook 觸發自動化流程（如傳送訊息、啟動爬蟲）。

## 🗄️ 資料模型 (Schema)

- **Lead (線索)**: 記錄用戶 UID、名稱、狀態、興趣行業與最後活動時間。
- **InteractionLog (互動日誌)**: 記錄每一條進出的指令與系統事件。
- **AutomatonTask (自動化任務)**: 追蹤長期運行的後台任務。

## 🔌 API 端點摘要

| 方法 | 路徑 | 說明 |
| :--- | :--- | :--- |
| `POST` | `/bot/command` | LINE Bot 指令核心處理器 |
| `GET` | `/leads` | 獲取所有客戶線索 |
| `POST` | `/trigger/{id}` | 手動觸發指定的 n8n 工作流 |
| `WS` | `/ws/logs` | 即時日誌串流接口 |

## 🛠️ 開發指令

```bash
# 安裝 Python 依賴
pip install -r requirements.txt

# 啟動後端伺服器 (開發模式)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 📝 注意事項

- 資料庫檔案儲存於 `data.db`。
- 環境變數設定請參考 `.env.example`，務必正確設定 `N8N_BASE_URL` 與 `N8N_API_KEY`。
