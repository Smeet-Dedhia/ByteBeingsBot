import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function getDatabaseSchema(databaseId: string) {
  try {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    const schema: Record<string, any> = {};
    
    let properties = (db as any).properties;
    
    if (!properties || Object.keys(properties).length === 0) {
      // Fallback: Query for 1 page to infer schema from page properties using fetch
      const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ page_size: 1 })
      });
      const response = await queryResponse.json();
      if (response.results && response.results.length > 0) {
        properties = response.results[0].properties;
      } else {
        properties = {};
      }
    }
    
    for (const [key, prop] of Object.entries(properties)) {
      const p = prop as any;
      schema[key] = {
        type: p.type,
      };
      if (p.type === 'select' && p.select?.options) {
        schema[key].options = p.select.options.map((o: any) => o.name);
      }
      if (p.type === 'status' && p.status?.options) {
        schema[key].options = p.status.options.map((o: any) => o.name);
      }
    }
    return schema;
  } catch (error) {
    console.error("Failed to fetch Notion schema:", error);
    return null;
  }
}

export async function dynamicPushToNotion(databaseId: string, rows: Record<string, any>[], schema: Record<string, any>) {
  for (const row of rows) {
    const properties: any = {};
    
    for (const [key, value] of Object.entries(row)) {
      if (!schema[key]) continue; // Ignore keys not in schema
      if (value === undefined || value === null || value === '') continue; // Ignore empty values

      const type = schema[key].type;
      if (type === 'title') {
        properties[key] = { title: [{ text: { content: String(value) } }] };
      } else if (type === 'rich_text') {
        properties[key] = { rich_text: [{ text: { content: String(value) } }] };
      } else if (type === 'select') {
        properties[key] = { select: { name: String(value) } };
      } else if (type === 'status') {
        properties[key] = { status: { name: String(value) } };
      } else if (type === 'number') {
        properties[key] = { number: Number(value) };
      } else if (type === 'date') {
        properties[key] = { date: { start: String(value) } };
      }
    }
    
    if (Object.keys(properties).length > 0) {
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties
      });
    }
  }
}
