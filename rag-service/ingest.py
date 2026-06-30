# rag-service/ingest.py
#
# Owns: Standalone one-time knowledge base ingestion script.
# Does NOT own: Serving requests or API routing.
# Why: Allows developers to seed the local vector database offline without needing to start the FastAPI server first.

import os
import sys
from datetime import datetime, timezone
import chromadb
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Resolve pathing
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_store")
KNOWLEDGE_BASE_DIR = os.path.join(os.path.dirname(BASE_DIR), "data", "knowledge_base")

def chunk_markdown_file(file_path: str):
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
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

def main():
    print("Starting offline knowledge base ingestion...")
    
    files_to_ingest = [
        "payment_faqs.md",
        "kyc_sops.md",
        "partner_policies.md",
        "escalation_matrix.md"
    ]

    all_chunks = []
    for filename in files_to_ingest:
        file_path = os.path.join(KNOWLEDGE_BASE_DIR, filename)
        print(f"Reading {filename}...")
        file_chunks = chunk_markdown_file(file_path)
        print(f"Extracted {len(file_chunks)} chunks from {filename}.")
        all_chunks.extend(file_chunks)

    if not all_chunks:
        print("Error: No chunks extracted. Aborting.")
        sys.exit(1)

    print(f"Total chunks to ingest: {len(all_chunks)}")

    print("Loading embedding model (all-MiniLM-L6-v2) locally...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    
    print(f"Connecting to ChromaDB at {CHROMA_DIR}...")
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    
    # Recreate the collection for complete idempotency
    try:
        chroma_client.delete_collection(name="eko_knowledge_base")
        print("Deleted existing collection.")
    except Exception:
        pass

    collection = chroma_client.get_or_create_collection(
        name="eko_knowledge_base"
    )

    print("Generating embeddings for all chunks...")
    documents = [c["content"] for c in all_chunks]
    embeddings = model.encode(documents).tolist()
    metadatas = [c["metadata"] for c in all_chunks]
    ids = [f"chunk_{i}" for i in range(len(all_chunks))]

    print("Adding vectors to ChromaDB...")
    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )

    print("Ingestion completed successfully! Local vector store is populated.")

if __name__ == "__main__":
    main()
