import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import commands
import * as initCmd from './commands/init.js';
import * as pullCmd from './commands/pull.js';
import * as pushCmd from './commands/push.js';
import * as historyCmd from './commands/history.js';
import * as rollbackCmd from './commands/rollback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Read package.json
const pkgPath = path.join(__dirname, '../../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

export async function run() {
  const program = new Command();

  program
    .name('envpull')
    .description('Manage environment variables with GCS')
    .version(pkg.version);

  // Register commands
  initCmd.register(program);
  pullCmd.register(program);
  pushCmd.register(program);
  historyCmd.register(program);
  rollbackCmd.register(program);

  await program.parseAsync(process.argv);
}

