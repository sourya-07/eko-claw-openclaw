// src/tools/escalateIssue.ts
//
// Owns: Recording an escalation in SQLite and writing a JSON audit file to logs/.
// Does NOT own: Defining escalation thresholds (which live in AGENTS.md).
// Why: Provides a standardized, auditable output for external ticketing/alerting services
// (such as PagerDuty or operations Dashboards) to pick up. Never throws.

import { db, generateNextTicketId } from "../db/sqlite.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the logs/ directory at the workspace root
const logsDir = path.resolve(__dirname, "../../../logs");

export const escalateIssueSchema = {
  name: "escalate_issue",
  description:
    "Escalates an issue that cannot be answered directly (due to high severity or low RAG confidence). " +
    "Assigns a human resolver and response SLA based on severity. Records to SQLite and writes a JSON log. Never throws.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The support query that requires escalation."
      },
      severity: {
        type: "string",
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        description: "The classified severity of the issue."
      },
      reason: {
        type: "string",
        description: "The reason why escalation is necessary (e.g. 'high severity query', 'low retrieval confidence', 'tool failure')."
      },
      ticket_id: {
        type: "string",
        description: "The ticket ID if one was previously created for this query."
      },
      intent: {
        type: "string",
        description: "The classified intent of the query (e.g. TRANSACTION_DISPUTE, PAYMENT_ISSUE). Used when creating a new ticket during escalation."
      }
    },
    required: ["query", "severity", "reason"]
  }
};

interface EscalateIssueArgs {
  query: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  ticket_id?: string;
  intent?: string;
}

interface EscalateIssueResult {
  assigned_to: string;
  expected_response_time: string;
  isError: boolean;
  message?: string;
  errorMessage?: string;
}

const ESCALATION_MATRIX: Record<string, { assigned_to: string; expected_response_time: string; escalation_channel: string }> = {
  LOW: {
    assigned_to: "Support Staff",
    expected_response_time: "24 hours",
    escalation_channel: "support@eko.co.in"
  },
  MEDIUM: {
    assigned_to: "Operations Team Lead",
    expected_response_time: "4 hours",
    escalation_channel: "ops@eko.co.in"
  },
  HIGH: {
    assigned_to: "Senior Operations Manager",
    expected_response_time: "2 hours",
    escalation_channel: "ops-lead@eko.co.in"
  },
  CRITICAL: {
    assigned_to: "Head of Operations",
    expected_response_time: "30 minutes",
    escalation_channel: "nodalofficer@eko.co.in"
  }
};

export async function escalateIssue(args: EscalateIssueArgs): Promise<EscalateIssueResult> {
  const { query, severity, reason, ticket_id } = args;

  const severityUpper = severity.toUpperCase();
  const matrixEntry = ESCALATION_MATRIX[severityUpper] || ESCALATION_MATRIX["HIGH"];
  const escalatedAt = new Date().toISOString();

  const escalationNoteText =
    `[ESCALATED at ${escalatedAt}]\n` +
    `Severity: ${severityUpper}\n` +
    `Reason: ${reason}\n` +
    `Assigned to: ${matrixEntry.assigned_to}\n` +
    `Expected response: ${matrixEntry.expected_response_time}\n` +
    `Contact: ${matrixEntry.escalation_channel}`;

  try {
    let finalTicketId = ticket_id;

    // 1. Ensure ticket exists and is updated in SQLite database
    if (!finalTicketId) {
      finalTicketId = generateNextTicketId();
      const intentValue = (args.intent || "UNKNOWN_INTENT_ESCALATED").toUpperCase();
      db.prepare(`
        INSERT INTO tickets (ticket_id, query, intent, severity, status, confidence_score, assigned_to, escalation_note, created_at, updated_at, resolved_at)
        VALUES (?, ?, ?, ?, 'ESCALATED', 0.0, ?, ?, ?, ?, NULL)
      `).run(
        finalTicketId,
        query,
        intentValue,
        severityUpper,
        matrixEntry.assigned_to,
        escalationNoteText,
        escalatedAt,
        escalatedAt
      );
    } else {
      db.prepare(`
        UPDATE tickets 
        SET status = 'ESCALATED', assigned_to = ?, escalation_note = ?, updated_at = ?, resolved_at = NULL
        WHERE ticket_id = ?
      `).run(
        matrixEntry.assigned_to,
        escalationNoteText,
        escalatedAt,
        finalTicketId
      );
    }

    // 2. Save escalation audit log file in logs/
    if (!fs.existsSync(logsDir)) {
      await fs.promises.mkdir(logsDir, { recursive: true });
    }

    // Format matches original filename YYYYMMDDTHHmmssZ
    const timestampCompact = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const logFilename = `escalation_${timestampCompact}_${finalTicketId}.json`;
    const logPath = path.join(logsDir, logFilename);

    const escalationData = {
      ticket_id: finalTicketId,
      severity: severityUpper,
      reason,
      assigned_to: matrixEntry.assigned_to,
      expected_response_time: matrixEntry.expected_response_time,
      escalation_channel: matrixEntry.escalation_channel,
      escalated_at: escalatedAt,
      escalation_note: escalationNoteText,
      is_error: false,
      escalation_failed: false
    };

    await fs.promises.writeFile(logPath, JSON.stringify(escalationData, null, 2), "utf8");

    return {
      assigned_to: matrixEntry.assigned_to,
      expected_response_time: matrixEntry.expected_response_time,
      isError: false,
      message: `Issue escalated successfully to ${matrixEntry.assigned_to}. Expected response within ${matrixEntry.expected_response_time}.`
    };
  } catch (error) {
    console.error("Database or filesystem error in escalateIssue tool:", error);
    return {
      assigned_to: matrixEntry.assigned_to,
      expected_response_time: matrixEntry.expected_response_time,
      isError: true,
      errorMessage: `Escalation logging failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
