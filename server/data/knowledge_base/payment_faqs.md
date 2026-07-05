# Eko Internal SOP & FAQ: Domestic Money Transfer (DMT) & UPI Payments

**Document ID:** EKO-OPS-PAY-001  
**Version:** 4.2  
**Owner:** Operations & Payments Settlement Team  
**Last Updated:** June 2026  

---

## 1. UPI Payment Failures & Resolution Steps
UPI transaction failures represent the highest volume of micro-entrepreneur tickets. Support staff must follow this resolution tree:
1. **Technical Decline (TD):** Bank server or UPI switcher is down. 
   - *Action:* Instruct the merchant to wait 15 minutes. If money was debited from the customer's account, it will auto-refund within 48 hours. Do not retry the transaction immediately to prevent duplicate debits.
2. **Business Decline (BD):** Incorrect UPI PIN, invalid VPA (Virtual Payment Address), or limit exceeded.
   - *Action:* Direct merchant to check input details. No Eko action required.
3. **Deemed Approved (Pending Status):** The bank switcher accepted the transaction, but no confirmation was received.
   - *Action:* Check transaction status in Eko Partner Portal. If still "PENDING", run a manual status poll. If it stays pending for >2 hours, the transaction is marked "FAILED" by the end-of-day reconciliation and refunded.

## 2. Bank Gateway Timeout Handling
When Eko's host server fails to receive a response from the NPCI/Partner Bank Gateway within 30 seconds:
- The transaction falls into a **PENDING_TIMEOUT** state.
- **DO NOT** attempt to debit the merchant wallet again.
- Eko's auto-recon engine polls the bank gateway every 10 minutes.
- If the gateway confirms successful debit, Eko marks it SUCCESS and updates the merchant wallet.
- If the gateway confirms failure, the transaction is marked FAILED, and any on-hold wallet balance is released.

## 3. Insufficient Balance Scenarios
Micro-entrepreneurs run on tight working capital. 
- **Error Code: EKO-ERR-3001 (Wallet Insufficient Balance)**: The merchant has insufficient balance in their Eko trade wallet to process the DMT/cash-out request.
- *Resolution:* The merchant must top up their wallet using UPI, NetBanking, or by depositing cash at an Eko partner distributor bank branch. Wallet updates are instant via virtual account transfers.

## 4. Failed IMPS/NEFT Transactions
For Domestic Money Transfers (DMT) routed via IMPS or NEFT:
- **IMPS Failures:** Usually fail instantly. If money is debited from Eko's nodal account but not credited to the beneficiary, it is reversed within 24 hours.
- **NEFT Failures:** Can take up to 2 hours for batch processing. If NEFT fails after bank hours, the reversal occurs on the next working day.
- *Resolution:* If a merchant complains of non-credit despite a "SUCCESS" status in Eko, request the Customer Reference Number (RRN) and instruct them to tell the customer to check bank statements after 3 working days.

## 5. Refund Timelines & Processes
- **Immediate Refunds (Auto-Reversal):** Within 5 minutes to 2 hours for switch failures.
- **Reconciliation-Based Refunds (T+1 to T+2):** Occur after the daily night reconciliation.
- **Customer Dispute Refunds (Chargebacks):** If a customer files a chargeback, Eko investigates with the partner bank. Resolution SLA is T+7 working days.

## 6. Common Payment Error Codes
Support agents must match these codes from the transaction payload:
- **EKO-PAY-101**: Invalid UPI PIN entered. Merchant action: Instruct customer to reset PIN.
- **EKO-PAY-102**: Bank server unavailable. Merchant action: Wait and retry after 15 minutes.
- **EKO-PAY-103**: Daily transaction limit exceeded. Merchant action: Suggest using alternate bank account or DMT.
- **EKO-PAY-104**: Insufficient funds in customer bank account. Merchant action: Ask customer to pay via cash or check account balance.
- **EKO-PAY-105**: Receiver bank declined transaction. Merchant action: Verify receiver's bank status.
