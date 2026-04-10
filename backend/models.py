from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database Setup (using SQLite for portability)
# Updated to use relative path for better portability
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    line_uid = Column(String, unique=True, index=True)
    name = Column(String)
    status = Column(String, default="new")  # new, in-progress, completed
    meta_info = Column(JSON, default={})     # Custom data captured (phone, email, etc.)
    last_interaction = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

class AutomatonTask(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    task_type = Column(String)  # scraper, sender, analyzer
    status = Column(String, default="active")
    interval_seconds = Column(Integer, default=3600)
    last_run = Column(DateTime)
    last_result = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class InteractionLog(Base):
    __tablename__ = "interaction_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(String)  # Using line_uid or ID to link to Lead
    event_type = Column(String)  # BOT_CMD_IN, BOT_CMD_OUT, TRIGGER_SUCCESS
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

class CustomerList(Base):
    __tablename__ = "customer_lists"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class LeadListAssociation(Base):
    __tablename__ = "lead_list_associations"
    
    lead_id = Column(Integer, ForeignKey("leads.id"), primary_key=True)
    list_id = Column(Integer, ForeignKey("customer_lists.id"), primary_key=True)

class MessageTemplate(Base):
    __tablename__ = "message_templates"
    id = Column(Integer, primary_key=True, index=True)
    slot_number = Column(Integer, unique=True, index=True) # 1-9
    name = Column(String)
    content = Column(Text) # JSON or Text
    msg_type = Column(String) # 'text' or 'flex'
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BroadcastJob(Base):
    __tablename__ = "broadcast_jobs"
    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("customer_lists.id"))
    template_id = Column(Integer, ForeignKey("message_templates.id"))
    scheduled_at = Column(DateTime)
    status = Column(String, default="pending") # pending, sending, completed, failed
    progress = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer_list = relationship("CustomerList")
    template = relationship("MessageTemplate")

# Create tables
def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
