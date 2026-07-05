import os
import json
import uuid
import threading
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple
from app.db.database import get_db_connection, generate_next_ticket_id
from app.rag.rag_service import search_kb

ESCALATION_MATRIX = {
    "LOW": {
        "assigned_to": "Customer Support Associate",
        "expected_response_time": "24 hours",
        "escalation_channel": "support@eko.co.in"
    },
    "MEDIUM": {
        "assigned_to": "Operations Team Lead",
        "expected_response_time": "8 hours",
        "escalation_channel": "ops@eko.co.in"
    },
    "HIGH": {
        "assigned_to": "Senior Operations Manager",
        "expected_response_time": "2 hours",
        "escalation_channel": "ops-lead@eko.co.in"
    },
    "CRITICAL": {
        "assigned_to": "Head of Operations",
        "expected_response_time": "30 minutes",
        "escalation_channel": "nodalofficer@eko.co.in"
    }
}

def classify_intent_local(query: str) -> str:
    """
    Classifies intent of query using deterministic keyword rules.
    """
    query_lower = query.lower()
    
    if any(k in query_lower for k in ["legal", "police", "court", "rbi", "ombudsman", "compliance", "regulatory"]):
        return "ESCALATION_REQUIRED"
        
    if any(k in query_lower for k in ["fraud", "unauthorized", "hacked", "stolen", "dispute", "scam"]):
        return "TRANSACTION_DISPUTE"
        
    if any(k in query_lower for k in ["payment", "transaction", "upi", "fail", "failed", "debit", "refund", "imps", "neft", "status", "reversal", "timeout"]):
        return "PAYMENT_ISSUE"
        
    if any(k in query_lower for k in ["kyc", "aadhaar", "pan", "biometric", "video kyc", "reject", "re-kyc", "verify", "document"]):
        return "KYC_ISSUE"
        
    if any(k in query_lower for k in ["commission", "payout", "partner", "tier", "distributor", "onboard", "suspension", "reactivate", "gst"]):
        return "PARTNER_QUERY"
        
    return "GENERAL_INQUIRY"

def classify_severity_local(query: str) -> str:
    """
    Classifies severity of query using deterministic keyword rules.
    """
    query_lower = query.lower()
    
    if any(k in query_lower for k in ["rbi", "police", "lawyer", "court", "legal", "ombudsman", "compliance", "regulatory", "fraud", "unauthorized", "stolen", "hacked", "dispute", "scam"]):
        return "CRITICAL"
        
    has_high_amount = False
    if any(k in query_lower for k in ["lakh", "lacs", "thousand"]):
        has_high_amount = True
    else:
        import re
        numbers = re.findall(r'\b\d+\b', query_lower)
        for num in numbers:
            if int(num) >= 20000:
                has_high_amount = True
                break

    if any(k in query_lower for k in ["urgent", "escalate", "distributor", "outage", "system down"]) or has_high_amount:
        return "HIGH"
        
    if any(k in query_lower for k in ["payment", "transaction", "upi", "fail", "failed", "debit", "refund", "imps", "neft", "status", "reversal", "timeout", "kyc", "aadhaar", "pan", "biometric", "video kyc", "reject", "re-kyc", "verify", "document"]):
        return "MEDIUM"
        
    return "LOW"

