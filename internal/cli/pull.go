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

var pullCmd = &cobra.Command{
	Use:   "pull [source]",
	Short: "Pull an env file from a remote source",
	Long: `Pull an env file from a configured GCS source.

Examples:
  # Pull default env from simon's source
  envpull pull simon

  # Pull using cached source
  envpull pull

  # Pull develop environment
  envpull pull simon --env develop

  # Pull to a specific file
  envpull pull simon --env prod --file .env.prod`,
	Args: cobra.MaximumNArgs(1),
	RunE: runPull,
}

func init() {
	pullCmd.Flags().StringP("env", "e", "default", "Environment name to pull")
	pullCmd.Flags().StringP("file", "f", ".env", "Local file path to write")
	pullCmd.Flags().BoolP("force", "", false, "Overwrite existing file without confirmation")
}

func runPull(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	// Get flags
	envName, _ := cmd.Flags().GetString("env")
	filePath, _ := cmd.Flags().GetString("file")
	force, _ := cmd.Flags().GetBool("force")

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
		return fmt.Errorf("no source specified and no cached source found\n\nUsage: envpull pull <source>")
	}

	// Use cached env if not specified and we have a cache
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

	// Check if local file exists
	if env.FileExists(filePath) && !force {
		ui.Warning("File '%s' already exists", filePath)
		confirmed, err := ui.Confirm("Overwrite?")
		if err != nil {
			return err
		}
		if !confirmed {
			ui.Info("Aborted")
			return nil
		}
	}

	// Create GCS client
	client, err := gcs.NewClient(ctx)
	if err != nil {
		return err
	}
	defer client.Close()

	// Download env file
	ui.Info("Pulling %s/%s from %s...", projectName, envName, sourceName)
	data, err := client.Download(ctx, source.Bucket, projectName, envName)
	if err != nil {
		return err
	}

	// Write to local file
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	// Update cache
	if err := config.UpdateCache(configDir, sourceName, envName); err != nil {
		ui.Warning("Failed to update cache: %v", err)
	}

	ui.Success("Pulled %s/%s.env to %s (%d bytes)", projectName, envName, filePath, len(data))
	return nil
}

func getSourceNames(cfg *config.Config) []string {
	names := make([]string, len(cfg.Sources))
	for i, s := range cfg.Sources {
		names[i] = s.Name
	}
	return names
}
