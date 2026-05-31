import { BaseAgent } from '../base';
import { AgentManifest, AgentTool } from '../../lib/types';
import { Type } from '@google/genai';
import { dataStore } from '../../lib/data-store';

export class CalendarAgent extends BaseAgent {
  manifest: AgentManifest = {
    id: 'calendar_agent',
    name: 'Calendar Agent',
    description: 'Manages schedules, books calendar events, and details upcoming meetings.',
    capabilities: ['create_event', 'list_events', 'modify_event'],
    triggerExamples: [
      'Schedule a meeting with Sarah tomorrow at 2pm',
      'What meetings do I have this week?',
      'Add a gym session to my calendar',
    ],
  };

  tools: AgentTool[] = [
    {
      declaration: {
        name: 'list_calendar_events',
        description: 'Get all calendar events.',
        parameters: {
          type: Type.OBJECT,
        },
      },
      execute: async () => {
        // Retrieve from persistent dataStore collection
        const events = await dataStore.getAll('calendar_events');
        return { events };
      },
    },
    {
      declaration: {
        name: 'create_calendar_event',
        description: 'Book a new event on the calendar.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Event title' },
            startTime: { type: Type.STRING, description: 'ISO date string or human readable date' },
            durationMinutes: { type: Type.NUMBER, description: 'Meeting duration' },
          },
          required: ['title', 'startTime'],
        },
      },
      execute: async (args) => {
        const record = await dataStore.insert('calendar_events', {
          title: args.title,
          startTime: args.startTime,
          durationMinutes: args.durationMinutes || 60,
        });
        return { success: true, event: record };
      },
    },
  ];

  getSystemPrompt(): string {
    return `You are a Calendar Scheduling Assistant.
Your goal is to book, update, and inspect calendar events.
Always search the calendar using list_calendar_events if the user asks for upcoming events, or insert a calendar event using create_calendar_event. Use the built-in respond_to_user tool to confirm completion.`;
  }
}
