import { Client } from 'pg';

const client = new Client({
  host: 'prpvozkyiybcffuccdoe.postgres.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'Richmond2025!@#',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function runQueries() {
  try {
    await client.connect();
    
    console.log("=== QUERY 1: exchange_rates table structure ===");
    const query1 = `
      select column_name, data_type
      from information_schema.columns
      where table_name = 'exchange_rates'
        and table_schema = 'public'
      order by ordinal_position;
    `;
    
    const res1 = await client.query(query1);
    console.table(res1.rows);
    
    console.log("\n=== QUERY 2: fx_rates table structure ===");
    const query2 = `
      select column_name, data_type
      from information_schema.columns
      where table_name = 'fx_rates'
        and table_schema = 'public'
      order by ordinal_position;
    `;
    
    const res2 = await client.query(query2);
    console.table(res2.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

runQueries();
