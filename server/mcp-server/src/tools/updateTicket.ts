// src/tools/updateTicket.ts
//
// Owns: Updating status, severity, or updated timestamp for an existing ticket in SQLite.
// Does NOT own: Defining ticket lifecycle stages.
// Why: Provides a standard interface for post-creation updates (such as manual resolutions or escalation linkings).

import { db } from "../db/sqlite.js";

export const updateTicketSchema = {
  name: "update_ticket",
  description: "Updates an existing support ticket's status, notes, or severity in Eko's local SQLite database. Never throws.",
  inputSchema: {
    type: "object",
    properties: {
      ticket_id: {
        type: "string",
        description: "The unique ticket ID to update (e.g. EKO-2026-0001)."
      },
      status: {
        type: "string",
        enum: ["OPEN", "IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"],
        description: "The new status of the ticket."
      },
      notes: {
        type: "string",
        description: "Operational notes to set/append on the ticket's escalation_note field."
      },
      severity: {
        type: "string",
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        description: "The updated severity classification of the ticket."
      }
    },
    required: ["ticket_id"]
  }
};

interface UpdateTicketArgs {
  ticket_id: string;
  status?: "OPEN" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED" | "CLOSED";
  notes?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface UpdateTicketResult {
  ticket_id: string;
  isError: boolean;
  message?: string;
  errorMessage?: string;
}

export async function updateTicket(args: UpdateTicketArgs): Promise<UpdateTicketResult> {
  const { ticket_id, status, notes, severity } = args;

  try {
    // Check if the ticket exists
    const ticket = db.prepare("SELECT ticket_id FROM tickets WHERE ticket_id = ?").get(ticket_id);
    if (!ticket) {
      return {
        ticket_id,
        isError: true,
        errorMessage: `Ticket with ID ${ticket_id} was not found in the database.`
      };
    }

    const updates: string[] = [];
    const params: any[] = [];
    const nowIso = new Date().toISOString();

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status.toUpperCase());
      
      if (status.toUpperCase() === "RESOLVED" || status.toUpperCase() === "CLOSED") {
        updates.push("resolved_at = ?");
        params.push(nowIso);
      } else {
        updates.push("resolved_at = NULL");
      }
    }
    if (notes !== undefined) {
      updates.push("escalation_note = ?");
      params.push(notes);
    }
    if (severity !== undefined) {
      updates.push("severity = ?");
      params.push(severity.toUpperCase());
    }

    if (updates.length === 0) {
      return {
        ticket_id,
        isError: false,
        message: "No attributes were provided for update. Ticket remains unchanged."
      };
    }

    updates.push("updated_at = ?");
    params.push(nowIso);
    params.push(ticket_id);

    db.prepare(`
      UPDATE tickets 
      SET ${updates.join(", ")}
      WHERE ticket_id = ?
    `).run(...params);

    return {
      ticket_id,
      isError: false,
      message: `Ticket ${ticket_id} was successfully updated.`
    };
  } catch (error) {
    console.error(`Database error in updateTicket tool execution for ID ${ticket_id}:`, error);
    return {
      ticket_id,
      isError: true,
      errorMessage: `Failed to update ticket: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
