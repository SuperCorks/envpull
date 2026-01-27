package version

import "fmt"

var (
	// Version is the semantic version (set by build flags)
	Version = "dev"
	// Commit is the git commit SHA (set by build flags)
	Commit = "none"
	// BuildDate is the build timestamp (set by build flags)
	BuildDate = "unknown"
)

// String returns a formatted version string
func String() string {
	return fmt.Sprintf("envpull %s (%s) built %s", Version, Commit, BuildDate)
}
