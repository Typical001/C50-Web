-- Supported clients use the authenticated Express enrollment endpoint.
-- Only server-owned insertion may run the locked visibility check.
create policy server_owned_enrollment_creation on public.enrollments
as restrictive for insert to authenticated with check (false);
