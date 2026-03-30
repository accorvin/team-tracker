import { describe, it, expect, vi } from 'vitest';
import { getConfig, saveConfig, DEFAULT_CONFIG, validateJqlSafeString } from '../../server/config.js';

describe('getConfig', () => {
  it('returns defaults when no file exists', () => {
    const readFromStorage = vi.fn().mockReturnValue(null);
    expect(getConfig(readFromStorage)).toEqual(DEFAULT_CONFIG);
  });

  it('merges saved config with defaults', () => {
    const readFromStorage = vi.fn().mockReturnValue({ jiraProject: 'CUSTOM' });
    const config = getConfig(readFromStorage);
    expect(config.jiraProject).toBe('CUSTOM');
    expect(config.linkedProject).toBe('RHAISTRAT'); // default
  });
});

describe('saveConfig', () => {
  it('saves valid config', () => {
    const writeToStorage = vi.fn();
    saveConfig(writeToStorage, { jiraProject: 'MYPROJECT' });
    expect(writeToStorage).toHaveBeenCalledWith('ai-impact/config.json', expect.objectContaining({
      jiraProject: 'MYPROJECT',
      linkedProject: 'RHAISTRAT'
    }));
  });

  it('rejects JQL-unsafe characters in string fields', () => {
    const writeToStorage = vi.fn();
    expect(() => saveConfig(writeToStorage, { jiraProject: 'BAD"PROJECT' })).toThrow('unsafe characters');
    expect(() => saveConfig(writeToStorage, { jiraProject: "BAD'PROJECT" })).toThrow('unsafe characters');
    expect(() => saveConfig(writeToStorage, { jiraProject: 'BAD(PROJECT)' })).toThrow('unsafe characters');
    expect(() => saveConfig(writeToStorage, { jiraProject: 'BAD;PROJECT' })).toThrow('unsafe characters');
    expect(() => saveConfig(writeToStorage, { jiraProject: 'BAD\\PROJECT' })).toThrow('unsafe characters');
  });

  it('rejects non-string values for string fields', () => {
    const writeToStorage = vi.fn();
    expect(() => saveConfig(writeToStorage, { jiraProject: '' })).toThrow('non-empty string');
  });

  it('rejects non-integer lookbackMonths', () => {
    const writeToStorage = vi.fn();
    expect(() => saveConfig(writeToStorage, { lookbackMonths: 1.5 })).toThrow('integer between 1 and 120');
    expect(() => saveConfig(writeToStorage, { lookbackMonths: 0 })).toThrow('integer between 1 and 120');
    expect(() => saveConfig(writeToStorage, { lookbackMonths: 121 })).toThrow('integer between 1 and 120');
  });

  it('rejects non-array excludedStatuses', () => {
    const writeToStorage = vi.fn();
    expect(() => saveConfig(writeToStorage, { excludedStatuses: 'Closed' })).toThrow('must be an array');
  });

  it('rejects unsafe excludedStatuses entries', () => {
    const writeToStorage = vi.fn();
    expect(() => saveConfig(writeToStorage, { excludedStatuses: ['Good', 'Bad"Status'] })).toThrow('unsafe characters');
  });

  it('validates trendThresholdPp range', () => {
    const writeToStorage = vi.fn();
    expect(() => saveConfig(writeToStorage, { trendThresholdPp: -1 })).toThrow('number between 0 and 50');
    expect(() => saveConfig(writeToStorage, { trendThresholdPp: 51 })).toThrow('number between 0 and 50');
    // Valid edge cases
    saveConfig(writeToStorage, { trendThresholdPp: 0 });
    saveConfig(writeToStorage, { trendThresholdPp: 50 });
  });
});

describe('validateJqlSafeString', () => {
  it('accepts safe strings', () => {
    expect(() => validateJqlSafeString('RHAIRFE', 'test')).not.toThrow();
    expect(() => validateJqlSafeString('rfe-creator-', 'test')).not.toThrow();
  });

  it('rejects unsafe strings', () => {
    expect(() => validateJqlSafeString('has"quote', 'test')).toThrow();
    expect(() => validateJqlSafeString("has'quote", 'test')).toThrow();
  });

  it('rejects empty strings', () => {
    expect(() => validateJqlSafeString('', 'test')).toThrow('non-empty string');
  });

  it('rejects non-strings', () => {
    expect(() => validateJqlSafeString(123, 'test')).toThrow('non-empty string');
  });
});
