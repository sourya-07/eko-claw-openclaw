# CLAW.md: Eko Support Operations Agent (OpenClaw Edition)

## 1. Mission Statement
Eko Claw is the autonomous operations agent for **Eko**, a fintech organization dedicated to bridging the financial services gap for millions of micro-entrepreneurs, retailers, and merchants across India. By providing local, low-latency, and zero-cost assistance, Eko Claw ensures that transaction delays, KYC bottlenecks, and payment failures are processed with human-like precision. Eko Claw aims to minimize transaction friction so that micro-merchants can run their businesses uninterrupted.

---

## 2. Architecture Overview
Eko Claw is designed with a modular, offline-first, three-tier architecture:

```
               +-----------------------------------------+
               |             OpenClaw Gateway            |
               | (Reads SOUL.md, AGENTS.md, TOOLS.md)     |
               +--------------------+--------------------+
                                    |
                                    | Stdio JSON-RPC Channel
                                    v
               +--------------------+--------------------+
               |           Node.js MCP Server            |
               | (Exposes tools, manages SQLite database)|
               +----------+--------------------+---------+
                          |                    |
             Local SQLite |                    | Local HTTP POST
             Queries      |                    | (localhost:8000)
                          v                    v
               +----------+---------+  +-------+---------+
               |    SQLite Database |  |  FastAPI Python |
               |     (eko_claw.db)  |  |   RAG Service   |
               +--------------------+  +-------+---------+
                                               |
                                  Local Disk   | ChromaDB Client
                                  Read/Write   v
                                       +-------+---------+
                                       | Local ChromaDB  |
                                       | (chroma_store/) |
                                       +-----------------+
```

- **OpenClaw Workspace Config:** The orchestration layer that injects the agent's identity (`SOUL.md`), standard operating procedures (`AGENTS.md`), and tool boundaries (`TOOLS.md`) as the system prompt. It directs the core LLM execution loop.
- **Node.js MCP Server:** Exposes custom tools to OpenClaw. It handles deterministic logic (such as ticket sequence generation and SLA matching) and interfaces with SQLite.
- **Python FastAPI RAG Service:** An offline service running on `localhost:8000`. It encodes queries using `sentence-transformers` and queries a local `ChromaDB` vector store to retrieve policy chunks and compute confidence scores.

### Why This Split Exists
1. **Separation of Concerns:** Business guidelines (`AGENTS.md`) and identity (`SOUL.md`) are config-first. Deterministic calculations (confidence math, ticket formatting, DB transactions) are compiled code in TypeScript.
2. **Offline Embedding matureness:** Python has robust, highly optimized libraries for `sentence-transformers` and `ChromaDB` running locally on CPU.
3. **Stdio Safety:** The Node.js MCP server executes as a child process under OpenClaw, ensuring direct stdin/stdout IPC, while the Python server runs as a separate local service.

---

## 3. Why OpenClaw Instead of LangGraph
While the workflow logic is functionally identical to the previous Python/LangGraph prototype, the transition to OpenClaw represents an architectural paradigm shift:

| Feature | LangGraph (Previous) | OpenClaw (Current) |
| :--- | :--- | :--- |
| **Logic Definition** | Hardcoded Python graph nodes, transitions, and edges. | Decoupled configuration files (`AGENTS.md`, `SOUL.md`) and declarative SOPs. |
| **Tool Orchestration** | Manual state updates and router nodes inside Python scripts. | OpenClaw native tool execution based on MCP schema discovery. |
| **Extensibility** | Code changes required in the graph script to alter agent flow. | Non-programmatic changes can be made by editing markdown system files. |
| **Runtime footprint** | Heavy graph runtime in memory. | Light config loader executing local binaries via stdin/stdout. |

---

## 4. Full Workflow Diagram

