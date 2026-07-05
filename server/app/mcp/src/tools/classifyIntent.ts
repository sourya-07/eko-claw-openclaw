// src/tools/classifyIntent.ts
//
// Owns: Classifying the merchant support query's intent into Eko-specific support categories.
// Does NOT own: Deciding on the next actions or ticketing rules (handled in AGENTS.md).
// Why: Keeping classification deterministic at tool level while logic remains config-first.
// Uses a fully local keyword heuristic — no external API calls needed, guaranteeing 100%
// availability regardless of API rate limits and NOT consuming Gemini free-tier quota.
// (OpenClaw's own agent reasoning loop already uses Gemini; adding a second call here was
//  redundant and caused premature 429 RESOURCE_EXHAUSTED errors during testing.)

import dotenv from "dotenv";
dotenv.config();

export const classifyIntentSchema = {
  name: "classify_intent",
  description:
    "Classifies the intent of a merchant/partner query into one of six categories: " +
    "PAYMENT_ISSUE, KYC_ISSUE, PARTNER_QUERY, TRANSACTION_DISPUTE, ESCALATION_REQUIRED, GENERAL_INQUIRY. " +
    "Always returns a valid category, using a keyword-based fallback if the LLM API fails.",
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

interface IntentResult {
  intent: string;
  source: "gemini" | "fallback";
}

export async function classifyIntent(args: { query: string }): Promise<IntentResult> {
  const queryText = (args.query?.trim() || "").substring(0, 1000);
  if (!queryText) {
    return { intent: "GENERAL_INQUIRY", source: "fallback" };
  }
  const queryLower = queryText.toLowerCase();

  // Fully deterministic keyword classification — no Gemini call needed.
  // OpenClaw's own agent reasoning loop already uses Gemini for tool orchestration;
  // adding another Gemini call here is redundant and doubles quota consumption.

  // 1. Check for escalation triggers
  if (
    queryLower.includes("legal") ||
    queryLower.includes("police") ||
    queryLower.includes("court") ||
    queryLower.includes("rbi") ||
    queryLower.includes("ombudsman") ||
    queryLower.includes("compliance") ||
    queryLower.includes("regulatory")
  ) {
    return { intent: "ESCALATION_REQUIRED", source: "fallback" };
  }

  // 2. Check for disputes and fraud (must be before payment checks)
  if (
    queryLower.includes("fraud") ||
    queryLower.includes("unauthorized") ||
    queryLower.includes("hacked") ||
    queryLower.includes("stolen") ||
    queryLower.includes("dispute") ||
    queryLower.includes("scam")
  ) {
    return { intent: "TRANSACTION_DISPUTE", source: "fallback" };
  }

  // 3. Check for payment/reversal issues
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
    queryLower.includes("timeout")
  ) {
    return { intent: "PAYMENT_ISSUE", source: "fallback" };
  }

  // 4. Check for KYC issues
  if (
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
    return { intent: "KYC_ISSUE", source: "fallback" };
  }

  // 5. Check for partner operational queries
  if (
    queryLower.includes("commission") ||
    queryLower.includes("payout") ||
    queryLower.includes("partner") ||
    queryLower.includes("tier") ||
    queryLower.includes("distributor") ||
    queryLower.includes("onboard") ||
    queryLower.includes("suspension") ||
    queryLower.includes("reactivate") ||
    queryLower.includes("gst")
  ) {
    return { intent: "PARTNER_QUERY", source: "fallback" };
  }

  return { intent: "GENERAL_INQUIRY", source: "fallback" };
}
