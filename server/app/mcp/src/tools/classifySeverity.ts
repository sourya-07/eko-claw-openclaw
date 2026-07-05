// src/tools/classifySeverity.ts
//
// Owns: Classifying the severity level (LOW, MEDIUM, HIGH, CRITICAL) of incoming queries.
// Does NOT own: Action flow or escalation mapping (handled in AGENTS.md / escalateIssue.ts).
// Why: Standardizes severity outputs while keeping routing policies configurable.
// Uses fully local keyword rules — no Gemini API calls, preserving free-tier quota for
// OpenClaw's own agent reasoning loop which is the only component that needs the LLM.

import dotenv from "dotenv";
dotenv.config();

export const classifySeveritySchema = {
  name: "classify_severity",
  description:
    "Classifies the severity level of a support query into LOW, MEDIUM, HIGH, or CRITICAL. " +
    "High-value issues, wallet freezes, and outages are classified as HIGH or CRITICAL.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The support query string submitted by the user."
      }
    },
    required: ["query"]
  }
};

interface SeverityResult {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  source: "gemini" | "fallback";
}

export async function classifySeverity(args: { query: string; intent?: string }): Promise<SeverityResult> {
  const queryText = (args.query?.trim() || "").substring(0, 1000);
  if (!queryText) {
    return { severity: "LOW", source: "fallback" };
  }
  const queryLower = queryText.toLowerCase();

  // Fully deterministic keyword classification — no Gemini call.
  // OpenClaw's agent reasoning already uses Gemini; this avoids consuming 2 extra
  // quota slots (intent + severity) per query on the 20 RPD free tier.

  // 1. Regulatory, legal, compliance, or fraud / disputes are CRITICAL
  if (
    queryLower.includes("rbi") ||
    queryLower.includes("police") ||
    queryLower.includes("lawyer") ||
    queryLower.includes("court") ||
    queryLower.includes("legal") ||
    queryLower.includes("ombudsman") ||
    queryLower.includes("compliance") ||
    queryLower.includes("regulatory") ||
    queryLower.includes("fraud") ||
    queryLower.includes("unauthorized") ||
    queryLower.includes("stolen") ||
    queryLower.includes("hacked") ||
    queryLower.includes("dispute") ||
    queryLower.includes("scam")
  ) {
    return { severity: "CRITICAL", source: "fallback" };
  }

  // 2. Check for high financial amounts or general high urgency
  const hasHighAmount = 
    queryLower.match(/\b(20000|50000|100000|lakh|lacs|thousand)\b/i) ||
    (/\b\d{5,}\b/.test(queryLower) && parseInt(queryLower.match(/\b\d{5,}\b/)?.[0] || "0", 10) >= 20000);

  if (
    queryLower.includes("urgent") ||
    queryLower.includes("escalate") ||
    queryLower.includes("distributor") ||
    queryLower.includes("outage") ||
    queryLower.includes("system down") ||
    hasHighAmount
  ) {
    return { severity: "HIGH", source: "fallback" };
  }

  // 3. Moderate issues (payment delays, KYC delays, biometric issues)
  if (
    queryLower.includes("payment") ||
    queryLower.includes("transaction") ||
    queryLower.includes("upi") ||
    queryLower.includes("fail") ||
    queryLower.includes("failed") ||
    queryLower.includes("debit") ||
    queryLower.includes("refund") ||
    queryLower.includes("imps") ||
    queryLower.includes("neft") ||
    queryLower.includes("status") ||
    queryLower.includes("reversal") ||
    queryLower.includes("timeout") ||
    queryLower.includes("kyc") ||
    queryLower.includes("aadhaar") ||
    queryLower.includes("pan") ||
    queryLower.includes("biometric") ||
    queryLower.includes("video kyc") ||
    queryLower.includes("reject") ||
    queryLower.includes("re-kyc") ||
    queryLower.includes("verify") ||
    queryLower.includes("document")
  ) {
    return { severity: "MEDIUM", source: "fallback" };
  }

  return { severity: "LOW", source: "fallback" };
}
