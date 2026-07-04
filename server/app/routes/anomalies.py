from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
from app.db.database import get_db_connection, generate_next_ticket_id
from app.models.schemas import AnomalyDetectRequest, AnomalyResponse

router = APIRouter(prefix="/api/anomalies", tags=["Anomalies"])

@router.get("/", response_model=List[AnomalyResponse])
def get_anomalies(
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    status: Optional[str] = Query(None, description="Filter by status (OPEN, UNDER_REVIEW, RESOLVED)"),
    limit: Optional[int] = Query(100, description="Limit result size")
):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query_str = "SELECT * FROM anomalies WHERE 1=1"
    params = []
    
    if severity:
        query_str += " AND severity = ?"
        params.append(severity.upper())
    if status:
        query_str += " AND status = ?"
        params.append(status.upper())
        
    query_str += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)
    
    try:
        cursor.execute(query_str, tuple(params))
        rows = cursor.fetchall()
        anomalies = [dict(row) for row in rows]
        return anomalies
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.get("/{anomaly_id}", response_model=AnomalyResponse)
def get_anomaly(anomaly_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM anomalies WHERE anomaly_id = ?", (anomaly_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Anomaly with ID {anomaly_id} not found.")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.post("/detect", response_model=AnomalyResponse)
def detect_anomaly(req: AnomalyDetectRequest):
    amount = req.amount
    type_val = req.type
    merchant = req.merchant
    txn_id = req.transaction_id
    
    severity = "LOW"
    rec_action = "Standard transaction monitoring review."
    
    if amount >= 50000:
        severity = "CRITICAL"
        rec_action = "Lock merchant payouts immediately. Place wallet on AML hold. Call partner node officer."
    elif amount >= 20000:
        severity = "HIGH"
        rec_action = "Temporary suspension of withdrawal limits. Request identity check via phone call."
    elif "biometric" in type_val.lower() or "fingerprint" in type_val.lower():
        severity = "CRITICAL"
        rec_action = "Reject onboarding or suspend AePS immediately. Request biometric scanner re-calibration."
    elif "velocity" in type_val.lower():
        severity = "HIGH"
        rec_action = "Check IP/device signatures. Restrict withdrawal speed to 1 transaction per hour."
    elif "double" in type_val.lower():
        severity = "MEDIUM"
        rec_action = "File chargeback case with NPCI. Crosscheck ledger entries for duplication."
    elif amount >= 5000:
        severity = "MEDIUM"
        rec_action = "Check logs for server timeout. Review webhook status responses."
        
    description = req.description or f"Anomaly flagged on transaction {txn_id} by {merchant} for {amount} INR (Type: {type_val})."
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT anomaly_id FROM anomalies WHERE transaction_id = ?", (txn_id,))
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail=f"Transaction {txn_id} has already been analyzed and logged.")
        
    anomaly_id = f"ANM-{datetime.now().year}-{int(datetime.now().timestamp()) % 10000:04d}"
    timestamp = datetime.now(timezone.utc).isoformat()
    status = "OPEN"
    
    try:
        cursor.execute("""
            INSERT INTO anomalies (anomaly_id, merchant, type, severity, timestamp, status, amount, description, recommended_action, transaction_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (anomaly_id, merchant, type_val, severity, timestamp, status, amount, description, rec_action, txn_id))
        
        if severity in ["HIGH", "CRITICAL"]:
            ticket_id = generate_next_ticket_id()
            ticket_status = "ESCALATED"
            assigned_to = "Head of Operations" if severity == "CRITICAL" else "Senior Operations Manager"
            escalation_note = (
                f"[SYSTEM AUTO-ESCALATED]\n"
                f"Linked Anomaly: {anomaly_id}\n"
                f"Merchant: {merchant}\n"
                f"Recommended Action: {rec_action}"
            )
            
            cursor.execute("""
                INSERT INTO tickets (ticket_id, query, intent, severity, status, confidence_score, assigned_to, escalation_note, created_at, updated_at, resolved_at)
                VALUES (?, ?, ?, ?, ?, 0.0, ?, ?, ?, ?, NULL)
            """, (ticket_id, description, "TRANSACTION_DISPUTE", severity, ticket_status, assigned_to, escalation_note, timestamp, timestamp))
            
            interaction_id = f"sys-int-{int(datetime.now().timestamp())}"
            tools_used = '["system_anomaly_rules"]'
            cursor.execute("""
                INSERT INTO interactions (interaction_id, ticket_id, query, outcome, confidence_score, tools_used, response_given, created_at)
                VALUES (?, ?, ?, 'ESCALATED', 0.0, ?, ?, ?)
            """, (interaction_id, ticket_id, description, tools_used, escalation_note, timestamp))
            
        conn.commit()
        
        return {
            "anomaly_id": anomaly_id,
            "merchant": merchant,
            "type": type_val,
            "severity": severity,
            "timestamp": timestamp,
            "status": status,
            "amount": amount,
            "description": description,
            "recommended_action": rec_action,
            "transaction_id": txn_id
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record anomaly: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.post("/{anomaly_id}/status", response_model=AnomalyResponse)
def update_anomaly_status(anomaly_id: str, status: str = Query(..., description="New status (OPEN, UNDER_REVIEW, RESOLVED)")):
    status_upper = status.upper()
    if status_upper not in ["OPEN", "UNDER_REVIEW", "RESOLVED"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be OPEN, UNDER_REVIEW, or RESOLVED.")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM anomalies WHERE anomaly_id = ?", (anomaly_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Anomaly {anomaly_id} not found.")
            
        cursor.execute("""
            UPDATE anomalies 
            SET status = ?
            WHERE anomaly_id = ?
        """, (status_upper, anomaly_id))
        conn.commit()
        
        cursor.execute("SELECT * FROM anomalies WHERE anomaly_id = ?", (anomaly_id,))
        updated_row = cursor.fetchone()
        return dict(updated_row)
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update anomaly: {str(e)}")
    finally:
        cursor.close()
        conn.close()

