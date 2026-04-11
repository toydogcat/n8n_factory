import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.db")

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Starting Migration V3 (Gmail Support)...")
        
        # Add columns to leads table
        try:
            cursor.execute("ALTER TABLE leads ADD COLUMN platform_id TEXT")
            print("Added 'platform_id' to 'leads'")
        except sqlite3.OperationalError:
            print("'platform_id' already exists in 'leads'")

        try:
            cursor.execute("ALTER TABLE leads ADD COLUMN source TEXT DEFAULT 'line'")
            print("Added 'source' to 'leads'")
        except sqlite3.OperationalError:
            print("'source' already exists in 'leads'")

        # Update existing leads to have source='line' and platform_id = line_uid
        cursor.execute("UPDATE leads SET source = 'line' WHERE source IS NULL")
        cursor.execute("UPDATE leads SET platform_id = line_uid WHERE platform_id IS NULL AND line_uid IS NOT NULL")
        
        # Add column to interaction_logs table
        try:
            cursor.execute("ALTER TABLE interaction_logs ADD COLUMN source TEXT DEFAULT 'line'")
            print("Added 'source' to 'interaction_logs'")
        except sqlite3.OperationalError:
            print("'source' already exists in 'interaction_logs'")

        conn.commit()
        print("Migration V3 completed successfully!")
    except Exception as e:
        print(f"Migration Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
