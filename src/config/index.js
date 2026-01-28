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
 */
export async function saveConfig(filepath, config) {
  const content = yaml.dump(config);
  await fs.writeFile(filepath, content, 'utf8');
}
