# Integration: Centralized FastAPI Brain for LINE Bot

We will shift the bot's logic from being hardcoded in n8n to being dynamic and tracked in the FastAPI backend (`backend/main.py`). This ensures all interactions are recorded in the database for future monitoring.

## User Review Required

> [!IMPORTANT]
> - **Internal Address**: n8n (on `.150`) will call the backend (on `.147`). I will use the internal IP `192.168.0.147` in the workflow to ensure they can talk to each other directly.
> - **Logic Shift**: The "你是誰" reply will now be managed by the Python code in `backend/main.py`.

## Proposed Changes

### 1. Backend: [main.py](file:///home/toymsi/documents/projects/n8n_factory/backend/main.py)
- **Update Logic**: Add a specific case in `bot_command_handler` for the question "你是誰".
- **Reply**: Return "我是 line超人 由n8n+AI超進化".
- **Data Tracking**: Ensure the interaction is logged in the `InteractionLog` and `Lead` tables.

### 2. n8n: Workflow Integration
- **Add HTTP Request Node**: Create a node that sends the following JSON to `http://192.168.0.147:8000/bot/command`:
    ```json
    {
      "uid": "{{ $json.body.events[0].source.userId }}",
      "username": "User",
      "message": "{{ $json.body.events[0].message.text }}"
    }
    ```
- **Update Reply Node**: Change the `Line : Reply with token` node to use the message returned from the FastAPI HTTP Request node.

## Open Questions

- Should I also activate the **Scraper** integration now, or focus strictly on the message logic first?
- Do you have a preferred "Display Name" for the bot in the backend metadata?

## Verification Plan

### Automated/Local Tests
- **Backend Test**: Run a local `curl` to `http://localhost:8000/bot/command` with "你是誰" and verify the JSON response and DB entry.
- **Workflow Simulation**: Trigger n8n with mock data and verify it calls the backend successfully via the logs.

### Manual Verification
- User tests via LINE and checks the terminal logs of the backend.
