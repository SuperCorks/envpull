import { loadConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient, GCSError } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';
import fs from 'fs/promises';
import path from 'path';

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
    .command('pull [source]')
    .description('Download .env files from GCS')
    .option('-e, --env <name>', 'Environment name', 'default')
    .option('-f, --file <path>', 'Local file path', '.env')
    .action(async (sourceName, options) => {
      const spinner = ui.spinner('Preparing pull...').start();
      
      try {
        // 1. Load config
        const result = await loadConfig();
        if (!result) {
          spinner.fail('No configuration found');
          console.log(ui.hint(`Run ${ui.cmd('envpull init')} to create one`));
          return;
        }
        const { config } = result;

        // 2. Resolve source
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
                console.log(ui.hint(`Usage: ${ui.cmd(`envpull pull <source>`)}`));
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

        // 3. Detect Project Name
        spinner.text = 'Detecting project...';
        const project = await getProjectName();
        if (!project) {
            spinner.fail('Could not detect project name');
            console.log(ui.hint('Ensure this is a git repo with a remote configured'));
            console.log(ui.hint(`Run: ${ui.cmd('git remote -v')} to check`));
            return;
        }

        // 4. Download
        spinner.text = `Downloading ${options.env}...`;
        const client = new GCSClient(config.project);
        let content;
        try {
          content = await client.download(source.bucket, project, options.env);
        } catch (err) {
          handleError(spinner, err);
        }

        // 5. Write local file
        spinner.text = `Writing to ${options.file}...`;
        const filePath = path.resolve(process.cwd(), options.file);
        await fs.writeFile(filePath, content, 'utf8');

        spinner.succeed(ui.success(`Pulled ${options.env} to ${ui.path(options.file)}`));
        console.log(ui.dim(`   ${ui.kv('Source', sourceName)} ${ui.kv('Project', project)}`));

      } catch (error) {
        handleError(spinner, error);
      }
    });
}

