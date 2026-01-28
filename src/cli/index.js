import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Import commands
import * as initCmd from './commands/init.js';
import * as pullCmd from './commands/pull.js';
import * as pushCmd from './commands/push.js';
import * as historyCmd from './commands/history.js';
import * as rollbackCmd from './commands/rollback.js';
import * as whoamiCmd from './commands/whoami.js';
import * as listCmd from './commands/list.js';
import * as sourcesCmd from './commands/sources.js';
import * as diffCmd from './commands/diff.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Read package.json
const pkgPath = path.join(__dirname, '../../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

export async function run() {
  const program = new Command();

  program
    .name('envpull')
    .description('Securely share .env files with your team via Google Cloud Storage')
    .version(pkg.version)
    .usage('[command] [options]')
    .configureHelp({
      sortSubcommands: false,
      subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage()
    })
    .addHelpText('beforeAll', `
${chalk.bold.cyan('envpull')} ${chalk.dim(`v${pkg.version}`)} – Share .env files via GCS
`)
    .addHelpText('after', `
${chalk.bold('EXAMPLES')}
  ${chalk.dim('# First time setup')}
  $ envpull init
  $ envpull push

  ${chalk.dim('# Pull on a new machine')}
  $ envpull pull

  ${chalk.dim('# See what changed')}
  $ envpull diff

${chalk.bold('MORE')}
  ${chalk.dim('Run')} envpull ${chalk.cyan('<command>')} --help ${chalk.dim('for command details')}
`);

  // Configure output
  program.configureOutput({
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => process.stderr.write(chalk.red(str)),
  });

  // Register commands in logical groups
  // Setup
  initCmd.register(program);
  
  // Core operations
  pushCmd.register(program);
  pullCmd.register(program);
  
  // Discovery
  listCmd.register(program);
  diffCmd.register(program);
  sourcesCmd.register(program);
  
  // Version control
  historyCmd.register(program);
  rollbackCmd.register(program);
  
  // Info
  whoamiCmd.register(program);

  // Show help if no command provided
  if (process.argv.length === 2) {
    program.help();
  }

  await program.parseAsync(process.argv);
}

