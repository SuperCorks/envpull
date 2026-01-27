package env

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"sort"
	"strings"
)

// ParseEnvFile reads and parses an env file from the given path
func ParseEnvFile(path string) (map[string]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read env file: %w", err)
	}
	return ParseEnvBytes(data), nil
}

// ParseEnvBytes parses env content from bytes
func ParseEnvBytes(data []byte) map[string]string {
	result := make(map[string]string)
	scanner := bufio.NewScanner(bytes.NewReader(data))

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Find the first = sign
		idx := strings.Index(line, "=")
		if idx == -1 {
			continue
		}

		key := strings.TrimSpace(line[:idx])
		value := strings.TrimSpace(line[idx+1:])

		// Remove surrounding quotes if present
		value = unquote(value)

		if key != "" {
			result[key] = value
		}
	}

	return result
}

// unquote removes surrounding quotes from a value
func unquote(s string) string {
	if len(s) >= 2 {
		// Double quotes
		if s[0] == '"' && s[len(s)-1] == '"' {
			return s[1 : len(s)-1]
		}
		// Single quotes
		if s[0] == '\'' && s[len(s)-1] == '\'' {
			return s[1 : len(s)-1]
		}
	}
	return s
}

// WriteEnvFile writes env variables to a file
func WriteEnvFile(path string, vars map[string]string) error {
	content := FormatEnv(vars)
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write env file: %w", err)
	}
	return nil
}

// FormatEnv formats env variables as a string with sorted keys
func FormatEnv(vars map[string]string) string {
	// Sort keys for consistent output
	keys := make([]string, 0, len(vars))
	for k := range vars {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for _, key := range keys {
		value := vars[key]
		// Quote values that contain spaces or special characters
		if needsQuoting(value) {
			value = fmt.Sprintf("%q", value)
		}
		builder.WriteString(fmt.Sprintf("%s=%s\n", key, value))
	}

	return builder.String()
}

// needsQuoting checks if a value needs to be quoted
func needsQuoting(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c == ' ' || c == '\t' || c == '"' || c == '\'' || c == '\\' || c == '\n' {
			return true
		}
	}
	return false
}

// FileExists checks if the env file exists at the given path
func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// ReadEnvFile reads raw content from an env file
func ReadEnvFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}
