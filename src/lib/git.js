import simpleGit from 'simple-git';

/**
 * Attempts to retrieve the "org/repo" name from the 'origin' remote.
 * @returns {Promise<string|null>} The project name or null if not found.
 */
export async function getProjectName() {
  const git = simpleGit();
  
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return null;

    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');
    
    if (!origin) return null;
    
    const url = origin.refs.fetch || origin.refs.push;
    if (!url) return null;

    // Handle common git URL formats:
    // git@github.com:org/repo.git
    // https://github.com/org/repo.git
    // https://user@github.com/org/repo.git
    
    // Regex explanation:
    // [:/] matches the separator before user/repo (either : for ssh or / for https)
    // ([^/]+\/[^/]+?) matches the org/repo part (non-slashes, slash, non-slashes)
    // (?:\.git)?$ matches optional .git at the end
    const match = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return null;

  } catch (error) {
    // Fail silently for now
    return null;
  }
}
