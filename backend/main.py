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
from sqlalchemy import text
from datetime import datetime

import re
# Import DB
import models
from models import get_db, init_db, Lead, AutomatonTask, InteractionLog, CustomerList, LeadListAssociation, MessageTemplate, BroadcastJob, OnboardingStep, SessionLocal
from fastapi import BackgroundTasks
import asyncio

load_dotenv()
init_db()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("n8n-factory")

# --- Pydantic Schemas for Frontend API ---
class LeadResponse(BaseModel):
    id: int
    line_uid: Optional[str] = None
    platform_id: Optional[str] = None
    source: Optional[str] = "line"
    name: Optional[str] = None
    status: str
    onboarding_step: int
    meta_info: Dict[str, Any]
    last_interaction: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class LogResponse(BaseModel):
    id: int
    entity_id: Optional[str]
    source: Optional[str]
    event_type: Optional[str]
    content: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

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

async def log_event(event_type: str, data: Any, db: Optional[Session] = None, entity_id: Optional[str] = None, source: str = "line"):
    payload_str = json.dumps({"type": event_type, "source": source, "data": data, "entity_id": entity_id})
    logger.info(f"Event: {event_type} ({source}) - {payload_str}")
    await manager.broadcast(payload_str)
    
    # Optional: Persist logs to DB
    if db:
        new_log = InteractionLog(
            event_type=event_type,
            entity_id=entity_id,
            source=source,
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
        await log_event("BOT_CMD_IN", cmd.dict(), db, entity_id=cmd.uid, source="line")

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

        # --- Entity Extraction (Automatic) ---
        email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
        if email_match:
            lead.meta_info = {**lead.meta_info, "email": email_match.group(0)}
            
        phone_match = re.search(r'09\d{8}', text)
        if phone_match:
            lead.meta_info = {**lead.meta_info, "phone": phone_match.group(0)}
            
        # Title/Gender extraction
        for title in ["先生", "小姐", "女士", "男", "女"]:
            if title in text:
                lead.meta_info = {**lead.meta_info, "title": title}
                break
        
        db.commit()

        # --- Onboarding Logic (Newcomer Tutorial) ---
        if lead.onboarding_step >= 0:
            # Check for next step
            next_step = db.query(OnboardingStep).filter(OnboardingStep.step_index == lead.onboarding_step + 1).first()
            if next_step:
                lead.onboarding_step += 1
                db.commit()
                return {
                    "response": next_step.message, 
                    "msg_type": next_step.msg_type, 
                    "action": f"ONBOARDING_STEP_{lead.onboarding_step}"
                }
            else:
                # Finished onboarding
                if lead.onboarding_step > 0:
                    lead.onboarding_step = -1 # Mark as completed
                    db.commit()
                    # Optional: send a final welcome if it's the first time finishing
        
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
        await log_event("BOT_CMD_OUT", result, db, entity_id=cmd.uid)
        return result
    except Exception as e:
        logger.error(f"Error in bot_command_handler: {e}")
        # Ensure we return something so n8n doesn't hang
        return {
            "reply": "系統稍早發生異常，請稍後再試。",
            "action_taken": "ERROR",
            "error": str(e)
        }

# --- Gmail Integration (New) ---

def sanitize_email_content(text: str) -> str:
    """Mask URLs: http -> htp as per user security requirement."""
    if not text: return ""
    # Regex to find http/https and replace with htp/htps
    # We use a simple replace for 'http' to catch both
    return text.replace("http", "htp")

class GmailIncoming(BaseModel):
    # Make everything optional to avoid 422 errors when n8n mapping fails
    sender: Optional[str] = "Unknown"
    subject: Optional[str] = "(No Subject)"
    body: Optional[str] = "(No Content)"
    message_id: Optional[str] = None

@app.post("/bot/gmail")
async def gmail_webhook_handler(request: Request, mail: Optional[GmailIncoming] = None, db: Session = Depends(get_db)):
    """
    Receives incoming Gmail from n8n.
    Robust handling to prevent 422 errors even if body is missing.
    """
    # 0. Catch the absolute raw data
    try:
        raw_data = await request.json()
    except:
        raw_data = {}

    # If Pydantic didn't receive a body, create a dummy one
    if not mail:
        mail = GmailIncoming()
    
    # 0.1 Deep Search for missing fields in the raw payload
    # n8n Gmail Trigger often sends data in capitalized keys or nested in 'value'
    extracted_sender = mail.sender
    extracted_subject = mail.subject
    extracted_body = mail.body

    # If Pydantic failed to map them (parsed as defaults), try manual extraction from the full JSON
    if extracted_sender == "Unknown":
        raw_from = raw_data.get("From") or raw_data.get("from")
        if isinstance(raw_from, dict):
            # Handle n8n nested address structure
            extracted_sender = raw_from.get("value", [{}])[0].get("address", "Unknown")
        elif isinstance(raw_from, str):
            extracted_sender = raw_from

    if extracted_subject == "(No Subject)":
        extracted_subject = raw_data.get("Subject") or raw_data.get("subject") or "(No Subject)"

    if extracted_body == "(No Content)":
        # Search for common text fields from Gmail nodes
        extracted_body = raw_data.get("text") or raw_data.get("body") or raw_data.get("snippet") or "(No Content)"

    # Logs the raw incoming for debugging
    await log_event("GMAIL_RAW", {
        "received": raw_data,
        "parsed": {
            "sender": extracted_sender,
            "subject": extracted_subject,
            "body": extracted_body
        }
    }, db, entity_id=extracted_sender or "unknown", source="gmail")

    # 1. Title Filtering
    # Strip whitespace and check for prefix
    clean_subject = extracted_subject.strip().replace(" ", "").replace("　", "")
    if not (clean_subject.startswith("[測試]") or clean_subject.startswith("【測試】")):
        logger.info(f"Gmail skipped: Subject '{extracted_subject}' hasn't [測試] prefix.")
        return {"status": "skipped", "reason": "subject_filter", "debug": extracted_subject}

    # 2. Content Sanitization
    safe_body = sanitize_email_content(extracted_body)
    
    await log_event("GMAIL_IN", {"sender": extracted_sender, "subject": extracted_subject, "content": safe_body}, db, entity_id=extracted_sender, source="gmail")

    # 3. Upsert Lead
    lead = db.query(Lead).filter(Lead.platform_id == extracted_sender).first()
    if not lead:
        lead = Lead(
            platform_id=extracted_sender, 
            name=extracted_sender.split('@')[0], 
            source="gmail"
        )
        db.add(lead)
    
    lead.last_interaction = datetime.now()
    db.commit()
    return {"status": "success", "lead_id": lead.id}

class GmailSendRequest(BaseModel):
    recipient: str
    subject: str
    body: str

@app.post("/api/gmail/send")
async def send_gmail(mail: GmailSendRequest, db: Session = Depends(get_db)):
    """Triggers n8n to send a Gmail."""
    try:
        payload = {
            "to": mail.recipient,
            "subject": mail.subject,
            "message": mail.body
        }
        await log_event("GMAIL_OUT", payload, db, entity_id=mail.recipient, source="gmail")
        # Trigger n8n Gmail Sender workflow (placeholder name 'GMAIL_SENDER')
        result = await n8n.trigger_workflow("GMAIL_SENDER", payload)
        return {"status": "success", "n8n_response": result}
    except Exception as e:
        logger.error(f"Gmail Send Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Direct Messaging ---

class MessageSendRequest(BaseModel):
    uid: str
    message: str
    source: Optional[str] = "line"
    msg_type: Optional[str] = "text"

@app.post("/api/message/send")
async def send_direct_message(req: MessageSendRequest, db: Session = Depends(get_db)):
    """Sends a direct message to a user via n8n SENDER."""
    try:
        payload = {
            "uid": req.uid,
            "message": req.message,
            "type": req.msg_type
        }
        await log_event("DIRECT_MSG_OUT", payload, db, entity_id=req.uid, source=req.source)
        # Trigger n8n SENDER workflow
        result = await n8n.trigger_workflow("SENDER", payload)
        return {"status": "success", "n8n_response": result}
    except Exception as e:
        logger.error(f"Direct Send Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Lead Management (Scenario 5) ---

@app.get("/leads", response_model=List[LeadResponse])
async def get_leads(db: Session = Depends(get_db)):
    """Fetch all leads for the dashboard."""
    return db.query(Lead).order_by(Lead.last_interaction.desc()).all()

@app.patch("/leads/{lead_id}")
async def update_lead(lead_id: int, update_data: Dict[str, Any], db: Session = Depends(get_db)):
    """Update lead details (alias, status, etc.)"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    for key, value in update_data.items():
        if hasattr(lead, key):
            setattr(lead, key, value)
            
    db.commit()
    db.refresh(lead)
    return lead

@app.get("/tasks")
async def get_tasks(db: Session = Depends(get_db)):
    """Fetch all automation tasks for the dashboard."""
    return db.query(AutomatonTask).all()

# --- Customer List Management API ---

class ListCreate(BaseModel):
    name: str

@app.get("/lists")
async def get_all_lists(db: Session = Depends(get_db)):
    """Retrieve all custom customer lists."""
    return db.query(CustomerList).all()

@app.post("/lists")
async def create_list(lc: ListCreate, db: Session = Depends(get_db)):
    """Create a new list (e.g., '愛喝酒名單')."""
    new_list = CustomerList(name=lc.name)
    db.add(new_list)
    try:
        db.commit()
        db.refresh(new_list)
        return new_list
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="List already exists or DB error")

@app.delete("/lists/{list_id}")
async def delete_list(list_id: int, db: Session = Depends(get_db)):
    """Delete a list."""
    target = db.query(CustomerList).filter(CustomerList.id == list_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="List not found")
    db.delete(target)
    db.commit()
    return {"status": "success"}

@app.get("/leads/{lead_id}/logs", response_model=List[LogResponse])
async def get_lead_logs(lead_id: int, db: Session = Depends(get_db)):
    """Fetch full conversation history for a specific Lead."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Filter by UID or Platform ID (Support both LINE and Gmail)
    target_id = lead.line_uid or lead.platform_id
    return db.query(InteractionLog).filter(InteractionLog.entity_id == target_id).order_by(InteractionLog.timestamp.desc()).all()

@app.post("/leads/{lead_id}/lists/{list_id}")
async def add_lead_to_list(lead_id: int, list_id: int, db: Session = Depends(get_db)):
    """Associate lead with a list."""
    assoc = LeadListAssociation(lead_id=lead_id, list_id=list_id)
    db.add(assoc)
    try:
        db.commit()
        return {"status": "success"}
    except:
        db.rollback()
        return {"status": "already_associated"}

@app.delete("/leads/{lead_id}/lists/{list_id}")
async def remove_lead_from_list(lead_id: int, list_id: int, db: Session = Depends(get_db)):
    """Remove lead from a list."""
    assoc = db.query(LeadListAssociation).filter(
        LeadListAssociation.lead_id == lead_id,
        LeadListAssociation.list_id == list_id
    ).first()
    if assoc:
        db.delete(assoc)
        db.commit()
    return {"status": "success"}

@app.get("/leads/{lead_id}/ai-context")
async def get_lead_ai_context(lead_id: int, db: Session = Depends(get_db)):
    """
    Gather logs and metadata for a lead to help the AI perform semantic analysis.
    """
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    logs = db.query(InteractionLog).filter(
        InteractionLog.entity_id == lead.line_uid
    ).order_by(InteractionLog.timestamp.desc()).limit(20).all()
    
    log_texts = [f"[{log.timestamp}] {log.event_type}: {log.content}" for log in logs]
    
    return {
        "lead_id": lead.id,
        "line_uid": lead.line_uid,
        "name": lead.name,
        "current_meta": lead.meta_info,
        "recent_logs": log_texts,
        "prompt_hint": f"請幫我分析客戶 {lead.name} 的對話紀錄，看看是否有遺漏的手機、Email 或性別資訊。"
    }

@app.get("/leads/{lead_id}/lists")
async def get_lead_lists(lead_id: int, db: Session = Depends(get_db)):
    """Get all lists a lead belongs to."""
    return db.query(CustomerList).join(LeadListAssociation).filter(LeadListAssociation.lead_id == lead_id).all()

@app.get("/lists/{list_id}/leads")
async def get_list_leads(list_id: int, db: Session = Depends(get_db)):
    """Get all leads in a specific list."""
    return db.query(Lead).join(LeadListAssociation).filter(LeadListAssociation.list_id == list_id).all()

# --- LINE Broadcast System (Scenario 5 Extension) ---

class TemplateUpdate(BaseModel):
    name: Optional[str]
    content: str
    msg_type: str # text, flex

@app.get("/broadcast/templates")
async def get_templates(db: Session = Depends(get_db)):
    """Fetch all 9 message slots."""
    templates = db.query(MessageTemplate).order_by(MessageTemplate.slot_number).all()
    # Ensure all 9 slots exist in response for UI
    result = {i: None for i in range(1, 10)}
    for t in templates:
        result[t.slot_number] = t
    return result

@app.post("/broadcast/templates/{slot}")
async def save_template(slot: int, tu: TemplateUpdate, db: Session = Depends(get_db)):
    """Save or update a message template in a specific slot (1-9)."""
    if slot < 1 or slot > 9:
        raise HTTPException(status_code=400, detail="Slot must be 1-9")
    
    template = db.query(MessageTemplate).filter(MessageTemplate.slot_number == slot).first()
    if not template:
        template = MessageTemplate(slot_number=slot)
        db.add(template)
    
    template.name = tu.name or f"Template {slot}"
    template.content = tu.content
    template.msg_type = tu.msg_type
    db.commit()
    db.refresh(template)
    return template

class BroadcastRequest(BaseModel):
    list_id: int
    template_id: int
    scheduled_at: Optional[str] = None # ISO Format

@app.post("/broadcast/send")
async def broadcast_message(br: BroadcastRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Trigger or schedule a broadcast to a list."""
    template = db.query(MessageTemplate).filter(MessageTemplate.id == br.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    leads = db.query(Lead).join(LeadListAssociation).filter(LeadListAssociation.list_id == br.list_id).all()
    if not leads:
        raise HTTPException(status_code=400, detail="List is empty")

    if br.scheduled_at:
        try:
            sched_time = datetime.fromisoformat(br.scheduled_at.replace('Z', '+00:00'))
            new_job = BroadcastJob(
                list_id=br.list_id,
                template_id=br.template_id,
                scheduled_at=sched_time,
                status="pending"
            )
            db.add(new_job)
            db.commit()
            return {"status": "scheduled", "job_id": new_job.id}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")
    else:
        # Immediate send via Background Task
        background_tasks.add_task(process_broadcast, br.list_id, template.content, template.msg_type)
        return {"status": "sending_started"}

@app.get("/broadcast/jobs")
async def get_broadcast_jobs(db: Session = Depends(get_db)):
    """Fetch all pending broadcast jobs and the 10 most recent completed/failed ones."""
    pending_jobs = db.query(BroadcastJob).filter(BroadcastJob.status == "pending").order_by(BroadcastJob.scheduled_at.asc()).all()
    recent_jobs = db.query(BroadcastJob).filter(BroadcastJob.status != "pending").order_by(BroadcastJob.scheduled_at.desc()).limit(10).all()
    
    all_jobs = pending_jobs + recent_jobs
    
    result = []
    for job in all_jobs:
        result.append({
            "id": job.id,
            "list_name": job.customer_list.name if job.customer_list else "未知名單",
            "template_name": job.template.name if job.template else f"範本 {job.template_id}",
            "scheduled_at": job.scheduled_at,
            "status": job.status
        })
    return result

@app.delete("/broadcast/jobs/{job_id}")
async def cancel_broadcast_job(job_id: int, db: Session = Depends(get_db)):
    """Cancel a pending broadcast job."""
    job = db.query(BroadcastJob).filter(BroadcastJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != "pending":
        raise HTTPException(status_code=400, detail="只有等待中的任務可以被取消")
    
    db.delete(job)
    db.commit()
    return {"status": "success"}

async def process_broadcast(list_id: int, content: str, msg_type: str):
    """Worker function to send messages to n8n one by one."""
    # We need a new session for background tasks
    db = models.SessionLocal()
    try:
        leads = db.query(Lead).join(LeadListAssociation).filter(LeadListAssociation.list_id == list_id).all()
        logger.info(f"🚀 Starting broadcast to list {list_id} ({len(leads)} leads)")
        
        for lead in leads:
            try:
                if lead.source == "gmail":
                    recipient = lead.platform_id
                    # n8n GMAIL_SENDER expects to, subject, message
                    payload = {
                        "to": recipient,
                        "subject": f"[廣播] 自動化訊息",
                        "message": content
                    }
                    await n8n.trigger_workflow("GMAIL_SENDER", payload)
                    await log_event("BROADCAST_SENT", {"recipient": recipient, "source": "gmail"}, db, entity_id=recipient, source="gmail")
                else:
                    # Default: LINE
                    uid = lead.line_uid or lead.platform_id
                    payload = {
                        "uid": uid,
                        "message": content,
                        "type": msg_type
                    }
                    await n8n.trigger_workflow("SENDER", payload)
                    await log_event("BROADCAST_SENT", {"uid": uid, "source": "line", "type": msg_type}, db, entity_id=uid, source="line")
            except Exception as e:
                logger.error(f"Failed to send broadcast to {lead.id}: {e}")
        
    finally:
        db.close()

# Scheduler Loop: Checks for pending jobs every 60 seconds
async def start_scheduler():
    while True:
        db = models.SessionLocal()
        try:
            now = datetime.utcnow()
            pending_jobs = db.query(BroadcastJob).filter(
                BroadcastJob.status == "pending",
                BroadcastJob.scheduled_at <= now
            ).all()
            
            for job in pending_jobs:
                job.status = "sending"
                db.commit()
                
                # Fetch template content
                template = db.query(MessageTemplate).filter(MessageTemplate.id == job.template_id).first()
                if template:
                    await process_broadcast(job.list_id, template.content, template.msg_type)
                    job.status = "completed"
                else:
                    job.status = "failed"
                db.commit()
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        finally:
            db.close()
            await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    # Start the scheduler in the background
    asyncio.create_task(start_scheduler())

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

# --- Analytics Lab API ---

class SQLQuery(BaseModel):
    query: str

@app.post("/api/analytics/query")
async def execute_sql_query(payload: SQLQuery, db: Session = Depends(get_db)):
    """
    Execute raw SQL for analytics. 
    Returns list of records formatted as dicts.
    """
    try:
        # Check for harmful verbs (STRICT blocking for IT beginners)
        forbidden = ["drop", "delete", "update", "insert", "truncate", "alter"]
        q_lower = payload.query.lower()
        if any(verb in q_lower for verb in forbidden):
            raise HTTPException(
                status_code=403, 
                detail="基於安全考量(IT小白保護機制)，禁止執行非查詢類(SELECT)的指令。"
            )
            
        result = db.execute(text(payload.query))
        
        # Check if the result has rows (is a SELECT)
        if result.returns_rows:
            rows = result.fetchall()
            # Convert Row objects to dictionaries
            keys = result.keys()
            data = [dict(zip(keys, row)) for row in rows]
            return {"data": data, "cols": list(keys)}
        else:
            db.commit() # Commit in case they did an insert/update despite warning
            return {"message": "Command executed successfully", "data": [], "cols": []}
            
    except Exception as e:
        logger.error(f"SQL Execution Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# --- Onboarding Management API ---

@app.get("/api/onboarding/steps")
async def get_onboarding_steps(db: Session = Depends(get_db)):
    return db.query(OnboardingStep).order_by(OnboardingStep.step_index).all()

@app.post("/api/onboarding/steps")
async def create_onboarding_step(step: Dict[str, Any], db: Session = Depends(get_db)):
    new_step = OnboardingStep(**step)
    db.add(new_step)
    db.commit()
    db.refresh(new_step)
    return new_step

@app.delete("/api/onboarding/steps/{step_id}")
async def delete_onboarding_step(step_id: int, db: Session = Depends(get_db)):
    step = db.query(OnboardingStep).filter(OnboardingStep.id == step_id).first()
    if step:
        db.delete(step)
        db.commit()
    return {"status": "success"}

# Initialize default onboarding if empty
@app.on_event("startup")
async def init_onboarding_defaults():
    db = SessionLocal()
    try:
        if db.query(OnboardingStep).count() == 0:
            defaults = [
                OnboardingStep(step_index=1, message="你好很高興認識你！我是 AI 助手。請問我該怎麼稱呼您呢？（例如：王先生、林小姐）", msg_type="text"),
                OnboardingStep(step_index=2, message="太好了！為了方便日後聯繫，可以留下您的 Email 或手機嗎？", msg_type="text"),
                OnboardingStep(step_index=3, message="感謝您的資訊！我已經為您準備好專屬服務了，請問有什麼我可以幫您的？", msg_type="text")
            ]
            db.add_all(defaults)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    # Use reload=True so changes take effect immediately
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
