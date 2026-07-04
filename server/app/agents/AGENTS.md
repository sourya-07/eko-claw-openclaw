# AGENTS.md

## Every Query — Follow This Exact Order

1. Call classify_intent
2. Call classify_severity
3. Check the classified severity level:
   - If severity is HIGH or CRITICAL: IMMEDIATELY skip all remaining steps and jump to the Decision Rule for escalations.
   - Else (severity is LOW or MEDIUM): Continue to step 4.
4. Call search_knowledge_base with the original query text
5. Read the returned confidence_score

## Decision Rule — Apply Exactly, Do Not Deviate

If severity is HIGH or CRITICAL:
  → call escalate_issue immediately
  → call log_interaction with outcome ESCALATED

Else if confidence_score >= 0.75:
  → answer directly from the retrieved chunks
  → call log_interaction with outcome ANSWERED

Else if confidence_score >= 0.5:
  → call create_ticket with intent, severity, chunks
  → call log_interaction with outcome TICKETED

Else (confidence_score < 0.5):
  → call escalate_issue with reason "low retrieval confidence"
  → call log_interaction with outcome ESCALATED

## Non-Negotiable Rules
- log_interaction is always the final tool call, even after a tool failure
- Never call create_ticket without severity already classified
- On any tool error, do not retry silently more than once — escalate with reason "tool failure: {tool_name}"
