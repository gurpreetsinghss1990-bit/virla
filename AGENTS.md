# VIRLA ENGINEERING GUARDRAILS

## Expo
Read the exact versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# PROFILE + WALLET + BOOKING PRE-ACCEPTANCE ARE FROZEN

The following areas are fully tested/stable and are now LOCKED/FROZEN.

## 1. PROFILE — LOCKED
- Profile loading/hydration
- Profile editing/saving
- Profile persistence
- Profile navigation
- users profile fields
- user_profiles profile fields
- Gender and all other profile attributes

## 2. WALLET / CREDITS / RECHARGE — LOCKED
- Wallet balance
- Wallet recharge
- credits_balance
- Credit persistence
- Credit transactions
- Wallet loading/hydration
- Wallet navigation
- Wallet UI

## 3. TRAINER AVAILABILITY / SLOTS — LOCKED
- Trainer availability
- Slot generation
- Enable/Disable slot
- Enable/Disable workout availability
- Availability persistence
- Client visibility of enabled slots
- Slot reservation/conflict behavior

## 4. BOOKING CREATION — LOCKED
- Client sees only trainer slots that are enabled and bookable
- Booking creation from an enabled slot
- Slot reservation and conflict protection
- Credit validation/deduction behavior
- Client preparation note / additional note capture
- Booking persistence
- Booking notification to trainer

## 5. EVERYTHING FROM BOOKING CREATION UNTIL TRAINER ACCEPTS — HARD LOCK
This is the newly expanded hard-freeze boundary.

Until the trainer has manually accepted the booking OR the existing approved backend auto-acceptance mechanism has transitioned it to accepted, DO NOT MODIFY any part of the following lifecycle:

- Trainer's incoming/new booking request
- Booking request card
- Booking request countdowns
- Three 10-minute acceptance countdown phases
- Acceptance notification/beep behavior
- Trainer booking detail screen
- Session Overview
- Client Reference
- Client gender display/data source
- Workout type/date/time/duration display
- Session type / solo-couple display
- Approximate location display/privacy behavior
- Credit display for the booking
- Client preparation note
- Client assessment display
- Trainer Accept Request / Accept Booking action
- Trainer accept confirmation flow
- Manual trainer acceptance RPC/state transition
- Existing 30-minute backend auto-acceptance fallback
- Auto-accepted state
- Trainer acknowledgement requirement after auto-acceptance
- Client acceptance notification/state update
- Admin operational follow-up for auto-accepted but unacknowledged bookings
- Booking matching/assignment behavior
- Trainer notification behavior
- Client visibility of booking state before acceptance
- Communication/profile privacy lock before acceptance
- Any database functions/RPCs that directly support the above pre-acceptance lifecycle

### CRITICAL RULE
**DO NOT TOUCH ANY CODE IN THE PRE-ACCEPTANCE LIFECYCLE ABOVE.**

Do not refactor it.
Do not rename it.
Do not optimize it.
Do not “clean it up.”
Do not change database schema related to it.
Do not change UI behavior related to it.
Do not change timing.
Do not change state names.
Do not change notification behavior.
Do not change acceptance logic.
Do not change matching logic.

Even if a future feature appears to have a dependency on this area, STOP before making any change and report the dependency.

## 6. SESSION / TRAVEL TIMING — LOCKED
The already-tested session lifecycle and travel-window behavior are frozen, including the configured 25-minute travel unlock behavior and existing timers. Do not alter them as part of unrelated work.

# AUTHORIZATION GATE

Anti-Gravity must treat all modules above as protected.

If a requested change would touch any protected module, Anti-Gravity MUST STOP and produce a prior-change assessment before editing anything:
1. Exact files to change.
2. Exact functions/components to change.
3. Why the change is necessary.
4. Current behavior.
5. Proposed behavior.
6. Database/schema/RPC impact.
7. Profile impact.
8. Wallet/credit impact.
9. Trainer availability/slot impact.
10. Booking creation impact.
11. Pre-acceptance lifecycle impact.
12. Timer/travel impact.
13. Regression risks.
14. Tests to run.
15. Rollback plan.

No code change is permitted until the owner explicitly authorizes it.

### PASSWORD / SECRET HANDLING
Do NOT store or commit the owner's authorization password in GitHub, source code, AGENTS.md, prompts, logs, or documentation. A plaintext password in repository files is not a secure access-control mechanism.

If an external coding agent supports an interactive authorization/password gate, require the owner to enter the secret interactively at the time authorization is granted. Otherwise, treat the explicit owner authorization message as the approval boundary.

# STABILIZATION CHECKPOINT — 2026-08-23

The system is currently considered STABLE through the point where the trainer can receive and accept a client booking request.

Tomorrow's work must resume from this exact checkpoint. Do not reopen or revisit frozen modules unless the owner explicitly authorizes a protected-module change after receiving the full prior-change assessment.

The next authorized development area is AFTER trainer acceptance, not before it.
