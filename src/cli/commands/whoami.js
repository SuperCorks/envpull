import { Storage } from '@google-cloud/storage';
import { loadConfig } from '../../config/index.js';
import { ui } from '../../lib/ui.js';
import { execSync } from 'child_process';

/**
 * Get the current ADC email from gcloud
 */
function getADCEmail() {
  try {
    // Try to get the ADC account
    const result = execSync('gcloud auth application-default print-access-token 2>/dev/null && gcloud config get-value account 2>/dev/null', {
      encoding: 'utf8',
      timeout: 10000
    });
    // The account is the second line (after the token)
    const lines = result.trim().split('\n');
    return lines[lines.length - 1] || null;
  } catch {
    return null;
  }
}

/**
 * Get project from ADC or gcloud config
 */
async function getGCloudInfo() {
  const storage = new Storage();
  
  let project = null;
  let email = null;
  let authValid = false;

  // Try to get project from Storage client (uses ADC)
  try {
    project = await storage.authClient.getProjectId();
    authValid = true;
  } catch {
    // Fall back to gcloud config
    try {
      project = execSync('gcloud config get-value project 2>/dev/null', {
        encoding: 'utf8',
        timeout: 5000
      }).trim();
    } catch {
      project = null;
    }
  }

  // Get email from gcloud
  try {
    email = execSync('gcloud config get-value account 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    if (email === '' || email === '(unset)') email = null;
  } catch {
    email = null;
  }

  return { project, email, authValid };
}

export function register(program) {
  program
    .command('whoami')
    .description('Show auth & project info')
    .action(async () => {
      const spinner = ui.spinner('Checking authentication...').start();

      try {
        const [gcloudInfo, configResult] = await Promise.all([
          getGCloudInfo(),
          loadConfig()
        ]);

        spinner.stop();

        const { project, email, authValid } = gcloudInfo;

        console.log(ui.bold('\n🔐 Authentication\n'));

        // Auth status
        if (authValid) {
          console.log(ui.success('  ✓ Authenticated with Google Cloud'));
        } else {
          console.log(ui.error('  ✗ Not authenticated'));
          console.log(ui.hint(`Run: ${ui.cmd('gcloud auth application-default login')}`));
        }

        // Email
        if (email) {
          console.log(`  ${ui.kv('Account', email)}`);
        }

        // Project
        if (project) {
          console.log(`  ${ui.kv('Project', project)}`);
        } else {
          console.log(ui.warn('  ⚠ No project set'));
          console.log(ui.hint(`Run: ${ui.cmd('gcloud config set project <PROJECT_ID>')}`));
        }

        // Config info
        console.log(ui.bold('\n📁 Configuration\n'));

        if (configResult) {
          const { config, filepath } = configResult;
          console.log(`  ${ui.kv('Config', filepath)}`);
          
          const sources = Object.keys(config.sources || {});
          if (sources.length > 0) {
            console.log(`  ${ui.kv('Sources', sources.join(', '))}`);
            
            // Show default source details
            const defaultSource = config.sources['default'] || config.sources[sources[0]];
            const defaultName = config.sources['default'] ? 'default' : sources[0];
            if (defaultSource?.bucket) {
              console.log(`  ${ui.kv('Default bucket', defaultSource.bucket)} ${ui.dim(`(${defaultName})`)}`);
            }
            if (defaultSource?.project) {
              console.log(`  ${ui.kv('GCP Project', defaultSource.project)} ${ui.dim(`(${defaultName})`)}`);
            }
          }
        } else {
          console.log(ui.dim('  No .envpull.yaml found'));
          console.log(ui.hint(`Run: ${ui.cmd('envpull init')} to create one`));
        }

        console.log('');

      } catch (error) {
        spinner.fail(error.message);
        process.exit(1);
      }
    });
}
