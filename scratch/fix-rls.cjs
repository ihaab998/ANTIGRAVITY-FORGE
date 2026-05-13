const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    await client.query(`
      DROP POLICY IF EXISTS "Mentors full students" ON public.students;
      CREATE POLICY "Mentors full students" ON public.students FOR ALL USING (public.is_mentor()) WITH CHECK (public.is_mentor());

      DROP POLICY IF EXISTS "Mentors full sessions" ON public.sessions;
      CREATE POLICY "Mentors full sessions" ON public.sessions FOR ALL USING (public.is_mentor()) WITH CHECK (public.is_mentor());

      DROP POLICY IF EXISTS "Mentors full materials" ON public.materials;
      CREATE POLICY "Mentors full materials" ON public.materials FOR ALL USING (public.is_mentor()) WITH CHECK (public.is_mentor());

      DROP POLICY IF EXISTS "Mentors full attendance" ON public.attendance;
      CREATE POLICY "Mentors full attendance" ON public.attendance FOR ALL USING (public.is_mentor()) WITH CHECK (public.is_mentor());

      DROP POLICY IF EXISTS "Mentors full import_log" ON public.import_log;
      CREATE POLICY "Mentors full import_log" ON public.import_log FOR ALL USING (public.is_mentor()) WITH CHECK (public.is_mentor());
    `);
    
    console.log('Successfully updated RLS policies to include WITH CHECK clauses.');

  } catch (err) {
    console.error('Database execution error:', err);
  } finally {
    await client.end();
  }
}

run();
