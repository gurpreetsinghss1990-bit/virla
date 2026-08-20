# VIRLA ONE BRAIN: PHASE 2 TECHNICAL DESIGN & TRANSITION MATRIX
AUTHORITATIVE STATE MACHINE DESIGN — READ-ONLY / DESIGN PLAN

---

## 1. EXECUTIVE SUMMARY & SYSTEM AUDIT
This document defines the technical specifications for transitioning the Virla architecture from a **Dual Brain** model (where the React Native client and Zustand caches determine transaction outcomes and credit state) to a **One Brain** model (where the Supabase PostgreSQL database serves as the sole, authoritative, transactional state machine).

All state mutations, time windows, and balance modifications will be controlled strictly through database-level checks and secure `SECURITY DEFINER` RPC functions. The client application becomes a pure presentation layer.

---

## 2. AMBIGUITIES & CONTRADICTIONS IN THE PRODUCTION SCHEMA
During our read-only audit of `docs/VIRLA_PRODUCTION_SCHEMA.sql` and the client codebase, we identified the following critical ambiguities, contradictions, and structural risks:

### A. Fragile Time parsing & NTP Dependency
- **Current Method:** `public.parse_booking_start_time()` parses user-submitted text fields like `"Today, Aug 20, 2026"` or `"Tomorrow, Aug 21, 2026"` using string operations.
- **Contradiction/Risk:** If client-side date formatting localization changes, the database trigger will crash on text-to-timestamp cast.
- **Timezone Crossover:** It subtracts a hardcoded `5 hours 30 minutes` interval to check UTC. This assumes the server time is strictly UTC and target is IST, which is vulnerable to server-level configuration drift.

### B. Conflicting Acceptance Escalation Definition
- **Intended Rule:** Immediate notification -> 5 mins later 2nd notification -> 5 mins later 3rd notification -> Auto-accept.
- **Current DB Trigger Behavior:** `process_pending_acceptance_bookings()` increments `acceptance_notification_count` to `2` at $T+5$ minutes. At $T+10$ minutes, it updates status directly to `trainer_accepted` (Auto-Accept) and increments the counter to `3`. This means the "3rd notification" is actually the confirmation that the booking was auto-accepted, not a warning *before* auto-acceptance.

### C. Permissive RLS Policies on Critical Tables
- **Current RLS:** Tables like `trainers`, `workouts`, and `trainer_workout_assignments` use `USING (true) WITH CHECK (true)`.
- **Contradiction/Risk:** Any authenticated user can write, update, or delete trainer ratings, availability profiles, or workout category assignments directly via the Supabase client API without server validation.
- **Profile Vulnerability:** The `user_profiles` RLS policy checks `user_id = auth.uid()` for updates. Because `credits_balance` resides directly in `user_profiles`, any authenticated user can increment their own credit balance to arbitrary amounts with a simple `supabase.from('user_profiles').update({ credits_balance: 999 })` command.

---

## 3. ONE BRAIN TARGET PRINCIPLES
1. **Server-Side Authority:** The client must never calculate `credits_balance` or transition `timeline_status` values.
2. **NTP Offset Removal:** All times are calculated directly in SQL queries using database `now()` matching UTC timestamps. No client-side clocks can influence limits.
3. **Atomic Mutations:** Credit deduction, booking insertion, and slot reservation must occur within a single SQL transaction.
4. **Idempotency:** Re-executing an RPC with the same payload (e.g. due to retry on network drop) must return the existing state without double charging or duplicate mutations.

---

## 4. COMPLETE TRANSITION MATRIX

