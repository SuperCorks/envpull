import { loadConfig } from '../../config/index.js';
import { GCSClient, GCSError } from '../../lib/gcs.js';
import { ui } from '../../lib/ui.js';

// Role display names
const ROLE_LABELS = {
  'roles/storage.objectViewer': 'Viewer (read-only)',
  'roles/storage.objectAdmin': 'Admin (read-write)',
  'roles/storage.admin': 'Storage Admin',
  'roles/storage.legacyBucketOwner': 'Bucket Owner',
  'roles/storage.legacyBucketReader': 'Legacy Reader',
  'roles/storage.legacyBucketWriter': 'Legacy Writer',
  'roles/storage.legacyObjectOwner': 'Object Owner',
  'roles/storage.legacyObjectReader': 'Object Reader',
};

function formatRole(role) {
  return ROLE_LABELS[role] || role.replace('roles/', '');
}

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
    .command('grants [source]')
    .description('Show who has access to a bucket')
    .action(async (sourceName) => {
      const spinner = ui.spinner('Loading config...').start();

      try {
        const result = await loadConfig();
        if (!result) {
          spinner.fail('No configuration found');
          console.log(ui.hint('Run "envpull init" to create one'));
          process.exit(1);
        }

        const { config } = result;
        const source = resolveSource(config, sourceName);
        const client = new GCSClient(source.project);
        const bucketName = client.normalizeBucketName(source.bucket);

        spinner.text = 'Fetching bucket access...';
        const bindings = await client.getIamPolicy(bucketName);

        spinner.stop();

        // Filter for user: members and relevant storage roles
        const relevantRoles = [
          'roles/storage.objectViewer',
          'roles/storage.objectAdmin',
          'roles/storage.admin'
        ];

        // Group users by their highest relevant role
        const userRoles = new Map();
        
        for (const binding of bindings) {
          if (!relevantRoles.includes(binding.role)) continue;
          
          for (const member of binding.members) {
            if (member.startsWith('user:')) {
              const email = member.replace('user:', '');
              const existing = userRoles.get(email);
              // Keep higher privilege role (admin > viewer)
              if (!existing || binding.role.includes('Admin')) {
                userRoles.set(email, binding.role);
              }
            }
          }
        }

        console.log(ui.bold(`\n🔐 Bucket Access: ${bucketName}\n`));
        console.log(ui.dim(`   Source: ${source.name}\n`));

        if (userRoles.size === 0) {
          console.log(ui.warn('   No individual user grants found'));
          console.log(ui.hint('\nGrant access with: envpull grant <email>'));
          return;
        }

        // Sort by role then email
        const sorted = [...userRoles.entries()].sort((a, b) => {
          if (a[1] !== b[1]) return a[1].localeCompare(b[1]);
          return a[0].localeCompare(b[0]);
        });

        for (const [email, role] of sorted) {
          const roleLabel = formatRole(role);
          console.log(`   ${ui.success('•')} ${email}`);
          console.log(`     ${ui.dim(roleLabel)}`);
        }

        console.log(ui.hint(`\nGrant access: envpull grant <email>`));

      } catch (error) {
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
