# Eko Merchant KYC Standard Operating Procedure (SOP)

**Document ID:** EKO-OPS-KYC-002  
**Version:** 3.1  
**Owner:** Compliance & Risk Management Team  
**Last Updated:** June 2026  

---

## 1. Aadhaar-Based KYC Verification (e-KYC)
Eko merchants (micro-entrepreneurs) must undergo Aadhaar-based e-KYC to unlock full transactional limits:
- **Process:** The merchant enters their 12-digit Aadhaar number in the Eko App and performs biometric authentication (using a registered fingerprint or iris scanner) or OTP authentication (sent to their Aadhaar-linked mobile number).
- **Validation:** Real-time lookup with the UIDAI system. If the details (Name, DOB, Gender) match the registry, the status is set to e-KYC Approved.
- **SLA:** Instant verification.

## 2. PAN Card Verification
Every merchant must provide a valid PAN card (Permanent Account Number) to ensure compliance with Income Tax regulations:
- **Process:** Upload a high-resolution, clear photo of the PAN card. Eko uses OCR to extract the name and PAN number.
- **Validation:** Cross-referenced with the NSDL database. The name on the PAN must match the Aadhaar name by a threshold of at least 85% (Jaro-Winkler distance algorithm).
- **Manual Review:** If the OCR fail rates are high or name matching is between 70%-84%, the application is sent to the KYC manual verification queue.

## 3. Video KYC (V-KYC) Escalation Procedure
For Gold Tier merchant onboarding or high-risk areas, Video KYC is mandatory:
- **Triggers:** Monthly transaction projection > ₹5,00,000, or when e-KYC/PAN details have a minor discrepancy.
- **Process:** A scheduled video call between the merchant and an Eko verification officer. The merchant must show their original PAN and Aadhaar card on camera and read out a dynamic 4-digit security code generated on the screen.
- **Escalation:** If the connection drops three times or verification fails, flag the record as `VKYC_FAILED` and route it to the Compliance Lead for manual review.

## 4. Re-KYC Triggers and Timelines
To prevent money laundering and account hijacking, merchants must update their KYC periodically:
- **Low Risk (Bronze/Silver):** Every 2 years.
- **High Risk (Gold/Active DMT Hubs):** Annually.
- **Ad-hoc Triggers:** 
  - Change of merchant outlet location.
  - Spike in transactional volume exceeding 300% of historical average in a 7-day period.
  - Suspected third-party operation of the Eko portal.

## 5. KYC Rejection Reasons & Resubmission Process
If a merchant's KYC is rejected, the system logs a rejection code:
- **EKO-KYC-REJ-01 (Blurry Document):** Document photo is unreadable. Merchant must retake photo under good lighting.
- **EKO-KYC-REJ-02 (Name Mismatch):** Name on PAN does not match Aadhaar name. Merchant must upload alternate business registration if name changed legally, or update Aadhaar records.
- **EKO-KYC-REJ-03 (Location Discrepancy):** GPRS coordinates of Eko app onboarding do not match shop address listed in documents. Merchant must onboard from the actual shop location.
- *Resubmission:* Merchants have 3 attempts to resubmit corrected documents via the Eko Partner App. After 3 failures, the account is temporarily suspended.

## 6. Micro-Entrepreneur Specific Requirements
Since many Eko partners are small mom-and-pop shops (Kirana stores):
- If the shop is rented, a registered rent agreement or utility bill in the owner's name along with a consent letter is acceptable as address proof.
- Single-room/home-based businesses must upload a photo of the shop banner or shop front showing the commercial nature of operations.
