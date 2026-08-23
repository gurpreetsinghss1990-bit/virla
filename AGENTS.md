# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# PROFILE + WALLET ARE FROZEN

Profile details and credit/wallet functionality have been fully tested and are working correctly.
From this point forward, DO NOT modify, refactor, rename, restructure, or otherwise touch any Profile or Wallet functionality for any new feature, bug fix, One Brain module, trainer module, booking module, membership module, or UI change.
This includes:
- Profile loading/hydration
- Profile editing/saving
- Profile persistence
- Profile navigation
- users profile fields
- user_profiles profile fields
- Wallet balance
- credits_balance
- Wallet loading/hydration
- Wallet navigation
- Credit persistence
- Credit transactions
- Wallet UI

Do not change these areas unless explicitly authorized via: “You are authorized to modify Profile/Wallet.”
If another feature appears to require a change to Profile or Wallet, STOP and report the dependency. Do not make the change automatically.
Profile + Wallet are now considered LOCKED/FROZEN.

# VIRLA — AUTHENTICATION MODULE LOCKED

The OTP/Login system and its associated flows are now permanently frozen. DO NOT modify, refactor, optimize, clean up, rename, or touch any code, environment configuration, database functions, or dependencies related to authentication.
This includes:
- OTP login
- Mobile number authentication
- MSG91 integration
- OTP request
- OTP verification
- OTP provider
- Authentication/session creation
- Auth state persistence
- Login navigation
- Mobile submit authentication
- OTP error handling
- Authentication-related Supabase functions
- Authentication environment/configuration

If a future task appears to require changing anything inside the locked OTP/Login module, STOP and ask for explicit authorization. Do not proceed until explicit approval is provided.

