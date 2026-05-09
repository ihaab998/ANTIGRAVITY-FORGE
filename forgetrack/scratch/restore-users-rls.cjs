const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function restoreUsersPolicies() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log('Restoring users RLS...');
    await client.query('ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;');
    
    await client.query(`
      DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.users;
      CREATE POLICY "Public profiles are viewable by authenticated users" 
      ON public.users FOR SELECT TO authenticated USING (true);
    `);
    
    await client.query(`
      DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
      CREATE POLICY "Users can update own profile" 
      ON public.users FOR UPDATE TO authenticated 
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
    `);
    console.log('Done.');
  } catch(e) {
    console.log(e);
  } finally {
    await client.end();
  }
}
restoreUsersPolicies();
