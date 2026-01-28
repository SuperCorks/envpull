import { loadConfig, saveConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient, GCSError } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';
import { input, confirm } from '@inquirer/prompts';
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
    .command('push [source]')
    .description('Upload local .env files to GCS')
    .option('-e, --env <name>', 'Environment name', 'default')
    .option('-f, --file <path>', 'Local file path', '.env')
    .action(async (sourceName, options) => {
      const spinner = ui.spinner('Preparing push...').start();
      
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
                console.log(ui.hint(`Usage: ${ui.cmd(`envpull push <source>`)}`));
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

        // 4. Read local file
        spinner.text = `Reading ${options.file}...`;
        const filePath = path.resolve(process.cwd(), options.file);
        let content;
        try {
            content = await fs.readFile(filePath, 'utf8');
        } catch (err) {
            spinner.fail(`File not found: ${ui.path(options.file)}`);
            console.log(ui.hint(`Create the file or use ${ui.cmd('--file <path>')} to specify a different one`));
            return;
        }

        // 5. Upload (with bucket existence check and retry loop)
        const client = new GCSClient(config.project);
        let currentBucket = source.bucket;
        let uploaded = false;

        while (!uploaded) {
          spinner.text = `Checking bucket...`;
          
          let exists;
          try {
            exists = await client.bucketExists(currentBucket);
          } catch (err) {
            handleError(spinner, err);
          }
          
          if (!exists) {
            spinner.stop();
            console.log(ui.warn(`\n⚠️  Bucket '${currentBucket}' does not exist`));
            
            const shouldCreate = await confirm({
              message: `Create bucket '${currentBucket}'?`,
              default: true
            });

            if (shouldCreate) {
              spinner.start(`Creating bucket...`);
              try {
                await client.createBucket(currentBucket);
                spinner.succeed(`Created bucket '${currentBucket}'`);
                spinner.start('Uploading...');
              } catch (createErr) {
                spinner.stop();
                console.log(ui.error(`\n❌ ${createErr.message}`));
                if (createErr.hint) {
                  console.log(ui.hint(createErr.hint));
                }
                
                currentBucket = await input({
                  message: 'Enter a different bucket name:',
                  validate: (value) => value ? true : 'Bucket name is required'
                });
                spinner.start();
                continue;
              }
            } else {
              currentBucket = await input({
                message: 'Enter a different bucket name:',
                validate: (value) => value ? true : 'Bucket name is required'
              });
              spinner.start();
              continue;
            }
          }

          // Attempt upload
          spinner.text = `Uploading to ${currentBucket}/${project}/${options.env}.env...`;
          try {
            await client.upload(currentBucket, project, options.env, content);
            uploaded = true;
          } catch (uploadErr) {
            // Check if it's a bucket-not-found error during upload
            const errMsg = (uploadErr.message || '').toLowerCase();
            if (errMsg.includes('bucket') && (errMsg.includes('not exist') || errMsg.includes('not found'))) {
              spinner.stop();
              console.log(ui.warn(`\n⚠️  Bucket '${currentBucket}' does not exist`));
              currentBucket = await input({
                message: 'Enter a different bucket name:',
                validate: (value) => value ? true : 'Bucket name is required'
              });
              spinner.start();
              continue;
            }
            throw uploadErr;
          }
        }

        // Update config if bucket changed
        if (currentBucket !== source.bucket) {
          const { filepath } = await loadConfig();
          const configResult = await loadConfig();
          configResult.config.sources[sourceName].bucket = currentBucket;
          await saveConfig(filepath, configResult.config);
          console.log(ui.info(`📝 Updated config with bucket '${currentBucket}'`));
        }

        spinner.succeed(ui.success(`Pushed to ${project}/${options.env}`));
        console.log(ui.dim(`   ${ui.kv('Source', sourceName)} ${ui.kv('Bucket', currentBucket)}`));

      } catch (error) {
        if (error.name === 'ExitPromptError') {
          spinner.stop();
          console.log(ui.dim('\nAborted.'));
          return;
        }
        handleError(spinner, error);
      }
    });
}

