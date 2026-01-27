package gcs

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

// Login runs gcloud auth application-default login
func Login() error {
	cmd := exec.Command("gcloud", "auth", "application-default", "login")
	cmd.Stdin = nil
	cmd.Stdout = nil
	cmd.Stderr = nil

	// Run interactively
	return cmd.Run()
}

// GetCurrentUser returns the current gcloud authenticated user
func GetCurrentUser() (string, error) {
	cmd := exec.Command("gcloud", "config", "get-value", "account")
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = nil

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("failed to get gcloud account: %w", err)
	}

	account := strings.TrimSpace(out.String())
	if account == "" {
		return "", fmt.Errorf("no gcloud account configured")
	}

	return account, nil
}

// GetCurrentProject returns the current gcloud project
func GetCurrentProject() (string, error) {
	cmd := exec.Command("gcloud", "config", "get-value", "project")
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = nil

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("failed to get gcloud project: %w", err)
	}

	project := strings.TrimSpace(out.String())
	return project, nil
}

// IsGcloudInstalled checks if gcloud CLI is installed
func IsGcloudInstalled() bool {
	cmd := exec.Command("gcloud", "version")
	return cmd.Run() == nil
}