| Transition | Current State | Target State | Actor | Server-Time Condition | Prerequisites | Database Mutation | Notification Dispatch | Admin Visibility | Failure Response | Idempotency Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Booking Creation** | None / Draft | `booked` | Client (User) | Any (Future time slot) | User profile has $\ge 1$ credit. Trainer has slot open. | Insert `bookings` row, deduct 1 credit from `user_profiles` (atomic transaction). | Immediate push alert to assigned trainer. | Visible in Admin Panel as `booked`. | Rollback transaction, throw error to client. | Unique constraint on `client_id` + `draft_token` prevents duplicate inserts. |
| **2. Trainer Assigned** | `booked` | `trainer_assigned` | System (Engine) | Within booking acceptance SLA | System matches trainer. | Update `bookings.trainer_id` and set `timeline_status = 'trainer_assigned'`. | Push to assigned trainer. | Dashboard status updates. | Log reassign event, retry matching. | Match attempt transaction locked by booking UUID. |
| **3. Manual Acceptance** | `booked` or `trainer_assigned` | `trainer_accepted` | Trainer | $T_{now} - T_{created} < 10$ minutes | Booking status is `upcoming`. Assigned trainer matches caller. | Update `timeline_status` to `trainer_accepted`. Set `acceptance_method = 'manual'`, set `trainer_accepted_at`. | Alert to Client: "Trainer Assigned". | Mark as accepted on Admin Panel. | Throw "10-minute acceptance window closed". | Return success if state is already `trainer_accepted`. |
| **4. Auto-Acceptance** | `booked` or `trainer_assigned` | `trainer_accepted` | System (Cron) | $T_{now} - T_{created} \ge 10$ minutes | Booking has remained unaccepted for 10 minutes. | Set `timeline_status = 'trainer_accepted'`, `acceptance_method = 'auto'`, `auto_accepted_at = now`. | Alert to Client (Confirmed), Trainer (Warning), Admin (Alert). | Flag prominently on Admin Panel as **AUTO-ACCEPTED (Follow-up Required)**. | Log match exception. | Cron check handles updates safely. |
| **5. Trainer Preparing** | `trainer_accepted` | `trainer_preparing` | Trainer | Any | Current status is `trainer_accepted`. | Update `timeline_status` to `trainer_preparing`. | Push notification to client. | Status updates in Live dashboard. | Transition rejection. | Return success if state is already `trainer_preparing`. |
| **6. Start Travel** | `trainer_accepted` or `trainer_preparing` | `trainer_travelling` | Trainer | $T_{now} \ge T_{scheduled} - 25$ mins | Travel window is open ($\le 25$ minutes before start). | Update `timeline_status` to `trainer_travelling`, record `travel_started_at`. | Push notification to client (with ETA info). | Status updates in Live dashboard. | Throw "Too early to start travel" validation error. | Return success if state is already `trainer_travelling`. |
| **7. Arrival / Check-in** | `trainer_travelling` | `trainer_arrived` | Trainer | $T_{now} \ge T_{scheduled} - 30$ mins | Trainer status is `trainer_travelling`. | Update `timeline_status` to `trainer_arrived`, generate 6-digit OTP, set `otp_expires_at = now + 15m`. | Push to client containing arrival info (OTP displayed in Client UI). | Status updates. | Transition rejection. | Return existing OTP if already generated. |
| **8. OTP Verification** | `trainer_arrived` | `otp_verified` | Client / Trainer | Within 15 min OTP window | Entered OTP matches DB value. | Update `timeline_status` to `otp_verified`. | Push status update to both trainer and customer. | Status updates. | Throw "Invalid or Expired OTP". | Return success if already `otp_verified`. |
| **9. Session Start** | `otp_verified` | `workout_started` | Trainer | Within session window | Timeline status is `otp_verified`. | Set `timeline_status = 'workout_started'`, set `workout_started_at`. | Push notification to client. | Active workout shown in Live tracker. | Transition rejection. | Return success if state is already `workout_started`. |
| **10. Session Completion** | `workout_started` | `workout_completed` | Trainer | $T_{now} \ge T_{start} + 30$ mins (safety) | Timeline status is `workout_started`. | Set `timeline_status = 'workout_completed'`, `status = 'completed'`, record `workout_completed_at`. | Push notification to client to rate coach. | Moves to completed bookings panel. | Transition rejection. | Return success if already `workout_completed`. |
| **11. Report Submission** | `workout_completed` | `trainer_report_submitted` | Trainer | Any | Timeline status is `workout_completed`. | Insert questionnaire into booking, trigger `trainer_earnings` calculation. | Push notification to client. | Dashboard report visible. | Throw validation error. | Constraint on questionnaire content updates. |
| **12. Review Submission** | `trainer_report_submitted` | `session_closed` | Client | Any | Timeline status is `trainer_report_submitted`. | Update `rating_details` and transition `timeline_status` to `session_closed`. | None. | Rated history visible. | Reject invalid ratings. | Return success if rating exists. |
| **13. Session Closure** | `customer_review_pending` | `session_closed` | System / Client | Any | Review phase complete or skipped. | Update `timeline_status` to `session_closed`. | None. | History archived. | Reject updates. | Return success if closed. |
| **14. Customer Cancellation** | `booked`, `trainer_assigned`, `trainer_accepted`, `trainer_preparing` | `cancelled` / `session_closed` | Client (User) | Any | Current status is `upcoming`. | Update status to `cancelled`, `timeline_status = 'session_closed'`, refund 1 credit if not late cancel. | Push cancel notification to trainer. | Logged in cancellation history. | Throw "Session already in progress". | Rollback validation prevents double refund. |
| **15. Late Cancellation / No Show** | `trainer_travelling` or `trainer_arrived` | `session_closed` | System / Admin | $T_{now} > T_{otp\_grace\_expiry}$ | No OTP entered within grace period. | Update `status` to `client_no_show` or `trainer_no_show`. Forfeit credit (client) or apply free credit (trainer error). | Push compensation/penalty notifications. | Visible as Exception. | Log warning. | Ledger updates locked by booking UUID. |
| **16. Expiry / Missed** | Any unstarted state | `session_closed` | System (Cron) | $T_{now} > T_{scheduled} + 30$ mins | Session never verified or started. | Set `status = 'missed_session_not_started'` and `timeline_status = 'session_closed'`. | Push alert to client/trainer. | Flagged as missed session. | Log warning. | Single update pass. |

