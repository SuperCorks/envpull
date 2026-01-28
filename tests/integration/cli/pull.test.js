import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { register } from '../../../src/cli/commands/pull.js';
import { Command } from 'commander';
import fs from 'fs/promises';
import { ui } from '../../../src/lib/ui.js';
import { GCSClient } from '../../../src/lib/gcs.js';
import * as configModule from '../../../src/config/index.js';
import * as gitModule from '../../../src/lib/git.js';
import path from 'path';

// Mock dependencies
vi.mock('fs/promises', () => ({
    default: {
        writeFile: vi.fn(),
        access: vi.fn(),
        readFile: vi.fn()
    }
}));

// Mock GCS Client
vi.mock('../../../src/lib/gcs.js', () => {
    return {
        GCSClient: vi.fn(),
        GCSError: class GCSError extends Error {
          constructor(message, hint) {
            super(message);
            this.hint = hint;
          }
        }
    }
});

// Mock UI with all helper functions
vi.mock('../../../src/lib/ui.js', () => ({
    ui: {
        spinner: vi.fn(),
        success: vi.fn(t => t),
        warn: vi.fn(t => t),
        error: vi.fn(t => t),
        info: vi.fn(t => t),
        dim: vi.fn(t => t),
        bold: vi.fn(t => t),
        hint: vi.fn(t => t),
        cmd: vi.fn(t => t),
        path: vi.fn(t => t),
        list: vi.fn(items => items.join('\n')),
        kv: vi.fn((k, v) => `${k}: ${v}`)
    }
}));

describe('cli/commands/pull', () => {
  let program;
  let exitSpy;
  let spinnerMockObject;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
    
    // Create a stable spinner object to facilitate inspection if needed
    spinnerMockObject = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
        stop: vi.fn(),
        text: ''
    };
    
    // Setup default spinner mock
    ui.spinner.mockReturnValue(spinnerMockObject);

    // Mock process.exit to prevent test runner crash and verify exit calls
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  // Helper to execute action
  const runCommand = async (args = []) => {
      register(program);
      // Suppress console output
      vi.spyOn(console, 'log').mockImplementation(() => {}); 
      await program.parseAsync(['node', 'envpull', 'pull', ...args]);
  };

  it('should fail if config is missing', async () => {
    vi.spyOn(configModule, 'loadConfig').mockResolvedValue(null);

    await runCommand([]);

    expect(spinnerMockObject.fail).toHaveBeenCalledWith('No configuration found');
  });

  it('should fail if sources mapping is empty', async () => {
    vi.spyOn(configModule, 'loadConfig').mockResolvedValue({ config: { sources: {} } });

    await runCommand();
    expect(spinnerMockObject.fail).toHaveBeenCalledWith('No sources configured');
  });

  it('should successfully pull environment variables', async () => {
    // Setup Mocks
    vi.spyOn(configModule, 'loadConfig').mockResolvedValue({
        config: {
            sources: {
                default: { bucket: 'my-bucket' }
            }
        }
    });

    vi.spyOn(gitModule, 'getProjectName').mockResolvedValue('my-org/my-project');
    
    // Mock GCS download
    const mockDownload = vi.fn().mockResolvedValue('KEY=VALUE');
    GCSClient.mockImplementation(function() {
        return {
            download: mockDownload
        }
    });

    await runCommand([]);

    expect(exitSpy).not.toHaveBeenCalled();
    expect(configModule.loadConfig).toHaveBeenCalled();
    expect(gitModule.getProjectName).toHaveBeenCalled();
    expect(mockDownload).toHaveBeenCalledWith('my-bucket', 'my-org/my-project', 'default');
    
    const expectedPath = path.resolve(process.cwd(), '.env');
    expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, 'KEY=VALUE', 'utf8');
  });

  it('should allow specifying source and env', async () => {
     vi.spyOn(configModule, 'loadConfig').mockResolvedValue({
        config: {
            sources: {
                staging: { bucket: 'staging-bucket' }
            }
        }
    });
    vi.spyOn(gitModule, 'getProjectName').mockResolvedValue('proj');
    const mockDownload = vi.fn().mockResolvedValue('ENV=STAGING');
    GCSClient.mockImplementation(function() {
        return {
            download: mockDownload
        }
    });

    await runCommand(['staging', '-e', 'production', '-f', '.env.prod']);
    
    expect(exitSpy).not.toHaveBeenCalled();
    expect(mockDownload).toHaveBeenCalledWith('staging-bucket', 'proj', 'production');
     const expectedPath = path.resolve(process.cwd(), '.env.prod');
     expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, 'ENV=STAGING', 'utf8');
  });
});
