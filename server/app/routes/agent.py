from fastapi import APIRouter, HTTPException
from app.models.schemas import AgentQueryRequest, AgentQueryResponse
from app.agents.agent import run_agent_workflow

router = APIRouter(prefix="/api/agent", tags=["Agent"])

@router.post("/query", response_model=AgentQueryResponse)
def query_agent(req: AgentQueryRequest):
    query_text = req.query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    try:
        result = run_agent_workflow(query_text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent workflow error: {str(e)}")
