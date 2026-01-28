# envpull

A CLI tool for sharing and syncing `.env` files via Google Cloud Storage (GCS) buckets.

## Overview

envpull makes it easy to share environment variables across team members and environments. Instead of copying `.env` files through insecure channels (Slack, email), store them securely in GCS buckets with proper access controls.

**Key features:**
- Config-based: Each repo has `.envpull.yaml` defining named sources
- Multiple sources: Different team members can have their own buckets
- Environment support: Manage `default`, `develop`, `prod`, etc.
- Git-aware: Auto-detects project name from git remote
- Version history: Rollback to previous versions of your environment files

## Prerequisites

- **Node.js**: Version 18 or higher.
- **gcloud CLI**: Required for Authentication (ADC). [Install gcloud](https://cloud.google.com/sdk/docs/install).

## Installation

```bash
npm install -g envpull
```

or run directly with npx:

```bash
npx envpull <command>
```

## Quick Start

### 1. Initialize your project

```bash
cd your-project
envpull init
```

This will prompt you for:
- A source name (alias for the bucket)
- A GCS bucket name

And create `.envpull.yaml` in your project.

### 2. Push your first env

```bash
envpull push
```

### 3. Pull on another machine

```bash
envpull pull
```

## Commands

### Pull

Pull an env file from a remote source:

```bash
# Pull from the default/only source
envpull pull

# Pull from a specific source
envpull pull simon

# Pull specific environment
envpull pull simon --env develop

# Pull to a specific file
envpull pull simon --env prod --file .env.prod
```

### Push

Push a local env file to a remote source:

```bash
# Push to the default/only source
envpull push

# Push to specific source
envpull push simon

# Push as specific environment
envpull push simon --env develop

# Push from specific file
envpull push simon --env develop --file .env.dev
```

### Initialize

Set up envpull for a new project:

```bash
envpull init
```

### History

Show version history for an environment:

```bash
# Show history for default env
envpull history

# Show history for specific source/env
envpull history simon --env develop
```

### Rollback

Rollback to a previous version using the GCS generation ID (shown in `history` output):

```bash
# Rollback default env
envpull rollback <generation>

# Rollback specific source/env
envpull rollback <generation> simon --env develop
```

After rolling back, run `envpull pull` to update your local file.

### Who Am I

Check your current authentication and configuration:

```bash
envpull whoami
```

Shows your Google account, GCP project, and envpull configuration.

### List Environments

List all environments available for a project:

```bash
# List all envs
envpull list

# List from specific source
envpull list team
```

### Diff

Compare your local `.env` with the remote version:

```bash
# Basic diff (values masked)
envpull diff

# Show actual values
envpull diff --show-values

# Compare specific env
envpull diff --env prod --file .env.prod
```

### Sources

List all configured sources:

```bash
envpull sources
```

### Version

```bash
envpull --version
```

## Configuration

### .envpull.yaml

This file defines your sources. Commit it to your repo so team members can pull envs.

```yaml
# Optional: specify GCP project (defaults to gcloud config)
project: my-gcp-project

sources:
  simon:
    bucket: gs://simon-envs

  team:
    bucket: gs://team-shared-envs
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

envpull uses Application Default Credentials (ADC). Authenticate with:

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

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run locally:
   ```bash
   node bin/envpull.js <command>
   ```
   e.g. `node bin/envpull.js pull`

### Link for local development

```bash
npm link
# Now you can run `envpull` globally pointing to this repo
envpull --version
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
