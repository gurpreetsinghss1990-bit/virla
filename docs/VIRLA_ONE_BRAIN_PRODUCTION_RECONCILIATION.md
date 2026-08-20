# VIRLA ONE BRAIN: PRODUCTION RECONCILIATION
READ-ONLY FORENSIC ARCHITECTURE AUDIT

## 1. EXECUTIVE SUMMARY
This document performs a forensic reconciliation of the current Virla application source code and actual production Supabase schema (`VIRLA_PRODUCTION_SCHEMA.sql`) against the previous Phase 1 architecture audit. The goal is to identify discrepancies, document exactly how the production system behaves today, highlight conflicting sources of truth (client vs. server), and establish preconditions for the "One Brain" target architecture.

The current system relies heavily on a "Dual Brain" model where client-side caches (Zustand stores like `useBookingStore`, `useWalletStore`) calculate critical state transitions, deduct balances, and manage time without server enforcement, while the database attempts to mirror these changes using permissive Row Level Security (RLS) policies.

## 2. PRODUCTION DATABASE INVENTORY
The production database consists of the following core tables:
- `users`, `user_profiles`, `trainers`, `trainer_applications` (User Management)
- `bookings`, `slot_reservations`, `workouts`, `trainer_workout_assignments` (Scheduling & Workouts)
- `addresses`, `trainer_earnings`, `credit_transactions`, `calorie_logs`, `hydration_logs` (User Data & Wallet)
- `notifications`, `push_delivery_logs`, `chat_messages`, `device_tokens` (Communications)

## 3. PHASE 1 AUDIT vs PRODUCTION SCHEMA
- **Schema matches Audit:** Yes, the tables match the Phase 1 audit closely.
- **Client Overreach:** The Phase 1 audit correctly identified client-side caches manipulating state, which is verified in the source code (e.g. `creditsBalance` in `walletStore.ts`, `timelineStatus` in `sessionEngine.ts`).
- **RLS Permissiveness:** The actual production schema shows RLS is enabled, but many policies still rely on client-provided data without strict backend validation, or use `USING (true) WITH CHECK (true)` for simulation tables.

## 4. TABLE-BY-TABLE ANALYSIS
- **`bookings`**: Stores session state (`status`, `timeline_status`, `otp`). Controlled by `validate_booking_transition` trigger. Client stores also directly update this using `Database.updateTimelineStatus(id, status)`.
- **`user_profiles`**: Stores `credits_balance`. Manipulated by `walletStore.ts` on the client (e.g. `profile.creditsBalance -= 1`) and synced via permissive database updates, allowing the client to dictate the balance.
- **`slot_reservations`**: Handles temporary locks.
- **`notifications`**: Pushes are triggered by DB inserts, but clients also locally push to this.
- **`trainer_applications`**: Approved via `approve_trainer_application` RPC.

## 5. FUNCTION-BY-FUNCTION ANALYSIS
- **`process_pending_acceptance_bookings()`**: Escalates unaccepted bookings. Auto-accepts at 10 minutes, sends reminders at 5 minutes.
- **`validate_booking_transition()`**: Enforces timeline rules (e.g., travel window opens 25 minutes prior).
- **`on_booking_status_updated()`**: Creates push notifications based on state changes.
- **`verify_and_start_session()`**: Validates OTP and sets `otp_verified`.
- **`expire_stale_bookings()`**: Clears sessions missed by 30 minutes.
- **`parse_booking_start_time()`**: String parsing for timestamps with hardcoded 5.5 hour offset.

## 6. TRIGGER ANALYSIS
- **`a_validate_booking_transition`**: Protects booking state transitions.
- **`trg_booking_status_updated`**: Fires notifications.
- **`trg_notification_inserted`**: Calls Expo push API.

## 7. RLS ANALYSIS
- RLS is enabled on all core tables.
- **Vulnerability**: Several policies use `USING (true) WITH CHECK (true)` (e.g., `workouts`, `trainers`, `trainer_workout_assignments`).
- Policies for `bookings` restrict based on `client_id` and `trainer_id`, but the client is trusted to submit valid transition data.
- The `user_profiles` table allows self-updating, which is how `walletStore.ts` forces credit deductions directly.

## 8. BOOKING STATE MACHINE AS IT EXISTS TODAY
1. **booked**: Request created.
2. **trainer_assigned**: System finds trainer.
3. **trainer_accepted**: Manual acceptance within 10m, or Auto-accepted.
4. **trainer_preparing**: Trainer confirms preparation.
5. **trainer_travelling**: Opens 25m before start.
6. **trainer_arrived**: Trainer is on location.
7. **otp_verified**: OTP matched.
8. **workout_started**: Session running.
9. **workout_completed**: Session finished.
10. **trainer_report_submitted**: Review phase.
11. **customer_review_pending**: Customer rating.
12. **session_closed**: Lifecycle complete.

