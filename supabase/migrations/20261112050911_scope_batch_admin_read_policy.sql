-- The admin predicate is executable only by authenticated users.
-- Keep anonymous catalog reads on their public visibility policy.
alter policy "Admins can view all batches" on public.batches to authenticated;
