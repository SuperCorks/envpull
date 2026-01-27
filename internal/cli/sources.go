package cli

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/supercorks/envpull/internal/config"
	"github.com/supercorks/envpull/internal/ui"
)

var sourcesCmd = &cobra.Command{
	Use:     "sources",
	Aliases: []string{"source"},
	Short:   "Manage configured sources",
	Long: `List, add, or remove configured sources.

Examples:
  # List all sources
  envpull sources

  # Add a new source
  envpull source add simon --bucket gs://my-bucket --project my-gcp-project

  # Remove a source
  envpull source remove simon`,
	Args: cobra.NoArgs,
	RunE: runSources,
}

var sourceAddCmd = &cobra.Command{
	Use:   "add NAME",
	Short: "Add a new source",
	Long: `Add a new source configuration.

Example:
  envpull source add simon --bucket gs://my-bucket --project my-gcp-project`,
	Args: cobra.ExactArgs(1),
	RunE: runSourceAdd,
}

var sourceRemoveCmd = &cobra.Command{
	Use:     "remove NAME",
	Aliases: []string{"rm", "delete"},
	Short:   "Remove a source",
	Long: `Remove a source configuration.

Example:
  envpull source remove simon`,
	Args: cobra.ExactArgs(1),
	RunE: runSourceRemove,
}

func init() {
	sourceAddCmd.Flags().StringP("bucket", "b", "", "GCS bucket name (e.g., gs://my-bucket)")
	sourceAddCmd.Flags().StringP("project", "p", "", "GCP project ID")
	sourceAddCmd.MarkFlagRequired("bucket")
	sourceAddCmd.MarkFlagRequired("project")

	sourcesCmd.AddCommand(sourceAddCmd)
	sourcesCmd.AddCommand(sourceRemoveCmd)
}

func runSources(cmd *cobra.Command, args []string) error {
	// Find and load config
	configDir, err := config.FindConfigDir()
	if err != nil {
		return fmt.Errorf("config not found: %w\n\nRun 'envpull init' to create a configuration", err)
	}

	cfg, err := config.LoadConfig(configDir)
	if err != nil {
		return err
	}

	// Load cache for marking current source
	cache, _ := config.LoadCache(configDir)

	if len(cfg.Sources) == 0 {
		ui.Info("No sources configured")
		ui.Println("\nAdd a source with: envpull source add NAME --bucket BUCKET --project PROJECT")
		return nil
	}

	ui.Println("\nConfigured sources:")
	ui.Println("")

	headers := []string{"NAME", "BUCKET", "PROJECT"}
	rows := make([][]string, len(cfg.Sources))

	for i, s := range cfg.Sources {
		name := s.Name
		if cache != nil && cache.LastSource == s.Name {
			name = s.Name + " *"
		}
		rows[i] = []string{name, s.Bucket, s.Project}
	}

	ui.Table(headers, rows)
	ui.Println("")

	return nil
}

func runSourceAdd(cmd *cobra.Command, args []string) error {
	name := args[0]
	bucket, _ := cmd.Flags().GetString("bucket")
	project, _ := cmd.Flags().GetString("project")

	// Find and load config
	configDir, err := config.FindConfigDir()
	if err != nil {
		return fmt.Errorf("config not found: %w\n\nRun 'envpull init' to create a configuration", err)
	}

	cfg, err := config.LoadConfig(configDir)
	if err != nil {
		return err
	}

	// Check if source already exists
	if cfg.HasSource(name) {
		return fmt.Errorf("source '%s' already exists", name)
	}

	// Add source
	cfg.AddSource(config.Source{
		Name:    name,
		Bucket:  bucket,
		Project: project,
	})

	// Save config
	if err := config.SaveConfig(configDir, cfg); err != nil {
		return err
	}

	ui.Success("Added source '%s'", name)
	return nil
}

func runSourceRemove(cmd *cobra.Command, args []string) error {
	name := args[0]

	// Find and load config
	configDir, err := config.FindConfigDir()
	if err != nil {
		return fmt.Errorf("config not found: %w\n\nRun 'envpull init' to create a configuration", err)
	}

	cfg, err := config.LoadConfig(configDir)
	if err != nil {
		return err
	}

	// Check if source exists
	if !cfg.HasSource(name) {
		return fmt.Errorf("source '%s' not found", name)
	}

	// Confirm removal
	confirmed, err := ui.Confirm(fmt.Sprintf("Remove source '%s'?", name))
	if err != nil {
		return err
	}
	if !confirmed {
		ui.Info("Aborted")
		return nil
	}

	// Remove source
	cfg.RemoveSource(name)

	// Save config
	if err := config.SaveConfig(configDir, cfg); err != nil {
		return err
	}

	ui.Success("Removed source '%s'", name)
	return nil
}
