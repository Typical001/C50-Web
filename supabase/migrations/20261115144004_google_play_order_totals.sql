-- Authoritative Google order totals, separate from Razorpay amount/paise fields.
alter table public.payments
  add column google_order_total numeric(20,9) check (google_order_total >= 0),
  add column google_order_currency text check (google_order_currency ~ '^[A-Z]{3}$'),
  add column google_order_state text check (google_order_state in ('PENDING','PROCESSED','CANCELED','PENDING_REFUND','PARTIALLY_REFUNDED','REFUNDED'));
