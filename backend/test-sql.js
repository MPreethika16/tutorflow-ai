const { Client } = require('pg');

async function testSql() {
  const url = process.env.DATABASE_URL || "postgresql://tutorflow:tutorflow_password@localhost:5433/tutorflow_db?schema=public";
  const client = new Client({ connectionString: url });
  
  await client.connect();
  
  try {
    console.log("TEST 1: q.embedding");
    await client.query(`SELECT q.embedding FROM "Question" q LIMIT 1`);
    console.log("SUCCESS");
  } catch(e) {
    console.log("FAILED:", e.message);
  }

  try {
    console.log("TEST 2: q.\"embedding\"");
    await client.query(`SELECT q."embedding" FROM "Question" q LIMIT 1`);
    console.log("SUCCESS");
  } catch(e) {
    console.log("FAILED:", e.message);
  }

  try {
    console.log("TEST 3: q.type");
    await client.query(`SELECT q.type FROM "Question" q LIMIT 1`);
    console.log("SUCCESS");
  } catch(e) {
    console.log("FAILED:", e.message);
  }

  try {
    console.log("TEST 4: a.\"teacherId\"");
    await client.query(`SELECT a."teacherId" FROM "Assessment" a LIMIT 1`);
    console.log("SUCCESS");
  } catch(e) {
    console.log("FAILED:", e.message);
  }

  await client.end();
}

testSql().catch(console.error);