---

## 5. CLIENT RESPONSIBILITY TO SERVER RPC MAPPING

| Existing Client Responsibility | File Reference | Target RPC |
| :--- | :--- | :--- |
| **Deduct credit, create draft, insert booking** | [Database.ts](file:///Users/virral/Desktop/Virla%20/src/database/Database.ts#L2453) (`addBooking`) | `rpc.create_booking(workout_id, date, time)` |
| **Cancel booking request & refund credit** | [Database.ts](file:///Users/virral/Desktop/Virla%20/src/database/Database.ts#L2539) (`cancelBooking`) | `rpc.cancel_booking(booking_id)` |
| **Manual accept & log assignment event** | [bookingStore.ts](file:///Users/virral/Desktop/Virla%20/src/store/bookingStore.ts#L202) (`acceptBooking`) | `rpc.trainer_accept_booking(booking_id)` |
| **Transition timeline status directly** | [bookingStore.ts](file:///Users/virral/Desktop/Virla%20/src/store/bookingStore.ts#L84) (`updateTimelineStatus`) | `rpc.update_session_timeline(booking_id, target_status)` |
| **Generate OTP, grace period, check-in** | [SessionEngine.ts](file:///Users/virral/Desktop/Virla%20/src/services/SessionEngine.ts#L91) (`checkIn`) | `rpc.trainer_check_in(booking_id)` |
| **Verify OTP (offline fallback removed)** | [SessionEngine.ts](file:///Users/virral/Desktop/Virla%20/src/services/SessionEngine.ts#L133) (`verifyOTP`) | `rpc.verify_and_start_session(booking_id, entered_otp)` |
| **Forfeit/deduct credits for late cancel** | [walletStore.ts](file:///Users/virral/Desktop/Virla%20/src/store/walletStore.ts#L110) (`deductCreditLateCancel`) | *System Handles Automatically via DB Triggers* |
| **Add compensation credit for coach failure** | [walletStore.ts](file:///Users/virral/Desktop/Virla%20/src/store/walletStore.ts#L130) (`addBonusCredit`) | *System Handles Automatically via DB Triggers* |

---

## 6. PROPOSED AUTHORITATIVE RPC SIGNATURES & CONTRACTS

### A. Booking Creation
```sql
CREATE OR REPLACE FUNCTION public.create_booking(
  p_workout_id text,
  p_date text, -- Will migrate to timestamp in future
  p_time text,
  p_assigned_trainer_id text
) RETURNS jsonb AS $$
-- Checks: User credit balance >= 1
-- Checks: Trainer slot is available
-- Actions: Deducts 1 credit from user_profiles, inserts booking record with timeline_status = 'booked'
-- Returns: Created booking ID or raises exception
```

### B. Travel & Lifecycle Status Updates
```sql
CREATE OR REPLACE FUNCTION public.update_session_timeline(
  p_booking_id text,
  p_target_status text
) RETURNS jsonb AS $$
-- Checks: Validates sender role matches client/trainer
-- Checks: Validates transition sequence using trigger logic
-- Checks: Validates current server time falls within the 25-minute window for travel
-- Returns: Updated booking record or raises transition exception
```

---

## 7. RLS & SECURITY ENFORCEMENT MATRIX

- **`user_profiles` (credits_balance):**
  - **SELECT:** `user_id = auth.uid() OR is_admin()`
  - **UPDATE:** Deny direct client updates to `credits_balance`. Allow updates *only* via `SECURITY DEFINER` RPC functions.
- **`bookings` (timeline_status):**
  - **SELECT:** `client_id = auth.uid() OR trainer_id = auth.uid() OR is_admin()`
  - **UPDATE:** Clients can only update text notes; all status transitions require the verified RPC execution.
- **`trainers`:**
  - **UPDATE:** Require authenticated trainer ID to update their own working radius or bio. Remove permissive simulation policy.

---

## 8. MIGRATION PLAN & PHASE 2 RUNBOOK
1. **DB Hardening (DDL):** Deploy updated RLS rules and secure RPC functions using migration file `20260821000000_one_brain_core.sql`.
2. **Client Removal of Direct Updates:** Remove client-side Zustand mutations and optimistic updates in `bookingStore.ts`, `walletStore.ts`, and `SessionEngine.ts`, routing them exclusively through database RPC triggers.
3. **Validation testing:** Perform unit testing using simulated OTP check-ins to verify server-time enforcement bounds (e.g. testing starting travel 26 minutes prior is blocked, and starting travel 24 minutes prior is allowed).
