package git

import (
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

// GetProjectName extracts the project name from the git remote origin URL
func GetProjectName() (string, error) {
	cmd := exec.Command("git", "remote", "get-url", "origin")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get git remote origin: %w", err)
	}

	url := strings.TrimSpace(string(output))
	return ParseProjectFromURL(url)
}

// ParseProjectFromURL extracts the project name from various git URL formats
// Supported formats:
// - git@github.com:supercorks/envpull.git
// - https://github.com/supercorks/envpull.git
// - https://github.com/supercorks/envpull
// - git@gitlab.com:supercorks/envpull.git
// - ssh://git@github.com/supercorks/envpull.git
func ParseProjectFromURL(url string) (string, error) {
	// Remove trailing .git if present
	url = strings.TrimSuffix(url, ".git")

	// SSH format: git@github.com:supercorks/envpull
	sshPattern := regexp.MustCompile(`^git@[^:]+:(.+)/([^/]+)$`)
	if matches := sshPattern.FindStringSubmatch(url); matches != nil {
		return matches[2], nil
	}

	// SSH URL format: ssh://git@github.com/supercorks/envpull
	sshURLPattern := regexp.MustCompile(`^ssh://[^/]+/(.+)/([^/]+)$`)
	if matches := sshURLPattern.FindStringSubmatch(url); matches != nil {
		return matches[2], nil
	}

	// HTTPS format: https://github.com/supercorks/envpull
	httpsPattern := regexp.MustCompile(`^https?://[^/]+/(.+)/([^/]+)$`)
	if matches := httpsPattern.FindStringSubmatch(url); matches != nil {
		return matches[2], nil
	}

	return "", fmt.Errorf("unable to parse project name from URL: %s", url)
}

// IsGitRepo checks if the current directory is a git repository
func IsGitRepo() bool {
	cmd := exec.Command("git", "rev-parse", "--git-dir")
	err := cmd.Run()
	return err == nil
}

// GetRepoRoot returns the root directory of the git repository
func GetRepoRoot() (string, error) {
	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get git repo root: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}
