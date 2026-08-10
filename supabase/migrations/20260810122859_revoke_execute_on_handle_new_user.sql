/*
# Revoke direct RPC access to the new-user trigger function

1. Security Changes
- Revoke EXECUTE on `public.handle_new_user()` from `PUBLIC`, `anon`, and `authenticated`.
- The function is a trigger fired by `on_auth_user_created` on `auth.users`; triggers run with the function's own privileges and do not require EXECUTE grants to fire. Revoking EXECUTE only closes the `/rest/v1/rpc/handle_new_user` endpoint so anonymous or signed-in callers cannot invoke it directly.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
