
const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function checkDb() {
  const response = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ page_size: 1 })
  });
  const data = await response.json();
  if (data.results && data.results.length > 0) {
    console.log("First page properties:", JSON.stringify(data.results[0].properties, null, 2));
  } else {
    console.log("Response:", JSON.stringify(data, null, 2));
  }
}

checkDb();
