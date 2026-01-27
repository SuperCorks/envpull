package cli

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/spf13/cobra"
	"github.com/supercorks/envpull/internal/gcs"
	"github.com/supercorks/envpull/internal/ui"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with Google Cloud",
	Long: `Run gcloud auth application-default login to authenticate.

This sets up Application Default Credentials (ADC) that envpull uses
to access GCS buckets.

Example:
  envpull login`,
	Args: cobra.NoArgs,
	RunE: runLogin,
}

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Show current gcloud identity",
	Long: `Show the currently authenticated gcloud account.

Example:
  envpull whoami`,
	Args: cobra.NoArgs,
	RunE: runWhoami,
}

func runLogin(cmd *cobra.Command, args []string) error {
	if !gcs.IsGcloudInstalled() {
		return fmt.Errorf("gcloud CLI is not installed\n\nInstall it from: https://cloud.google.com/sdk/docs/install")
	}

	ui.Info("Running gcloud auth application-default login...")
	ui.Println("")

	// Run gcloud auth interactively
	gcloudCmd := exec.Command("gcloud", "auth", "application-default", "login")
	gcloudCmd.Stdin = os.Stdin
	gcloudCmd.Stdout = os.Stdout
	gcloudCmd.Stderr = os.Stderr

	if err := gcloudCmd.Run(); err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	ui.Println("")
	ui.Success("Authentication complete!")
	return nil
}

func runWhoami(cmd *cobra.Command, args []string) error {
	if !gcs.IsGcloudInstalled() {
		return fmt.Errorf("gcloud CLI is not installed\n\nInstall it from: https://cloud.google.com/sdk/docs/install")
	}

	user, err := gcs.GetCurrentUser()
	if err != nil {
		return fmt.Errorf("not authenticated: %w\n\nRun 'envpull login' to authenticate", err)
	}

	project, _ := gcs.GetCurrentProject()

	ui.Println("\nGoogle Cloud Identity:")
	ui.Println("  Account: %s", user)
	if project != "" {
		ui.Println("  Project: %s", project)
	}
	ui.Println("")

	return nil
}
