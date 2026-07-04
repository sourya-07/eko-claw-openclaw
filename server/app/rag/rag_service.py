import os
import threading
from datetime import datetime, timezone
from typing import List, Dict, Any
import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Setup directories relative to the server root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHROMA_DIR = os.path.join(BASE_DIR, "data", "chroma_store")
KNOWLEDGE_BASE_DIR = os.path.join(BASE_DIR, "data", "knowledge_base")

# Global variables for lazy loading
_model = None
_model_lock = threading.Lock()

def get_embedding_model():
    """
    Lazily and thread-safely loads the sentence-transformers model.
    """
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                print("Loading sentence-transformers/all-MiniLM-L6-v2 model (lazy-loaded)...")
                from sentence_transformers import SentenceTransformer
                _model = SentenceTransformer("all-MiniLM-L6-v2")
                print("Model loaded successfully.")
    return _model

def get_chroma_collection():
    """
    Initializes and returns the persistent ChromaDB collection.
    """
    os.makedirs(CHROMA_DIR, exist_ok=True)
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = chroma_client.get_or_create_collection(
        name="eko_knowledge_base",
        metadata={"hnsw:space": "cosine"}
    )
    return chroma_client, collection

def chunk_markdown_file(file_path: str) -> List[Dict[str, Any]]:
    """
    Parses a markdown file and splits it into logical chunks.
    """
    if not os.path.exists(file_path):
        return []

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    filename = os.path.basename(file_path)
    now_iso = datetime.now(timezone.utc).isoformat()
    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", " ", ""]
    )
    
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

def search_kb(query: str) -> Dict[str, Any]:
    """
    Searches document retrieval based on cosine distance.
    """
    query = query.strip()
    if not query:
        return {"chunks": [], "confidence_score": 0.0}

    try:
        model = get_embedding_model()
        _, collection = get_chroma_collection()
        
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

        return {
            "chunks": formatted_chunks,
            "confidence_score": confidence_score
        }

    except Exception as e:
        print(f"Error during search query: {e}")
        return {"chunks": [], "confidence_score": 0.0, "isError": True, "errorMessage": str(e)}

def ingest_kb() -> Dict[str, Any]:
    """
    Ingests knowledge base markdown files into ChromaDB.
    """
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
            raise FileNotFoundError(f"Required knowledge base file {filename} not found at {file_path}")
        file_chunks = chunk_markdown_file(file_path)
        all_chunks.extend(file_chunks)

    if not all_chunks:
        raise ValueError("No chunks extracted from knowledge base files")

    try:
        chroma_client, collection = get_chroma_collection()
        
        # Recreate collection to guarantee idempotency
        try:
            chroma_client.delete_collection(name="eko_knowledge_base")
        except Exception:
            pass # Collection did not exist

        collection = chroma_client.get_or_create_collection(
            name="eko_knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )

        model = get_embedding_model()
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

        return {"status": "success", "chunks_ingested": len(all_chunks)}

    except Exception as e:
        print(f"Failed to ingest knowledge base: {e}")
        raise e
