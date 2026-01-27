package config

// Source represents a single env source configuration
type Source struct {
	Name    string `yaml:"name"`
	Bucket  string `yaml:"bucket"`
	Project string `yaml:"project"`
}

// Config represents the .envpull.yml configuration file
type Config struct {
	Sources []Source `yaml:"sources"`
}

// Cache represents the .envpull.cache file for storing last used values
type Cache struct {
	LastSource string `yaml:"last_source,omitempty"`
	LastEnv    string `yaml:"last_env,omitempty"`
}

// GetSource returns a source by name, or nil if not found
func (c *Config) GetSource(name string) *Source {
	for i := range c.Sources {
		if c.Sources[i].Name == name {
			return &c.Sources[i]
		}
	}
	return nil
}

// HasSource checks if a source with the given name exists
func (c *Config) HasSource(name string) bool {
	return c.GetSource(name) != nil
}

// AddSource adds a new source to the config
func (c *Config) AddSource(source Source) {
	c.Sources = append(c.Sources, source)
}

// RemoveSource removes a source by name, returns true if removed
func (c *Config) RemoveSource(name string) bool {
	for i := range c.Sources {
		if c.Sources[i].Name == name {
			c.Sources = append(c.Sources[:i], c.Sources[i+1:]...)
			return true
		}
	}
	return false
}
