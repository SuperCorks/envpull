import { loadConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';

export function register(program) {
  program
    .command('rollback <generation> [source]')
    .description('Rollback environment to a specific version')
    .option('-e, --env <name>', 'Environment name', 'default')
    .action(async (generation, sourceName, options) => {
      const spinner = ui.spinner('Rolling back...').start();
      
      try {
        const result = await loadConfig();
        if (!result) {
          spinner.fail('Config not found');
          return;
        }
        const { config } = result;

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
                spinner.fail('Multiple sources found, please specify one.');
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

        const client = new GCSClient();
        await client.rollback(source.bucket, project, options.env, generation);

        spinner.succeed(ui.success(`Rolled back ${project}/${options.env} to generation ${generation}`));
        console.log(ui.info('Run \'envpull pull\' to update your local file.'));

      } catch (error) {
        spinner.fail(error.message);
        process.exit(1);
      }
    });
}
