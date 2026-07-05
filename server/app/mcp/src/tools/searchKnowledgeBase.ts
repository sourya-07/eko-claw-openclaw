// src/tools/searchKnowledgeBase.ts
//
// Owns: Calling the local Python RAG service running on localhost.
// Does NOT own: Confidence threshold decision logic (lives in AGENTS.md).
// Why: Keeps tool logic decoupled from agent decision parameters.
// If the local RAG service is unreachable or errors out, we return isError: true
// so the agent can gracefully escalate rather than crashing the system.

export const searchKnowledgeBaseSchema = {
  name: "search_knowledge_base",
  description:
    "Searches Eko's internal knowledge base (FAQs, SOPs, policies) via the local RAG " +
    "service running on localhost. Returns matching chunks and a confidence_score between 0 and 1. " +
    "A low score indicates the KB lacks coverage for this query, which is a valid signal.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The original support query text from the merchant or partner."
      }
    },
    required: ["query"]
  }
};

interface Chunk {
  content: string;
  metadata: Record<string, any>;
}

interface SearchToolResult {
  chunks: Chunk[];
  confidenceScore: number;
  confidence_score: number; // Support both cases to prevent model mismatches
  isError: boolean;
  errorMessage?: string;
}

export async function searchKnowledgeBase(args: { query: string }): Promise<SearchToolResult> {
  const query = (args.query?.trim() || "").substring(0, 1000);
  if (!query) {
    return {
      chunks: [],
      confidenceScore: 0.0,
      confidence_score: 0.0,
      isError: false
    };
  }

  try {
    const response = await fetch("http://127.0.0.1:8000/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      // Local service down is recoverable - returning a high-level error flag
      // triggers the agent fallback/escalation logic safely.
      return {
        chunks: [],
        confidenceScore: 0.0,
        confidence_score: 0.0,
        isError: true,
        errorMessage: `RAG service returned HTTP status ${response.status}`
      };
    }

    const data = (await response.json()) as { chunks: Chunk[]; confidence_score: number };
    const score = data.confidence_score ?? 0.0;

    return {
      chunks: data.chunks || [],
      confidenceScore: score,
      confidence_score: score,
      isError: false
    };
  } catch (error) {
    return {
      chunks: [],
      confidenceScore: 0.0,
      confidence_score: 0.0,
      isError: true,
      errorMessage: `RAG service unreachable: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
