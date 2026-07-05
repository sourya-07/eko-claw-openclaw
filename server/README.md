# Eko Support Operations Server Backend

FastAPI Python backend for **eko_claw**, an Autonomous AI Agent that detects payment anomalies, classifies severity, and manages support escalations for Eko's micro-entrepreneur network.

## Features
- **FastAPI Core**: Efficient endpoints for dashboard stats, support ticket lifecycle, payment anomaly detection, and agent querying.
- **SQLite with WAL**: Fully persistent database storage with Write-Ahead Logging for high efficiency.
- **RAG Vector Search**: Document chunking and retrieval using a local cosine similarity ChromaDB vector store.
- **Gemini AI Agent**: Semi-autonomous operations workflow for ticket generation, automated severity-based escalations, and audit trace generation.

## Restructured Folder Layout
- `app/main.py`: Entry point for FastAPI and route registrations.
- `app/routes/`: Subdirectories for route handlers (anomalies, tickets, agent, rag, dashboard).
- `app/agents/`: Automated LangGraph-style state machine and SOP workflow.
- `app/rag/`: Local vector indexing, document loading, and similarity search.
- `app/db/`: SQLite database initialization and helper operations.
- `data/`: Ingested knowledge documents and SQLite WAL database storage.

## Local Development Setup

1. **Install Virtual Environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables:**
   Copy the template:
   ```bash
   cp .env.example .env
   ```
   Add your `GOOGLE_API_KEY` (Gemini API) in the `.env` file.

4. **Ingest the Knowledge Base Documents:**
   We need to seed the vector store with guidelines before running search. Trigger a POST request to:
   `http://localhost:8000/api/rag/ingest`
   or run the FastAPI server and trigger ingest.

5. **Start Dev Server:**
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server status |
| GET | `/api/dashboard/stats` | Dashboard statistics & summaries |
| POST | `/api/agent/query` | Submit merchant queries to the agent workflow |
| GET | `/api/anomalies/` | Fetch all logged anomalies |
| POST | `/api/anomalies/detect` | Post transaction info for rule-based analysis |
| GET | `/api/tickets/` | Fetch all support tickets |
| POST | `/api/tickets/{id}/escalate` | Trigger manual escalation on a ticket |
