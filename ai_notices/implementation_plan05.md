# n8n Factory Frontend Development Plan

We will develop a premium, real-time dashboard for the **n8n Factory**. This dashboard will serve as the "Frontend" in the architecture: `admin <-> frontend <-> backend <-> n8n`.

## User Review Required

> [!IMPORTANT]
> - **IP Address Configuration**: The current code points to `localhost`. I will update it to allow dynamic backend targeting so it works across your local network (e.g., targeting `.147`).
> - **Framework Choice**: The existing code uses Tailwind CSS classes but the library is not installed. I will install **Tailwind CSS v4** to enable these styles and ensure a "Premium" look.
> - **Language**: I will localize the UI to **Traditional Chinese** (繁體中文) to maintain consistency with your previous project steps.

## Proposed Changes

### 1. Build System & Styling
#### [MODIFY] [package.json](file:///home/toymsi/documents/projects/n8n_factory/frontend/package.json)
- Add `tailwindcss`, `@tailwindcss/vite`, and `autoprefixer`.
- Ensure `framer-motion` is correctly integrated for smooth transitions.

#### [MODIFY] [vite.config.js](file:///home/toymsi/documents/projects/n8n_factory/frontend/vite.config.js)
- Configure Tailwind CSS plugin for Vite.

#### [MODIFY] [index.css](file:///home/toymsi/documents/projects/n8n_factory/frontend/src/index.css)
- Import Tailwind directives.
- Retain and polish the "Premium" design tokens (Glassmorphism, Outfit font).

### 2. Dashboard Logic & UI
#### [MODIFY] [App.jsx](file:///home/toymsi/documents/projects/n8n_factory/frontend/src/App.jsx)
- **Localization**: Translate all labels to Traditional Chinese (e.g., "Total Leads" -> "線索總數", "System Logs" -> "系統日誌").
- **Connectivity**: Add logic to detect or configure the backend IP.
- **Real-time**: Ensure WebSocket connection is robust and handles reconnections.
- **Framer Motion**: Add entrance animations for cards and lists.
- **Workflow Control**: Correctly map the "Trigger" buttons to actual n8n workflow IDs defined in the backend/workflows.

### 3. Localization
#### [MODIFY] [index.html](file:///home/toymsi/documents/projects/n8n_factory/frontend/index.html)
- Set `lang="zh-Hant"`.
- Update page title to "n8n 自動化整合工廠".

---

## Open Questions

- Do you prefer a **Dark Mode** by default (which fits the current "Glassmorphism" theme), or should I implement a toggle?
- Should I add a section to view the **Scraper** results directly on the dashboard?

## Verification Plan

### Automated Tests
- Run `npm run dev` and check for any build errors.
- Verify API calls in the browser console.

### Manual Verification
1. **Connectivity Check**: Open the dashboard from a different device on the network (if possible) and check if it talks to the backend.
2. **Real-time Test**: Send a message to the LINE Bot and verify the "System Logs" and "Leads" update instantly without refreshing.
3. **Trigger Test**: Click a "Trigger" button and check the backend logs for successful n8n activation.
