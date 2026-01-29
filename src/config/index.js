import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

const CONFIG_FILE_NAME = '.envpull.yaml';

/**
 * Traverses up the directory tree to find the config file.
 * @returns {Promise<{config: Object, filepath: string}|null>}
 */
export async function loadConfig() {
  let currentDir = process.cwd();
  while (true) {
    const configPath = path.join(currentDir, CONFIG_FILE_NAME);
    try {
      await fs.access(configPath);
      const content = await fs.readFile(configPath, 'utf8');
      return {
        config: yaml.load(content) || {},
        filepath: configPath
      };
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }
  }
  return null;
}

/**
 * Saves the config to the specified path.
 * @param {string} filepath 
 * @param {Object} config 
 * @param {boolean} includeHeader - Whether to include explanatory header comment
 */
export async function saveConfig(filepath, config, includeHeader = false) {
  let content = yaml.dump(config);
  
  if (includeHeader) {
    const header = `# envpull config - securely share .env files via Google Cloud Storage
# Install: npm install -g @supercorks/envpull
# Docs: https://github.com/SuperCorks/envpull

`;
    content = header + content;
  }
  
  await fs.writeFile(filepath, content, 'utf8');
}
