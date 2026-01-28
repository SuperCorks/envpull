import { Storage } from '@google-cloud/storage';
import path from 'path';

export class GCSClient {
  constructor() {
    this.storage = new Storage();
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
    
    await file.save(content, {
      contentType: 'text/plain',
      resumable: false
    });
    
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
        throw new Error(`Env file '${envName}' not found in ${bucketName}/${project}`);
      }
      throw err;
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
    
    // Copy the specific generation to the live version (null generation)
    await file.copy(bucket.file(objectPath));
  }
}
