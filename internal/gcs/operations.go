package gcs

import (
	"context"
	"fmt"
	"io"
	"strings"

	"cloud.google.com/go/storage"
	"google.golang.org/api/iterator"
)

// Download downloads an env file from GCS
func (c *Client) Download(ctx context.Context, bucket, project, env string) ([]byte, error) {
	bucket = NormalizeBucketName(bucket)
	objectPath := ObjectPath(project, env)

	reader, err := c.client.Bucket(bucket).Object(objectPath).NewReader(ctx)
	if err != nil {
		if err == storage.ErrObjectNotExist {
			return nil, fmt.Errorf("env '%s' not found in %s/%s", env, bucket, project)
		}
		return nil, fmt.Errorf("failed to read from GCS: %w", err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read data: %w", err)
	}

	return data, nil
}

// Upload uploads an env file to GCS
func (c *Client) Upload(ctx context.Context, bucket, project, env string, data []byte) error {
	bucket = NormalizeBucketName(bucket)
	objectPath := ObjectPath(project, env)

	writer := c.client.Bucket(bucket).Object(objectPath).NewWriter(ctx)
	writer.ContentType = "text/plain"

	if _, err := writer.Write(data); err != nil {
		writer.Close()
		return fmt.Errorf("failed to write to GCS: %w", err)
	}

	if err := writer.Close(); err != nil {
		return fmt.Errorf("failed to finalize upload: %w", err)
	}

	return nil
}

// List lists all env files for a project in a bucket
func (c *Client) List(ctx context.Context, bucket, project string) ([]string, error) {
	bucket = NormalizeBucketName(bucket)
	prefix := project + "/"

	var envNames []string
	it := c.client.Bucket(bucket).Objects(ctx, &storage.Query{Prefix: prefix})

	for {
		attrs, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to list objects: %w", err)
		}

		// Extract env name from path (project/env.env -> env)
		name := strings.TrimPrefix(attrs.Name, prefix)
		if strings.HasSuffix(name, ".env") {
			envName := strings.TrimSuffix(name, ".env")
			if envName != "" && !strings.Contains(envName, "/") {
				envNames = append(envNames, envName)
			}
		}
	}

	return envNames, nil
}

// Exists checks if an env file exists in GCS
func (c *Client) Exists(ctx context.Context, bucket, project, env string) (bool, error) {
	bucket = NormalizeBucketName(bucket)
	objectPath := ObjectPath(project, env)

	_, err := c.client.Bucket(bucket).Object(objectPath).Attrs(ctx)
	if err != nil {
		if err == storage.ErrObjectNotExist {
			return false, nil
		}
		return false, fmt.Errorf("failed to check object existence: %w", err)
	}

	return true, nil
}

// Delete deletes an env file from GCS
func (c *Client) Delete(ctx context.Context, bucket, project, env string) error {
	bucket = NormalizeBucketName(bucket)
	objectPath := ObjectPath(project, env)

	if err := c.client.Bucket(bucket).Object(objectPath).Delete(ctx); err != nil {
		if err == storage.ErrObjectNotExist {
			return fmt.Errorf("env '%s' not found", env)
		}
		return fmt.Errorf("failed to delete from GCS: %w", err)
	}

	return nil
}
