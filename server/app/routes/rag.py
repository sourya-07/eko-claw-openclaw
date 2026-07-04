from fastapi import APIRouter, HTTPException
from app.models.schemas import SearchRequest, SearchResponse
from app.rag.rag_service import search_kb, ingest_kb

router = APIRouter(prefix="/api/rag", tags=["RAG"])

@router.post("/search", response_model=SearchResponse)
def search_kb_route(req: SearchRequest):
    try:
        res = search_kb(req.query)
        return {
            "chunks": res.get("chunks", []),
            "confidence_score": res.get("confidence_score", 0.0),
            "isError": res.get("isError", False),
            "errorMessage": res.get("errorMessage")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest")
def ingest_kb_route():
    try:
        res = ingest_kb()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
