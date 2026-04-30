-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.students (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    usn TEXT UNIQUE NOT NULL,
    admission_number TEXT,
    email TEXT,
    branch_code TEXT NOT NULL,
    batch TEXT DEFAULT '2024-2028',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sessions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    topic TEXT NOT NULL,
    month_number INTEGER NOT NULL,
    duration_hours DECIMAL(3,1) DEFAULT 2.0,
    session_type TEXT DEFAULT 'offline',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.import_log (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL,
    skipped_rows INTEGER NOT NULL,
    warnings TEXT,
    column_mapping TEXT,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    present BOOLEAN NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    marked_by TEXT DEFAULT 'system',
    import_id INTEGER REFERENCES public.import_log(id) ON DELETE SET NULL,
    UNIQUE(student_id, session_id)
);

CREATE TABLE IF NOT EXISTS public.materials (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('mentor', 'student')),
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. TRIGGERS & VALIDATION
-- ==========================================

-- Trigger to validate attendance dates
CREATE OR REPLACE FUNCTION public.check_attendance_date()
RETURNS trigger AS $$
DECLARE
    session_date DATE;
BEGIN
    SELECT date INTO session_date FROM public.sessions WHERE id = NEW.session_id;
    
    IF session_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Attendance date cannot be in the future';
    END IF;
    
    IF session_date < '2025-08-04'::DATE THEN
        RAISE EXCEPTION 'Attendance date cannot be before 2025-08-04';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_attendance_date
    BEFORE INSERT OR UPDATE ON public.attendance
    FOR EACH ROW EXECUTE PROCEDURE public.check_attendance_date();

-- Trigger to auto-create auth.users and public.users on student creation
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger AS $$
DECLARE
  new_user_id uuid;
BEGIN
  new_user_id := gen_random_uuid();
  
  -- Insert into auth.users (creating the Supabase login)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud,
    confirmation_token
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    LOWER(NEW.usn) || '@forge.local',
    crypt(NEW.usn, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('role', 'student', 'student_id', NEW.id, 'display_name', NEW.name),
    now(),
    now(),
    'authenticated',
    'authenticated',
    ''
  );

  -- Insert into public.users
  INSERT INTO public.users (id, email, role, student_id, display_name)
  VALUES (new_user_id, LOWER(NEW.usn) || '@forge.local', 'student', NEW.id, NEW.name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_student_created
  AFTER INSERT ON public.students
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_student();

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helper functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.is_mentor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'mentor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'student');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_student_id()
RETURNS INTEGER AS $$
DECLARE
  sid INTEGER;
BEGIN
  SELECT student_id INTO sid FROM public.users WHERE id = auth.uid();
  RETURN sid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users policies
CREATE POLICY "Users read own" ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Mentors read all users" ON public.users FOR SELECT USING (public.is_mentor());

-- Students policies
CREATE POLICY "Mentors full students" ON public.students FOR ALL USING (public.is_mentor());
CREATE POLICY "Students read own row" ON public.students FOR SELECT USING (id = public.get_my_student_id());

-- Sessions policies
CREATE POLICY "Mentors full sessions" ON public.sessions FOR ALL USING (public.is_mentor());
CREATE POLICY "Students read sessions" ON public.sessions FOR SELECT USING (public.is_student());

-- Materials policies
CREATE POLICY "Mentors full materials" ON public.materials FOR ALL USING (public.is_mentor());
CREATE POLICY "Students read materials" ON public.materials FOR SELECT USING (public.is_student());

-- Attendance policies
CREATE POLICY "Mentors full attendance" ON public.attendance FOR ALL USING (public.is_mentor());
CREATE POLICY "Students read own attendance" ON public.attendance FOR SELECT USING (student_id = public.get_my_student_id());

-- Import_log policies
CREATE POLICY "Mentors full import_log" ON public.import_log FOR ALL USING (public.is_mentor());
