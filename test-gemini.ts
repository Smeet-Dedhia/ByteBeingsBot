
const { processWorkflow } = require('./lib/gemini');
const { getDatabaseSchema } = require('./lib/notion');

async function testGemini() {
  console.log("Fetching database schema...");
  const schema = await getDatabaseSchema(process.env.NOTION_DATABASE_ID);
  console.log("Schema retrieved:", JSON.stringify(schema, null, 2));

  console.log("Calling Gemini processWorkflow...");
  const text = "We need to redesign the homepage. Sarah will handle the design, due by next Friday. Priority is High.";
  const result = await processWorkflow('meeting_tasks', text, schema);

  console.log("Gemini Output:");
  console.log(JSON.stringify(result, null, 2));
}

testGemini();
