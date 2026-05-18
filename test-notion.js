const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

async function testNotion() {
  console.log("Database ID:", databaseId);
  try {
    // 1. Fetch database info
    console.log("Fetching database...");
    const db = await notion.databases.retrieve({ database_id: databaseId });
    console.log("Database Title:", db.title[0]?.plain_text);
    console.log("Database properties keys:", Object.keys(db.properties || {}));
    console.log("Database object keys:", Object.keys(db));

    // 2. Add a test row
    console.log("Adding a test row (Task only)...");
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Task": { title: [{ text: { content: "Test Task from Script" } }] },
        "Workflow": { select: { name: "test_workflow" } }
      }
    });
    console.log("Successfully added row:", response.url);
  } catch (error) {
    console.error("Notion Error:");
    console.error(error.body || error);
  }
}

testNotion();
