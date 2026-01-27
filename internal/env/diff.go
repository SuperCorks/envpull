package env

import (
	"fmt"
	"sort"
	"strings"

	"github.com/sergi/go-diff/diffmatchpatch"
)

// DiffResult represents the difference between two env files
type DiffResult struct {
	Added    map[string]string // Keys only in remote
	Removed  map[string]string // Keys only in local
	Modified map[string]Change // Keys with different values
	Same     map[string]string // Keys with same values
}

// Change represents a value change
type Change struct {
	Local  string
	Remote string
}

// HasChanges returns true if there are any differences
func (d *DiffResult) HasChanges() bool {
	return len(d.Added) > 0 || len(d.Removed) > 0 || len(d.Modified) > 0
}

// CompareEnvs compares local and remote env variables
func CompareEnvs(local, remote map[string]string) *DiffResult {
	result := &DiffResult{
		Added:    make(map[string]string),
		Removed:  make(map[string]string),
		Modified: make(map[string]Change),
		Same:     make(map[string]string),
	}

	// Check local keys
	for key, localVal := range local {
		if remoteVal, exists := remote[key]; exists {
			if localVal == remoteVal {
				result.Same[key] = localVal
			} else {
				result.Modified[key] = Change{Local: localVal, Remote: remoteVal}
			}
		} else {
			result.Removed[key] = localVal
		}
	}

	// Check for keys only in remote
	for key, remoteVal := range remote {
		if _, exists := local[key]; !exists {
			result.Added[key] = remoteVal
		}
	}

	return result
}

// FormatDiff returns a human-readable diff
func FormatDiff(diff *DiffResult) string {
	var builder strings.Builder

	if !diff.HasChanges() {
		return "No differences found.\n"
	}

	// Added keys (will be added when pulling)
	if len(diff.Added) > 0 {
		builder.WriteString("\n+ Added (in remote, not in local):\n")
		for _, key := range sortedKeys(diff.Added) {
			builder.WriteString(fmt.Sprintf("  + %s=%s\n", key, truncateValue(diff.Added[key])))
		}
	}

	// Removed keys (will be removed when pulling)
	if len(diff.Removed) > 0 {
		builder.WriteString("\n- Removed (in local, not in remote):\n")
		for _, key := range sortedKeys(diff.Removed) {
			builder.WriteString(fmt.Sprintf("  - %s=%s\n", key, truncateValue(diff.Removed[key])))
		}
	}

	// Modified keys
	if len(diff.Modified) > 0 {
		builder.WriteString("\n~ Modified:\n")
		keys := make([]string, 0, len(diff.Modified))
		for k := range diff.Modified {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, key := range keys {
			change := diff.Modified[key]
			builder.WriteString(fmt.Sprintf("  ~ %s:\n", key))
			builder.WriteString(fmt.Sprintf("    - %s\n", truncateValue(change.Local)))
			builder.WriteString(fmt.Sprintf("    + %s\n", truncateValue(change.Remote)))
		}
	}

	return builder.String()
}

// FormatUnifiedDiff returns a unified diff format
func FormatUnifiedDiff(localContent, remoteContent string) string {
	dmp := diffmatchpatch.New()
	diffs := dmp.DiffMain(localContent, remoteContent, false)
	return dmp.DiffPrettyText(diffs)
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func truncateValue(s string) string {
	const maxLen = 50
	if len(s) > maxLen {
		return s[:maxLen] + "..."
	}
	return s
}
