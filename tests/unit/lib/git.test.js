import { describe, it, expect, vi, afterEach } from 'vitest';
import { getProjectName } from '../../../src/lib/git.js';
import simpleGit from 'simple-git';

vi.mock('simple-git', () => {
  return {
    default: vi.fn()
  };
});

describe('lib/git', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return null if not a git repo', async () => {
    const mockGit = {
      checkIsRepo: vi.fn().mockResolvedValue(false),
    };
    simpleGit.mockReturnValue(mockGit);

    const result = await getProjectName();
    expect(result).toBeNull();
  });

  it('should return null if no origin remote', async () => {
     const mockGit = {
      checkIsRepo: vi.fn().mockResolvedValue(true),
      getRemotes: vi.fn().mockResolvedValue([
          { name: 'upstream', refs: {} }
      ]),
    };
    simpleGit.mockReturnValue(mockGit);

    const result = await getProjectName();
    expect(result).toBeNull();
  });

  it('should parse HTTPS url', async () => {
    const mockGit = {
      checkIsRepo: vi.fn().mockResolvedValue(true),
      getRemotes: vi.fn().mockResolvedValue([
          { name: 'origin', refs: { fetch: 'https://github.com/org/repo.git' } }
      ]),
    };
    simpleGit.mockReturnValue(mockGit);

    const result = await getProjectName();
    expect(result).toBe('org/repo');
  });

  it('should parse SSH url', async () => {
    const mockGit = {
      checkIsRepo: vi.fn().mockResolvedValue(true),
      getRemotes: vi.fn().mockResolvedValue([
          { name: 'origin', refs: { fetch: 'git@github.com:org/repo.git' } }
      ]),
    };
    simpleGit.mockReturnValue(mockGit);

    const result = await getProjectName();
    expect(result).toBe('org/repo');
  });
  
  it('should parse URL without .git', async () => {
    const mockGit = {
      checkIsRepo: vi.fn().mockResolvedValue(true),
      getRemotes: vi.fn().mockResolvedValue([
          { name: 'origin', refs: { fetch: 'https://github.com/org/repo' } }
      ]),
    };
    simpleGit.mockReturnValue(mockGit);

    const result = await getProjectName();
    expect(result).toBe('org/repo');
  });
});
