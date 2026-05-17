import { expect, test, describe, beforeEach } from 'vitest';
import { getSession, clearSession, userSessions } from '@/lib/state';

describe('State Management', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    for (const key in userSessions) {
      delete userSessions[key];
    }
  });

  test('getSession should create a new session if it does not exist', () => {
    const session = getSession(123);
    expect(session).toEqual({});
    expect(userSessions[123]).toEqual({});
  });

  test('getSession should return the existing session', () => {
    const session = getSession(123);
    session.workflow = 'meeting_tasks';
    
    const sameSession = getSession(123);
    expect(sameSession.workflow).toBe('meeting_tasks');
  });

  test('clearSession should reset the session for the given chat ID', () => {
    const session = getSession(123);
    session.workflow = 'prd_generator';
    
    clearSession(123);
    expect(getSession(123)).toEqual({});
  });
});
