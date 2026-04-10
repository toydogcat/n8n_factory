import os
import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from n8n_helper import N8NClient
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from datetime import datetime

# Import DB
import models
from models import get_db, init_db, Lead, AutomatonTask, InteractionLog

load_dotenv()
init_db()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("n8n-factory")

app = FastAPI(title="n8n Factory API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

n8n = N8NClient()

# Active connections for WebSocket logs
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to WS: {e}")

manager = ConnectionManager()

async def log_event(event_type: str, data: Any, db: Optional[Session] = None):
    payload_str = json.dumps({"type": event_type, "data": data})
    logger.info(f"Event: {event_type} - {payload_str}")
    await manager.broadcast(payload_str)
    
    # Optional: Persist logs to DB
    if db:
        new_log = InteractionLog(
            event_type=event_type,
            content=str(data),
            timestamp=datetime.utcnow()
        )
        db.add(new_log)
        db.commit()

@app.get("/")
async def root():
    return {"message": "n8n Factory Backend is running with Database support"}

# --- Bot Integration (Scenario 1 & 3) ---

class BotCommand(BaseModel):
    uid: str
    username: Optional[str] = "User"
    message: str
    metadata: Optional[Dict[str, Any]] = {}

@app.post("/bot/command")
async def bot_command_handler(cmd: BotCommand, db: Session = Depends(get_db)):
    """
    Centralized handler for LINE Bot commands. 
    Called by n8n when a message starts with '/' or requires logic.
    """
    try:
        text = cmd.message.strip().lower()
        await log_event("BOT_CMD_IN", cmd.dict(), db)

        # 1. Update or Create Lead
        lead = db.query(Lead).filter(Lead.line_uid == cmd.uid).first()
        if not lead:
            lead = Lead(line_uid=cmd.uid, name=cmd.username, status="new", meta_info={})
            db.add(lead)
            db.commit()
            db.refresh(lead)

        # Ensure meta_info is not None
        if lead.meta_info is None:
            lead.meta_info = {}

        # 2. Process Commands
        response_msg = ""
        action = "NONE"

        if "你是誰" in text:
            response_msg = "我是 line超人 由n8n+AI超進化"
            action = "REPLY_IDENTITY"
        elif text.startswith("/help"):
            response_msg = f"Hello {lead.name}! I am your Automation Assistant. Commands: /help, /winwin, /status"
            action = "REPLY_HELP"
        elif text.startswith("/winwin"):
            # Scenario 3: Collect info (Dialogue flow)
            if not lead.meta_info.get("interest"):
                response_msg = "Great! What industry are you interested in for the WinWin project?"
                lead.status = "in-progress"
                lead.meta_info = {**lead.meta_info, "state": "awaiting_industry"}
            else:
                response_msg = "I have recorded your interest. Our team will contact you shortly."
            action = "REPLY_WINWIN"
        elif (lead.meta_info or {}).get("state") == "awaiting_industry":
            # Process the answer from the previous step
            lead.meta_info = {**lead.meta_info, "industry": cmd.message, "state": "completed"}
            lead.status = "completed"
            response_msg = f"Thank you! Industry recorded: {cmd.message}. You are now on our list."
            action = "RECORD_DATA"
        else:
            # Default response for other messages
            response_msg = "I received your message. Type /help to see what I can do!"
            action = "REPLY_DEFAULT"

        db.commit()
        
        # Return instructions to n8n
        result = {
            "reply": response_msg,
            "action_taken": action,
            "lead_status": lead.status
        }
        await log_event("BOT_CMD_OUT", result, db)
        return result
    except Exception as e:
        logger.error(f"Error in bot_command_handler: {e}")
        # Ensure we return something so n8n doesn't hang
        return {
            "reply": "系統稍早發生異常，請稍後再試。",
            "action_taken": "ERROR",
            "error": str(e)
        }

# --- Lead Management (Scenario 5) ---

@app.get("/leads")
async def get_leads(db: Session = Depends(get_db)):
    """Fetch all leads for the dashboard."""
    return db.query(Lead).order_by(Lead.last_interaction.desc()).all()

@app.get("/tasks")
async def get_tasks(db: Session = Depends(get_db)):
    """Fetch all automation tasks for the dashboard."""
    return db.query(AutomatonTask).all()

# --- Automation Trigger (Scenario 4) ---

@app.post("/trigger/{workflow_id}")
async def trigger_n8n(workflow_id: str, data: Dict[str, Any], db: Session = Depends(get_db)):
    """Trigger an n8n workflow from the dashboard/script."""
    try:
        await log_event("TRIGGER_OUT", {"workflow_id": workflow_id, "payload": data}, db)
        result = await n8n.trigger_workflow(workflow_id, data)
        await log_event("TRIGGER_SUCCESS", result, db)
        return result
    except Exception as e:
        logger.error(f"Error triggering workflow: {e}")
        await log_event("TRIGGER_ERROR", str(e), db)
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/logs")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WS error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
