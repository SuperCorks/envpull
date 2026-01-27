package cli

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/supercorks/envpull/internal/config"
	"github.com/supercorks/envpull/internal/gcs"
	"github.com/supercorks/envpull/internal/git"
	"github.com/supercorks/envpull/internal/ui"
)

var listCmd = &cobra.Command{
	Use:     "ls [source]",
	Aliases: []string{"list"},
	Short:   "List available environments from a source",
	Long: `List all available environment files from a configured GCS source.

Examples:
  # List envs from cached source
  envpull ls

  # List envs from a specific source
  envpull ls simon`,
	Args: cobra.MaximumNArgs(1),
	RunE: runList,
}

func runList(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

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
		return fmt.Errorf("no source specified and no cached source found\n\nUsage: envpull ls <source>")
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

	// Create GCS client
	client, err := gcs.NewClient(ctx)
	if err != nil {
		return err
	}
	defer client.Close()

	// List env files
	envNames, err := client.List(ctx, source.Bucket, projectName)
	if err != nil {
		return err
	}

	if len(envNames) == 0 {
		ui.Info("No environments found for project '%s' in source '%s'", projectName, sourceName)
		return nil
	}

	ui.Println("\nEnvironments for %s in %s:", projectName, sourceName)
	ui.Println("")
	for _, name := range envNames {
		marker := " "
		if cache.LastEnv == name && cache.LastSource == sourceName {
			marker = "*"
		}
		fmt.Printf("  %s %s\n", marker, name)
	}
	ui.Println("")

	return nil
}
