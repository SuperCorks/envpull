package cli

import (
	"os"

	"github.com/spf13/cobra"
	"github.com/supercorks/envpull/internal/ui"
	"github.com/supercorks/envpull/pkg/version"
)

var rootCmd = &cobra.Command{
	Use:   "envpull [source]",
	Short: "Sync .env files via GCS buckets",
	Long: `envpull is a CLI tool for sharing and syncing .env files via GCS buckets.

It's config-based - each repo has .envpull.yml defining named sources (GCS buckets).

Examples:
  # Pull default env from a source
  envpull simon

  # Pull specific environment
  envpull simon --env develop

  # Push local .env to remote
  envpull push simon

  # List available environments
  envpull ls simon

  # Initialize a new project
  envpull init`,
	Version: version.String(),
	Args:    cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// If a source is provided, treat it as a pull command
		if len(args) == 1 {
			return runPull(cmd, args)
		}

		// If no source is provided but we have a cached source, also pull
		env, _ := cmd.Flags().GetString("env")
		file, _ := cmd.Flags().GetString("file")
		force, _ := cmd.Flags().GetBool("force")

		// Check if any pull-related flags are set
		if env != "default" || file != ".env" || force {
			return runPull(cmd, args)
		}

		// Otherwise, show help
		return cmd.Help()
	},
}

func init() {
	// Add pull flags to root command for shorthand pull
	rootCmd.Flags().StringP("env", "e", "default", "Environment name to pull (e.g., develop, prod)")
	rootCmd.Flags().StringP("file", "f", ".env", "Local file path to write")
	rootCmd.Flags().BoolP("force", "", false, "Overwrite existing file without confirmation")

	// Add subcommands
	rootCmd.AddCommand(pullCmd)
	rootCmd.AddCommand(pushCmd)
	rootCmd.AddCommand(listCmd)
	rootCmd.AddCommand(sourcesCmd)
	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(loginCmd)
	rootCmd.AddCommand(whoamiCmd)
	rootCmd.AddCommand(diffCmd)
	rootCmd.AddCommand(showCmd)
	rootCmd.AddCommand(versionCmd)
}

// Execute runs the root command
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		ui.Error("%v", err)
		os.Exit(1)
	}
}
