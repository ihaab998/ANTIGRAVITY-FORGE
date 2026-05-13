const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function fixSchema() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Remove the unique constraint on date
    await client.query('ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_date_key;');
    console.log('Constraint sessions_date_key dropped successfully.');

  } catch (err) {
    console.error('Error fixing schema:', err);
  } finally {
    await client.end();
  }
}

fixSchema();
