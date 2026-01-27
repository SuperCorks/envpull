package cli

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/supercorks/envpull/internal/config"
	"github.com/supercorks/envpull/internal/gcs"
	"github.com/supercorks/envpull/internal/git"
)

var showCmd = &cobra.Command{
	Use:   "show [source]",
	Short: "Show remote env contents",
	Long: `Print the contents of a remote env file to stdout.

Examples:
  # Show env from cached source
  envpull show

  # Show env from specific source
  envpull show simon

  # Show specific environment
  envpull show simon --env prod`,
	Args: cobra.MaximumNArgs(1),
	RunE: runShow,
}

func init() {
	showCmd.Flags().StringP("env", "e", "default", "Environment name to show")
}

func runShow(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	// Get flags
	envName, _ := cmd.Flags().GetString("env")

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
	} else {
		return fmt.Errorf("no source specified and no cached source found\n\nUsage: envpull show <source>")
	}

	// Use cached env if not specified
	if envName == "default" && cache.LastEnv != "" && cache.LastSource == sourceName {
		envName = cache.LastEnv
	}

	// Get source configuration
	source := cfg.GetSource(sourceName)
	if source == nil {
		return fmt.Errorf("source '%s' not found in config", sourceName)
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

	// Download remote env
	data, err := client.Download(ctx, source.Bucket, projectName, envName)
	if err != nil {
		return err
	}

	// Print to stdout
	fmt.Print(string(data))

	return nil
}
