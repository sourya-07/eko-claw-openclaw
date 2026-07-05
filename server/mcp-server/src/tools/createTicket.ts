// src/tools/createTicket.ts
//
// Owns: Generating the custom ticket_id and saving a new ticket record to SQLite.
// Does NOT own: Deciding when to create a ticket (lives in AGENTS.md).
// Why: Standardizes the persistence layer. Encapsulating SQL writes here keeps agent files clean
// and guarantees that database exceptions are caught and reported safely.

import { db, generateNextTicketId } from "../db/sqlite.js";

export const createTicketSchema = {
  name: "create_ticket",
  description:
    "Creates a structured support ticket in Eko's local SQLite database. " +
    "Generates a unique EKO-YYYY-NNNN ticket ID and returns the created record details. Never throws.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The original support query submitted by the merchant."
      },
      intent: {
        type: "string",
        description: "The classified intent of the query (e.g. PAYMENT_ISSUE)."
      },
      severity: {
        type: "string",
        description: "The classified severity of the query (e.g. LOW, MEDIUM)."
      },
      confidenceScore: {
        type: "number",
        description: "The retrieval confidence score returned by search_knowledge_base."
      },
      chunks: {
        type: "array",
        items: { type: "string" },
        description: "The raw markdown document chunks retrieved during search."
      }
    },
    required: ["query", "intent", "severity", "confidenceScore", "chunks"]
  }
};

interface CreateTicketArgs {
  query: string;
  intent: string;
  severity: string;
  confidenceScore: number;
  chunks: string[];
}

interface CreateTicketResult {
  ticket_id: string;
  status: string;
  isError: boolean;
  message?: string;
  errorMessage?: string;
}

export async function createTicket(args: CreateTicketArgs): Promise<CreateTicketResult> {
  try {
    const ticketId = generateNextTicketId();
    const nowIso = new Date().toISOString();

    const severityToAssignee: Record<string, string> = {
      LOW: "Support Staff",
      MEDIUM: "Operations Team Lead",
      HIGH: "Senior Operations Manager",
      CRITICAL: "Head of Operations"
    };
    const assignedTo = severityToAssignee[args.severity.toUpperCase()] || "Support Staff";

    db.prepare(`
      INSERT INTO tickets (ticket_id, query, intent, severity, status, confidence_score, assigned_to, escalation_note, created_at, updated_at, resolved_at)
      VALUES (?, ?, ?, ?, 'OPEN', ?, ?, NULL, ?, ?, NULL)
    `).run(
      ticketId,
      args.query,
      args.intent,
      args.severity.toUpperCase(),
      args.confidenceScore,
      assignedTo,
      nowIso,
      nowIso
    );

    return {
      ticket_id: ticketId,
      status: "OPEN",
      isError: false,
      message: `Support ticket ${ticketId} successfully created for intent ${args.intent}.`
    };
  } catch (error) {
    console.error("Database error in createTicket tool execution:", error);
    return {
      ticket_id: "",
      status: "",
      isError: true,
      errorMessage: `Failed to insert ticket: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
