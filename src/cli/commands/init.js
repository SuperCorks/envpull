import { input } from '@inquirer/prompts';
import { saveConfig } from '../../config/index.js';
import { ui } from '../../lib/ui.js';
import path from 'path';
import fs from 'fs';

export function register(program) {
  program
    .command('init')
    .description('Initialize envpull in the current directory')
    .action(async () => {
      try {
        ui.spinner('Initializing envpull...').start().stop();

        const sourceName = await input({ 
          message: 'Source name (alias for this bucket):', 
          default: 'default' 
        });

        const bucket = await input({ 
          message: 'GCS Bucket name:',
          validate: (value) => value ? true : 'Bucket name is required'
        });

        const config = {
          sources: {
            [sourceName]: {
              bucket: bucket
            }
          }
        };

        const configPath = path.join(process.cwd(), '.envpull.yaml');
        
        // check if exists
        if (fs.existsSync(configPath)) {
            const overwrite = await input({ 
                message: 'Config file already exists. Overwrite? (y/n)',
                validate: (v) => ['y', 'n'].includes(v.toLowerCase()) ? true : 'Please enter y or n' 
            });
            if (overwrite.toLowerCase() !== 'y') {
                console.log(ui.info('Aborted.'));
                return;
            }
        }

        await saveConfig(configPath, config);
        
        console.log(ui.success(`\nConfiguration saved to ${configPath}`));
        console.log(ui.info(`\nYou can now run 'envpull push' or 'envpull pull'`));

      } catch (error) {
        console.error(ui.error(error.message));
        process.exit(1);
      }
    });
}

