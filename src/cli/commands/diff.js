import { loadConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient, GCSError } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Parse env content into key-value pairs
 */
function parseEnv(content) {
  const result = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[key] = value;
  }
  
  return result;
}

/**
 * Compare two env objects
 */
function diffEnvs(local, remote) {
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const diff = {
    added: [],      // In local, not in remote
    removed: [],    // In remote, not in local
    changed: [],    // Different values
    unchanged: []   // Same values
  };

  for (const key of allKeys) {
    const inLocal = key in local;
    const inRemote = key in remote;

    if (inLocal && !inRemote) {
      diff.added.push({ key, value: local[key] });
    } else if (!inLocal && inRemote) {
      diff.removed.push({ key, value: remote[key] });
    } else if (local[key] !== remote[key]) {
      diff.changed.push({ key, local: local[key], remote: remote[key] });
    } else {
      diff.unchanged.push({ key, value: local[key] });
    }
  }

  return diff;
}

/**
 * Mask sensitive values
 */
function maskValue(value, showValues) {
  if (showValues) return value;
  if (!value || value.length <= 4) return '****';
  return value.slice(0, 2) + '****' + value.slice(-2);
}

export function register(program) {
  program
    .command('diff [file]')
    .description('Show differences between local and remote')
    .option('-s, --source <name>', 'Source name from config')
    .option('-b, --branch <name>', 'Branch/environment name', 'default')
    .option('--show-values', 'Show actual values (not masked)')
    .action(async (file, options) => {
      const filePath = file || '.env';
      const filename = path.basename(filePath);
      const branch = options.branch;
      const spinner = ui.spinner('Comparing...').start();

      try {
        const result = await loadConfig();
        if (!result) {
          spinner.fail('No configuration found');
          console.log(ui.hint(`Run ${ui.cmd('envpull init')} to create one`));
          return;
        }
        const { config } = result;

        let sourceName = options.source;
        if (!sourceName) {
          const keys = Object.keys(config.sources || {});
          if (keys.length === 0) {
            spinner.fail('No sources configured');
            return;
          }
          if (config.sources['default']) {
            sourceName = 'default';
          } else if (keys.length === 1) {
            sourceName = keys[0];
          } else {
            spinner.fail('Multiple sources found, please specify one');
            console.log('\nAvailable sources:');
            console.log(ui.list(keys));
            return;
          }
        }

        const source = config.sources[sourceName];
        if (!source) {
          spinner.fail(`Source '${sourceName}' not found`);
          return;
        }

        const project = await getProjectName();
        if (!project) {
          spinner.fail('Could not detect project name');
          return;
        }

        // Read local file
        const fullPath = path.resolve(process.cwd(), filePath);
        let localContent;
        try {
          localContent = await fs.readFile(fullPath, 'utf8');
        } catch (err) {
          spinner.fail(`Local file not found: ${ui.path(filePath)}`);
          console.log(ui.hint(`Create it or pull with ${ui.cmd(`envpull pull ${filePath} -b ${branch}`)}`));
          return;
        }

        // Download remote
        const client = new GCSClient(source.project);
        let remoteContent;
        try {
          remoteContent = await client.download(source.bucket, project, branch, filename);
        } catch (err) {
          if (err.message?.includes('not found')) {
            spinner.fail(`Remote file '${branch}/${filename}' not found`);
            console.log(ui.hint(`Push it first with ${ui.cmd(`envpull push ${filePath} -b ${branch}`)}`));
            return;
          }
          throw err;
        }

        spinner.stop();

        // Parse and compare
        const localEnv = parseEnv(localContent);
        const remoteEnv = parseEnv(remoteContent);
        const diff = diffEnvs(localEnv, remoteEnv);

        console.log(ui.bold(`\n🔍 Diff: ${filePath} ↔ ${branch}/${filename}\n`));
        console.log(ui.dim(`   Local: ${filePath}  •  Remote: ${source.bucket}/${project}/${branch}/${filename}\n`));

        const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;

        if (!hasChanges) {
          console.log(ui.success('   ✓ Files are identical\n'));
          return;
        }

        // Show added (local only)
        if (diff.added.length > 0) {
          console.log(ui.success(`   + Added locally (${diff.added.length}):`));
          diff.added.forEach(({ key, value }) => {
            console.log(`     ${ui.success('+')} ${key}=${maskValue(value, options.showValues)}`);
          });
          console.log('');
        }

        // Show removed (remote only)
        if (diff.removed.length > 0) {
          console.log(ui.error(`   - Missing locally (${diff.removed.length}):`));
          diff.removed.forEach(({ key, value }) => {
            console.log(`     ${ui.error('-')} ${key}=${maskValue(value, options.showValues)}`);
          });
          console.log('');
        }

        // Show changed
        if (diff.changed.length > 0) {
          console.log(ui.warn(`   ~ Modified (${diff.changed.length}):`));
          diff.changed.forEach(({ key, local, remote }) => {
            console.log(`     ${ui.warn('~')} ${key}`);
            console.log(`       ${ui.dim('local:')}  ${maskValue(local, options.showValues)}`);
            console.log(`       ${ui.dim('remote:')} ${maskValue(remote, options.showValues)}`);
          });
          console.log('');
        }

        // Summary
        console.log(ui.dim(`   ${diff.unchanged.length} unchanged, ${diff.added.length} added, ${diff.removed.length} missing, ${diff.changed.length} modified\n`));

        if (diff.added.length > 0 || diff.changed.length > 0) {
          console.log(ui.hint(`Push changes: ${ui.cmd('envpull push')}`));
        }
        if (diff.removed.length > 0) {
          console.log(ui.hint(`Pull remote: ${ui.cmd('envpull pull')}`));
        }

      } catch (error) {
        spinner.fail(error.message);
        if (error.detail) {
          console.log(ui.dim(`   ${error.detail}`));
        }
        if (error.hint) {
          console.log(ui.hint(error.hint));
        }
        process.exit(1);
      }
    });
}
