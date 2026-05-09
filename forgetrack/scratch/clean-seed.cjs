const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function cleanAndSeed() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log('Cleaning up...');
    // Delete from public.users first (cascade might handle it but let's be explicit)
    await client.query('DELETE FROM public.users');
    await client.query('DELETE FROM public.students');
    // Delete from auth.users (this should cascade to identities)
    await client.query('DELETE FROM auth.users');
    console.log('Cleanup done.');

    // Now re-seed using the logic from run-migrations.cjs
    // I'll just run chunk 1 of run-migrations.cjs but fixed
    console.log('Re-seeding mentors...');
    await client.query(`
      DO $$
      DECLARE
        mentor_id1 uuid := gen_random_uuid();
        mentor_id2 uuid := gen_random_uuid();
      BEGIN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, raw_user_meta_data, created_at, updated_at) 
        VALUES (mentor_id1, '00000000-0000-0000-0000-000000000000', 'nischay@theboringpeople.in', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"role":"mentor","display_name":"Nischay B K"}', now(), now());

        INSERT INTO public.users (id, email, role, display_name) 
        VALUES (mentor_id1, 'nischay@theboringpeople.in', 'mentor', 'Nischay B K');

        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, raw_user_meta_data, created_at, updated_at) 
        VALUES (mentor_id2, '00000000-0000-0000-0000-000000000000', 'varun@theboringpeople.in', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"role":"mentor","display_name":"Varun"}', now(), now());

        INSERT INTO public.users (id, email, role, display_name) 
        VALUES (mentor_id2, 'varun@theboringpeople.in', 'mentor', 'Varun');
      END $$;
    `);
    
    // Also need identities
    console.log('Fixing identities...');
    await client.query(`
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
      SELECT gen_random_uuid(), id, id::text, jsonb_build_object('sub', id, 'email', email), 'email', created_at, updated_at
      FROM auth.users
    `);

    console.log('Re-seeding done.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
cleanAndSeed();
