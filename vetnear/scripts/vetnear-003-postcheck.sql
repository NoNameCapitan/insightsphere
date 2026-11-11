-- VetNear 1.26.1 — перевірка ПІСЛЯ 003_security_hardening.sql.
-- Виконувати власником БД у staging, потім production.
-- psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f vetnear-003-postcheck.sql
-- Не застосовує міграцію. Каталоги читаються; тестові записи нижче відкочуються.
-- Перевірено статично за архівом; на реальному PostgreSQL у цьому аудиті НЕ запускалося.

BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

SELECT current_database(), current_user, current_setting('TimeZone') AS timezone,
       version();

-- Очікування: шість таблиць, rls_enabled=true, policies=0.
SELECT c.relname, c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('partner_submissions','moderation_events','place_reports',
  'published_places','place_lead_events','moderator_tokens')
ORDER BY c.relname;

-- Ефективні привілеї (включно з PUBLIC / успадкуванням): усі false.
SELECT r.role_name, t.table_name, p.privilege,
       has_table_privilege(r.role_name, 'public.'||t.table_name, p.privilege) AS allowed
FROM (VALUES ('anon'),('authenticated')) r(role_name)
CROSS JOIN (VALUES ('partner_submissions'),('moderation_events'),('place_reports'),
                   ('published_places'),('place_lead_events'),('moderator_tokens')) t(table_name)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),
                   ('REFERENCES'),('TRIGGER')) p(privilege)
ORDER BY 1,2,3;

-- Очікування: чотири CHECK, convalidated=true. Перевірити також сам вираз.
SELECT conrelid::regclass AS table_name, conname, convalidated,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace='public'::regnamespace AND conname IN
 ('place_reports_sizes','place_lead_events_sizes',
  'partner_submissions_data_size','published_places_promo_bounded')
ORDER BY conname;

-- Очікування: UNIQUE, valid/ready; UTC-дата; WHERE session_hash IS NOT NULL.
SELECT i.indisunique, i.indisvalid, i.indisready,
       pg_get_indexdef(i.indexrelid) AS definition
FROM pg_index i
WHERE i.indexrelid=to_regclass('public.place_lead_events_dedupe_idx');

-- Очікування: один активний BEFORE UPDATE OR DELETE FOR EACH ROW.
SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE t.tgrelid='public.moderation_events'::regclass AND NOT t.tgisinternal;

-- Очікування: purge SECURITY INVOKER (prosecdef=false), DELETE старше 13 місяців.
SELECT p.oid::regprocedure AS function_name,
       pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.oid IN ('public.purge_old_lead_events()'::regprocedure,
               'public.moderation_events_immutable()'::regprocedure);

SELECT r.role_name,
       has_function_privilege(r.role_name,'public.purge_old_lead_events()','EXECUTE') AS may_purge
FROM (VALUES ('anon'),('authenticated')) r(role_name);

-- Зупиняє файл, якщо основні інваріанти порушені.
DO $$
DECLARE r text; t text; priv text; bad boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['partner_submissions','moderation_events','place_reports',
                           'published_places','place_lead_events','moderator_tokens'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||t)
                   AND relrowsecurity) THEN
      RAISE EXCEPTION 'RLS missing: %',t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('public.'||t)) THEN
      RAISE EXCEPTION 'Unexpected RLS policy: %',t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(r,'public.'||t,priv) THEN
          RAISE EXCEPTION 'Unexpected privilege: % % %',r,t,priv;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM pg_constraint
      WHERE convalidated AND (conrelid,conname) IN
       (('public.place_reports'::regclass,'place_reports_sizes'),
        ('public.place_lead_events'::regclass,'place_lead_events_sizes'),
        ('public.partner_submissions'::regclass,'partner_submissions_data_size'),
        ('public.published_places'::regclass,'published_places_promo_bounded'))) <> 4 THEN
    RAISE EXCEPTION 'Missing or unvalidated CHECK';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index
    WHERE indexrelid=to_regclass('public.place_lead_events_dedupe_idx')
      AND indisunique AND indisvalid AND indisready) THEN
    RAISE EXCEPTION 'Missing/invalid unique dedupe index';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.moderation_events'::regclass
      AND tgname='moderation_events_no_mutation' AND tgenabled='O'
      AND (tgtype::int & 1)=1 AND (tgtype::int & 2)=2
      AND (tgtype::int & 8)=8 AND (tgtype::int & 16)=16) THEN
    RAISE EXCEPTION 'Missing enabled row BEFORE UPDATE+DELETE trigger';
  END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_function_privilege(r,'public.purge_old_lead_events()','EXECUTE') THEN
      RAISE EXCEPTION 'Public role can execute purge: %',r;
    END IF;
  END LOOP;
