# rag-service/main.py
#
# Owns: Local, offline-capable FastAPI RAG service.
# Does NOT own: Business workflow logic or decision thresholds (which live in OpenClaw config/tools).
# Why: Python has the most mature tooling for sentence-transformers and local ChromaDB.
# Running locally on localhost:8000 ensures $0 cost, zero network dependencies, and full data privacy.

import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import chromadb
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

app = FastAPI(title="Eko Claw Local RAG Service", version="1.0.0")

# Setup paths relative to this file to ensure it runs correctly regardless of cwd
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_store")
KNOWLEDGE_BASE_DIR = os.path.join(os.path.dirname(BASE_DIR), "data", "knowledge_base")

# Load embedding model once at startup (runs entirely on CPU, no cost)
print("Loading sentence-transformers/all-MiniLM-L6-v2 model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Model loaded successfully.")

# Initialize local persistent ChromaDB client
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
collection = chroma_client.get_or_create_collection(
    name="eko_knowledge_base"
)

class SearchRequest(BaseModel):
    query: str

class SearchResponse(BaseModel):
    chunks: List[Dict[str, Any]]
    confidence_score: float
    isError: Optional[bool] = False
    errorMessage: Optional[str] = None

class IngestResponse(BaseModel):
    status: str
    chunks_ingested: int

def chunk_markdown_file(file_path: str) -> List[Dict[str, Any]]:
    """
    Parses a markdown file and splits it into logical chunks of 500 characters with 50 overlap.
    """
    if not os.path.exists(file_path):
        return []

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    filename = os.path.basename(file_path)
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Extract H1 title for metadata context if available
    title = ""
    for line in content.split("\n"):
        if line.startswith("# "):
            title = line[2:].strip()
            break

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", " ", ""]
    )
    
    # Split text
    split_texts = splitter.split_text(content)
    
    chunks = []
    for idx, text in enumerate(split_texts):
        chunks.append({
            "content": text,
            "metadata": {
                "source": filename,
                "chunk_index": idx,
                "ingested_at": now_iso
            }
        })
        
    return chunks

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """
    Exposes document retrieval based on L2 distance.
    Calculates confidence_score as the mean of the top 3 matching chunks' similarities.
    """
    query = request.query.strip()
    if not query:
        return SearchResponse(chunks=[], confidence_score=0.0)

    try:
        # Generate embedding locally
        query_embedding = model.encode(query).tolist()

        # Query local vector store
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=5
        )

        documents = results.get("documents", [[]])[0]
        distances = results.get("distances", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        formatted_chunks = []
        for i in range(len(documents)):
            dist = distances[i] if (distances and i < len(distances)) else 1.0
            similarity_score = 1.0 / (1.0 + dist)
            meta = metadatas[i] if (metadatas and i < len(metadatas)) else {}
            
            formatted_chunks.append({
                "content": documents[i],
                "metadata": meta,
                "source": meta.get("source"),
                "similarity_score": round(similarity_score, 4)
            })

        # Calculate confidence_score = mean of similarities of top 3
        if distances:
            top_3_distances = distances[:3]
            similarities = [1.0 / (1.0 + d) for d in top_3_distances]
            mean_similarity = sum(similarities) / len(similarities)
            confidence_score = round(mean_similarity, 4)
        else:
            confidence_score = 0.0

        return SearchResponse(
            chunks=formatted_chunks,
            confidence_score=confidence_score
        )

    except Exception as e:
        print(f"Error during search query: {e}")
        # Never crash the endpoint, return empty list and zero score
        return SearchResponse(chunks=[], confidence_score=0.0, isError=True, errorMessage=str(e))

@app.post("/ingest", response_model=IngestResponse)
async def ingest():
    """
    Idempotently ingests the 4 knowledge base files into ChromaDB.
    Drops existing collection content first to ensure no duplicates are created.
    """
    global collection
    
    files_to_ingest = [
        "payment_faqs.md",
        "kyc_sops.md",
        "partner_policies.md",
        "escalation_matrix.md"
    ]

    all_chunks = []
    for filename in files_to_ingest:
        file_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=500,
                detail=f"Required knowledge base file {filename} not found at {file_path}"
            )
        file_chunks = chunk_markdown_file(file_path)
        all_chunks.extend(file_chunks)

    if not all_chunks:
        raise HTTPException(
            status_code=500,
            detail="No chunks extracted from knowledge base files"
        )

    try:
        # Recreate the collection to guarantee idempotency (zero duplicate chunks)
        try:
            chroma_client.delete_collection(name="eko_knowledge_base")
        except Exception:
            pass # Did not exist

        collection = chroma_client.get_or_create_collection(
            name="eko_knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )

        # Generate embeddings and add to collection
        documents = [c["content"] for c in all_chunks]
        embeddings = model.encode(documents).tolist()
        metadatas = [c["metadata"] for c in all_chunks]
        ids = [f"chunk_{i}" for i in range(len(all_chunks))]

        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

        return IngestResponse(status="success", chunks_ingested=len(all_chunks))

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ingest documents: {str(e)}"
        )


import sqlite3

# Shared DB path constant — mcp-server writes to mcp-server/eko_claw.db
# (mcp-server dist/db/__dirname resolves two levels up to mcp-server/, not project root)
SQLITE_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(BASE_DIR), "mcp-server", "eko_claw.db"))


@app.get("/tickets")
def read_tickets_endpoint(limit: Optional[int] = None):
    """
    Utility endpoint to read SQLite 'tickets' entries.
    Allows database verification directly from your browser.
    Optional: ?limit=3 to get only the last N tickets.
    """
    if not os.path.exists(SQLITE_DB_PATH):
        return {"tickets": [], "error": None, "message": "No tickets yet — run the agent first to create one."}
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
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
def read_interactions_endpoint():
    """
    Utility endpoint to read SQLite 'interactions' entries.
    Allows interaction log verification directly from your browser.
    """
    if not os.path.exists(SQLITE_DB_PATH):
        return {"interactions": [], "error": None, "message": "No interactions yet — run POST /agent first to create one."}
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM interactions ORDER BY created_at DESC")
        rows = cursor.fetchall()
        interactions_list = [dict(row) for row in rows]
        conn.close()
        return {"interactions": interactions_list, "error": None}
    except Exception as e:
        return {"interactions": [], "error": str(e)}


