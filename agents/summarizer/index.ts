import { BaseAgent } from '../base';
import { AgentManifest, AgentTool } from '../../lib/types';
import { Type } from '@google/genai';

export class SummarizerAgent extends BaseAgent {
  manifest: AgentManifest = {
    id: 'content_summarizer_agent',
    name: 'Content Summarizer Agent',
    description: 'Summarizes YouTube videos and articles to help determine if they are worth consuming.',
    capabilities: ['summarize_article', 'summarize_video'],
    triggerExamples: [
      'Summarize this URL article',
      'Should I watch this YouTube video link?',
      'Give me a summary of this video',
    ],
  };

  tools: AgentTool[] = [
    {
      declaration: {
        name: 'fetch_article_text',
        description: 'Scrape and extract text body content from an article URL.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            url: { type: Type.STRING, description: 'The web article URL.' },
          },
          required: ['url'],
        },
      },
      execute: async (args) => {
        try {
          const url = args.url as string;
          const response = await fetch(url);
          const html = await response.text();
          // Extract basic text body (simple text fallback scraper)
          const text = html.replace(/<[^>]*>/g, ' ').substring(0, 10000);
          return { title: 'Article Content', content: text };
        } catch (error: any) {
          return { error: error.message || 'Failed to fetch article text' };
        }
      },
    },
  ];

  getSystemPrompt(): string {
    return `You are a Content Summarization Expert.
If a user supplies a URL link to an article, call fetch_article_text first. Summarize it in 3 bullet points, compute estimated read time, and give a factual "Worth It" verdict. Save this log into the "content_summaries" collection using save_to_collection.`;
  }
}
