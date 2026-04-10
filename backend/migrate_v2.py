import sqlite3
import os

DB_PATH = "backend/data.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Adding 'onboarding_step' column to 'leads' table...")
        cursor.execute("ALTER TABLE leads ADD COLUMN onboarding_step INTEGER DEFAULT 0")
        conn.commit()
        print("Success!")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'onboarding_step' already exists.")
        else:
            print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
