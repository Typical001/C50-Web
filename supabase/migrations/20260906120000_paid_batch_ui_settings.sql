begin;
-- Reference IDs only; arbitrary embed HTML is never stored or executed by the CMS.
alter table public.batches add constraint batch_razorpay_button_id_format
  check (razorpay_payment_button_id is null or razorpay_payment_button_id ~ '^pl_[A-Za-z0-9]+$') not valid;

-- Isolated requested fixture. Do not modify the existing Aagaz batch or enable checkout.
insert into public.batches(id,title,description,instructor,price,discount_price,is_paid,is_free,is_active,
  category,custom_tag,payment_enabled,razorpay_payment_button_id)
values ('c5050000-1000-4000-8000-000000000005','Razorpay ₹1,000 Test — No Course Access',
  'Payment-button testing only. This button does not grant course access. Verify Test mode in Razorpay Dashboard before using.',
  'C50 Test Administration',1000,1000,true,false,false,'MPPSC','Payment Test',false,'pl_TYDEnuuLchDM7E')
on conflict(id) do nothing;
commit;
