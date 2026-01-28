import { Storage } from '@google-cloud/storage';
import path from 'path';

/**
 * Custom error class for GCS operations with actionable hints
 */
export class GCSError extends Error {
  constructor(message, hint = null, originalError = null) {
    super(message);
    this.name = 'GCSError';
    this.hint = hint;
    this.originalError = originalError;
  }
}

/**
 * Wraps GCS errors with user-friendly messages
 * @param {Error} err 
 * @param {string} context 
 * @returns {GCSError}
 */
function wrapError(err, context = '') {
  const msg = err.message || String(err);
  const msgLower = msg.toLowerCase();
  
  // Not authenticated
  if (msg.includes('Could not load the default credentials') || 
      msg.includes('Unable to detect a Project Id') ||
      msg.includes('GOOGLE_APPLICATION_CREDENTIALS') ||
      msg.includes('Could not refresh access token') ||
      msg.includes('invalid_client')) {
    return new GCSError(
      'Not authenticated with Google Cloud',
      'Run: gcloud auth application-default login',
      err
    );
  }
  
  // Token expired
  if (msg.includes('Token has been expired') || msg.includes('invalid_grant') || msg.includes('token expired')) {
    return new GCSError(
      'Google Cloud credentials have expired',
      'Run: gcloud auth application-default login',
      err
    );
  }
  
  // Permission denied
  if (err.code === 403 || msg.includes('does not have storage') || msgLower.includes('access denied') || msgLower.includes('permission denied')) {
    return new GCSError(
      'Permission denied',
      'Ask the bucket owner to grant you Storage Object Admin role',
      err
    );
  }
  
  // Bucket not found - catch various message formats
  if (msgLower.includes('bucket') && (msgLower.includes('not exist') || msgLower.includes('not found') || msgLower.includes('no such bucket'))) {
    return new GCSError(
      `Bucket '${context || 'unknown'}' does not exist`,
      'Create it with "envpull push" (you\'ll be prompted) or check the name in .envpull.yaml',
      err
    );
  }

  // "specified bucket" is another GCS error pattern
  if (msgLower.includes('specified bucket')) {
    return new GCSError(
      `Bucket '${context || 'unknown'}' does not exist`,
      'Create it with "envpull push" (you\'ll be prompted) or check the name in .envpull.yaml',
      err
    );
  }
  
  // Object not found
  if (err.code === 404 || msgLower.includes('no such object') || msgLower.includes('not found')) {
    return new GCSError(
      `Not found${context ? `: ${context}` : ''}`,
      null,
      err
    );
  }
  
  // Network error
  if (msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED') || msg.includes('network')) {
    return new GCSError(
      'Network error - could not connect to Google Cloud',
      'Check your internet connection',
      err
    );
  }
  
  // Default: return original message with no hint
  return new GCSError(msg, null, err);
}

export class GCSClient {
  constructor(projectId = null) {
    const options = {};
    if (projectId) {
      options.projectId = projectId;
    }
    this.storage = new Storage(options);
    this.projectId = projectId;
  }

  /**
   * Normalizes bucket name by removing gs:// prefix
   * @param {string} bucket 
   * @returns {string}
   */
  normalizeBucketName(bucket) {
    return bucket.replace(/^gs:\/\//, '').replace(/\/$/, '');
  }

  /**
   * Checks if a bucket exists
   * @param {string} bucketName 
   * @returns {Promise<boolean>}
   */
  async bucketExists(bucketName) {
    bucketName = this.normalizeBucketName(bucketName);
    const bucket = this.storage.bucket(bucketName);
    try {
      const [exists] = await bucket.exists();
      return exists;
    } catch (err) {
      // If we can't check existence, treat it as "doesn't exist" if that's the error
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('bucket') && (msg.includes('not exist') || msg.includes('not found'))) {
        return false;
      }
      throw wrapError(err, bucketName);
    }
  }

  /**
   * Creates a new bucket
   * @param {string} bucketName 
   * @returns {Promise<void>}
   */
  async createBucket(bucketName) {
    bucketName = this.normalizeBucketName(bucketName);
    try {
      await this.storage.createBucket(bucketName);
    } catch (err) {
      // Provide specific messages for common create failures
      const msg = err.message || '';
      if (err.code === 409 || msg.includes('already exists')) {
        throw new GCSError(
          `Bucket '${bucketName}' already exists`,
          'This name is taken globally. Try a more unique name (e.g., yourcompany-envpull)',
          err
        );
      }
      if (msg.includes('Invalid bucket name')) {
        throw new GCSError(
          `Invalid bucket name '${bucketName}'`,
          'Bucket names must be 3-63 chars, lowercase, numbers, hyphens only',
          err
        );
      }
      throw wrapError(err, bucketName);
    }
  }

  /**
   * Constructs object path: project/envName.env
   * @param {string} project 
   * @param {string} envName 
   * @returns {string}
   */
  getObjectPath(project, envName) {
    return `${project}/${envName}.env`;
  }

