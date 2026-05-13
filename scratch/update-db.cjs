const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function updateFunctions() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log('Updating functions...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.is_mentor()
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN (auth.jwt() -> 'user_metadata' ->> 'role') = 'mentor';
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

      CREATE OR REPLACE FUNCTION public.is_student()
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN (auth.jwt() -> 'user_metadata' ->> 'role') = 'student';
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

      CREATE OR REPLACE FUNCTION public.get_my_student_id()
      RETURNS INTEGER AS $$
      BEGIN
        RETURN (auth.jwt() -> 'user_metadata' ->> 'student_id')::INTEGER;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    `);
    console.log('Functions updated.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
updateFunctions();
