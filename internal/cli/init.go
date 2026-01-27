package cli

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"github.com/supercorks/envpull/internal/config"
	"github.com/supercorks/envpull/internal/gcs"
	"github.com/supercorks/envpull/internal/git"
	"github.com/supercorks/envpull/internal/ui"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize envpull configuration",
	Long: `Initialize envpull configuration for the current project.

This command will:
1. Detect the project name from git remote
2. Prompt for source configuration (name, bucket, GCP project)
3. Create .envpull.yml configuration file
4. Add .envpull.cache to .gitignore

Example:
  envpull init`,
	Args: cobra.NoArgs,
	RunE: runInit,
}

func runInit(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	// Check if already initialized
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get current directory: %w", err)
	}

	if config.ConfigExists(cwd) {
		ui.Warning("Configuration already exists in this directory")
		confirmed, err := ui.Confirm("Reinitialize?")
		if err != nil {
			return err
		}
		if !confirmed {
			ui.Info("Aborted")
			return nil
		}
	}

	// Check if in a git repo
	if !git.IsGitRepo() {
		ui.Warning("Not in a git repository")
		ui.Info("envpull uses git remote to detect project name")
	}

	// Detect project name
	var projectName string
	projectName, err = git.GetProjectName()
	if err != nil {
		ui.Warning("Could not detect project name from git: %v", err)
		projectName, err = ui.InputRequired("Project name")
		if err != nil {
			return err
		}
	} else {
		ui.Success("Detected project: %s", projectName)
	}

	// Get default GCP project
	defaultGCPProject, _ := gcs.GetCurrentProject()

	ui.Println("\nLet's configure your first source:\n")

	// Get source name
	sourceName, err := ui.Input("Source name (e.g., your name or 'team')", "")
	if err != nil {
		return err
	}
	if sourceName == "" {
		return fmt.Errorf("source name is required")
	}

	// Get bucket name
	bucketName, err := ui.Input("GCS bucket (e.g., gs://my-envs)", "")
	if err != nil {
		return err
	}
	if bucketName == "" {
		return fmt.Errorf("bucket name is required")
	}
	if !strings.HasPrefix(bucketName, "gs://") {
		bucketName = "gs://" + bucketName
	}

	// Get GCP project
	gcpProject, err := ui.Input("GCP project ID", defaultGCPProject)
	if err != nil {
		return err
	}
	if gcpProject == "" {
		return fmt.Errorf("GCP project is required")
	}

	// Create GCS client to verify access
	client, err := gcs.NewClient(ctx)
	if err != nil {
		ui.Warning("Could not create GCS client: %v", err)
		ui.Info("You may need to run 'envpull login' first")
	} else {
		defer client.Close()

		// Check if bucket exists
		exists, err := client.BucketExists(ctx, bucketName)
		if err != nil {
			ui.Warning("Could not verify bucket access: %v", err)
		} else if !exists {
			ui.Warning("Bucket '%s' does not exist", bucketName)
			createBucket, err := ui.Confirm("Create it?")
			if err != nil {
				return err
			}
			if createBucket {
				if err := client.CreateBucket(ctx, bucketName, gcpProject); err != nil {
					return fmt.Errorf("failed to create bucket: %w", err)
				}
				ui.Success("Created bucket '%s'", bucketName)
			}
		} else {
			ui.Success("Verified bucket access")
		}
	}

	// Create config
	cfg := &config.Config{
		Sources: []config.Source{
			{
				Name:    sourceName,
				Bucket:  bucketName,
				Project: gcpProject,
			},
		},
	}

	// Save config
	if err := config.SaveConfig(cwd, cfg); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}
	ui.Success("Created .envpull.yml")

	// Add .envpull.cache to .gitignore
	if err := addToGitignore(cwd, ".envpull.cache"); err != nil {
		ui.Warning("Could not update .gitignore: %v", err)
	} else {
		ui.Success("Added .envpull.cache to .gitignore")
	}

	ui.Println("\n🎉 envpull is ready!")
	ui.Println("\nNext steps:")
	ui.Println("  • Push your first env:  envpull push %s", sourceName)
	ui.Println("  • Pull an env:          envpull %s", sourceName)
	ui.Println("  • List environments:    envpull ls %s", sourceName)

	return nil
}

func addToGitignore(dir, entry string) error {
	gitignorePath := filepath.Join(dir, ".gitignore")

	// Read existing content
	content, err := os.ReadFile(gitignorePath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	// Check if entry already exists
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == entry {
			return nil // Already present
		}
	}

	// Append entry
	f, err := os.OpenFile(gitignorePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	// Add newline if file doesn't end with one
	if len(content) > 0 && content[len(content)-1] != '\n' {
		if _, err := f.WriteString("\n"); err != nil {
			return err
		}
	}

	if _, err := f.WriteString(entry + "\n"); err != nil {
		return err
	}

	return nil
}
