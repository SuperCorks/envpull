import { loadConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';
import fs from 'fs/promises';
import path from 'path';

export function register(program) {
  program
    .command('pull [source]')
    .description('Pull environment variables from GCS')
    .option('-e, --env <name>', 'Environment name', 'default')
    .option('-f, --file <path>', 'Local file path', '.env')
    .action(async (sourceName, options) => {
      const spinner = ui.spinner('Preparing pull...').start();
      
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

        // 4. Download
        spinner.text = `Downloading from ${source.bucket}/${project}/${options.env}.env...`;
        const client = new GCSClient();
        const content = await client.download(source.bucket, project, options.env);

        // 5. Write local file
        spinner.text = `Writing to ${options.file}...`;
        const filePath = path.resolve(process.cwd(), options.file);
        await fs.writeFile(filePath, content, 'utf8');

        spinner.succeed(ui.success(`Pulled ${options.env} from ${sourceName} to ${options.file}`));

      } catch (error) {
        spinner.fail(error.message);
        process.exit(1);
      }
    });
}

