-- ============================================================================
-- SECURITY HARDENING: Revoke Client Access to purchase_credits RPC
-- ============================================================================

-- 1. Public, Anon, aur Authenticated roles se execution rights cheeno
REVOKE EXECUTE ON FUNCTION public.purchase_credits(TEXT, INT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purchase_credits(TEXT, INT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.purchase_credits(TEXT, INT, TEXT) FROM authenticated;

-- 2. Sirf service_role (Edge Functions / Backend) aur Postgres admin ko allow karo
GRANT EXECUTE ON FUNCTION public.purchase_credits(TEXT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_credits(TEXT, INT, TEXT) TO postgres;

-- 3. Explicit Comment for Audit
COMMENT ON FUNCTION public.purchase_credits(TEXT, INT, TEXT) IS 
'CRITICAL SECURITY: Accessible only via service_role in Edge Functions post PayPhi server-side cryptographic verification.';
