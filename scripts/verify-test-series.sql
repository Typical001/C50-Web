begin;
do $$
declare u uuid; v uuid; a uuid; f uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); pay uuid:=gen_random_uuid(); n int;
begin
 select id into u from public.profiles where role='student' limit 1;
 select id into v from public.profiles where role='student' and id<>u limit 1;
 select id into a from public.profiles where role='admin' limit 1;
 if u is null or v is null or a is null then raise exception 'Test identities unavailable'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','service_role')::text,true);
 insert into public.batches(id,title,is_active,is_free,is_paid,price,discount_price,payment_enabled,tags) values
 (f,'Rollback test series free',true,true,false,0,0,false,'["Test Series"]'),
 (p,'Rollback test series paid',true,false,true,100,null,true,'["Test Series"]');
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 begin
 insert into public.enrollments(user_id,batch_id,access_type,status) values(u,f,'free','active');
 raise exception 'ASSERT direct enrollment unexpectedly allowed';
 exception when others then if SQLERRM like 'ASSERT%' then raise; end if; end;
 execute 'reset role';
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','service_role')::text,true);
 insert into public.enrollments(user_id,batch_id,access_type,status) values(u,f,'free','active');
 insert into public.payments(id,user_id,batch_id,amount,amount_paise,currency,gateway_mode,razorpay_order_id)
 values(pay,u,p,100,10000,'INR','test','order_'||replace(pay::text,'-',''));
 update public.batches set catalog_visible=false where id in (f,p);
 if not public.has_active_batch_access(u,f) then raise exception 'Archived free access lost'; end if;
 begin
  insert into public.enrollments(user_id,batch_id,access_type,status) values(v,f,'free','active');
  raise exception 'ASSERT free enrollment unexpectedly allowed';
 exception when others then if SQLERRM like 'ASSERT%' then raise; end if; end;
 begin
  insert into public.payments(user_id,batch_id,amount) values(v,p,100);
  raise exception 'ASSERT hidden paid order unexpectedly allowed';
 exception when others then if SQLERRM like 'ASSERT%' then raise; end if; end;
 perform public.finalize_razorpay_payment(pay,'pay_'||replace(pay::text,'-',''),null,null);
 perform public.finalize_razorpay_payment(pay,'pay_'||replace(pay::text,'-',''),null,null);
 select count(*) into n from public.enrollments where user_id=u and batch_id=p;
 if n<>1 or not public.has_active_batch_access(u,p) then raise exception 'Delayed/duplicate capture failed'; end if;
 begin
  delete from public.batches where id=f;
  raise exception 'ASSERT series deletion allowed';
 exception when others then if SQLERRM like 'ASSERT%' then raise; end if; end;
 begin
  update public.batches set is_paid=true,is_free=false,price=100 where id=f;
  raise exception 'ASSERT access type change allowed';
 exception when others then if SQLERRM like 'ASSERT%' then raise; end if; end;
 perform set_config('request.jwt.claims',json_build_object('sub',v,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.batches where id in(f,p);
 if n<>0 then raise exception 'Hidden rows visible to unrelated student'; end if;
 begin
  insert into public.batches(title,is_free,is_paid,price,tags) values('Forbidden',true,false,0,'["Test Series"]');
  raise exception 'ASSERT student catalog write allowed';
 exception when others then if SQLERRM like 'ASSERT%' then raise; end if; end;
 execute 'reset role';
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.batches where id in(f,p);
 if n<>2 then raise exception 'Owned archived rows unavailable'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 update public.batches set catalog_visible=true where id=f;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Admin republish denied'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 execute 'set local role anon';
 select count(*) into n from public.batches where id=p;
 if n<>0 then raise exception 'Anonymous hidden read allowed'; end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: rollback-only catalog, enrollment, delayed/duplicate finalization, student/admin/anonymous authorization checks' as result;
