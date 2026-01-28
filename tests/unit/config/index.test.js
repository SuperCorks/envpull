import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { loadConfig } from '../../../src/config/index.js';

vi.mock('fs/promises', () => {
    return {
        default: {
            access: vi.fn(),
            readFile: vi.fn(),
            writeFile: vi.fn()
        }
    };
});

describe('config/index', () => {
  // Clear mocks after each test
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadConfig', () => {
    it('should load config from current directory', async () => {
      const mockCwd = '/app/project';
      vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
      
      const configContent = 'key: value';
      
      fs.access.mockImplementation(async (p) => {
        if (p === path.join(mockCwd, '.envpull.yaml')) return Promise.resolve();
        return Promise.reject({ code: 'ENOENT' });
      });
      
      fs.readFile.mockResolvedValue(configContent);

      const result = await loadConfig();
      expect(result).not.toBeNull();
      expect(result.config).toEqual({ key: 'value' });
      expect(result.filepath).toBe(path.join(mockCwd, '.envpull.yaml'));
    });

    it('should traverse up directory tree', async () => {
        const mockCwd = '/app/project/subdir';
        const rootDir = '/app/project';
        vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);

        fs.access.mockImplementation(async (p) => {
            if (p === path.join(rootDir, '.envpull.yaml')) return Promise.resolve();
            return Promise.reject({ code: 'ENOENT' });
        });
        
        fs.readFile.mockResolvedValue('root: true');

        const result = await loadConfig();
        expect(result).not.toBeNull();
        expect(result.config).toEqual({ root: true });
        expect(result.filepath).toBe(path.join(rootDir, '.envpull.yaml'));
    });

    it('should return null if no config found', async () => {
        const mockCwd = '/app';
        vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);

        fs.access.mockRejectedValue({ code: 'ENOENT' });

        const result = await loadConfig();
        expect(result).toBeNull();
    });
  });
});
