# envpull - Usage Scenarios & Edge Cases

A comprehensive guide covering all operation sequences, realistic use cases, and edge cases.

---

## Prerequisites & Authentication

### Do I need to login?

**Yes.** envpull uses Google Cloud's Application Default Credentials (ADC). Before using any command that talks to GCS, you need to authenticate:

```bash
gcloud auth application-default login
```

This opens a browser where you sign in with your Google account. The credentials are cached locally.

**Check your auth status anytime:**
```bash
envpull whoami
```

This shows your current Google account, project, and envpull configuration.

### Edge Cases - Authentication

| Scenario | What happens | Solution |
|----------|--------------|----------|
| `gcloud` CLI not installed | Error: `gcloud: command not found` or GCS SDK fails to find credentials | Install gcloud: https://cloud.google.com/sdk/docs/install |
| Not logged in | Error: `Could not load the default credentials` | Run `gcloud auth application-default login` |
| Token expired | Error: `Invalid credentials` or `Token has been expired` | Re-run `gcloud auth application-default login` |
| No permission on bucket | Error: `403 Forbidden` or `Access denied` | Ask bucket owner to grant you `Storage Object Viewer/Creator` role |
| Wrong Google account | Downloads/uploads to wrong bucket or permission denied | Run `gcloud auth application-default revoke` then login again with correct account |

---

## Scenario 1: First-Time Setup (New Project)

### The Happy Path

```bash
# 1. Install envpull
npm install -g @supercorks/envpull

# 2. Navigate to your project
cd my-project

# 3. Initialize - creates .envpull.yaml
envpull init
# Prompts: Source name (default: "default"), Bucket name

# 4. Create your .env file
echo "API_KEY=secret123" > .env

# 5. Push to GCS
envpull push
```

### Edge Cases - Installation

| Scenario | What happens | Solution |
|----------|--------------|----------|
| Node.js < 18 | May fail with syntax errors (ESM, optional chaining) | Upgrade Node.js to v18+ |
| No npm/npx | `command not found` | Install Node.js which includes npm |
| Permission denied on global install | `EACCES: permission denied` | Use `sudo npm install -g` or fix npm permissions |

### Edge Cases - `envpull init`

| Scenario | What happens | Solution |
|----------|--------------|----------|
| `.envpull.yaml` already exists | Prompts: "Config file already exists. Overwrite?" | Choose Yes to overwrite or No to abort |
| Invalid bucket name entered | Validation error, re-prompts | Enter valid name (3-63 chars, lowercase, numbers, hyphens) |
| GCP Project left blank | Config works without it (uses gcloud default) | Set later in `.envpull.yaml` or re-run init |
| Ctrl+C during prompts | Exits cleanly, no config created | Re-run `envpull init` |

### Edge Cases - `envpull push` (First Push)

| Scenario | What happens | Solution |
|----------|--------------|----------|
| Bucket doesn't exist | Prompts: "Bucket 'X' does not exist. Would you like to create it?" | Choose Yes to create, or enter a different bucket name |
| Bucket creation fails (name taken) | Error shown, prompts for different bucket name | Enter a globally unique bucket name |
| Bucket creation fails (no permission) | Error shown, prompts for different bucket name | Use a bucket you have permission to create, or ask admin |
| `.env` file doesn't exist | Error: "File '.env' not found locally" | Create the `.env` file first |
| Not in a git repo | Error: "Could not detect project name from git remote" | Initialize git: `git init && git remote add origin <url>` |
| Git remote not set | Error: "Could not detect project name from git remote" | Add a remote: `git remote add origin <url>` |
| No config file | Error: "Config not found. Run 'envpull init'" | Run `envpull init` first |
| Not authenticated with gcloud | Error about credentials | Run `gcloud auth application-default login` |

---

## Scenario 2: Joining an Existing Project (New Team Member)

### The Happy Path

```bash
# 1. Clone the repo (which includes .envpull.yaml)
git clone git@github.com:team/project.git
cd project

# 2. Authenticate with GCS
gcloud auth application-default login

# 3. Pull the env file
envpull pull
# Creates .env with the team's environment variables
```

### Edge Cases - `envpull pull`

| Scenario | What happens | Solution |
|----------|--------------|----------|
| No `.envpull.yaml` in repo | Error: "Config not found" | Ask teammate for the config or run `envpull init` |
| Bucket doesn't exist | Error: "The specified bucket does not exist" | Check bucket name in `.envpull.yaml`, ask teammate |
| Env file never pushed | Error: "Env file 'default' not found in bucket/project" | Someone needs to `envpull push` first |
| No permission to read bucket | Error: `403 Forbidden` | Ask bucket owner for `Storage Object Viewer` role |
| Local `.env` already exists | **Overwrites without warning** | Back up your `.env` first if needed |
| Multiple sources, none named "default" | Error: "Multiple sources found, please specify one" | Run `envpull pull <source-name>` |
| Wrong environment | Gets wrong variables | Use `--env` flag: `envpull pull --env develop` |

---

## Scenario 3: Daily Workflow - Updating Environment Variables

