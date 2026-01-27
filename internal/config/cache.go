package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// LoadCache loads the cache from the given directory
func LoadCache(dir string) (*Cache, error) {
	cachePath := filepath.Join(dir, CacheFileName)
	data, err := os.ReadFile(cachePath)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty cache if file doesn't exist
			return &Cache{}, nil
		}
		return nil, fmt.Errorf("failed to read cache file: %w", err)
	}

	var cache Cache
	if err := yaml.Unmarshal(data, &cache); err != nil {
		return nil, fmt.Errorf("failed to parse cache file: %w", err)
	}

	return &cache, nil
}

// SaveCache saves the cache to the given directory
func SaveCache(dir string, cache *Cache) error {
	cachePath := filepath.Join(dir, CacheFileName)
	data, err := yaml.Marshal(cache)
	if err != nil {
		return fmt.Errorf("failed to marshal cache: %w", err)
	}

	if err := os.WriteFile(cachePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write cache file: %w", err)
	}

	return nil
}

// UpdateCache updates the cache with new values
func UpdateCache(dir string, source, env string) error {
	cache, err := LoadCache(dir)
	if err != nil {
		cache = &Cache{}
	}

	if source != "" {
		cache.LastSource = source
	}
	if env != "" {
		cache.LastEnv = env
	}

	return SaveCache(dir, cache)
}

// CacheExists checks if a cache file exists in the given directory
func CacheExists(dir string) bool {
	cachePath := filepath.Join(dir, CacheFileName)
	_, err := os.Stat(cachePath)
	return err == nil
}
