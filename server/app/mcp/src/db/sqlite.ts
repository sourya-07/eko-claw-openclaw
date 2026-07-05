// src/db/sqlite.ts
//
// Owns: SQLite persistent database connection and schema initialization.
// Does NOT own: Business decision rules or RAG search functionality.
// Why: SQLite is a zero-cost, serverless, file-based database that works locally.
// using better-sqlite3 avoids the complexity of external DB servers.

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Place database file in the mcp-server root folder
const dbPath = path.resolve(__dirname, "../../eko_claw.db");

console.error(`Initializing SQLite database at: ${dbPath}`);

export const db = new Database(dbPath);

// Enable foreign keys for integrity
db.pragma("foreign_keys = ON");

// Initialize Schema
try {
  db.prepare("SELECT assigned_to FROM tickets LIMIT 1").get();
} catch (e) {
  console.error("Old schema detected. Dropping old tables to migrate to aligned parity schema...");
  db.exec("DROP TABLE IF EXISTS escalations;");
  db.exec("DROP TABLE IF EXISTS tickets;");
  db.exec("DROP TABLE IF EXISTS interactions;");
}

db.exec(`
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

  CREATE INDEX IF NOT EXISTS idx_interactions_ticket_id ON interactions(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_status_severity ON tickets(status, severity);
`);

/**
 * Generates an incrementing unique ticket ID in the format EKO-YYYY-NNNN.
 * Looks up the last created ticket ID for the current year to determine the sequence.
 */
export function generateNextTicketId(): string {
  const currentYear = new Date().getFullYear();
  const pattern = `EKO-${currentYear}-%`;

  try {
    const row = db.prepare(`
      SELECT ticket_id 
      FROM tickets 
      WHERE ticket_id LIKE ? 
      ORDER BY ticket_id DESC 
      LIMIT 1
    `).get(pattern) as { ticket_id: string } | undefined;

    let nextSeq = 1;
    if (row && row.ticket_id) {
      const parts = row.ticket_id.split("-");
      if (parts.length === 3) {
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
    }

    const seqStr = String(nextSeq).padStart(4, "0");
    return `EKO-${currentYear}-${seqStr}`;
  } catch (error) {
    console.error("Error generating next ticket ID, falling back to timestamp suffix:", error);
    // Safe fallback if queries fail
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `EKO-${currentYear}-${rand}`;
  }
}
