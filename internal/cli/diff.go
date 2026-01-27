package cli

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/supercorks/envpull/internal/config"
	"github.com/supercorks/envpull/internal/env"
	"github.com/supercorks/envpull/internal/gcs"
	"github.com/supercorks/envpull/internal/git"
	"github.com/supercorks/envpull/internal/ui"
)

var diffCmd = &cobra.Command{
	Use:   "diff [source]",
	Short: "Compare local env with remote",
	Long: `Compare the local env file with the remote version.

Examples:
  # Compare with cached source
  envpull diff

  # Compare with specific source
  envpull diff simon

  # Compare specific environment
  envpull diff simon --env develop

  # Compare specific local file
  envpull diff simon --env develop --file .env.dev`,
	Args: cobra.MaximumNArgs(1),
	RunE: runDiff,
}

func init() {
	diffCmd.Flags().StringP("env", "e", "default", "Environment name to compare")
	diffCmd.Flags().StringP("file", "f", ".env", "Local file path to compare")
}

func runDiff(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	// Get flags
	envName, _ := cmd.Flags().GetString("env")
	filePath, _ := cmd.Flags().GetString("file")

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
		return fmt.Errorf("no source specified and no cached source found\n\nUsage: envpull diff <source>")
	}

	// Use cached env if not specified
	if envName == "default" && cache.LastEnv != "" && cache.LastSource == sourceName {
		envName = cache.LastEnv
		ui.Info("Using cached env: %s", envName)
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

	// Read local file
	var localVars map[string]string
	if env.FileExists(filePath) {
		localVars, err = env.ParseEnvFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to parse local file: %w", err)
		}
	} else {
		ui.Warning("Local file '%s' does not exist", filePath)
		localVars = make(map[string]string)
	}

	// Create GCS client
	client, err := gcs.NewClient(ctx)
	if err != nil {
		return err
	}
	defer client.Close()

	// Download remote env
	ui.Info("Comparing local '%s' with remote %s/%s/%s.env...", filePath, sourceName, projectName, envName)
	remoteData, err := client.Download(ctx, source.Bucket, projectName, envName)
	if err != nil {
		return err
	}
	remoteVars := env.ParseEnvBytes(remoteData)

	// Compare
	diff := env.CompareEnvs(localVars, remoteVars)

	if !diff.HasChanges() {
		ui.Success("No differences found")
		return nil
	}

	ui.Println(env.FormatDiff(diff))

	// Summary
	ui.Println("\nSummary:")
	if len(diff.Added) > 0 {
		ui.Green("  + %d added (in remote)\n", len(diff.Added))
	}
	if len(diff.Removed) > 0 {
		ui.Red("  - %d removed (in local only)\n", len(diff.Removed))
	}
	if len(diff.Modified) > 0 {
		ui.Yellow("  ~ %d modified\n", len(diff.Modified))
	}
	ui.Dim("  = %d unchanged", len(diff.Same))
	ui.Println("")

	return nil
}
