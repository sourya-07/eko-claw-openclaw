import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { db } from "../db/sqlite.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to root logs/ directory
const logsDir = path.resolve(__dirname, "../../../logs");

export const logInteractionSchema = {
  name: "log_interaction",
  description:
    "Logs the session interaction audit trail to SQLite database and a local JSON file in the logs/ directory. " +
    "Must be called as the final tool execution of every session. Never throws.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The original query submitted by the user."
      },
      intent: {
        type: "string",
        description: "The classified intent of the query."
      },
      severity: {
        type: "string",
        description: "The classified severity of the query."
      },
      confidenceScore: {
        type: "number",
        description: "The confidence score from search_knowledge_base."
      },
      outcome: {
        type: "string",
        enum: ["ANSWERED", "TICKETED", "ESCALATED"],
        description: "The terminal status of this user session interaction."
      },
      ticketId: {
        type: "string",
        description: "The generated ticket ID (if outcome is TICKETED or ESCALATED with a ticket)."
      },
      responseGiven: {
        type: "string",
        description: "The draft response provided to the customer (if outcome is ANSWERED)."
      },
      reasoningTrace: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tool: { type: "string", description: "Name of the executed tool." },
            args: { type: "object", description: "Arguments passed to the tool." },
            result: { type: "object", description: "Result returned by the tool." }
          },
          required: ["tool", "result"]
        },
        description: "List of all tools invoked during this session trace."
      }
    },
    required: ["query", "intent", "severity", "confidenceScore", "outcome", "reasoningTrace"]
  }
};

interface ToolTraceItem {
  tool: string;
  args?: Record<string, any>;
  result: Record<string, any>;
}

interface LogInteractionArgs {
  query: string;
  intent: string;
  severity: string;
  confidenceScore: number;
  outcome: "ANSWERED" | "TICKETED" | "ESCALATED";
  ticketId?: string;
  responseGiven?: string;
  reasoningTrace: ToolTraceItem[];
}

interface LogInteractionResult {
  isError: boolean;
  message?: string;
  errorMessage?: string;
}

export async function logInteraction(args: LogInteractionArgs): Promise<LogInteractionResult> {
  const { query, intent, severity, confidenceScore, outcome, ticketId, responseGiven, reasoningTrace } = args;

  const interactionId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  try {
    // 1. Write to SQLite interactions table
    const toolsUsed = reasoningTrace.map(t => t.tool);
    db.prepare(`
      INSERT INTO interactions (interaction_id, ticket_id, query, outcome, confidence_score, tools_used, response_given, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      interactionId,
      ticketId || null,
      query,
      outcome,
      confidenceScore,
      JSON.stringify(toolsUsed),
      responseGiven || null,
      nowIso
    );

    // 2. Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      await fs.promises.mkdir(logsDir, { recursive: true });
    }

    // Format matches original compact timestamp representation
    const timestampCompact = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const fileSuffix = ticketId ? ticketId : "NO_TICKET";
    const logFilename = `interaction_${timestampCompact}_${fileSuffix}.json`;
    const logPath = path.join(logsDir, logFilename);

    const logPayload = {
      timestamp: nowIso,
      query,
      intent,
      severity,
      confidence_score: confidenceScore,
      outcome,
      ticket_id: ticketId || null,
      reasoning_trace: reasoningTrace
    };

    await fs.promises.writeFile(logPath, JSON.stringify(logPayload, null, 2), "utf8");

    return {
      isError: false,
      message: `Interaction successfully logged to DB and file: ${logFilename}.`
    };
  } catch (error) {
    console.error("Failed to write interaction log:", error);
    return {
      isError: true,
      errorMessage: `Logging failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
