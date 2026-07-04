from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
from app.db.database import get_db_connection, generate_next_ticket_id
from app.models.schemas import TicketCreateRequest, TicketResponse, TicketEscalateRequest
from app.agents.agent import db_escalate_ticket, ESCALATION_MATRIX

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])

@router.get("/", response_model=List[TicketResponse])
def get_tickets(
    status: Optional[str] = Query(None, description="Filter by status (OPEN, IN_PROGRESS, ESCALATED, RESOLVED, CLOSED)"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    limit: Optional[int] = Query(100, description="Limit result size")
):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query_str = "SELECT * FROM tickets WHERE 1=1"
    params = []
    
    if status:
        query_str += " AND status = ?"
        params.append(status.upper())
    if severity:
        query_str += " AND severity = ?"
        params.append(severity.upper())
        
    query_str += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    
    try:
        cursor.execute(query_str, tuple(params))
        rows = cursor.fetchall()
        tickets = [dict(row) for row in rows]
        return tickets
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(ticket_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found.")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.post("/", response_model=TicketResponse)
def create_ticket(req: TicketCreateRequest):
    ticket_id = generate_next_ticket_id()
    now_iso = datetime.now(timezone.utc).isoformat()
    severity_upper = req.severity.upper()
    assigned_to = ESCALATION_MATRIX.get(severity_upper, ESCALATION_MATRIX["LOW"])["assigned_to"]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO tickets (ticket_id, query, intent, severity, status, confidence_score, assigned_to, escalation_note, created_at, updated_at, resolved_at)
            VALUES (?, ?, ?, ?, 'OPEN', ?, ?, NULL, ?, ?, NULL)
        """, (ticket_id, req.query, req.intent.upper(), severity_upper, req.confidence_score, assigned_to, now_iso, now_iso))
        conn.commit()
        
        cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,))
        row = cursor.fetchone()
        return dict(row)
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create ticket: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.post("/{ticket_id}/escalate", response_model=TicketResponse)
def escalate_ticket(ticket_id: str, req: TicketEscalateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found.")
            
        current_severity = req.severity.upper() if req.severity else ticket['severity']
        query = ticket['query']
        intent = ticket['intent']
        
        cursor.close()
        conn.close()
        
        db_escalate_ticket(query=query, severity=current_severity, reason=req.reason, ticket_id=ticket_id, intent=intent)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,))
        row = cursor.fetchone()
        return dict(row)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to escalate ticket: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.post("/{ticket_id}/resolve", response_model=TicketResponse)
def resolve_ticket(ticket_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,))
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found.")
            
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            UPDATE tickets 
            SET status = 'RESOLVED', resolved_at = ?, updated_at = ?
            WHERE ticket_id = ?
        """, (now_iso, now_iso, ticket_id))
        conn.commit()
        
        cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,))
        row = cursor.fetchone()
        return dict(row)
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to resolve ticket: {str(e)}")
    finally:
        cursor.close()
        conn.close()

