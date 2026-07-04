import os
import sqlite3
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load env variables
load_dotenv()

from app.db.database import init_db, DB_PATH
from app.routes import health, anomalies, tickets, dashboard, agent, rag
from app.rag.rag_service import search_kb, ingest_kb

# Initialize FastAPI App
app = FastAPI(
    title="eko_claw Server",
    description="Autonomous AI Agent backend for payment anomaly detection & support operations.",
    version="1.0.0"
)

# CORS middleware to allow vercel client and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://eko-claw-client.vercel.app", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB initialization on startup
@app.on_event("startup")
def startup_event():
    print("Initializing SQLite database & schema migrations...")
    init_db()
    print("Database successfully initialized.")

# Register API Routers
app.include_router(health.router)
app.include_router(anomalies.router)
app.include_router(tickets.router)
app.include_router(dashboard.router)
app.include_router(agent.router)
app.include_router(rag.router)

# Legacy support endpoints from original rag-service/main.py
@app.post("/search")
def legacy_search(req: dict):
    query = req.get("query", "")
    res = search_kb(query)
    return res

@app.post("/ingest")
def legacy_ingest():
    res = ingest_kb()
    return res

@app.get("/tickets")
def legacy_get_tickets(limit: Optional[int] = None):
    if not os.path.exists(DB_PATH):
        return {"tickets": [], "error": None, "message": "No tickets yet."}
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if limit:
            cursor.execute("SELECT * FROM tickets ORDER BY created_at DESC LIMIT ?", (limit,))
        else:
            cursor.execute("SELECT * FROM tickets ORDER BY created_at DESC")
        rows = cursor.fetchall()
        tickets_list = [dict(row) for row in rows]
        conn.close()
        return {"tickets": tickets_list, "total": len(tickets_list), "error": None}
    except Exception as e:
        return {"tickets": [], "error": str(e)}

@app.get("/interactions")
def legacy_get_interactions():
    if not os.path.exists(DB_PATH):
        return {"interactions": [], "error": None, "message": "No interactions yet."}
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM interactions ORDER BY created_at DESC")
        rows = cursor.fetchall()
        interactions_list = [dict(row) for row in rows]
        conn.close()
        return {"interactions": interactions_list, "error": None}
    except Exception as e:
        return {"interactions": [], "error": str(e)}
