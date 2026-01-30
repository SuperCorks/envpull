import { loadConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient, GCSError } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';

/**
 * Handles errors with proper formatting and hints
 */
function handleError(spinner, error) {
  spinner.fail(error.message);
  if (error.detail) {
    console.log(ui.dim(`   ${error.detail}`));
  }
  if (error.hint) {
    console.log(ui.hint(error.hint));
  }
  process.exit(1);
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  bytes = parseInt(bytes, 10);
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format date relative to now
 */
function formatDate(date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function register(program) {
  program
    .command('history [source]')
    .description('List past versions of .env')
    .option('-e, --env <name>', 'Environment name', 'default')
    .action(async (sourceName, options) => {
      const spinner = ui.spinner('Fetching history...').start();
      
      try {
        const result = await loadConfig();
        if (!result) {
          spinner.fail('No configuration found');
          console.log(ui.hint(`Run ${ui.cmd('envpull init')} to create one`));
          return;
        }
        const { config } = result;

        if (!sourceName) {
            const keys = Object.keys(config.sources || {});
            if (keys.length === 0) {
                spinner.fail('No sources configured');
                console.log(ui.hint(`Add a source in ${ui.path('.envpull.yaml')}`));
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
                console.log(ui.hint(`Usage: ${ui.cmd(`envpull history <source>`)}`));
                return;
            }
        }

        const source = config.sources[sourceName];
        if (!source) {
            spinner.fail(`Source '${sourceName}' not found`);
            const keys = Object.keys(config.sources || {});
            if (keys.length > 0) {
              console.log('\nAvailable sources:');
              console.log(ui.list(keys));
            }
            return;
        }

        const project = await getProjectName();
        if (!project) {
            spinner.fail('Could not detect project name');
            console.log(ui.hint('Ensure this is a git repo with a remote configured'));
            return;
        }

        const client = new GCSClient(source.project);
        let versions;
        try {
          versions = await client.listVersions(source.bucket, project, options.env);
        } catch (err) {
          handleError(spinner, err);
        }

        spinner.stop();

        if (versions.length === 0) {
            console.log(ui.warn(`\n📭 No versions found for '${options.env}'`));
            console.log(ui.hint(`Push one first with ${ui.cmd('envpull push')}`));
            return;
        }

        console.log(ui.bold(`\n📜 ${project}/${options.env}`));
        console.log(ui.dim(`   Source: ${sourceName}  •  ${versions.length} version${versions.length > 1 ? 's' : ''}\n`));
        
        // Table header
        console.log(ui.dim('   ' + [
            'GENERATION'.padEnd(20),
            'UPDATED'.padEnd(15),
            'SIZE'.padEnd(10)
        ].join('')));

        // Rows
        versions.forEach((v, i) => {
            const isLatest = i === 0;
            const gen = v.generation.padEnd(20);
            const updated = formatDate(v.updated).padEnd(15);
            const size = formatBytes(v.size).padEnd(10);
            
            if (isLatest) {
              console.log(ui.success(`   ${gen}${updated}${size}`) + ui.dim(' (current)'));
            } else {
              console.log(`   ${gen}${ui.dim(updated)}${ui.dim(size)}`);
            }
        });

        if (versions.length > 1) {
          console.log(ui.hint(`\nTo rollback: ${ui.cmd(`envpull rollback <generation>`)}`));
        }

      } catch (error) {
        handleError(spinner, error);
      }
    });
}
