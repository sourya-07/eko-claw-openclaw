// src/index.ts
//
// Owns: Main MCP server process, routing tool requests, and lifecycle management.
// Does NOT own: Execution logic of individual tools (delegated to src/tools/).
// Why: Standardizes server routing and shields the stdin/stdout transport layer.
// IMPORTANT: All diagnostic logging MUST use console.error instead of console.log.
// Stdio transport utilizes stdout for JSON-RPC messages; any plain text printed to stdout
// will corrupt the protocol stream and crash the OpenClaw session gateway.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import tools and schemas
import { searchKnowledgeBaseSchema, searchKnowledgeBase } from "./tools/searchKnowledgeBase.js";
import { classifyIntentSchema, classifyIntent } from "./tools/classifyIntent.js";
import { classifySeveritySchema, classifySeverity } from "./tools/classifySeverity.js";
import { createTicketSchema, createTicket } from "./tools/createTicket.js";
import { updateTicketSchema, updateTicket } from "./tools/updateTicket.js";
import { escalateIssueSchema, escalateIssue } from "./tools/escalateIssue.js";
import { logInteractionSchema, logInteraction } from "./tools/logInteraction.js";

const server = new Server(
  {
    name: "eko-claw-tools",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register list tools schema
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      searchKnowledgeBaseSchema,
      classifyIntentSchema,
      classifySeveritySchema,
      createTicketSchema,
      updateTicketSchema,
      escalateIssueSchema,
      logInteractionSchema
    ]
  };
});

// Register call tool schema
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Log request details to stderr for debugging
  console.error(`MCP calling tool: "${name}" with args:`, JSON.stringify(args));

  try {
    let result: any;

    switch (name) {
      case "search_knowledge_base":
        result = await searchKnowledgeBase(args as any);
        break;
      case "classify_intent":
        result = await classifyIntent(args as any);
        break;
      case "classify_severity":
        result = await classifySeverity(args as any);
        break;
      case "create_ticket":
        result = await createTicket(args as any);
        break;
      case "update_ticket":
        result = await updateTicket(args as any);
        break;
      case "escalate_issue":
        result = await escalateIssue(args as any);
        break;
      case "log_interaction":
        result = await logInteraction(args as any);
        break;
      default:
        throw new Error(`Requested tool "${name}" was not found on this server.`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result)
        }
      ]
    };
  } catch (error: any) {
    console.error(`Execution error in tool "${name}":`, error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            isError: true,
            errorMessage: error instanceof Error ? error.message : String(error)
          })
        }
      ],
      isError: true
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Eko Claw MCP Server successfully initialized on Stdio Transport.");
}

run().catch((error) => {
  console.error("Critical failure during MCP server startup:", error);
  process.exit(1);
});
