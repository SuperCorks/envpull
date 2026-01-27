package gcs

import (
	"context"
	"fmt"
	"strings"

	"cloud.google.com/go/storage"
	"google.golang.org/api/option"
)

// Client wraps the GCS storage client
type Client struct {
	client *storage.Client
}

// NewClient creates a new GCS client using Application Default Credentials
func NewClient(ctx context.Context) (*Client, error) {
	client, err := storage.NewClient(ctx, option.WithScopes(storage.ScopeFullControl))
	if err != nil {
		return nil, fmt.Errorf("failed to create GCS client: %w\n\nTry running: envpull login", err)
	}
	return &Client{client: client}, nil
}

// Close closes the GCS client
func (c *Client) Close() error {
	return c.client.Close()
}

// Bucket returns a bucket handle
func (c *Client) Bucket(name string) *storage.BucketHandle {
	// Strip gs:// prefix if present
	name = NormalizeBucketName(name)
	return c.client.Bucket(name)
}

// NormalizeBucketName strips the gs:// prefix from a bucket name
func NormalizeBucketName(bucket string) string {
	bucket = strings.TrimPrefix(bucket, "gs://")
	bucket = strings.TrimSuffix(bucket, "/")
	return bucket
}

// ObjectPath constructs the object path for an env file
func ObjectPath(project, env string) string {
	return fmt.Sprintf("%s/%s.env", project, env)
}

// BucketExists checks if a bucket exists and is accessible
func (c *Client) BucketExists(ctx context.Context, bucket string) (bool, error) {
	bucket = NormalizeBucketName(bucket)
	_, err := c.client.Bucket(bucket).Attrs(ctx)
	if err != nil {
		if err == storage.ErrBucketNotExist {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// CreateBucket creates a new GCS bucket
func (c *Client) CreateBucket(ctx context.Context, bucket, project string) error {
	bucket = NormalizeBucketName(bucket)
	return c.client.Bucket(bucket).Create(ctx, project, nil)
}
