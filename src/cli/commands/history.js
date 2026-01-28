import { loadConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';

export function register(program) {
  program
    .command('history [source]')
    .description('Show version history of environment variables')
    .option('-e, --env <name>', 'Environment name', 'default')
    .action(async (sourceName, options) => {
      const spinner = ui.spinner('Fetching history...').start();
      
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
        const versions = await client.listVersions(source.bucket, project, options.env);

        spinner.stop();

        if (versions.length === 0) {
            console.log(ui.info('No versions found.'));
            return;
        }

        console.log(ui.bold(`History for ${project}/${options.env} (Source: ${sourceName})`));
        console.log('');
        
        // Header
        console.log([
            'Generation'.padEnd(20),
            'Updated'.padEnd(30),
            'Size'.padEnd(10)
        ].join(' '));
        console.log('-'.repeat(60));

        // Rows
        versions.forEach(v => {
            console.log([
                v.generation.padEnd(20),
                new Date(v.updated).toLocaleString().padEnd(30),
                (v.size + ' B').padEnd(10)
            ].join(' '));
        });

      } catch (error) {
        spinner.fail(error.message);
        process.exit(1);
      }
    });
}