  /**
   * Uploads content to GCS
   * @param {string} bucketName 
   * @param {string} project 
   * @param {string} envName 
   * @param {string} content 
   */
  async upload(bucketName, project, envName, content) {
    bucketName = this.normalizeBucketName(bucketName);
    const objectPath = this.getObjectPath(project, envName);
    
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(objectPath);
    
    try {
      await file.save(content, {
        contentType: 'text/plain',
        resumable: false
      });
    } catch (err) {
      throw wrapError(err, `${bucketName}/${objectPath}`);
    }
    
    return objectPath;
  }

  /**
   * Downloads content from GCS
   * @param {string} bucketName 
   * @param {string} project 
   * @param {string} envName 
   * @returns {Promise<string>}
   */
  async download(bucketName, project, envName) {
    bucketName = this.normalizeBucketName(bucketName);
    const objectPath = this.getObjectPath(project, envName);
    
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(objectPath);
    
    try {
      const [content] = await file.download();
      return content.toString('utf8');
    } catch (err) {
      if (err.code === 404) {
        throw new GCSError(
          `Environment '${envName}' not found`,
          `No file at ${bucketName}/${project}/${envName}.env - has it been pushed yet?`,
          err
        );
      }
      throw wrapError(err, `${bucketName}/${objectPath}`);
    }
  }

  /**
   * Lists versions of an env file
   * @param {string} bucketName 
   * @param {string} project 
   * @param {string} envName 
   * @returns {Promise<Array<{generation: string, updated: string, size: string}>>}
   */
  async listVersions(bucketName, project, envName) {
    bucketName = this.normalizeBucketName(bucketName);
    const objectPath = this.getObjectPath(project, envName);
    
    const bucket = this.storage.bucket(bucketName);
    
    try {
      // List all versions of the object
      const [files] = await bucket.getFiles({
        prefix: objectPath,
        versions: true
      });

      // Filter strictly for exact match on name (in case of similar prefixes)
      // and sort by time desc
      return files
        .filter(f => f.name === objectPath)
        .map(f => ({
          generation: f.metadata.generation,
          updated: f.metadata.updated,
          size: f.metadata.size,
          contentType: f.metadata.contentType
        }))
        .sort((a, b) => new Date(b.updated) - new Date(a.updated));
    } catch (err) {
      throw wrapError(err, bucketName);
    }
  }

  /**
   * Lists all environments for a project
   * @param {string} bucketName 
   * @param {string} project 
   * @returns {Promise<Array<{name: string, updated: string, size: string}>>}
   */
  async listEnvs(bucketName, project) {
    bucketName = this.normalizeBucketName(bucketName);
    const prefix = `${project}/`;
    
    const bucket = this.storage.bucket(bucketName);
    
    try {
      const [files] = await bucket.getFiles({
        prefix: prefix
      });

      // Filter for .env files only and extract env name
      return files
        .filter(f => f.name.endsWith('.env') && f.name.startsWith(prefix))
        .map(f => {
          const name = f.name.slice(prefix.length, -4); // Remove prefix and .env suffix
          return {
            name,
            updated: f.metadata.updated,
            size: f.metadata.size
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      throw wrapError(err, bucketName);
    }
  }

  /**
   * Rolls back to a specific version
   * @param {string} bucketName 
   * @param {string} project 
   * @param {string} envName 
   * @param {string} generation 
   */
  async rollback(bucketName, project, envName, generation) {
    bucketName = this.normalizeBucketName(bucketName);
    const objectPath = this.getObjectPath(project, envName);
    
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(objectPath, { generation });
    
    try {
      // Copy the specific generation to the live version (null generation)
      await file.copy(bucket.file(objectPath));
    } catch (err) {
      if (err.code === 404) {
        throw new GCSError(
          `Version '${generation}' not found`,
          'Run "envpull history" to see available versions',
          err
        );
      }
      throw wrapError(err, `${bucketName}/${objectPath}`);
    }
  }

  /**
   * Grants IAM access to a bucket for a user
   * @param {string} bucketName 
   * @param {string} email - User's email address
   * @param {string} role - IAM role (e.g., 'roles/storage.objectViewer' or 'roles/storage.objectAdmin')
   */
  async grantAccess(bucketName, email, role) {
    bucketName = this.normalizeBucketName(bucketName);
    const bucket = this.storage.bucket(bucketName);
    
    try {
      // Get current IAM policy
      const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
      
      // Find or create the binding for this role
      const member = `user:${email}`;
      let binding = policy.bindings.find(b => b.role === role);
      
      if (binding) {
        // Add member if not already present
        if (!binding.members.includes(member)) {
          binding.members.push(member);
        }
      } else {
        // Create new binding
        policy.bindings.push({
          role,
          members: [member]
        });
      }
      
      // Set the updated policy
      await bucket.iam.setPolicy(policy);
    } catch (err) {
      throw wrapError(err, bucketName);
    }
  }
}
