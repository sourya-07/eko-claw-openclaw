# Eko Claw - Native OpenClaw Agent

Eko Claw is a native OpenClaw operations and support agent built for **Eko** support teams. It classifies incoming queries, retrieves internal policy guidelines using local vector retrieval (RAG), creates structured support tickets in SQLite, and escalates high-severity or low-confidence issues to operations managers.

---

## Running This For Free (Zero-Cost Setup Guide)

No step in this project requires a paid account, credit card, or cloud infrastructure. Everything runs locally on your machine with fully open-source tools and a free LLM tier.

### Prerequisites
1. **Node.js (v22.19+)** and **pnpm** installed.
2. **Python (v3.11+)** and **uv** (fast Python package installer) installed.

---

### Step-by-Step Setup

#### 1. Obtain a Free Gemini API Key
- Go to [Google AI Studio](https://aistudio.google.com/).
- Sign in with any free Google Account (no credit card or billing configuration required).
- Click **Create API Key** and copy your key.
- Create a `.env` file at the root of the `eko-claw-openclaw` directory and paste your key:
  ```env
  GOOGLE_API_KEY=your_copied_gemini_api_key_here
  ```

##### Gemini 2.5 Flash Free-Tier Constraints:
- **Rate Limit:** 15 Requests Per Minute (RPM).
- **Daily Quota:** 1,000 Requests Per Day (RPD).
- **Token Limit:** 1,000,000 Tokens Per Minute (TPM).
- **Fallback Behavior:** If these limits are exceeded, Eko Claw's tools will immediately fall back to a local, regex/keyword-based classification heuristic to avoid service interruptions.

#### 2. Configure and Populate the Local RAG Service
The RAG service runs a local vector store (ChromaDB) and generates embeddings locally on your CPU using an open-source model.
- Navigate to the `rag-service` directory:
  ```bash
  cd rag-service
  ```
- Install dependencies and create a virtual environment using `uv`:
  ```bash
  uv venv
  source .venv/bin/activate  # On Windows: .venv\Scripts\activate
  uv pip install -e .
  ```
- Ingest the knowledge base documents into ChromaDB (this parses the files in `data/knowledge_base/` and generates embeddings locally):
  ```bash
  uv run python ingest.py
  ```
- Start the local FastAPI microservice:
  ```bash
  uv run uvicorn main:app --host 127.0.0.1 --port 8000
  ```
  The RAG service is now running at `http://127.0.0.1:8000`. You can test it by visiting `http://127.0.0.1:8000/docs` in your browser.

#### 3. Build and Configure the Node.js MCP Server
The tool layer runs on Node.js and interfaces with a local SQLite database.
- Open a new terminal window and navigate to the `mcp-server` directory:
  ```bash
  cd mcp-server
  ```
- Install dependencies using `pnpm`:
  ```bash
  pnpm install
  ```
- Compile the TypeScript code to JavaScript:
  ```bash
  pnpm build
  ```
- (Optional) Start the server standalone to verify it initializes:
  ```bash
  node dist/index.js
  ```
  *Note: The server communicates via stdin/stdout and will wait for input. Close it with `Ctrl+C` once verified.*

#### 4. Run the OpenClaw Gateway
- Install OpenClaw globally on your machine:
  ```bash
  npm install -g openclaw
  ```
- Copy the `.env` file containing your `GOOGLE_API_KEY` into the root directory of the workspace where you run OpenClaw.
- Start the OpenClaw session gate pointing to the root config:
  ```bash
  openclaw start --config ./openclaw.config.json
  ```
- OpenClaw will automatically spawn the Node MCP server as a subprocess, load `SOUL.md`, `AGENTS.md`, and `TOOLS.md` from the `./openclaw-workspace` folder, and initiate the interactive terminal.

---

## Folder Structure

```
eko-claw-openclaw 
│   ├── openclaw.config.json    # Registers the MCP server & Gemini provider
│   ├── CLAW.md                 # Project architecture and workflow documentation
│   └── README.md               # Setup and execution guide
│
├── openclaw-workspace/         # The declarative configuration injected into the agent
│   ├── SOUL.md                 # Agent personality and tone guidelines
│   ├── AGENTS.md               # Operational SOP and decision rules
│   └── TOOLS.md                # Boundaries and scopes of custom tools
│
├── mcp-server/                 # Node.js/TypeScript Tool Layer (Stdio MCP Server)
│   ├── src/
│   │   ├── index.ts            # MCP entry point and JSON-RPC router
│   │   ├── db/
│   │   │   └── sqlite.ts       # SQLite database connector & table schemas
│   │   └── tools/              # MCP Tool files (RAG search, classification, ticketing)
│   └── package.json
│
├── rag-service/                # Offline Python RAG API microservice (localhost:8000)
│   ├── main.py                 # FastAPI server (exposes /search and /ingest)
│   ├── ingest.py               # Standalone database seeder script
│   └── chroma_store/           # Local persistent vector database directory
│
├── data/
│   └── knowledge_base/         # Internal operational guidelines (markdown)
│
└── logs/                       # JSON execution trace and escalation logs
```
