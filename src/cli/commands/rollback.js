import { loadConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient, GCSError } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';
import { confirm } from '@inquirer/prompts';

/**
 * Handles errors with proper formatting and hints
 */
function handleError(spinner, error) {
  spinner.fail(error.message);
  if (error.hint) {
    console.log(ui.hint(error.hint));
  }
  process.exit(1);
}

export function register(program) {
  program
    .command('rollback <generation> [source]')
    .description('Restore a previous .env version')
    .option('-e, --env <name>', 'Environment name', 'default')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (generation, sourceName, options) => {
      const spinner = ui.spinner('Preparing rollback...').start();
      
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
                console.log(ui.hint(`Usage: ${ui.cmd(`envpull rollback <generation> <source>`)}`));
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

        // Confirm rollback
        if (!options.yes) {
          spinner.stop();
          console.log(ui.warn(`\n⚠️  You are about to rollback '${options.env}' to version ${generation}`));
          const confirmed = await confirm({
            message: 'This will overwrite the current version. Continue?',
            default: false
          });
          if (!confirmed) {
            console.log(ui.dim('\nAborted.'));
            return;
          }
          spinner.start('Rolling back...');
        }

        const client = new GCSClient(config.project);
        try {
          await client.rollback(source.bucket, project, options.env, generation);
        } catch (err) {
          handleError(spinner, err);
        }

        spinner.succeed(ui.success(`Rolled back '${options.env}' to version ${generation}`));
        console.log(ui.hint(`Run ${ui.cmd('envpull pull')} to update your local file`));

      } catch (error) {
        if (error.name === 'ExitPromptError') {
          console.log(ui.dim('\nAborted.'));
          return;
        }
        handleError(spinner, error);
      }
    });
}
