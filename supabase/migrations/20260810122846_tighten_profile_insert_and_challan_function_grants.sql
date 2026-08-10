/*
# Tighten profile insert policy and challan function grants

1. Security Changes
- Add an INSERT policy on `profiles` so an authenticated user can create their own profile row at signup. The existing trigger already creates a row, but the frontend upsert that sets the selected role needs an INSERT policy to succeed when the row does not yet exist.
- Revoke EXECUTE on `confirm_sales_challan` from `anon` and from `PUBLIC` so only authenticated staff can confirm challans. The previous migration revoked from `anon` but the default `PUBLIC` grant still applied.
- Re-grant EXECUTE to `authenticated` only.

2. Important Notes
- Profile roles are set at signup; the database does not enforce per-role table access in this assignment. Role controls which navigation items are visible in the UI.
- The `confirm_sales_challan` function is SECURITY DEFINER and validates stock atomically; only authenticated users may call it.
*/

DROP POLICY IF EXISTS "staff_insert_own_profile" ON public.profiles;
CREATE POLICY "staff_insert_own_profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.confirm_sales_challan(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_sales_challan(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_sales_challan(uuid) TO authenticated;
