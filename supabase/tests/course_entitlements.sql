-- Runs against a database with an existing student. All fixture writes roll back.
begin;
do $$
declare
  student_id uuid;
  target_batch uuid := gen_random_uuid();
  other_batch_id uuid := gen_random_uuid();
  pay_id uuid := gen_random_uuid();
begin
  select id into student_id from public.profiles where role = 'student' limit 1;
  if student_id is null then raise exception 'A student fixture is required'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('role','service_role','sub',student_id)::text,true);
  insert into public.batches(id,title,price,discount_price,is_paid,is_free) values
    (target_batch,'Entitlement test',1000,1000,true,false),
    (other_batch_id,'Other entitlement test',1000,1000,true,false);
  if public.has_active_batch_access(student_id,target_batch) then raise exception 'Access without enrollment'; end if;
  insert into public.enrollments(user_id,batch_id,access_type,status) values(student_id,target_batch,'free','active');
  if public.has_active_batch_access(student_id,target_batch) then raise exception 'Free label bypassed paid access'; end if;
  insert into public.payments(id,user_id,batch_id,amount,amount_paise,gateway_mode,status,razorpay_order_id,razorpay_payment_id)
    values(pay_id,student_id,target_batch,1000,100000,'test','pending','order_'||replace(pay_id::text,'-',''),'pay_'||replace(pay_id::text,'-',''));
  begin
    insert into public.payments(user_id,batch_id,amount,amount_paise,gateway_mode,status)
      values(student_id,target_batch,1000,100000,'test','pending');
    raise exception 'Duplicate pending purchase was allowed';
  exception when unique_violation then null;
  end;
  update public.enrollments set payment_id=pay_id,access_type='paid' where user_id=student_id and batch_id=target_batch;
  if public.has_active_batch_access(student_id,target_batch) then raise exception 'Pending payment granted access'; end if;
  update public.payments set status='success' where id=pay_id;
  if public.has_active_batch_access(student_id,target_batch) then raise exception 'Unverified success granted access'; end if;
  update public.payments set verified_at=now(),batch_id=other_batch_id where id=pay_id;
  if public.has_active_batch_access(student_id,target_batch) then raise exception 'Wrong batch payment granted access'; end if;
  update public.payments set batch_id=target_batch where id=pay_id;
  if not public.has_active_batch_access(student_id,target_batch) then raise exception 'Verified entitlement denied'; end if;
  update public.payments set verified_at=null,status='failed' where id=pay_id;
  perform public.finalize_razorpay_payment(pay_id,'pay_'||replace(pay_id::text,'-',''),'test_signature',null);
  perform public.finalize_razorpay_payment(pay_id,'pay_'||replace(pay_id::text,'-',''),'test_signature',null);
  if not public.has_active_batch_access(student_id,target_batch) then raise exception 'Finalizer did not establish verification'; end if;
  if (select count(*) from public.enrollments where user_id=student_id and batch_id=target_batch) <> 1 then
    raise exception 'Duplicate finalization duplicated enrollment';
  end if;
  delete from public.enrollments where user_id=student_id and batch_id=target_batch;
  perform public.finalize_razorpay_payment(pay_id,'pay_'||replace(pay_id::text,'-',''),'test_signature',null);
  if not public.has_active_batch_access(student_id,target_batch) then raise exception 'Missing enrollment repair failed'; end if;
  update public.enrollments set status='cancelled' where user_id=student_id and batch_id=target_batch;
  if public.has_active_batch_access(student_id,target_batch) then raise exception 'Inactive enrollment granted access'; end if;
  update public.enrollments set status='active' where user_id=student_id and batch_id=target_batch;
  insert into public.lectures(batch_id,title) values(target_batch,'Protected fixture');
  perform set_config('test.batch_id',target_batch::text,true);
  perform set_config('test.student_id',student_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',student_id)::text,true);
end;
$$;
set local role authenticated;
do $$
begin
  if (select count(*) from public.lectures where batch_id=current_setting('test.batch_id')::uuid) <> 1 then
    raise exception 'RLS denied entitled student';
  end if;
  begin
    update public.profiles set role='admin' where id=current_setting('test.student_id')::uuid;
    raise exception 'Role escalation was allowed';
  exception when insufficient_privilege then null;
  end;
  if has_function_privilege(current_user,'public.finalize_razorpay_payment(uuid,text,text,text)','EXECUTE') then
    raise exception 'Client can finalize payment';
  end if;
end;
$$;
reset role;
update public.payments set verified_at=null where batch_id=current_setting('test.batch_id')::uuid;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.lectures where batch_id=current_setting('test.batch_id')::uuid) then
    raise exception 'RLS leaked unpaid course';
  end if;
end; $$;
reset role;
rollback;
select 'PASS: entitlement checks, direct RLS, role protection, RPC permissions; fixtures rolled back' as result;
