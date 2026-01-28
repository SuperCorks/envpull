import { loadConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';
import fs from 'fs/promises';
import path from 'path';

export function register(program) {
  program
    .command('push [source]')
    .description('Push environment variables to GCS')
    .option('-e, --env <name>', 'Environment name', 'default')
    .option('-f, --file <path>', 'Local file path', '.env')
    .action(async (sourceName, options) => {
      const spinner = ui.spinner('Preparing push...').start();
      
      try {
        // 1. Load config
        const result = await loadConfig();
        if (!result) {
          spinner.fail('Config not found');
          console.log(ui.warn('Run \'envpull init\' to create a configuration'));
          return;
        }
        const { config } = result;

        // 2. Resolve source
        if (!sourceName) {
            // Default to 'default' or the only source available
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
                console.log('Available sources:', keys.join(', '));
                return;
            }
        }

        const source = config.sources[sourceName];
        if (!source) {
            spinner.fail(`Source '${sourceName}' not found in config`);
            return;
        }

        // 3. Detect Project Name
        spinner.text = 'Detecting project name...';
        const project = await getProjectName();
        if (!project) {
            spinner.fail('Could not detect project name from git remote');
            return;
        }

        // 4. Read local file
        spinner.text = `Reading ${options.file}...`;
        const filePath = path.resolve(process.cwd(), options.file);
        let content;
        try {
            content = await fs.readFile(filePath, 'utf8');
        } catch (err) {
            spinner.fail(`File '${options.file}' not found locally`);
            return;
        }

        // 5. Upload
        spinner.text = `Uploading to ${source.bucket}/${project}/${options.env}.env...`;
        const client = new GCSClient();
        await client.upload(source.bucket, project, options.env, content);

        spinner.succeed(ui.success(`Pushed ${options.file} to ${sourceName} (${project}/${options.env})`));

      } catch (error) {
        spinner.fail(error.message);
        process.exit(1);
      }
    });
}

