-- Create server time function to act as authoritative NTP clock source
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamp with time zone AS $$
BEGIN
  RETURN now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to all users (authenticated and anonymous)
GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon, authenticated;