### Pulling Latest Changes

```bash
# Someone updated the env, pull the changes
envpull pull
```

### Pushing Your Changes

```bash
# You updated .env, share with team
envpull push
```

### Edge Cases - Concurrent Updates

| Scenario | What happens | Solution |
|----------|--------------|----------|
| Two people push at the same time | Last push wins, first push is in version history | Use `envpull history` and `envpull rollback` if needed |
| Pulled old version, pushed over new | Old version is now current, new version in history | Use `envpull rollback <generation>` to restore |
| Need to see what changed | No diff command yet | Pull to temp file: `envpull pull -f .env.remote` and diff |

---

## Scenario 4: Working with Multiple Environments

### Setup Multiple Environments

```bash
# Push development env
envpull push --env develop --file .env.develop

# Push production env  
envpull push --env prod --file .env.prod

# Push staging env
envpull push --env staging --file .env.staging
```

### Pulling Specific Environments

```bash
# Pull develop env
envpull pull --env develop --file .env.develop

# Pull prod env
envpull pull --env prod --file .env.prod
```

### Edge Cases - Multiple Environments

| Scenario | What happens | Solution |
|----------|--------------|----------|
| Wrong env name | Creates/pulls from wrong path in bucket | Double-check `--env` value |
| Forgot `--file` flag | Overwrites `.env` with wrong environment | Pull again with correct `--env` and `--file` |
| Env doesn't exist in bucket | Error: "Env file 'X' not found" | Push it first or check env name spelling |

---

## Scenario 5: Working with Multiple Sources (Buckets)

### Config with Multiple Sources

```yaml
# .envpull.yaml
project: my-gcp-project  # Optional: GCP project ID

sources:
  personal:
    bucket: gs://simon-envs
  team:
    bucket: gs://acme-team-envs
  client:
    bucket: gs://client-shared-envs
```

### Using Multiple Sources

```bash
# Push to your personal bucket
envpull push personal

# Pull from team bucket
envpull pull team

# Pull client's env
envpull pull client --env prod
```

### Edge Cases - Multiple Sources

| Scenario | What happens | Solution |
|----------|--------------|----------|
| No source specified, multiple exist, no "default" | Error: "Multiple sources found, please specify one" | Specify source: `envpull pull team` |
| Source name typo | Error: "Source 'X' not found in config" | Check `.envpull.yaml` for correct names |
| Different permissions per bucket | May succeed on one, fail on another | Get appropriate permissions for each bucket |

---

## Scenario 6: Version History & Rollback

### Viewing History

```bash
# See all versions of default env
envpull history

# See history for specific env
envpull history --env prod
```

**Output:**
```
History for my-project/default (Source: default)

Generation           Updated                        Size      
------------------------------------------------------------
1737999123456789     1/27/2026, 3:45:23 PM         256 B     
1737998000000000     1/27/2026, 2:30:00 PM         245 B     
1737990000000000     1/27/2026, 12:00:00 PM        230 B     
```

### Rolling Back

```bash
# Rollback to specific version
envpull rollback 1737998000000000

# Then pull to get it locally
envpull pull
```

### Edge Cases - History & Rollback

| Scenario | What happens | Solution |
|----------|--------------|----------|
| Bucket versioning not enabled | Only shows current version (generation) | Enable versioning on GCS bucket |
| Invalid generation ID | Error from GCS: "No such object" | Copy exact generation from `envpull history` |
| Rollback but forget to pull | Local file still has old content | Run `envpull pull` after rollback |
| No versions exist | "No versions found" | Nothing has been pushed yet |
| Version was deleted by lifecycle policy | Error: "No such object" | Version is gone, choose another |

---

## Scenario 7: Discovery - Exploring What Exists

### List All Environments

```bash
# List all envs for current project
envpull list

# List from specific source
envpull list team
```

**Output:**
```
📂 my-project
   Source: default  •  Bucket: my-bucket

   • default              2h ago  256 B
   • develop              1d ago  312 B
   • staging              3d ago  298 B
   • prod                 5d ago  287 B

💡 Pull with: envpull pull --env <name>
```

### Show Configured Sources

```bash
envpull sources
```

**Output:**
```
📦 Configured Sources

   Config: /path/to/project/.envpull.yaml

   • default (default)
     Bucket: gs://my-bucket

   • team
     Bucket: gs://team-shared-envs
```

### Compare Local vs Remote

```bash
# Basic diff
envpull diff

# With actual values shown
envpull diff --show-values

# Specific env
envpull diff --env prod --file .env.prod
```

**Output:**
```
🔍 Diff: .env ↔ default

   Local: .env  •  Remote: my-bucket/my-project/default.env

   + Added locally (1):
     + NEW_API_KEY=ab****yz

   - Missing locally (1):
     - OLD_SECRET=xy****ab

   ~ Modified (1):
     ~ DATABASE_URL
       local:  postgres://lo****st
       remote: postgres://re****te

   5 unchanged, 1 added, 1 missing, 1 modified

💡 Push changes: envpull push
💡 Pull remote: envpull pull
```

---

