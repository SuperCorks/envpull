import { loadConfig } from '../../config/index.js';
import { ui } from '../../lib/ui.js';

export function register(program) {
  program
    .command('sources')
    .description('Show sources in .envpull.yaml')
    .action(async () => {
      try {
        const result = await loadConfig();
        if (!result) {
          console.log(ui.warn('\n📭 No configuration found'));
          console.log(ui.hint(`Run ${ui.cmd('envpull init')} to create one`));
          return;
        }
        const { config, filepath } = result;

        const sources = Object.keys(config.sources || {});
        
        if (sources.length === 0) {
          console.log(ui.warn('\n📭 No sources configured'));
          console.log(ui.hint(`Add a source in ${ui.path('.envpull.yaml')}`));
          return;
        }

        console.log(ui.bold('\n📦 Configured Sources\n'));
        console.log(ui.dim(`   Config: ${filepath}\n`));

        sources.forEach(name => {
          const source = config.sources[name];
          const isDefault = name === 'default' || (sources.length === 1);
          const badge = isDefault ? ui.dim(' (default)') : '';
          console.log(`   ${ui.success('•')} ${ui.bold(name)}${badge}`);
          console.log(`     ${ui.kv('Bucket', source.bucket)}`);
          if (source.project) {
            console.log(`     ${ui.kv('Project', source.project)}`);
          }
          console.log('');
        });

        if (config.project) {
          console.log(ui.dim(`   Global project: ${config.project}\n`));
        }

      } catch (error) {
        console.error(ui.error(`\n❌ ${error.message}`));
        process.exit(1);
      }
    });
}
