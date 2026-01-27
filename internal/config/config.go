package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const (
	// ConfigFileName is the name of the config file
	ConfigFileName = ".envpull.yml"
	// CacheFileName is the name of the cache file
	CacheFileName = ".envpull.cache"
)

// FindConfigDir searches for .envpull.yml starting from current dir and walking up
func FindConfigDir() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current directory: %w", err)
	}

	for {
		configPath := filepath.Join(dir, ConfigFileName)
		if _, err := os.Stat(configPath); err == nil {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached root without finding config
			return "", fmt.Errorf("no %s found in current directory or any parent directory", ConfigFileName)
		}
		dir = parent
	}
}

// LoadConfig loads the config from the given directory
func LoadConfig(dir string) (*Config, error) {
	configPath := filepath.Join(dir, ConfigFileName)
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

// SaveConfig saves the config to the given directory
func SaveConfig(dir string, config *Config) error {
	configPath := filepath.Join(dir, ConfigFileName)
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// ConfigExists checks if a config file exists in the given directory
func ConfigExists(dir string) bool {
	configPath := filepath.Join(dir, ConfigFileName)
	_, err := os.Stat(configPath)
	return err == nil
}

// CreateConfig creates a new config file in the given directory
func CreateConfig(dir string, config *Config) error {
	if ConfigExists(dir) {
		return fmt.Errorf("config file already exists in %s", dir)
	}
	return SaveConfig(dir, config)
}