```
[ Merchant Query ]
        │
        ▼
 1. classify_intent  -----> [ Intent: PAYMENT_ISSUE, KYC_ISSUE, etc. ]
        │
        ▼
 2. classify_severity -----> [ Severity: LOW, MEDIUM, HIGH, CRITICAL ]
        │
        ├─────────────────────────────────────────┐
        ▼ (HIGH / CRITICAL)                       ▼ (LOW / MEDIUM)
[ escalate_issue ]                       3. search_knowledge_base
        │                                         │
        │                                         ▼
        │                                 [ Read confidence_score ]
        │                                         │
        │                       ┌─────────────────┼──────────────────┐
        │                       ▼ (>= 0.75)       ▼ (0.5 - 0.75)     ▼ (< 0.5)
        │                 [ Answer Direct ]  [ create_ticket ]  [ escalate_issue ]
        │                       │                 │                  │
        ▼                       ▼                 ▼                  ▼
[ log_interaction ] <───────────┴─────────────────┴──────────────────┘
        │
        ▼
  [ Turn End ]
```

---

## 5. Tool Registry

### 1. `classify_intent`
- **Input:** `query` (string)
- **Output:** `intent` (enum string), `source` (string)
- **Side Effects:** None.
- **Failures:** Fallback to local keyword rules if Gemini fails.

### 2. `classify_severity`
- **Input:** `query` (string)
- **Output:** `severity` (enum string), `source` (string)
- **Side Effects:** None.
- **Failures:** Fallback to keyword heuristics if Gemini fails.

### 3. `search_knowledge_base`
- **Input:** `query` (string)
- **Output:** `chunks` (array of objects), `confidence_score` (float), `isError` (boolean)
- **Side Effects:** None.
- **Failures:** Returns an error flag with empty results if RAG service is offline.

### 4. `create_ticket`
- **Input:** `query`, `intent`, `severity`, `confidenceScore`, `chunks`
- **Output:** `ticket_id`, `status`, `isError`
- **Side Effects:** Writes a new record to the SQLite database (`tickets` table).
- **Failures:** Returns `isError: true` on DB write failure.

### 5. `update_ticket`
- **Input:** `ticket_id`, `status` (optional), `severity` (optional)
- **Output:** `ticket_id`, `isError`
- **Side Effects:** Updates fields in SQLite.

### 6. `escalate_issue`
- **Input:** `query`, `severity`, `reason`, `ticket_id` (optional)
- **Output:** `assigned_to`, `expected_response_time`, `isError`
- **Side Effects:** Writes record to SQLite `escalations` table and outputs a JSON file to `/logs/`.

### 7. `log_interaction`
- **Input:** `query`, `intent`, `severity`, `confidenceScore`, `outcome`, `ticketId` (optional), `reasoningTrace`
- **Output:** `isError`
- **Side Effects:** Generates a timestamped pretty-printed interaction trace JSON under `/logs/`.

---

## 6. Confidence Scoring Logic and Thresholds
The RAG confidence score is calculated inside the local FastAPI service:
1. The search query is embedded using `all-MiniLM-L6-v2`.
2. ChromaDB runs a cosine search returning the top 3 closest chunks.
3. For each chunk distance $d$ (where $d \in [0, 2]$), the cosine similarity is computed as $1.0 - d$.
4. The final confidence score is the arithmetic mean of these 3 similarities, clamped between `0.0` and `1.0`.

- **Score >= 0.75 (Low/Med Severity):** High alignment. Answer directly using retrieved text.
- **Score 0.50 - 0.74 (Low/Med Severity):** Partial alignment. Create an SQLite ticket for operational review.
- **Score < 0.50 (Or High/Critical Severity):** Low alignment or high risk. Trigger escalation.

---

## 7. Zero-Cost Architecture
Every component runs on free tiers or open-source local configurations:
- **OpenClaw:** MIT licensed agent wrapper, self-hosted.
- **LLM:** Google Gemini API `gemini-2.5-flash` using its free tier.
- **Vector Store:** ChromaDB running locally in persistent filesystem mode.
- **Embeddings:** Local CPU-based inference of `sentence-transformers/all-MiniLM-L6-v2`.
- **Database:** SQLite (`better-sqlite3`), file-based, zero configuration.
- **Hosting:** Local development machine (localhost).

