from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class SearchRequest(BaseModel):
    query: str

class SearchChunk(BaseModel):
    content: str
    metadata: Dict[str, Any]
    source: Optional[str] = None
    similarity_score: float

class SearchResponse(BaseModel):
    chunks: List[SearchChunk]
    confidence_score: float
    isError: Optional[bool] = False
    errorMessage: Optional[str] = None

# Anomaly models
class AnomalyDetectRequest(BaseModel):
    merchant: str
    amount: float
    type: str
    transaction_id: str
    description: Optional[str] = None

class AnomalyResponse(BaseModel):
    anomaly_id: str
    merchant: str
    type: str
    severity: str
    timestamp: str
    status: str
    amount: float
    description: str
    recommended_action: str
    transaction_id: str

# Ticket models
class TicketCreateRequest(BaseModel):
    query: str
    intent: str
    severity: str
    confidence_score: float = 0.0
    chunks: List[str] = []

class TicketResponse(BaseModel):
    ticket_id: str
    query: str
    intent: str
    severity: str
    status: str
    confidence_score: float
    assigned_to: Optional[str] = None
    escalation_note: Optional[str] = None
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None

class TicketEscalateRequest(BaseModel):
    reason: str
    severity: Optional[str] = None

# Agent models
class AgentQueryRequest(BaseModel):
    query: str

class ToolTraceItem(BaseModel):
    tool: str
    args: Optional[Dict[str, Any]] = None
    result: Dict[str, Any]

class AgentQueryResponse(BaseModel):
    query: str
    intent: str
    severity: str
    outcome: str
    ticket_id: Optional[str] = None
    response_given: Optional[str] = None
    reasoning_trace: List[ToolTraceItem]