def get_llm_response(query: str, chunks: List[Dict[str, Any]]) -> str:
    """
    Calls Google Gemini (or OpenAI if configured) to formulate a response based on RAG chunks.
    Falls back gracefully if API is not configured or fails.
    """
    google_key = os.environ.get("GOOGLE_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    
    chunks_text = "\n\n".join([f"Source: {c['source']}\nContent: {c['content']}" for c in chunks])
    
    prompt = f"""
You are Eko Claw, the Autonomous Support Operations AI Agent for Eko's partner/merchant network.
Your mission is to help micro-entrepreneurs solve transaction delays, KYC bottlenecks, and payment failures.

Use the following standard operating procedures (SOPs) retrieved from our knowledge base to answer the merchant's query:
---
{chunks_text}
---

Merchant Query: "{query}"

Answer the query professionally, directly, and concisely. Keep it customer-friendly and operational.
If the SOPs do not contain the answer, say "I cannot find a direct resolution in our SOPs, but I will record this for our support team."
"""

    if google_key and google_key != "your GOOGLE_API_KEY":
        try:
            import google.generativeai as genai
            genai.configure(api_key=google_key)
            model_name = "gemini-2.5-flash"
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Gemini generation error: {e}. Trying fallbacks...")

    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.2
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI generation error: {e}. Trying fallbacks...")

    if chunks:
        best_chunk = chunks[0]["content"]
        return f"Based on Eko's operational guidelines: {best_chunk}\n(Note: Responding in offline-safe mode due to API limitations.)"
    
    return "I am currently unable to fetch support guidelines, so I will register a support ticket for further analysis."

def db_create_ticket(query: str, intent: str, severity: str, confidence_score: float, chunks: List[Dict[str, Any]]) -> Tuple[str, str]:
    """
    Creates a support ticket in SQLite and returns the ticket_id and status.
    """
    ticket_id = generate_next_ticket_id()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    assigned_to = ESCALATION_MATRIX.get(severity, ESCALATION_MATRIX["LOW"])["assigned_to"]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO tickets (ticket_id, query, intent, severity, status, confidence_score, assigned_to, escalation_note, created_at, updated_at, resolved_at)
            VALUES (?, ?, ?, ?, 'OPEN', ?, ?, NULL, ?, ?, NULL)
        """, (ticket_id, query, intent, severity, confidence_score, assigned_to, now_iso, now_iso))
        conn.commit()
        return ticket_id, "OPEN"
    except Exception as e:
        print(f"Database error in db_create_ticket: {e}")
        return "", "ERROR"
    finally:
        cursor.close()
        conn.close()

def db_escalate_ticket(query: str, severity: str, reason: str, ticket_id: str = None, intent: str = None) -> Tuple[str, str, str]:
    """
    Escalates an issue. Creates a ticket if none exists, updates to ESCALATED status,
    assigns correct operator, and writes an audit log in `/logs/`.
    Returns (ticket_id, status, assigned_to).
    """
    severity = severity.upper()
    matrix_entry = ESCALATION_MATRIX.get(severity, ESCALATION_MATRIX["HIGH"])
    escalated_at = datetime.now(timezone.utc).isoformat()
    
    escalation_note = (
        f"[ESCALATED at {escalated_at}]\n"
        f"Severity: {severity}\n"
        f"Reason: {reason}\n"
        f"Assigned to: {matrix_entry['assigned_to']}\n"
        f"Expected response: {matrix_entry['expected_response_time']}\n"
        f"Contact: {matrix_entry['escalation_channel']}"
    )
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        final_ticket_id = ticket_id
        if not final_ticket_id:
            final_ticket_id = generate_next_ticket_id()
            intent_val = (intent or "UNKNOWN_INTENT_ESCALATED").upper()
            cursor.execute("""
                INSERT INTO tickets (ticket_id, query, intent, severity, status, confidence_score, assigned_to, escalation_note, created_at, updated_at, resolved_at)
                VALUES (?, ?, ?, ?, 'ESCALATED', 0.0, ?, ?, ?, ?, NULL)
            """, (final_ticket_id, query, intent_val, severity, matrix_entry['assigned_to'], escalation_note, escalated_at, escalated_at))
        else:
            cursor.execute("""
                UPDATE tickets 
                SET status = 'ESCALATED', severity = ?, assigned_to = ?, escalation_note = ?, updated_at = ?, resolved_at = NULL
                WHERE ticket_id = ?
            """, (severity, matrix_entry['assigned_to'], escalation_note, escalated_at, final_ticket_id))

            
        conn.commit()
        
        # Write escalation JSON file
        server_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        logs_dir = os.path.join(server_root, "logs")
        os.makedirs(logs_dir, exist_ok=True)
        
        timestamp_compact = datetime.now().strftime("%Y%m%dT%H%M%SZ")
        log_filename = f"escalation_{timestamp_compact}_{final_ticket_id}.json"
        log_path = os.path.join(logs_dir, log_filename)
        
        escalation_data = {
            "ticket_id": final_ticket_id,
            "severity": severity,
            "reason": reason,
            "assigned_to": matrix_entry['assigned_to'],
            "expected_response_time": matrix_entry['expected_response_time'],
            "escalation_channel": matrix_entry['escalation_channel'],
            "escalated_at": escalated_at,
            "escalation_note": escalation_note,
            "is_error": False,
            "escalation_failed": False
        }
        
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(escalation_data, f, indent=2)
            
        return final_ticket_id, "ESCALATED", matrix_entry['assigned_to']
        
    except Exception as e:
        print(f"Error in db_escalate_ticket: {e}")
        return ticket_id or "", "ERROR", ""
    finally:
        cursor.close()
        conn.close()

def db_log_interaction(query: str, intent: str, severity: str, confidence_score: float, outcome: str, ticket_id: str = None, response_given: str = None, reasoning_trace: List[Dict[str, Any]] = None) -> bool:
    """
    Logs the final interaction metadata in SQLite and writes a JSON log in `/logs/`.
    """
    interaction_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    
    tools_used = [t["tool"] for t in (reasoning_trace or [])]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO interactions (interaction_id, ticket_id, query, outcome, confidence_score, tools_used, response_given, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (interaction_id, ticket_id, query, outcome, confidence_score, json.dumps(tools_used), response_given, now_iso))
        conn.commit()
        
        # Write interaction JSON file
        server_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        logs_dir = os.path.join(server_root, "logs")
        os.makedirs(logs_dir, exist_ok=True)
        
        timestamp_compact = datetime.now().strftime("%Y%m%dT%H%M%SZ")
        file_suffix = ticket_id if ticket_id else "NO_TICKET"
        log_filename = f"interaction_{timestamp_compact}_{file_suffix}.json"
        log_path = os.path.join(logs_dir, log_filename)
        
        log_payload = {
            "timestamp": now_iso,
            "query": query,
            "intent": intent,
            "severity": severity,
            "confidence_score": confidence_score,
            "outcome": outcome,
            "ticket_id": ticket_id,
            "reasoning_trace": reasoning_trace
        }
        
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(log_payload, f, indent=2)
            
        return True
    except Exception as e:
        print(f"Error in db_log_interaction: {e}")
        return False
    finally:
        cursor.close()
        conn.close()

def run_agent_workflow(query: str) -> Dict[str, Any]:
    """
    Processes the query using the Eko Claw Agent workflow.
    """
    reasoning_trace = []
    
    # 1. Classify Intent
    intent = classify_intent_local(query)
    reasoning_trace.append({
        "tool": "classify_intent",
        "args": {"query": query},
        "result": {"intent": intent, "source": "fallback"}
    })
    
    # 2. Classify Severity
    severity = classify_severity_local(query)
    reasoning_trace.append({
        "tool": "classify_severity",
        "args": {"query": query},
        "result": {"severity": severity, "source": "fallback"}
    })
    
    if severity in ["HIGH", "CRITICAL"]:
        ticket_id, status, assigned_to = db_escalate_ticket(query=query, severity=severity, reason="High/Critical severity query path", intent=intent)
        reasoning_trace.append({
            "tool": "escalate_issue",
            "args": {"query": query, "severity": severity, "reason": "High/Critical severity query path", "intent": intent},
            "result": {"ticket_id": ticket_id, "status": status, "assigned_to": assigned_to, "isError": False}
        })
        
        outcome = "ESCALATED"
        response_given = f"This issue is classified as {severity} severity and has been escalated immediately to Eko's {assigned_to}. Expected response timeline is {ESCALATION_MATRIX[severity]['expected_response_time']}."
        
        db_log_interaction(query=query, intent=intent, severity=severity, confidence_score=0.0, outcome=outcome, ticket_id=ticket_id, response_given=response_given, reasoning_trace=reasoning_trace)
        reasoning_trace.append({
            "tool": "log_interaction",
            "args": {"query": query, "intent": intent, "severity": severity, "confidenceScore": 0.0, "outcome": outcome, "ticketId": ticket_id},
            "result": {"isError": False, "message": "Interaction successfully logged"}
        })
        
    else:
        try:
            rag_res = search_kb(query)
            chunks = rag_res.get("chunks", [])
            confidence_score = rag_res.get("confidence_score", 0.0)
            is_error = rag_res.get("isError", False)
            
            reasoning_trace.append({
                "tool": "search_knowledge_base",
                "args": {"query": query},
                "result": {"chunks": [c["content"] for c in chunks[:2]], "confidence_score": confidence_score, "isError": is_error}
            })
            
            if is_error:
                ticket_id, status, assigned_to = db_escalate_ticket(query=query, severity=severity, reason="tool failure: search_knowledge_base", intent=intent)
                reasoning_trace.append({
                    "tool": "escalate_issue",
                    "args": {"query": query, "severity": severity, "reason": "tool failure: search_knowledge_base", "intent": intent},
                    "result": {"ticket_id": ticket_id, "status": status, "assigned_to": assigned_to, "isError": False}
                })
                outcome = "ESCALATED"
                response_given = "We encountered a temporary issue searching our knowledge base. This ticket has been escalated for manual review."
                
                db_log_interaction(query=query, intent=intent, severity=severity, confidence_score=0.0, outcome=outcome, ticket_id=ticket_id, response_given=response_given, reasoning_trace=reasoning_trace)
                reasoning_trace.append({
                    "tool": "log_interaction",
                    "args": {"query": query, "intent": intent, "severity": severity, "confidenceScore": 0.0, "outcome": outcome, "ticketId": ticket_id},
                    "result": {"isError": False}
                })
                
            elif confidence_score >= 0.75:
                response_given = get_llm_response(query, chunks)
                outcome = "ANSWERED"
                ticket_id = None
                
                db_log_interaction(query=query, intent=intent, severity=severity, confidence_score=confidence_score, outcome=outcome, ticket_id=ticket_id, response_given=response_given, reasoning_trace=reasoning_trace)
                reasoning_trace.append({
                    "tool": "log_interaction",
                    "args": {"query": query, "intent": intent, "severity": severity, "confidenceScore": confidence_score, "outcome": outcome},
                    "result": {"isError": False}
                })
                
            elif confidence_score >= 0.5:
                ticket_id, status = db_create_ticket(query, intent, severity, confidence_score, chunks)
                reasoning_trace.append({
                    "tool": "create_ticket",
                    "args": {"query": query, "intent": intent, "severity": severity, "confidenceScore": confidence_score},
                    "result": {"ticket_id": ticket_id, "status": status, "isError": False}
                })
                outcome = "TICKETED"
                response_given = f"Your query has been recorded. I've created a support ticket ({ticket_id}) for review by our operations team. We will update you shortly."
                
                db_log_interaction(query=query, intent=intent, severity=severity, confidence_score=confidence_score, outcome=outcome, ticket_id=ticket_id, response_given=response_given, reasoning_trace=reasoning_trace)
                reasoning_trace.append({
                    "tool": "log_interaction",
                    "args": {"query": query, "intent": intent, "severity": severity, "confidenceScore": confidence_score, "outcome": outcome, "ticketId": ticket_id},
                    "result": {"isError": False}
                })
                
            else:
                ticket_id, status, assigned_to = db_escalate_ticket(query=query, severity=severity, reason="low retrieval confidence", intent=intent)
                reasoning_trace.append({
                    "tool": "escalate_issue",
                    "args": {"query": query, "severity": severity, "reason": "low retrieval confidence", "intent": intent},
                    "result": {"ticket_id": ticket_id, "status": status, "assigned_to": assigned_to, "isError": False}
                })
                outcome = "ESCALATED"
                response_given = f"We couldn't locate sufficient information in our SOPs to answer your query. This issue has been escalated to Eko's {assigned_to} for manual support."
                
                db_log_interaction(query=query, intent=intent, severity=severity, confidence_score=confidence_score, outcome=outcome, ticket_id=ticket_id, response_given=response_given, reasoning_trace=reasoning_trace)
                reasoning_trace.append({
                    "tool": "log_interaction",
                    "args": {"query": query, "intent": intent, "severity": severity, "confidenceScore": confidence_score, "outcome": outcome, "ticketId": ticket_id},
                    "result": {"isError": False}
                })
                
        except Exception as ex:
            print(f"RAG search or ticketing crash: {ex}")
            ticket_id, status, assigned_to = db_escalate_ticket(query=query, severity=severity, reason=f"agent runtime exception: {str(ex)}", intent=intent)
            reasoning_trace.append({
                "tool": "escalate_issue",
                "args": {"query": query, "severity": severity, "reason": f"agent runtime exception", "intent": intent},
                "result": {"ticket_id": ticket_id, "status": status, "assigned_to": assigned_to, "isError": True}
            })
            outcome = "ESCALATED"
            response_given = "A system exception occurred while processing. The issue was escalated to support."
            db_log_interaction(query=query, intent=intent, severity=severity, confidence_score=0.0, outcome=outcome, ticket_id=ticket_id, response_given=response_given, reasoning_trace=reasoning_trace)
            reasoning_trace.append({
                "tool": "log_interaction",
                "args": {"query": query, "intent": intent, "severity": severity, "confidenceScore": 0.0, "outcome": outcome, "ticketId": ticket_id},
                "result": {"isError": False}
            })
            
    return {
        "query": query,
        "intent": intent,
        "severity": severity,
        "outcome": outcome,
        "ticket_id": ticket_id,
        "response_given": response_given,
        "reasoning_trace": reasoning_trace
    }