END $$;
ROLLBACK;

-- Поведінкові перевірки саме service_role, не лише читання SQL-тексту.
-- Створюють лише тимчасові за життєвим циклом тестові рядки в звичайних таблицях.
-- ROLLBACK прибирає все; не робіть COMMIT цієї секції.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL ROLE service_role;
SET LOCAL TIME ZONE 'Pacific/Honolulu';
DO $$
DECLARE
  s text := 'smoke_'||substr(md5(random()::text||clock_timestamp()::text),1,20);
  payload jsonb;
BEGIN
  INSERT INTO partner_submissions(id,category,district,name,data)
    VALUES (s,'veterinary_clinic','podilskyi','SMOKE — rollback only','{}');
  INSERT INTO moderation_events(id,submission_id,action,actor_role,actor_id)
    VALUES (s,s,'approved','moderator','smoke-postcheck');

  BEGIN
    UPDATE moderation_events SET reason='must fail' WHERE id=s;
    RAISE EXCEPTION 'FAIL: moderation UPDATE allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'moderation_events is append-only' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM moderation_events WHERE id=s;
    RAISE EXCEPTION 'FAIL: moderation DELETE allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'moderation_events is append-only' THEN RAISE; END IF;
  END;
  -- ON DELETE CASCADE теж має впертися в append-only trigger.
  BEGIN
    DELETE FROM partner_submissions WHERE id=s;
    RAISE EXCEPTION 'FAIL: parent deletion erased audit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'moderation_events is append-only' THEN RAISE; END IF;
  END;

  -- Очікування: CHECK violation (23514), а не успішний INSERT.
  BEGIN
    INSERT INTO place_reports(id,place_id,reason,message)
      VALUES (s||'_r',s,'other',repeat('x',1001));
    RAISE EXCEPTION 'FAIL: report message >1000 accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO place_reports(id,place_id,reason)
      VALUES (s||'_r2',repeat('x',121),'other');
    RAISE EXCEPTION 'FAIL: report place_id >120 accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO place_lead_events(id,place_id,event_type,source_path)
      VALUES (s||'_l',s,'call','/'||repeat('x',120));
    RAISE EXCEPTION 'FAIL: source_path >120 accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO place_lead_events(id,place_id,event_type)
      VALUES (s||'_l2',repeat('x',81),'call');
    RAISE EXCEPTION 'FAIL: lead place_id >80 accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  SELECT jsonb_build_object('blob',string_agg(md5(g::text),'')) INTO payload
    FROM generate_series(1,3000) g;
  IF pg_column_size(payload) <= 65536 THEN RAISE EXCEPTION 'Bad size fixture'; END IF;
  BEGIN
    INSERT INTO partner_submissions(id,category,district,name,data)
      VALUES (s||'_big','veterinary_clinic','podilskyi','SMOKE',payload);
    RAISE EXCEPTION 'FAIL: oversized submission accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO published_places(id,slug,data,tier,promoted_until)
      VALUES (s||'_p',s||'_p','{}','promoted',NULL);
    RAISE EXCEPTION 'FAIL: unbounded promotion accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- Один UTC-день: 00:30 і 23:30 мають конфліктувати попри інший session TZ.
  INSERT INTO place_lead_events(id,place_id,event_type,session_hash,created_at)
    VALUES (s||'_d1',s,'call',s,'2000-01-01 00:30:00+00');
  BEGIN
    INSERT INTO place_lead_events(id,place_id,event_type,session_hash,created_at)
      VALUES (s||'_d2',s,'call',s,'2000-01-01 23:30:00+00');
    RAISE EXCEPTION 'FAIL: UTC-day duplicate accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  -- Наступний UTC-день допускається.
  INSERT INTO place_lead_events(id,place_id,event_type,session_hash,created_at)
    VALUES (s||'_d3',s,'call',s,'2000-01-02 00:01:00+00');
  -- Частковий індекс не дедуплікує NULL session_hash.
  INSERT INTO place_lead_events(id,place_id,event_type,created_at)
    VALUES (s||'_n1',s,'call','2000-01-01 00:30:00+00'),
           (s||'_n2',s,'call','2000-01-01 00:30:00+00');
  RAISE NOTICE 'PASS: service_role audit immutability, CHECKs and UTC dedupe';
END $$;
ROLLBACK;

-- Purge тут навмисно НЕ запускається: навіть з ROLLBACK він може заблокувати
-- багато production-рядків. Тест retention з фікстурами — лише staging (runbook).
