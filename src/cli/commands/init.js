import { input, confirm } from '@inquirer/prompts';
import { saveConfig } from '../../config/index.js';
import { ui } from '../../lib/ui.js';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Try to get current GCP project from gcloud config
 */
function getCurrentProject() {
  try {
    const result = execSync('gcloud config get-value project 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    return result && result !== '(unset)' ? result : null;
  } catch {
    return null;
  }
}

/**
 * Normalize bucket name by removing gs:// prefix and trailing slash
 */
function normalizeBucketName(bucket) {
  return bucket.replace(/^gs:\/\//, '').replace(/\/$/, '');
}

export function register(program) {
  program
    .command('init')
    .description('Set up a new .envpull.yaml config')
    .action(async () => {
      try {
        console.log(ui.bold('\n🔧 Setting up envpull\n'));

        const sourceName = await input({ 
          message: 'Source name (alias for this bucket):', 
          default: 'default' 
        });

        const bucketInput = await input({ 
          message: 'GCS Bucket name:',
          validate: (value) => {
            if (!value) return 'Bucket name is required';
            const normalized = normalizeBucketName(value);
            if (!/^[a-z0-9][a-z0-9-_.]{1,61}[a-z0-9]$/.test(normalized)) {
              return 'Invalid bucket name (3-63 chars, lowercase, numbers, hyphens, dots)';
            }
            return true;
          }
        });

        // Normalize the bucket name for storage
        const bucket = normalizeBucketName(bucketInput);

        // Get current project as default
        const currentProject = getCurrentProject();
        
        const gcpProject = await input({ 
          message: 'GCP Project ID (optional, press Enter to skip):',
          default: currentProject || ''
        });

        const config = {
          sources: {
            [sourceName]: {
              bucket: bucket,
              ...(gcpProject && gcpProject.trim() ? { project: gcpProject.trim() } : {})
            }
          }
        };

        const configPath = path.join(process.cwd(), '.envpull.yaml');
        
        // check if exists
        if (fs.existsSync(configPath)) {
            const overwrite = await confirm({ 
                message: 'Config file already exists. Overwrite?',
                default: false
            });
            if (!overwrite) {
                console.log(ui.dim('\nAborted.'));
                return;
            }
        }

        await saveConfig(configPath, config, true);
        
        console.log(ui.success(`\n✅ Created ${ui.path('.envpull.yaml')}\n`));
        console.log(ui.dim('Next steps:'));
        console.log(`  1. Authenticate: ${ui.cmd('gcloud auth application-default login')}`);
        console.log(`  2. Push your .env: ${ui.cmd('envpull push')}`);
        console.log(`  3. On other machines: ${ui.cmd('envpull pull')}\n`);

      } catch (error) {
        if (error.name === 'ExitPromptError') {
          // User pressed Ctrl+C
          console.log(ui.dim('\nAborted.'));
          return;
        }
        console.error(ui.error(`\n❌ ${error.message}`));
        process.exit(1);
      }
    });
}