---

## 8. Exception Handling and Fallback Chain
- **Gemini Rate Limits / Outages:** Classification tools catch errors and evaluate local keyword heuristic rules to determine intent and severity.
- **RAG Service Down:** `search_knowledge_base` returns `isError: true`. The agent catches this failure and immediately escalates the issue with the reason `"tool failure: search_knowledge_base"`.
- **SQLite Database Locked/Corrupt:** Ticketing tools catch SQL exceptions and return `isError: true` to prevent the session loop from crashing, allowing the final interaction audit log to be written to disk.

---

## 9. Escalation Matrix
Escalations map to specific personnel and response window SLAs depending on severity:
- **CRITICAL:** Escalate to **Head of Operations** (SLA: 30 minutes).
- **HIGH:** Escalate to **Senior Operations Manager** (SLA: 2 hours).
- **MEDIUM:** Escalate to **Operations Analyst** (SLA: 8 hours).
- **LOW:** Escalate to **Customer Support Associate** (SLA: 24 hours).

---

## 10. Current Autonomous Capabilities
- Deterministic extraction of customer intent and severity levels.
- Contextual search of operational guidelines (KYC, commissions, payments).
- Automatic database ticketing and log file exports.
- Multi-tier escalation assignments.

---

## 11. Known Limitations
- Runs on local machine only.
- Local CPU embedding adds a minor delay (~150-300ms) on cold starts.
- SQLite does not support highly concurrent multi-write operations (suitable for edge agents, but needs PostgreSQL for scale).

---

## 12. Next Version Improvements
- Upgrade SQLite to PostgreSQL if cloud databases are made available.
- Implement automated SMS/Email notifications on ticket creation.
- Add biometric device telemetry parsing tool to identify micro-ATM failures directly from logs.

---

## 13. Sample Interactions

### Interaction 1: Direct Resolution (Low Severity, High Confidence)
- **Input Query:** "My customer has insufficient funds error 51 on their UPI app, what should I tell them?"
- **Tool Traces:**
  1. `classify_intent` -> `PAYMENT_ISSUE`
  2. `classify_severity` -> `LOW`
  3. `search_knowledge_base` -> returning chunks from `payment_faqs.md` (mean cosine similarity: `0.89`)
  4. `log_interaction` -> `outcome: ANSWERED`
- **Output Response:** The error code 51 (or U30) indicates that the customer has insufficient funds in their bank account. Please advise the customer to check their account balance and re-try the transaction once they have loaded sufficient funds.

### Interaction 2: Ticket Created (Medium Severity, Medium Confidence)
- **Input Query:** "How long does it take for a Gold tier merchant's onboarding to be approved?"
- **Tool Traces:**
  1. `classify_intent` -> `PARTNER_QUERY`
  2. `classify_severity` -> `MEDIUM`
  3. `search_knowledge_base` -> returning chunks from `partner_policies.md` (mean cosine similarity: `0.68`)
  4. `create_ticket` -> returning `ticket_id: EKO-2026-0001`
  5. `log_interaction` -> `outcome: TICKETED`, `ticketId: EKO-2026-0001`
- **Output Response:** Your query regarding Gold tier merchant onboarding timelines has been recorded. I have created support ticket **EKO-2026-0001** to track this issue. A support analyst will review the documentation within our operational timeline.

### Interaction 3: Escalation (High Severity, Immediate Escalation)
- **Input Query:** "Urgent! Our entire UPI server gateway has crashed and all UPI transactions are failing with timeouts!"
- **Tool Traces:**
  1. `classify_intent` -> `ESCALATION_REQUIRED`
  2. `classify_severity` -> `CRITICAL`
  3. `escalate_issue` -> returning `assigned_to: Head of Operations`, `expected_response_time: 30 minutes`
  4. `log_interaction` -> `outcome: ESCALATED`
- **Output Response:** This critical issue has been escalated directly to Eko's **Head of Operations**. They have been notified, and the expected initial response time is within **30 minutes**.
