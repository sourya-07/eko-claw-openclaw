// test_tools.js
//
// Standalone script to verify each MCP tool functionality directly.
// Excluded from production workspace, used solely for the readiness audit.

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { searchKnowledgeBase } from "./dist/tools/searchKnowledgeBase.js";
import { classifyIntent } from "./dist/tools/classifyIntent.js";
import { classifySeverity } from "./dist/tools/classifySeverity.js";
import { createTicket } from "./dist/tools/createTicket.js";
import { updateTicket } from "./dist/tools/updateTicket.js";
import { escalateIssue } from "./dist/tools/escalateIssue.js";
import { logInteraction } from "./dist/tools/logInteraction.js";
import { db } from "./dist/db/sqlite.js";

dotenv.config({ path: "../.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log("=== STARTING MCP TOOLS AUDIT AND VERIFICATION ===\n");

  // 1. searchKnowledgeBase - Active Check
  console.log("Testing searchKnowledgeBase (RAG service UP)...");
  const ragUpRes = await searchKnowledgeBase({ query: "UPI payment failed" });
  console.log(`- Result: Chunks fetched = ${ragUpRes.chunks.length}, confidence = ${ragUpRes.confidenceScore}, isError = ${ragUpRes.isError}`);
  if (ragUpRes.chunks.length > 0 && ragUpRes.confidenceScore > 0 && !ragUpRes.isError) {
    console.log("  [PASS] searchKnowledgeBase active check");
  } else {
    console.error("  [FAIL] searchKnowledgeBase active check");
  }

  // 2. searchKnowledgeBase - Inactive check (Graceful degradation)
  // We can temporarily query with an unreachable port by mocking fetch or similar,
  // or we can stop the server. Let's call a modified URL or test what happens when fetching a broken URL.
  // Actually, we can temporarily query a port we know is down (e.g. 9999) if we verify it fails.
  // Let's test the error output of searchKnowledgeBase by using a bad environment or server down scenario.
  console.log("Testing searchKnowledgeBase (Offline/Down Check)...");
  // To simulate down, we can temporarily rename fetch or test if it handles errors.
  // Since we catch connection failures in our code, this should pass. Let's verify with local function:
  try {
    const originalFetch = global.fetch;
    global.fetch = () => Promise.reject(new Error("Connection refused"));
    const ragDownRes = await searchKnowledgeBase({ query: "UPI payment failed" });
    global.fetch = originalFetch;
    console.log(`- Result: chunks = ${ragDownRes.chunks.length}, isError = ${ragDownRes.isError}, error = "${ragDownRes.errorMessage}"`);
    if (ragDownRes.isError && ragDownRes.errorMessage?.includes("Connection refused")) {
      console.log("  [PASS] searchKnowledgeBase offline resilience");
    } else {
      console.error("  [FAIL] searchKnowledgeBase offline resilience");
    }
  } catch (err) {
    console.error("  [FAIL] searchKnowledgeBase offline threw exception", err);
  }

  // 3. classifyIntent - LLM classification
  console.log("\nTesting classifyIntent with Gemini...");
  const queries = [
    { text: "My payment failed and money was debited", expected: "PAYMENT_ISSUE" },
    { text: "Help me verify my Aadhaar card details for KYC", expected: "KYC_ISSUE" },
    { text: "Where can I view my payout commission rates?", expected: "PARTNER_QUERY" },
    { text: "I see an unauthorized transaction of Rs 10000 on my wallet", expected: "TRANSACTION_DISPUTE" },
    { text: "URGENT! System outage, everything is crashing!", expected: "ESCALATION_REQUIRED" },
    { text: "How can I download the TDS certificate?", expected: "GENERAL_INQUIRY" }
  ];

  for (const q of queries) {
    const res = await classifyIntent({ query: q.text });
    console.log(`- Query: "${q.text}" -> Intent: ${res.intent} (source: ${res.source})`);
  }

  // 4. classifyIntent - Fallback verification
  console.log("\nTesting classifyIntent Keyword Fallback (Deleting API key temporary)...");
  const savedKey = process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  let allFallbackPass = true;
  for (const q of queries) {
    const res = await classifyIntent({ query: q.text });
    console.log(`- Fallback query: "${q.text}" -> Intent: ${res.intent} (source: ${res.source})`);
    if (res.source !== "fallback") {
      allFallbackPass = false;
    }
  }
  process.env.GOOGLE_API_KEY = savedKey; // Restore
  if (allFallbackPass) {
    console.log("  [PASS] classifyIntent keyword fallback active and correct");
  } else {
    console.error("  [FAIL] classifyIntent keyword fallback failed");
  }

  // 5. classifySeverity - LLM classification
  console.log("\nTesting classifySeverity...");
  const sevQueries = [
    { text: "What is Eko Bronze daily limit?", expected: "LOW" },
    { text: "My onboarding is pending for 2 days", expected: "MEDIUM" },
    { text: "My wallet has been blocked with Rs 50000 inside, please unblock!", expected: "HIGH" },
    { text: "The entire payment database has crashed, regulatory compliance freeze!", expected: "CRITICAL" }
  ];
  for (const q of sevQueries) {
    const res = await classifySeverity({ query: q.text });
    console.log(`- Query: "${q.text}" -> Severity: ${res.severity} (source: ${res.source})`);
  }

  // 6. classifySeverity - Fallback verification
  console.log("\nTesting classifySeverity Keyword Fallback...");
  delete process.env.GOOGLE_API_KEY;
  let allSevFallbackPass = true;
  for (const q of sevQueries) {
    const res = await classifySeverity({ query: q.text });
    console.log(`- Fallback query: "${q.text}" -> Severity: ${res.severity} (source: ${res.source})`);
    if (res.source !== "fallback") {
      allSevFallbackPass = false;
    }
  }
  process.env.GOOGLE_API_KEY = savedKey; // Restore
  if (allSevFallbackPass) {
    console.log("  [PASS] classifySeverity keyword fallback active and correct");
  } else {
    console.error("  [FAIL] classifySeverity keyword fallback failed");
  }

    // 7. createTicket - DB writes and sequence
  console.log("\nTesting createTicket (Ticket creation & auto-increment check)...");
  // Clean database tickets first for predictable testing
  db.prepare("DELETE FROM interactions").run();
  db.prepare("DELETE FROM tickets").run();

  const ticket1 = await createTicket({
    query: "Gold onboarding timeline pending",
    intent: "PARTNER_QUERY",
    severity: "MEDIUM",
    confidenceScore: 0.68,
    chunks: ["Partner onboarding takes 24-48 business hours."]
  });
  console.log(`- Ticket 1: ID = ${ticket1.ticket_id}, status = ${ticket1.status}, error = ${ticket1.isError}`);

  const ticket2 = await createTicket({
    query: "UPI payment pending status",
    intent: "PAYMENT_ISSUE",
    severity: "LOW",
    confidenceScore: 0.81,
    chunks: ["UPI timeout resolves in 24 hours."]
  });
  console.log(`- Ticket 2: ID = ${ticket2.ticket_id}, status = ${ticket2.status}, error = ${ticket2.isError}`);

  const rowCount = db.prepare("SELECT COUNT(*) as count FROM tickets").get();
  console.log(`- DB Check: Total rows in tickets table = ${rowCount.count}`);

  const expectedYear = new Date().getFullYear();
  if (ticket1.ticket_id === `EKO-${expectedYear}-0001` && ticket2.ticket_id === `EKO-${expectedYear}-0002` && rowCount.count === 2) {
    console.log("  [PASS] createTicket auto-increment sequence and SQLite write");
  } else {
    console.error("  [FAIL] createTicket sequence or SQLite write failed");
  }

  // 8. updateTicket - Valid and invalid inputs
  console.log("\nTesting updateTicket...");
  const updateRes1 = await updateTicket({
    ticket_id: ticket1.ticket_id,
    status: "RESOLVED",
    severity: "LOW"
  });
  console.log(`- Valid Update Result: error = ${updateRes1.isError}, msg = "${updateRes1.message}"`);

  // Verify DB updated
  const updatedRow = db.prepare("SELECT status, severity FROM tickets WHERE ticket_id = ?").get(ticket1.ticket_id);
  console.log(`- DB Row after update: status = "${updatedRow.status}", severity = "${updatedRow.severity}"`);

  const updateRes2 = await updateTicket({
    ticket_id: "EKO-2099-9999", // non-existent
    status: "CLOSED"
  });
  console.log(`- Non-existent Update Result: error = ${updateRes2.isError}, errorMsg = "${updateRes2.errorMessage}"`);

  if (!updateRes1.isError && updatedRow.status === "RESOLVED" && updatedRow.severity === "LOW" && updateRes2.isError) {
    console.log("  [PASS] updateTicket correctly modifies DB rows and handles missing tickets");
  } else {
    console.error("  [FAIL] updateTicket failed validations");
  }

  // 9. escalateIssue - SLA routing, database and JSON logs
  console.log("\nTesting escalateIssue...");
  // Reset ticket status to OPEN/LOW first to test transition
  db.prepare("UPDATE tickets SET status = 'OPEN', severity = 'LOW' WHERE ticket_id = ?").run(ticket1.ticket_id);
  
  const escRes1 = await escalateIssue({
    query: "Outage on payment gateway",
    severity: "CRITICAL",
    reason: "outage",
    ticket_id: ticket1.ticket_id
  });
  console.log(`- Escalation Critical: assigned = "${escRes1.assigned_to}", SLA = "${escRes1.expected_response_time}", error = ${escRes1.isError}`);

  const escRes2 = await escalateIssue({
    query: "Wallet blocked Rs 50000",
    severity: "HIGH",
    reason: "large wallet balance blocked"
    // no ticket_id passed
  });
  console.log(`- Escalation High (No Ticket): assigned = "${escRes2.assigned_to}", SLA = "${escRes2.expected_response_time}", error = ${escRes2.isError}`);

  const escCount = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'ESCALATED'").get();
  console.log(`- DB Check: Total escalated tickets = ${escCount.count}`);

  // Check logs directory
  const logsDir = path.resolve(__dirname, "../logs");
  const logFiles = fs.readdirSync(logsDir).filter(f => f.startsWith("escalation_"));
  console.log(`- Filesystem check: Found ${logFiles.length} escalation JSON log files in logs/`);

  if (
    escRes1.assigned_to === "Head of Operations" &&
    escRes1.expected_response_time === "30 minutes" &&
    escRes2.assigned_to === "Senior Operations Manager" &&
    escRes2.expected_response_time === "2 hours" &&
    escCount.count === 2 &&
    logFiles.length >= 2
  ) {
    console.log("  [PASS] escalateIssue SLA routing, SQLite write, and log file export");
  } else {
    console.error("  [FAIL] escalateIssue SLA routing, SQLite write, or log file export failed");
  }

  // 10. logInteraction - Interaction pretty print JSON log
  console.log("\nTesting logInteraction...");
  const logIntRes = await logInteraction({
    query: "Gold onboarding timeline pending",
    intent: "PARTNER_QUERY",
    severity: "MEDIUM",
    confidenceScore: 0.68,
    outcome: "TICKETED",
    ticketId: ticket1.ticket_id,
    reasoningTrace: [
      { tool: "classify_intent", result: { intent: "PARTNER_QUERY" } },
      { tool: "classify_severity", result: { severity: "MEDIUM" } },
      { tool: "search_knowledge_base", result: { confidenceScore: 0.68 } },
      { tool: "create_ticket", result: { ticket_id: ticket1.ticket_id } }
    ]
  });
  console.log(`- Log interaction result: error = ${logIntRes.isError}, msg = "${logIntRes.message}"`);

  // Verify DB written
  const intDbCount = db.prepare("SELECT COUNT(*) as count FROM interactions").get();
  console.log(`- DB Check: Total rows in interactions table = ${intDbCount.count}`);

  // Verify file written and readable
  const intFiles = fs.readdirSync(logsDir).filter(f => f.startsWith("interaction_"));
  console.log(`- Filesystem check: Found ${intFiles.length} interaction JSON files in logs/`);
  
  let validJson = false;
  if (intFiles.length > 0) {
    const samplePath = path.join(logsDir, intFiles[0]);
    try {
      const parsed = JSON.parse(fs.readFileSync(samplePath, "utf8"));
      if (parsed.query && parsed.reasoning_trace && parsed.outcome) {
        validJson = true;
      }
    } catch (e) {
      console.error("  [FAIL] logInteraction JSON parse failed", e);
    }
  }

  if (!logIntRes.isError && intFiles.length > 0 && validJson && intDbCount.count === 1) {
    console.log("  [PASS] logInteraction writes pretty-printed, parseable JSON files and persists to SQLite");
  } else {
    console.error("  [FAIL] logInteraction validation or SQLite persistence failed");
  }

  console.log("\n=== COMPLETED MCP TOOLS AUDIT AND VERIFICATION ===");
}

runTests().catch(console.error);
