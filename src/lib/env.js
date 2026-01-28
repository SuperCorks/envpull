import dotenv from 'dotenv';

/**
 * Parses a .env string into an object.
 * @param {string} content 
 * @returns {Record<string, string>}
 */
export function parseEnv(content) {
  return dotenv.parse(content);
}

/**
 * Formats an environment object back into a .env string.
 * - Sorts keys alphabetically.
 * - Wraps values in quotes.
 * - Escapes existing quotes and newlines.
 * @param {Record<string, string>} envObj 
 * @returns {string}
 */
export function formatEnv(envObj) {
  return Object.keys(envObj)
    .sort()
    .map(key => {
      let value = envObj[key] || '';
      
      // Escape backslashes first
      value = value.replace(/\\/g, '\\\\');
      // Escape double quotes
      value = value.replace(/"/g, '\\"');
      // Escape newlines to make it a single line string "...\n..."
      value = value.replace(/\n/g, '\\n');
      
      return `${key}="${value}"`;
    })
    .join('\n');
}
