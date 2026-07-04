from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from app.db.database import get_db_connection

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT count(*) FROM anomalies;")
        total_anomalies = cursor.fetchone()[0]
        
        cursor.execute("SELECT count(*) FROM anomalies WHERE severity = 'CRITICAL';")
        crit_anoms = cursor.fetchone()[0]
        cursor.execute("SELECT count(*) FROM tickets WHERE severity = 'CRITICAL' AND status != 'RESOLVED' AND status != 'CLOSED';")
        crit_tickets = cursor.fetchone()[0]
        critical_alerts = crit_anoms + crit_tickets
        
        cursor.execute("SELECT count(*) FROM tickets WHERE status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED');")
        open_tickets = cursor.fetchone()[0]
        
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        cursor.execute("SELECT count(*) FROM tickets WHERE status IN ('RESOLVED', 'CLOSED') AND resolved_at >= ?;", (today_start,))
        resolved_tickets = cursor.fetchone()[0]
        cursor.execute("SELECT count(*) FROM anomalies WHERE status = 'RESOLVED' AND timestamp >= ?;", (today_start,))
        resolved_anoms = cursor.fetchone()[0]
        resolved_today = resolved_tickets + resolved_anoms
        
        cursor.execute("SELECT * FROM anomalies ORDER BY timestamp DESC LIMIT 5;")
        recent_anoms = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute("SELECT * FROM tickets ORDER BY created_at DESC LIMIT 5;")
        recent_tickets = [dict(row) for row in cursor.fetchall()]
        
        now = datetime.now(timezone.utc)
        chart_data = []
        for i in range(6, -1, -1):
            date_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            start_iso = f"{date_str}T00:00:00"
            end_iso = f"{date_str}T23:59:59"
            
            cursor.execute("SELECT count(*) FROM anomalies WHERE timestamp BETWEEN ? AND ?;", (start_iso, end_iso))
            count = cursor.fetchone()[0]
            chart_data.append({
                "date": (now - timedelta(days=i)).strftime("%b %d"),
                "count": count
            })
            
        return {
            "total_anomalies": total_anomalies,
            "critical_alerts": critical_alerts,
            "open_tickets": open_tickets,
            "resolved_today": resolved_today,
            "recent_anomalies": recent_anoms,
            "recent_tickets": recent_tickets,
            "anomalies_over_time": chart_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        conn.close()
