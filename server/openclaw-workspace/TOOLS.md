# TOOLS.md

## search_knowledge_base
Searches Eko's internal FAQs, SOPs, and policies via the local RAG service. Read-only. Returns chunks and a confidence_score between 0 and 1. A low score is valid signal — it means the knowledge base genuinely lacks coverage, not that the tool failed.

## classify_intent / classify_severity
Deterministic classification. Always call both before deciding next steps. Never estimate these yourself.

## create_ticket
Writes a new ticket. Call once per query only. Use update_ticket for any changes afterward.

## escalate_issue
Irreversible from the agent's side. Only call when the AGENTS.md decision rule says to — do not escalate defensively.

## log_interaction
Always the last call of every turn. Never skip this.
