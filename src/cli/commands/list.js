import { loadConfig } from '../../config/index.js';
import { getProjectName } from '../../lib/git.js';
import { GCSClient, GCSError } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';

/**
 * Handles errors with proper formatting and hints
 */
function handleError(spinner, error) {
  spinner.fail(error.message);
  if (error.detail) {
    console.log(ui.dim(`   ${error.detail}`));
  }
  if (error.hint) {
    console.log(ui.hint(error.hint));
  }
  process.exit(1);
}

export function register(program) {
  program
    .command('list [source]')
    .alias('ls')
    .description('Show available branches and files in bucket')
    .option('-b, --branch <name>', 'Show files in specific branch')
    .action(async (sourceName, options) => {
      const spinner = ui.spinner('Fetching...').start();

      try {
        const result = await loadConfig();
        if (!result) {
          spinner.fail('No configuration found');
          console.log(ui.hint(`Run ${ui.cmd('envpull init')} to create one`));
          return;
        }
        const { config } = result;

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
            console.log(ui.hint(`Usage: ${ui.cmd(`envpull list <source>`)}`));
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

        const project = await getProjectName();
        if (!project) {
          spinner.fail('Could not detect project name');
          console.log(ui.hint('Ensure this is a git repo with a remote configured'));
          return;
        }

        const client = new GCSClient(source.project);

        // If a specific branch is requested, show files in that branch
        if (options.branch) {
          let files;
          try {
            files = await client.listFiles(source.bucket, project, options.branch);
          } catch (err) {
            handleError(spinner, err);
          }

          spinner.stop();

          if (files.length === 0) {
            console.log(ui.warn(`\n📭 No files found in branch '${options.branch}'`));
            console.log(ui.hint(`Push with ${ui.cmd(`envpull push .env -b ${options.branch}`)}`));
            return;
          }

          console.log(ui.bold(`\n📂 ${project}/${options.branch}`));
          console.log(ui.dim(`   Source: ${sourceName}  •  Bucket: ${source.bucket}\n`));

          files.forEach(file => {
            const age = formatAge(file.updated);
            console.log(`   ${ui.success('•')} ${file.name.padEnd(20)} ${ui.dim(age)}  ${ui.dim(formatBytes(file.size))}`);
          });

          console.log(ui.hint(`\nPull with: ${ui.cmd(`envpull pull <file> -b ${options.branch}`)}`));
          return;
        }

        // Otherwise, show branches with their files
        let branches;
        try {
          branches = await client.listBranches(source.bucket, project);
        } catch (err) {
          handleError(spinner, err);
        }

        if (branches.length === 0) {
          spinner.stop();
          console.log(ui.warn(`\n📭 No branches found for '${project}'`));
          console.log(ui.hint(`Push with ${ui.cmd('envpull push')}`));
          return;
        }

        // Fetch files for each branch
        const branchFiles = {};
        for (const branch of branches) {
          try {
            branchFiles[branch.name] = await client.listFiles(source.bucket, project, branch.name);
          } catch (err) {
            branchFiles[branch.name] = [];
          }
        }

        spinner.stop();

        console.log(ui.bold(`\n📂 ${project}`));
        console.log(ui.dim(`   Source: ${sourceName}  •  Bucket: ${source.bucket}\n`));

        for (const branch of branches) {
          const files = branchFiles[branch.name];
          console.log(`   ${ui.bold(branch.name)}/`);
          
          if (files.length === 0) {
            console.log(ui.dim('      (empty)'));
          } else {
            files.forEach(file => {
              const age = formatAge(file.updated);
              console.log(`      ${ui.success('•')} ${file.name.padEnd(18)} ${ui.dim(age)}  ${ui.dim(formatBytes(file.size))}`);
            });
          }
          console.log('');
        }

        console.log(ui.hint(`Pull: ${ui.cmd(`envpull pull <file> -b <branch>`)}`));

      } catch (error) {
        handleError(spinner, error);
      }
    });
}

function formatAge(date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function formatBytes(bytes) {
  bytes = parseInt(bytes, 10);
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
