# Eko Customer Operations & Technical Escalation Matrix

**Document ID:** EKO-OPS-ESC-004  
**Version:** 6.1  
**Owner:** Director of Customer Operations & Nodal Compliance  
**Last Updated:** June 2026  

---

## 1. Severity Classifications & Assigned Roles
Eko categorizes operational issues into four severity tiers based on financial exposure and business impact:

| Severity | Definition | Assigned Ops Role |
| :--- | :--- | :--- |
| **LOW** | Minor queries, basic FAQs, general commission checks, status checks. | Level 1 Customer Support Desk |
| **MEDIUM** | Standard KYC delays, single transaction delays, localized app load speed issues. | Level 2 Operations Associate |
| **HIGH** | Wallet balance discrepancy, distributor cash-out failures, recurring Aadhaar/UPI gate timeouts. | Senior Operations Analyst |
| **CRITICAL** | Multiple wallet debits without credit, system outages, suspected merchant account breach, regulatory notices. | Head of Operations / Compliance Lead |

## 2. Response Time SLAs by Severity
SLAs govern the maximum permissible time before the assignee must update the ticket and initiate contact:
- **LOW:** 24 working hours response SLA. Resolution target: 48 working hours.
- **MEDIUM:** 4 working hours response SLA. Resolution target: 12 working hours.
- **HIGH:** 1 hour response SLA. Resolution target: 4 working hours.
- **CRITICAL:** 15 minutes response SLA. Resolution target: 1 hour.

## 3. Escalation Triggers and Conditions
A ticket is automatically escalated under the following rules:
- **T1: SLA Breach:** A MEDIUM ticket is escalated to HIGH if not updated within 4 hours. A HIGH ticket escalates to CRITICAL if unresolved after 4 hours.
- **T2: Financial Threshold:** Any transaction dispute involving value > ₹25,000 is automatically classified as HIGH. disputes > ₹1,00,000 are automatically classified as CRITICAL.
- **T3: Bulk Failures:** Any report affecting > 5 merchants simultaneously is escalated to HIGH (technical gateway failure rule).

## 4. After-Hours Escalation Procedure
Eko support operates 24/7 for high-volume channels. Outside of standard office hours (9:00 AM - 7:00 PM IST):
- HIGH and CRITICAL alerts are piped to the **On-Call Operations Lead** via PagerDuty.
- If the On-Call Lead does not acknowledge the incident within 10 minutes, a synthetic SMS alert escalates the ticket to the CTO and Director of Operations.
- Standard LOW and MEDIUM tickets remain queued until the next business morning.

## 5. Regulatory & Compliance Escalation Path
Under Reserve Bank of India (RBI) guidelines for prepaid payment instruments (PPI) and DMT intermediaries:
- If a customer/merchant alleges fraud or unauthorized transaction:
  - Immediately freeze the affected Eko wallet.
  - Route the ticket directly to the **Nodal Officer** (`nodalofficer@eko.co.in`).
  - Eko is required to file a Suspicious Transaction Report (STR) to FIU-IND within 7 days if fraud is verified.
