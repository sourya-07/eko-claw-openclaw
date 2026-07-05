// src/types.ts
//
// Owns: Shared TypeScript definitions and types for the Eko Claw MCP server.
// Why: Centralizing interfaces prevents code duplication and mismatch of model labels.

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Intent =
  | "PAYMENT_ISSUE"
  | "KYC_ISSUE"
  | "PARTNER_QUERY"
  | "TRANSACTION_DISPUTE"
  | "ESCALATION_REQUIRED"
  | "GENERAL_INQUIRY";

export type Outcome = "ANSWERED" | "TICKETED" | "ESCALATED";

export interface Chunk {
  content: string;
  metadata: Record<string, any>;
}

export interface Ticket {
  ticket_id: string;
  query: string;
  intent: Intent;
  severity: Severity;
  confidence_score: number | null;
  status: "OPEN" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED" | "CLOSED";
  assigned_to: string | null;
  escalation_note: string | null;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string | null;
}


export interface ToolTraceItem {
  tool: string;
  args?: Record<string, any>;
  result: Record<string, any>;
}
