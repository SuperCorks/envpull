import { loadConfig } from '../../config/index.js';
import { GCSClient, GCSError } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';
import { confirm } from '@inquirer/prompts';

/**
 * Resolve source from config
 */
function resolveSource(config, sourceName) {
  const keys = Object.keys(config.sources || {});
  
  if (keys.length === 0) {
    throw new GCSError(
      'No sources configured',
      'Run "envpull init" to set up a source'
    );
  }
  
  if (sourceName) {
    if (!config.sources[sourceName]) {
      throw new GCSError(
        `Source '${sourceName}' not found in config`,
        `Available sources: ${keys.join(', ')}`
      );
    }
    return { name: sourceName, ...config.sources[sourceName] };
  }
  
  // Auto-select source
  if (config.sources['default']) {
    return { name: 'default', ...config.sources['default'] };
  }
  
  if (keys.length === 1) {
    return { name: keys[0], ...config.sources[keys[0]] };
  }
  
  throw new GCSError(
    'Multiple sources found, please specify one',
    `Available sources: ${keys.join(', ')}`
  );
}

export function register(program) {
  program
    .command('grant <email>')
    .description('Grant bucket access to a team member by email')
    .option('-s, --source <name>', 'Source name from config')
    .option('--read-write', 'Grant read-write access (admin) instead of read-only')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (email, options) => {
      const spinner = ui.spinner('Loading config...').start();

      try {
        // Validate email format
        if (!email.includes('@')) {
          spinner.fail('Invalid email address');
          console.log(ui.hint('Provide a valid email address (e.g., teammate@example.com)'));
          process.exit(1);
        }

        // Load config
        const result = await loadConfig();
        if (!result) {
          spinner.fail('No configuration found');
          console.log(ui.hint('Run "envpull init" to create one'));
          process.exit(1);
        }

        const { config } = result;
        const source = resolveSource(config, options.source);
        const client = new GCSClient(source.project);
        const bucketName = client.normalizeBucketName(source.bucket);
        const role = options.readWrite ? 'roles/storage.objectAdmin' : 'roles/storage.objectViewer';
        const roleLabel = options.readWrite ? 'Storage Object Admin (read/write)' : 'Storage Object Viewer (read-only)';

        spinner.stop();

        // Confirm unless --yes
        if (!options.yes) {
          console.log(`\n${ui.bold('Grant Access')}\n`);
          console.log(ui.kv('Bucket', bucketName));
          console.log(ui.kv('Email', email));
          console.log(ui.kv('Role', roleLabel));
          console.log();

          const confirmed = await confirm({
            message: `Grant ${options.readWrite ? 'read-write' : 'read-only'} access to ${email}?`,
            default: true
          });

          if (!confirmed) {
            console.log(ui.dim('\nAborted.'));
            return;
          }
        }

        spinner.text = `Granting access to ${email}...`;
        spinner.start();

        await client.grantAccess(bucketName, email, role);

        spinner.succeed(`Granted ${options.readWrite ? 'read-write' : 'read-only'} access to ${ui.bold(email)}`);
        console.log(ui.hint(`They can now run: envpull pull`));

      } catch (error) {
        if (error.name === 'ExitPromptError') {
          spinner.stop();
          console.log(ui.dim('\nAborted.'));
          return;
        }
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
