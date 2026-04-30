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

    // Fix auth.identities
    await client.query(`
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
      SELECT 
        gen_random_uuid(), 
        id, 
        id::text, 
        jsonb_build_object('sub', id, 'email', email), 
        'email', 
        created_at, 
        updated_at
      FROM auth.users
      WHERE id NOT IN (SELECT user_id FROM auth.identities)
    `);
    console.log('Fixed auth.identities.');

  } catch (err) {
    console.error('Database execution error:', err);
  } finally {
    await client.end();
  }
}

run();
