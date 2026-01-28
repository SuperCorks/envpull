# AGENTS.md

Guidelines for AI agents working on the envpull codebase.

## Project Overview

envpull is a CLI tool for securely sharing `.env` files via Google Cloud Storage (GCS) buckets. It uses Commander.js for CLI parsing, `@google-cloud/storage` for GCS operations, and chalk/ora for user interface.

## Quick Reference

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run locally
node bin/envpull.js <command>

# Link for global usage during development
npm link
```

## Architecture

```
bin/envpull.js          # Entry point
src/
  cli/
    index.js            # Commander program setup
    commands/           # One file per CLI command
  config/
    index.js            # .envpull.yaml loading/saving
  lib/
    env.js              # .env parsing/formatting
    gcs.js              # GCS client wrapper with error handling
    git.js              # Git remote detection
    ui.js               # UI helpers (spinner, colors, formatting)
tests/
  unit/                 # Pure unit tests with mocks
  integration/          # Integration tests (still mocked, but test full flows)
```

## Code Conventions

### ES Modules
All files use ES modules (`"type": "module"` in package.json):
```javascript
import { something } from './module.js';
export function myFunction() { }
```

### Command Structure
Each command exports a `register(program)` function:
```javascript
export function register(program) {
  program
    .command('name [args]')
    .description('What it does')
    .option('-e, --env <name>', 'Option description', 'default')
    .action(async (args, options) => {
      // Implementation
    });
}
```

### Error Handling Pattern
Use the `GCSError` class with actionable hints:
```javascript
throw new GCSError(
  'User-friendly error message',
  'Actionable hint for the user',
  originalError
);
```

Commands should catch errors and display them consistently:
```javascript
function handleError(spinner, error) {
  spinner.fail(error.message);
  if (error.hint) {
    console.log(ui.hint(error.hint));
  }
  process.exit(1);
}
```

### UI Helpers
Always use `src/lib/ui.js` for consistent output:
```javascript
import { ui } from '../lib/ui.js';

const spinner = ui.spinner('Loading...').start();
spinner.succeed(ui.success('Done!'));
spinner.fail('Failed');

console.log(ui.hint('Run: envpull init'));
console.log(ui.kv('Source', 'value'));
console.log(ui.path('.env'));
console.log(ui.cmd('envpull pull'));
console.log(ui.list(['item1', 'item2']));
```

### Configuration
Config is loaded from `.envpull.yaml` using yaml traversal up the directory tree:
```javascript
import { loadConfig, saveConfig } from '../config/index.js';

const result = await loadConfig();
if (!result) {
  // No config found
}
const { config, filepath } = result;
```

## Testing

### Test Framework
Uses Vitest with the following patterns:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('module/function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should do something specific', () => {
    expect(result).toBe(expected);
  });
});
```

### Mocking Pattern
Mock modules at the top of test files:
```javascript
vi.mock('../../../src/lib/gcs.js', () => ({
  GCSClient: vi.fn(),
  GCSError: class GCSError extends Error {
    constructor(message, hint) {
      super(message);
      this.hint = hint;
    }
  }
}));
```

Mock the UI spinner with a chainable object:
```javascript
const spinnerMock = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn(),
  fail: vi.fn(),
  stop: vi.fn(),
  text: ''
};
ui.spinner.mockReturnValue(spinnerMock);
```

### Test Organization
- `tests/unit/` - Test individual functions in isolation
- `tests/integration/cli/` - Test CLI commands end-to-end (with mocked external services)

## Common Patterns

### Resolving Source from Config
```javascript
if (!sourceName) {
  const keys = Object.keys(config.sources || {});
  if (keys.length === 0) {
    // No sources
  } else if (config.sources['default']) {
    sourceName = 'default';
  } else if (keys.length === 1) {
    sourceName = keys[0];
  } else {
    // Multiple sources - ask user to specify
  }
}
```

### GCS Operations
```javascript
import { GCSClient, GCSError } from '../lib/gcs.js';

const client = new GCSClient(config.project);
try {
  const content = await client.download(bucket, project, envName);
} catch (err) {
  // GCSError with .hint property
}
```

### Git Project Detection
```javascript
import { getProjectName } from '../lib/git.js';

const project = await getProjectName();
// Returns: 'org/repo-name' or null
```

## Best Practices

1. **Always provide hints** - When errors occur, give users actionable next steps
2. **Use spinners** - Show progress for any async operation
3. **Normalize bucket names** - Use `client.normalizeBucketName()` to strip `gs://` prefix
4. **Sort env keys** - When writing .env files, sort alphabetically for consistency
5. **Quote values** - Always wrap .env values in double quotes
6. **Exit with code 1** - Call `process.exit(1)` on errors after displaying message

## Version Bumping

When making changes, always check if the version in `package.json` has been bumped compared to `main`:

```bash
# Check current version vs main
git show main:package.json | grep '"version"'
```

If the version hasn't been bumped yet, bump it according to semver:
- **Patch** (1.0.x): Bug fixes, small changes, documentation updates
- **Minor** (1.x.0): New features, new commands, backward-compatible additions
- **Major** (x.0.0): Breaking changes, removed commands, config format changes

Only bump once per PR/branch—if already bumped, no further bump needed.

## File Naming

- Commands: `src/cli/commands/<verb>.js` (e.g., `pull.js`, `push.js`)
- Libraries: `src/lib/<domain>.js` (e.g., `gcs.js`, `git.js`)
- Tests mirror source: `tests/unit/lib/env.test.js` for `src/lib/env.js`

## Dependencies

Key dependencies and their purposes:
- `commander` - CLI argument parsing
- `@google-cloud/storage` - GCS SDK
- `chalk` - Terminal colors
- `ora` - Spinner animations
- `@inquirer/prompts` - Interactive prompts
- `dotenv` - .env file parsing
- `js-yaml` - YAML config parsing
- `simple-git` - Git operations
- `diff` - Text diffing for the diff command
- `execa` - Shell command execution
