import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "eko_support.db")

print(f"Opening database at: {DB_PATH}")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Map historical tickets to historical anomalies
links = {
    "EKO-2026-0003": "ANM-2026-0003",
    "EKO-2026-0005": "ANM-2026-0005",
    "EKO-2026-0006": "ANM-2026-0006",
    "EKO-2026-0007": "ANM-2026-0007",
    "EKO-2026-0008": "ANM-2026-0008",
    "EKO-2026-0010": "ANM-2026-0010",
    "EKO-2026-0011": "ANM-2026-0011",
    "EKO-2026-0012": "ANM-2026-0012",
}

for ticket_id, anomaly_id in links.items():
    cursor.execute("SELECT escalation_note FROM tickets WHERE ticket_id = ?", (ticket_id,))
    row = cursor.fetchone()
    if row:
        current_note = row[0] or ""
        if "Linked Anomaly:" not in current_note:
            new_note = f"{current_note}\nLinked Anomaly: {anomaly_id}"
            cursor.execute("UPDATE tickets SET escalation_note = ? WHERE ticket_id = ?", (new_note, ticket_id))
            print(f"Linked {ticket_id} -> {anomaly_id}")

conn.commit()
conn.close()
print("Migration completed successfully!")
