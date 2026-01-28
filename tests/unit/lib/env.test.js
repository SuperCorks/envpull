import { describe, it, expect } from 'vitest';
import { parseEnv, formatEnv } from '../../../src/lib/env.js';

describe('lib/env', () => {
  describe('parseEnv', () => {
    it('should parse basic key-value pairs', () => {
      const input = 'KEY="VAL"\nANOTHER=value';
      const expected = { KEY: 'VAL', ANOTHER: 'value' };
      expect(parseEnv(input)).toEqual(expected);
    });

    it('should handle comments', () => {
      const input = '# This is a comment\nKEY=VAL # inline comment';
      const expected = { KEY: 'VAL' };
      expect(parseEnv(input)).toEqual(expected);
    });
    
    // dotenv handles quoting logic, but we verify our expectation
    it('should handle quoted values', () => {
        const input = 'KEY="value with spaces"';
        const expected = { KEY: 'value with spaces' };
        expect(parseEnv(input)).toEqual(expected);
    });
  });

  describe('formatEnv', () => {
    it('should sort keys alphabetically', () => {
      const input = { B: 'b', A: 'a' };
      const output = formatEnv(input);
      const lines = output.split('\n');
      expect(lines[0]).toBe('A="a"');
      expect(lines[1]).toBe('B="b"');
    });

    it('should quote values', () => {
      const input = { KEY: 'value' };
      expect(formatEnv(input)).toBe('KEY="value"');
    });

    it('should escape double quotes in values', () => {
      const input = { KEY: 'val"ue' };
      // Expected: KEY="val\"ue"
      expect(formatEnv(input)).toBe('KEY="val\\"ue"');
    });
    
    it('should escape newlines in values', () => {
        const input = { KEY: 'line1\nline2' };
        // Expected: KEY="line1\nline2"
        expect(formatEnv(input)).toBe('KEY="line1\\nline2"');
    });

    it('should escape backslashes', () => {
        const input = { KEY: 'val\\ue' };
        // Expected: KEY="val\\ue"
        expect(formatEnv(input)).toBe('KEY="val\\\\ue"');
    });
  });
});
