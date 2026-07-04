import sqlite3
import os
import random
from datetime import datetime, timedelta, timezone

# Resolve path relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.environ.get("DATABASE_URL", os.path.join(BASE_DIR, "data", "eko_support.db"))

# Ensure the parent directory of DB exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def get_db_connection():
    """
    Creates and returns a thread-safe connection to the SQLite database.
    Configures WAL journaling, foreign keys, and ROW result structure.
    """
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    
    # Configure Performance parameters
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.close()
    
    return conn

def init_db():
    """
    Creates necessary tables and indexes if they do not exist.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Create tickets table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tickets (
        ticket_id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        intent TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        status TEXT NOT NULL CHECK(status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED')),
        confidence_score REAL,
        assigned_to TEXT,
        escalation_note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        resolved_at TEXT
    );
    """)
    
    # 2. Create interactions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS interactions (
        interaction_id TEXT PRIMARY KEY,
        ticket_id TEXT,
        query TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK(outcome IN ('ANSWERED', 'TICKETED', 'ESCALATED')),
        confidence_score REAL,
        tools_used TEXT,       -- JSON array string
        response_given TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id) ON DELETE SET NULL
    );
    """)
    
    # 3. Create anomalies table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS anomalies (
        anomaly_id TEXT PRIMARY KEY,
        merchant TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        timestamp TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        status TEXT NOT NULL CHECK(status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED')),
        amount REAL NOT NULL,
        description TEXT,
        recommended_action TEXT,
        transaction_id TEXT UNIQUE NOT NULL
    );
    """)
    
    # 4. Create Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_status_severity ON tickets(status, severity);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_interactions_ticket_id ON interactions(ticket_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_anomalies_status_severity ON anomalies(status, severity);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON anomalies(timestamp);")
    
    conn.commit()
    
    # 5. Seed initial anomaly data if empty
    cursor.execute("SELECT count(*) FROM anomalies;")
    count = cursor.fetchone()[0]
    if count == 0:
        print("Seeding database with initial anomaly data...")
        seed_anomalies(cursor)
        conn.commit()
        
    cursor.close()
    conn.close()

def seed_anomalies(cursor):
    """
    Seeds a range of realistic payment anomalies spanning the last 7 days.
    """
    merchants = [
        "Sharma Grocery & Retail", "Krishna Telecom", "Verma Micro-ATM Hub",
        "Ramesh Kirana Store", "Sita Pay Point", "Anil General Store",
        "Super Digital Services", "Pooja Mobile Care", "Gupta Cash Agency"
    ]
    
    types = [
        ("Double Debit", "System debited customer account twice for a single successful merchant credit."),
        ("Velocity Limit Exceeded", "Merchant triggered more than 5 high-value withdrawals within 3 minutes."),
        ("High-Value Cashout Failure", "A single cashout request of 45,000 INR timed out and failed without instant reversal."),
        ("Suspicious Biometric Pattern", "AePS request failed 4 consecutive times with fingerprint mismatch warnings."),
        ("Midnight Transaction Burst", "Large volume of IMPS transfers totaling 120,000 INR processed between 2 AM and 4 AM.")
    ]
    
    severity_map = {
        "Double Debit": "MEDIUM",
        "Velocity Limit Exceeded": "HIGH",
        "High-Value Cashout Failure": "HIGH",
        "Suspicious Biometric Pattern": "CRITICAL",
        "Midnight Transaction Burst": "CRITICAL"
    }
    
    actions_map = {
        "Double Debit": "Initiate chargeback dispute via bank partner and check auto-refund state.",
        "Velocity Limit Exceeded": "Place merchant wallet on temporary hold. Call merchant to verify physical store activity.",
        "High-Value Cashout Failure": "Trigger manual reversal check on ICICI gateway. Notify partner operations node officer.",
        "Suspicious Biometric Pattern": "Request merchant to upload live photo on partner app. Lock AePS payouts temporarily.",
        "Midnight Transaction Burst": "Flag wallet for AML review. Call merchant to confirm authorization of night payouts."
    }
    
    now = datetime.now(timezone.utc)
    
    # Generate anomalies over the last 8 days
    for i in range(12):
        merchant = random.choice(merchants)
        type_name, desc_template = random.choice(types)
        severity = severity_map[type_name]
        action = actions_map[type_name]
        
        days_ago = random.randint(0, 7)
        hours_ago = random.randint(1, 23)
        timestamp = (now - timedelta(days=days_ago, hours=hours_ago)).isoformat()
        
        status = "OPEN"
        if days_ago > 3:
            status = random.choice(["RESOLVED", "UNDER_REVIEW"])
        elif days_ago > 1:
            status = random.choice(["OPEN", "UNDER_REVIEW"])
            
        anomaly_id = f"ANM-{2026}-{i+1:04d}"
        amount = round(random.uniform(500, 75000), 2)
        txn_id = f"TXN-{now.year}-{100000 + i}"
        description = f"{desc_template} Involved amount: {amount} INR."
        
        cursor.execute("""
        INSERT INTO anomalies (anomaly_id, merchant, type, severity, timestamp, status, amount, description, recommended_action, transaction_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (anomaly_id, merchant, type_name, severity, timestamp, status, amount, description, action, txn_id))

def generate_next_ticket_id():
    """
    Generates a unique incremented ticket ID in the format EKO-YYYY-NNNN.
    """
    current_year = datetime.now().year
    pattern = f"EKO-{current_year}-%"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT ticket_id 
            FROM tickets 
            WHERE ticket_id LIKE ? 
            ORDER BY ticket_id DESC 
            LIMIT 1
        """, (pattern,))
        row = cursor.fetchone()
        
        next_seq = 1
        if row and row['ticket_id']:
            parts = row['ticket_id'].split("-")
            if len(parts) == 3:
                try:
                    last_seq = int(parts[2])
                    next_seq = last_seq + 1
                except ValueError:
                    pass
                    
        seq_str = str(next_seq).zfill(4)
        return f"EKO-{current_year}-{seq_str}"
    except Exception as e:
        print(f"Error generating next ticket ID: {e}")
        rand = random.randint(1000, 9999)
        return f"EKO-{current_year}-{rand}"
    finally:
        cursor.close()
        conn.close()