## 9. ACCEPTANCE / AUTO-ACCEPTANCE ANALYSIS
- **Intended Rule**: New Request -> Long/alarm -> 5m second notification -> 5m third notification -> Auto-accept -> Admin dashboard visible.
- **Actual Production Behavior**: 
  - `process_pending_acceptance_bookings()` checks for `created_at + 10 * 60 * 1000`.
  - It sets `acceptance_method = 'auto'` and `auto_accepted_at`.
  - Sends 3 notifications: Client (confirmed), Trainer (auto-accepted warning), Admin (auto-accepted operational alert).
  - Reminder is sent at 5 minutes (`acceptance_notification_count = 1`).
  - No 10-minute third warning is sent *before* auto-acceptance. The third notification *is* the auto-acceptance.

## 10. SLOT AVAILABILITY ANALYSIS
- Client-side filtering in `AssignmentEngine.ts` and `index.tsx`.
- Client logic excludes `completed`, `workout_completed`, `session_closed`, and `cancelled`.
- DB enforces `unique_active_trainer_slot` and `unique_trainer_slot_reservation`.

## 11. NOTIFICATION / ESCALATION ANALYSIS
- Server-side `on_notification_inserted` correctly handles push delivery.
- However, the client (`membershipStore.ts`, etc.) locally generates notification payloads without DB enforcement (e.g., "You only have X credits left").

## 12. SESSION LIFECYCLE ANALYSIS
- `SessionEngine.ts` locally manages transitions (`trainer_arrived`, `otp_verified`, `workout_started`).
- Local transitions are optimistically saved and then pushed to DB.

## 13. TIME / TIMEZONE ANALYSIS
- `parse_booking_start_time` relies on regex parsing `Today, Aug 20` strings and subtracts a hardcoded `5 hours 30 minutes`.
- Client and DB dual-calculate NTP vs UTC, leading to desyncs.

## 14. DUPLICATE SOURCES OF TRUTH
- **Wallet/Credits**: Client `walletStore.ts` and `Database.ts` deduct credits (`profile.creditsBalance -= 1`) manually instead of using atomic DB RPCs.
- **Timeline Status**: `bookingStore.ts` holds `timelineStatus` in memory and pushes updates, bypassing strict server authority.

## 15. RACE CONDITIONS / FAILURE MODES
- **Credit Double Spend**: If network fails after client deducts `creditsBalance` in memory, or if two clients book simultaneously, the permissive RLS allows overwriting the balance.
- **Clock Skew**: Client clock skew allows bypassing the 25-minute travel window if local validation is used.

## 16. DATA INTEGRITY GAPS
- Hardcoded `5 hours 30 minutes` timezone offset breaks if DST or timezone changes.
- String date matching (`Today, `) is fragile.

## 17. ONE BRAIN TARGET ARCHITECTURE REQUIREMENTS
- The server (Supabase) must be the ONLY authoritative source of truth.
- The client must never calculate `creditsBalance`. It must call an RPC `deduct_credit(booking_id)`.
- Client must never dictate `timeline_status`. It must call RPCs like `start_travel(booking_id)`.

## 18. PROPOSED AUTHORITATIVE STATE MACHINES
- Transition rules must be strictly enforced via RPCs that atomically verify preconditions (time, role, balance) and execute changes, instead of allowing RLS updates to raw tables.

## 19. REQUIRED DATABASE CHANGES — PLANNING ONLY
- Add RPCs for all booking transitions.
- Add RPC for credit deduction and addition.
- Convert date/time string formats to actual `timestamptz`.
- Remove permissive RLS policies on simulated tables.

## 20. REQUIRED APPLICATION CHANGES — PLANNING ONLY
- Refactor `walletStore.ts`, `membershipStore.ts`, and `bookingStore.ts` to be read-only proxies.
- Remove all client-side state mutations for DB entities.
- Adopt Supabase Realtime subscriptions to sync state natively.

## 21. MIGRATION RISKS
- Modifying date strings to `timestamptz` will require careful backfilling.
- Breaking the dual-brain cache will temporarily disrupt offline support.

## 22. OPEN QUESTIONS / UNKNOWN AREAS
- How should offline caching be handled if the client is fully read-only?

## 23. PHASE 2 PRECONDITIONS
- Phase 2 is SAFE TO BEGIN. We have fully documented the production discrepancies, pinpointed the dual sources of truth, and verified the architectural vulnerabilities.
