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

export function register(program) {
  program
    .command('list [source]')
    .alias('ls')
    .description('Show available environments in bucket')
    .action(async (sourceName) => {
      const spinner = ui.spinner('Fetching environments...').start();

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
            console.log(ui.hint(`Usage: ${ui.cmd(`envpull list <source>`)}`));
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

        const client = new GCSClient(config.project);
        let envs;
        try {
          envs = await client.listEnvs(source.bucket, project);
        } catch (err) {
          handleError(spinner, err);
        }

        spinner.stop();

        if (envs.length === 0) {
          console.log(ui.warn(`\n📭 No environments found for '${project}'`));
          console.log(ui.hint(`Push one with ${ui.cmd('envpull push --env <name>')}`));
          return;
        }

        console.log(ui.bold(`\n📂 ${project}`));
        console.log(ui.dim(`   Source: ${sourceName}  •  Bucket: ${source.bucket}\n`));

        envs.forEach(env => {
          const age = formatAge(env.updated);
          console.log(`   ${ui.success('•')} ${env.name.padEnd(20)} ${ui.dim(age)}  ${ui.dim(formatBytes(env.size))}`);
        });

        console.log(ui.hint(`\nPull with: ${ui.cmd(`envpull pull --env <name>`)}`));

      } catch (error) {
        handleError(spinner, error);
      }
    });
}

function formatAge(date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function formatBytes(bytes) {
  bytes = parseInt(bytes, 10);
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
