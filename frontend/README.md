# n8n Factory - 前端中控台 (Frontend Dashboard)

這是 n8n 自動化整合工廠的視覺化管理介面，採用最尖端的技術棧打造「Premium」級別的監控體驗。

## 🚀 技術特性

- **React 19 & Vite 8**: 極速的開發與打包體驗。
- **Tailwind CSS v4**: 使用最新一代的 utility-first 框架。
- **Framer Motion**: 流暢的元件進入與切換動畫。
- **Lucide React**: 豐富且統一的圖標語義。
- **WebSocket (Real-time)**: 即時監聽後端活動日誌，實現毫秒級同步。

## ⚙️ 配置說明

### API 連線
專案內置了動態 IP 偵測邏輯（於 `src/App.jsx`）：
- 當在本地開發時，會自動嘗試連結 `192.168.0.147:8000`。
- 部署後會根據當前訪問的 Hostname 自動調整。

## 🛠️ 開發指令

```bash
# 安裝依賴 (建議使用 --legacy-peer-deps 以適配新版 Vite/Tailwind)
npm install --legacy-peer-deps

# 啟動開發伺服器
npm run dev

# 打包正式版本
npm run build
```

## 🏗️ 介面說明

1. **控制儀表板**: 系統概覽、統計數據與手動觸發流程按鈕。
2. **線索管理**: 列出所有從 LINE Bot 轉化進來的線索資料，包含 UID、狀態與興趣屬性。
3. **數據分析**: 互動趨勢與系統效能指標 (KPI) 視覺化。
4. **即時偵測日誌**: 側邊欄終端機，顯示系統底層發生的所有 BOT/TRIGGER 事件。
