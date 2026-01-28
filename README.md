# envpull

**Stop sharing `.env` files over Slack.** Store them securely in Google Cloud Storage with version history and team access control.

```bash
npm install -g @supercorks/envpull
```

---

## 30-Second Quick Start

```bash
# 1. Login to Google Cloud (one-time)
gcloud auth application-default login

# 2. Initialize in your project
cd your-project
envpull init            # Creates .envpull.yaml

# 3. Push your .env
envpull push            # Uploads to GCS bucket

# 4. Pull on another machine (or share with teammate)
envpull pull            # Downloads .env from GCS
```

That's it. Your `.env` is now synced via GCS.

---

## Commands at a Glance

| Command | What it does |
|---------|--------------|
| `envpull init` | Set up envpull for your project |
| `envpull push` | Upload your `.env` to GCS |
| `envpull pull` | Download `.env` from GCS |
| `envpull diff` | Compare local vs remote |
| `envpull list` | Show all available environments |
| `envpull history` | View version history |
| `envpull rollback <id>` | Restore a previous version |
| `envpull grant <email>` | Grant bucket access to a teammate |
| `envpull sources` | List configured sources |
| `envpull whoami` | Check your auth & config |

> **Tip:** Run `envpull <command> --help` for detailed options

---

## Common Workflows

### Grant Access to a Teammate

```bash
envpull grant teammate@company.com       # Full read/write access
envpull grant teammate@company.com --read-only   # Read-only access
```

They'll be able to `envpull pull` immediately after.

### New Team Member Setup

Clone the repo (it includes `.envpull.yaml`), then:

```bash
gcloud auth application-default login
envpull pull
```

### Multiple Environments

```bash
# Push staging env
envpull push --env staging --file .env.staging

# Pull prod env
envpull pull --env prod --file .env.prod
```

### Compare Before Pulling

```bash
envpull diff                  # See what's different (values masked)
envpull diff --show-values    # See actual values
```

### Oops, Need to Rollback

```bash
envpull history               # Find the generation ID
envpull rollback 1737999123456789
envpull pull                  # Get the restored version
```

---

## Configuration

### `.envpull.yaml`

Created by `envpull init`. Commit this to your repo.

```yaml
project: my-gcp-project       # Optional: GCP project ID

sources:
  default:
    bucket: my-team-envs      # GCS bucket name

  # Add more sources for different buckets
  personal:
    bucket: simon-dev-envs
```

### Using Multiple Sources

```bash
envpull pull personal         # Pull from 'personal' source
envpull push default          # Push to 'default' source
```

### GCS Bucket Structure

Files are organized by project (auto-detected from git remote):

```
gs://your-bucket/
└── org/repo-name/            # From git remote
    ├── default.env           # envpull push/pull
    ├── develop.env           # envpull push --env develop
    ├── staging.env
    └── prod.env
```

---

## Requirements

- **Node.js 18+**
- **gcloud CLI** — [Install here](https://cloud.google.com/sdk/docs/install)
- **Git repo with remote** — Project name is derived from the git remote URL

### Authentication

envpull uses Google Cloud Application Default Credentials:

```bash
gcloud auth application-default login
```

Check your status anytime with `envpull whoami`.

---

## GCS Bucket Permissions

Users need these IAM permissions on the bucket:

| Permission | Required for |
|------------|--------------|
| `storage.objects.get` | pull, diff, history |
| `storage.objects.list` | list |
| `storage.objects.create` | push |
| `storage.objects.delete` | push (overwrite) |

**Quick setup:** Grant `Storage Object Admin` role for full access, or `Storage Object Viewer` for read-only.

---

## Security Best Practices

1. **Enable bucket versioning** — Automatic history & rollback capability
2. **Use separate buckets** — Keep prod secrets isolated from dev
3. **Set lifecycle policies** — Auto-delete old versions after N days
4. **Review IAM regularly** — Remove access for departed team members
5. **Use IAM conditions** — Restrict access by environment if needed

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `gcloud: command not found` | [Install gcloud CLI](https://cloud.google.com/sdk/docs/install) |
| `Could not load credentials` | Run `gcloud auth application-default login` |
| `Permission denied` / `403` | Ask bucket owner for access, or check you're using the right Google account |
| `Could not detect project name` | Ensure you're in a git repo with a remote: `git remote -v` |
| `Config not found` | Run `envpull init` or `cd` to the directory with `.envpull.yaml` |
| `Bucket does not exist` | Say "yes" to create it, or fix the name in `.envpull.yaml` |

---

## CI/CD Usage

Example for GitHub Actions:

```yaml
- uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}

- run: npm install -g @supercorks/envpull

- run: envpull pull --env prod --file .env.prod
```

---

## Development

```bash
git clone <repo>
npm install
node bin/envpull.js <command>   # Run locally

npm link                        # Link globally for testing
npm test                        # Run tests
```

---

## License

MIT — see [LICENSE](LICENSE)