## Scenario 8: CI/CD Integration

### In GitHub Actions

```yaml
jobs:
  deploy:
    steps:
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - run: npm install -g @supercorks/envpull
      
      - run: envpull pull --env prod --file .env.prod
```

### Edge Cases - CI/CD

| Scenario | What happens | Solution |
|----------|--------------|----------|
| No service account key | Auth fails | Set up GCP service account and add key to secrets |
| Service account lacks permissions | 403 Forbidden | Grant `Storage Object Viewer` role to SA |
| `.envpull.yaml` not in repo | Config not found | Commit `.envpull.yaml` to repo |
| Interactive prompt in CI | Hangs forever (bucket doesn't exist) | Ensure bucket exists before CI runs |

---

## Scenario 9: Monorepo with Multiple Projects

### Structure

```
monorepo/
├── .envpull.yaml        # Root config
├── apps/
│   ├── web/
│   │   └── .env
│   └── api/
│       └── .env
└── packages/
```

### Approach 1: Single Config, Different Envs

```bash
# From repo root
envpull push --env web --file apps/web/.env
envpull push --env api --file apps/api/.env

envpull pull --env web --file apps/web/.env
envpull pull --env api --file apps/api/.env
```

### Approach 2: Separate Configs Per App

```bash
# Each app has its own .envpull.yaml
cd apps/web && envpull pull
cd apps/api && envpull pull
```

---

## Scenario 10: Troubleshooting Common Issues

### "Bucket 'xxx' does not exist"

**What you'll see:**
```
⚠️  Bucket 'my-bucket' does not exist
? Create bucket 'my-bucket'? (Y/n)
```

**Causes:**
1. Bucket name typo in `.envpull.yaml`
2. Bucket was deleted
3. Bucket is in different GCP project than your credentials

**Solutions:**
1. Say Yes to create it (if you have permission)
2. Enter a different bucket name when prompted
3. Fix the name in `.envpull.yaml`

### "Not authenticated with Google Cloud"

**What you'll see:**
```
✖ Not authenticated with Google Cloud
💡 Run: gcloud auth application-default login
```

**Solution:**
```bash
gcloud auth application-default login
```

### "Could not detect project name"

**What you'll see:**
```
✖ Could not detect project name
💡 Ensure this is a git repo with a remote configured
💡 Run: git remote -v to check
```

**Solutions:**
```bash
# Check if in git repo
git status

# Check remotes
git remote -v

# Add remote if missing
git remote add origin git@github.com:user/repo.git
```

### "No configuration found"

**What you'll see:**
```
✖ No configuration found
💡 Run envpull init to create one
```

**Solutions:**
1. Run `envpull init` to create config
2. `cd` to project root where `.envpull.yaml` exists

### "Permission denied"

**What you'll see:**
```
✖ Permission denied
💡 Ask the bucket owner to grant you Storage Object Admin role
```

**Solutions:**
```bash
# Re-authenticate (maybe wrong account)
gcloud auth application-default revoke
gcloud auth application-default login

# Check current account
gcloud auth list
```

### "Environment 'xxx' not found"

**What you'll see:**
```
✖ Environment 'develop' not found
💡 No file at my-bucket/my-project/develop.env - has it been pushed yet?
```

**Solutions:**
1. Push it first: `envpull push --env develop`
2. Check the env name spelling
3. Use `envpull history` to see what exists

### "Version 'xxx' not found" (rollback)

**What you'll see:**
```
✖ Version '12345' not found
💡 Run "envpull history" to see available versions
```

**Solution:**
Run `envpull history` and copy the exact generation ID from the list.

---

## Command Reference Quick Card

| Command | Description | Common Options |
|---------|-------------|----------------|
| `envpull init` | Create `.envpull.yaml` config | - |
| `envpull push [source]` | Upload `.env` to GCS | `--env`, `--file` |
| `envpull pull [source]` | Download `.env` from GCS | `--env`, `--file` |
| `envpull list [source]` | List all environments | - |
| `envpull diff [source]` | Compare local vs remote | `--env`, `--file`, `--show-values` |
| `envpull history [source]` | Show version history | `--env` |
| `envpull rollback <gen> [source]` | Restore a previous version | `--env`, `--yes` |
| `envpull sources` | List configured sources | - |
| `envpull whoami` | Show auth & config info | - |
| `envpull --version` | Show version | - |
| `envpull --help` | Show help | - |

---

## File Structure in GCS

```
gs://your-bucket/
└── <project-name>/           # Auto-detected from git remote
    ├── default.env           # envpull push/pull (no --env)
    ├── develop.env           # envpull push/pull --env develop
    ├── staging.env           # envpull push/pull --env staging
    └── prod.env              # envpull push/pull --env prod
```

---

## Checklist: Before Your First Push

- [ ] Node.js 18+ installed
- [ ] gcloud CLI installed
- [ ] Authenticated: `gcloud auth application-default login`
- [ ] In a git repo with a remote configured
- [ ] Created config: `envpull init`
- [ ] Have a `.env` file to push
- [ ] Have permission to write to the GCS bucket (or will create it)
