package cli

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/supercorks/envpull/internal/config"
	"github.com/supercorks/envpull/internal/env"
	"github.com/supercorks/envpull/internal/gcs"
	"github.com/supercorks/envpull/internal/git"
	"github.com/supercorks/envpull/internal/ui"
)

var pushCmd = &cobra.Command{
	Use:   "push [source]",
	Short: "Push a local env file to a remote source",
	Long: `Push a local env file to a configured GCS source.

Examples:
  # Push .env to cached source
  envpull push

  # Push to a specific source
  envpull push simon

  # Push as a specific environment
  envpull push simon --env develop

  # Push a specific file
  envpull push simon --env develop --file .env.dev`,
	Args: cobra.MaximumNArgs(1),
	RunE: runPush,
}

func init() {
	pushCmd.Flags().StringP("env", "e", "default", "Environment name to push as")
	pushCmd.Flags().StringP("file", "f", ".env", "Local file path to read")
}

func runPush(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	// Get flags
	envName, _ := cmd.Flags().GetString("env")
	filePath, _ := cmd.Flags().GetString("file")

	// Check if local file exists
	if !env.FileExists(filePath) {
		return fmt.Errorf("file '%s' not found", filePath)
	}

	// Find and load config
	configDir, err := config.FindConfigDir()
	if err != nil {
		return fmt.Errorf("config not found: %w\n\nRun 'envpull init' to create a configuration", err)
	}

	cfg, err := config.LoadConfig(configDir)
	if err != nil {
		return err
	}

	// Load cache
	cache, err := config.LoadCache(configDir)
	if err != nil {
		return err
	}

	// Determine source name
	var sourceName string
	if len(args) > 0 {
		sourceName = args[0]
	} else if cache.LastSource != "" {
		sourceName = cache.LastSource
		ui.Info("Using cached source: %s", sourceName)
	} else {
		return fmt.Errorf("no source specified and no cached source found\n\nUsage: envpull push <source>")
	}

	// Use cached env if not specified
	if envName == "default" && cache.LastEnv != "" && cache.LastSource == sourceName {
		envName = cache.LastEnv
		ui.Info("Using cached env: %s", envName)
	}

	// Get source configuration
	source := cfg.GetSource(sourceName)
	if source == nil {
		return fmt.Errorf("source '%s' not found in config\n\nAvailable sources: %v", sourceName, getSourceNames(cfg))
	}

	// Get project name from git
	projectName, err := git.GetProjectName()
	if err != nil {
		return fmt.Errorf("failed to detect project name: %w", err)
	}

	// Read local file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// Create GCS client
	client, err := gcs.NewClient(ctx)
	if err != nil {
		return err
	}
	defer client.Close()

	// Check if remote exists and confirm overwrite
	exists, err := client.Exists(ctx, source.Bucket, projectName, envName)
	if err != nil {
		ui.Warning("Could not check if remote exists: %v", err)
	} else if exists {
		ui.Warning("Remote %s/%s.env already exists in %s", projectName, envName, sourceName)
		confirmed, err := ui.Confirm("Overwrite?")
		if err != nil {
			return err
		}
		if !confirmed {
			ui.Info("Aborted")
			return nil
		}
	}

	// Upload env file
	ui.Info("Pushing %s to %s/%s/%s.env...", filePath, sourceName, projectName, envName)
	if err := client.Upload(ctx, source.Bucket, projectName, envName, data); err != nil {
		return err
	}

	// Update cache
	if err := config.UpdateCache(configDir, sourceName, envName); err != nil {
		ui.Warning("Failed to update cache: %v", err)
	}

	ui.Success("Pushed %s to %s/%s/%s.env (%d bytes)", filePath, sourceName, projectName, envName, len(data))
	return nil
}
