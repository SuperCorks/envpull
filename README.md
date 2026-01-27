# envpull

A CLI tool for sharing and syncing `.env` files via Google Cloud Storage (GCS) buckets.

## Overview

envpull makes it easy to share environment variables across team members and environments. Instead of copying `.env` files through insecure channels (Slack, email), store them securely in GCS buckets with proper access controls.

**Key features:**
- Config-based: Each repo has `.envpull.yml` defining named sources
- Multiple sources: Different team members can have their own buckets
- Environment support: Manage `default`, `develop`, `prod`, etc.
- Smart caching: Remembers your last used source and environment
- Git-aware: Auto-detects project name from git remote

## Installation

### Using Go

```bash
go install github.com/supercorks/envpull/cmd/envpull@latest
```

### Using Homebrew (macOS)

```bash
brew tap supercorks/tap
brew install envpull
```

### Binary Download

Download the latest release from the [releases page](https://github.com/supercorks/envpull/releases).

## Quick Start

### 1. Initialize your project

```bash
cd your-project
envpull init
```

This will:
- Detect your project name from git remote
- Prompt for source configuration
- Create `.envpull.yml`
- Add `.envpull.cache` to `.gitignore`

### 2. Push your first env

```bash
envpull push simon
```

### 3. Pull on another machine

```bash
envpull simon
```

## Commands

### Pull (Default)

Pull an env file from a remote source:

```bash
# Pull default env from 'simon' source
envpull simon

# Uses cached source if available
envpull

# Pull specific environment
envpull simon --env develop

# Pull to a specific file
envpull simon --env prod --file .env.prod

# Force overwrite without confirmation
envpull simon --force
```

### Push

Push a local env file to a remote source:

```bash
# Push to cached source
envpull push

# Push to specific source
envpull push simon

# Push as specific environment
envpull push simon --env develop

# Push from specific file
envpull push simon --env develop --file .env.dev
```

### List

List available environments:

```bash
# List from cached source
envpull ls

# List from specific source
envpull ls simon
```

### Sources

Manage configured sources:

```bash
# List all sources
envpull sources

# Add a new source
envpull source add team --bucket gs://team-envs --project my-gcp-project

# Remove a source
envpull source remove team
```

### Initialize

Set up envpull for a new project:

```bash
envpull init
```

### Authentication

```bash
# Login with Google Cloud
envpull login

# Show current identity
envpull whoami
```

### Utilities

```bash
# Compare local vs remote
envpull diff simon --env develop

# Show remote contents
envpull show simon --env prod

# Print version
envpull version
```

## Configuration

### .envpull.yml

This file defines your sources. Commit it to your repo so team members can pull envs.

```yaml
sources:
  - name: simon
    bucket: gs://simon-envs
    project: simons-gcp-project
    
  - name: team
    bucket: gs://team-shared-envs
    project: team-gcp-project
```

### .envpull.cache

This file stores your last used source and environment. It's auto-generated and should be gitignored.

```yaml
last_source: simon
last_env: develop
```

### GCS Bucket Structure

envpull organizes files by project name (auto-detected from git remote):

```
gs://your-bucket/
└── your-project-name/
    ├── default.env
    ├── develop.env
    └── prod.env
```

## Security

### GCS IAM Permissions

Users need the following permissions on the GCS bucket:

- `storage.objects.create` - to push
- `storage.objects.get` - to pull/show
- `storage.objects.list` - to list environments
- `storage.objects.delete` - to overwrite existing envs

Recommended: Use a dedicated service account or rely on individual user permissions with Google Cloud IAM.

### Authentication

envpull uses Application Default Credentials (ADC). Run `envpull login` to authenticate, which executes:

```bash
gcloud auth application-default login
```

### Best Practices

1. **Use separate buckets** for different security levels (e.g., prod secrets vs dev)
2. **Enable bucket versioning** to track changes
3. **Set up bucket lifecycle policies** to auto-delete old versions
4. **Use IAM conditions** to restrict access by project or environment
5. **Audit access** using GCS access logs

## Development

### Building

```bash
make build
```

### Testing

```bash
make test
```

### Installing locally

```bash
make install
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
