# n8n Factory - Project Walkthrough

The **n8n Factory** is now ready! This platform provides a rapid development environment for integrating local Python scripts with n8n workflows.

## Features Implemented

- **Unified Dashboard**: A premium, glassmorphic UI built with Vite + React to monitor and trigger automations.
- **Python Backend**: Fast API implementation running in the `toby` conda environment.
- **WebSocket Logs**: Real-time event streaming from local scripts and n8n webhooks.
- **SDK & Examples**: Simple Python helpers to trigger n8n workflows from any local script.
- **Conda environment Integration**: Configured to work seamlessly with your `toby` environment.

## Project Structure

- `backend/`: FastAPI server and n8n helper logic.
- `frontend/`: Vite + React dashboard with modern styling.
- `examples/`: Ready-to-run Python scripts to test integrations.
- `actions/`: Placeholder for your custom Python tools that n8n can call.

## Getting Started

### 1. Configure n8n
Update the `backend/.env` file with your n8n API details:
```bash
# Edit this file
/home/toymsi/documents/projects/n8n_factory/backend/.env
```

### 2. Launch the Factory
Run the convenience script to start both backend and frontend:
```bash
./start.sh
```

### 3. Trigger a Workflow
You can trigger a workflow via the dashboard or using the provided Python example:
```bash
conda run -n toby python examples/simple_trigger.py
```

## How it works

1.  **Dashboard to n8n**: When you click "Trigger Task" on the dashboard, it calls the local FastAPI, which in turn triggers the n8n workflow.
2.  **n8n to Local**: You can send data from n8n back to `http://localhost:8000/webhook/my_action`. The data will appear instantly on the dashboard's "Live Stream" via WebSockets.

---

> [!NOTE]
> All Python operations are configured to run within the **toby** conda environment as requested.

> [!TIP]
> You can add more "Workflows" by updating the state in `frontend/src/App.jsx` or by implementing a dynamic discovery endpoint in the backend.
