-- Run this ONCE in the Supabase SQL editor after running `prisma migrate dev`.
-- It creates a trigger that auto-inserts a public.users row whenever
-- a new user signs up via Supabase Auth.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter        INT := 0;
BEGIN
  -- Derive username from the email prefix, lowercase + only alphanumeric/_
  base_username  := lower(split_part(NEW.email, '@', 1));
  base_username  := regexp_replace(base_username, '[^a-z0-9_]', '_', 'g');

  -- Must start with a letter
  IF base_username !~ '^[a-z]' THEN
    base_username := 'user_' || base_username;
  END IF;

  final_username := base_username;

  -- Resolve uniqueness collisions
  WHILE EXISTS (SELECT 1 FROM public.users WHERE username = final_username) LOOP
    counter        := counter + 1;
    final_username := base_username || '_' || counter;
  END LOOP;

  INSERT INTO public.users (id, email, username, created_at, updated_at)
  VALUES (NEW.id, NEW.email, final_username, NOW(), NOW());

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
