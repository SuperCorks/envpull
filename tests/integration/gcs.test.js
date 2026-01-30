import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GCSClient, GCSError } from '../../src/lib/gcs.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../../integration-tests-service-account.json');
const BUCKET_NAME = 'envpull-integration-tests-1';
const TEST_PROJECT = 'integration-test-project';

// Skip if service account file doesn't exist
const serviceAccountExists = fs.existsSync(SERVICE_ACCOUNT_PATH);

describe.skipIf(!serviceAccountExists)('GCSClient Integration Tests', () => {
  let client;
  const testBranch = `test-${Date.now()}`;

  beforeAll(() => {
    // Set credentials for the test
    process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;
    client = new GCSClient();
  });

  afterAll(async () => {
    // Clean up all test files by listing and deleting everything under the test project/branch
    if (client) {
      const bucket = client.storage.bucket(BUCKET_NAME);
      const prefix = `${TEST_PROJECT}/${testBranch}/`;
      
      try {
        const [files] = await bucket.getFiles({ prefix });
        for (const file of files) {
          try {
            await file.delete();
          } catch (err) {
            console.warn(`Failed to delete ${file.name}:`, err.message);
          }
        }
      } catch (err) {
        console.warn('Cleanup failed:', err.message);
      }
    }
  });

  // Note: bucketExists requires storage.buckets.get permission which the service account may not have
  // The service account only needs object-level permissions for envpull to work
  describe('bucketExists', () => {
    it('should return false for non-existing bucket', async () => {
      const exists = await client.bucketExists('this-bucket-definitely-does-not-exist-12345');
      expect(exists).toBe(false);
    });
  });

  describe('upload and download', () => {
    const testFilename = '.env';
    const testContent = 'API_KEY="test-value-123"\nDATABASE_URL="postgres://localhost/test"';

    it('should upload a file', async () => {
      const objectPath = await client.upload(BUCKET_NAME, TEST_PROJECT, testBranch, testFilename, testContent);
      
      expect(objectPath).toBe(`${TEST_PROJECT}/${testBranch}/${testFilename}`);
    });

    it('should download the uploaded file', async () => {
      const content = await client.download(BUCKET_NAME, TEST_PROJECT, testBranch, testFilename);
      expect(content).toBe(testContent);
    });

    it('should throw GCSError for non-existing file', async () => {
      await expect(
        client.download(BUCKET_NAME, TEST_PROJECT, testBranch, 'non-existing-file.env')
      ).rejects.toThrow(GCSError);
    });
  });

  describe('listBranches', () => {
    it('should list branches for a project', async () => {
      const branches = await client.listBranches(BUCKET_NAME, TEST_PROJECT);
      
      expect(Array.isArray(branches)).toBe(true);
      const testBranchEntry = branches.find(b => b.name === testBranch);
      expect(testBranchEntry).toBeDefined();
      expect(testBranchEntry.fileCount).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for non-existing project', async () => {
      const branches = await client.listBranches(BUCKET_NAME, 'non-existing-project-xyz');
      expect(branches).toEqual([]);
    });
  });

  describe('listFiles', () => {
    it('should list files in a branch', async () => {
      const files = await client.listFiles(BUCKET_NAME, TEST_PROJECT, testBranch);
      
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThanOrEqual(1);
      
      const envFile = files.find(f => f.name === '.env');
      expect(envFile).toBeDefined();
      expect(envFile.size).toBeDefined();
      expect(envFile.updated).toBeDefined();
    });

    it('should return empty array for non-existing branch', async () => {
      const files = await client.listFiles(BUCKET_NAME, TEST_PROJECT, 'non-existing-branch');
      expect(files).toEqual([]);
    });
  });

  describe('multiple files in same branch', () => {
    const prodEnvContent = 'NODE_ENV="production"\nAPI_URL="https://api.prod.com"';
    
    it('should upload additional file to same branch', async () => {
      const objectPath = await client.upload(BUCKET_NAME, TEST_PROJECT, testBranch, '.env.prod', prodEnvContent);
      
      expect(objectPath).toBe(`${TEST_PROJECT}/${testBranch}/.env.prod`);
    });

    it('should list all files in branch', async () => {
      const files = await client.listFiles(BUCKET_NAME, TEST_PROJECT, testBranch);
      
      expect(files.length).toBe(2);
      expect(files.map(f => f.name).sort()).toEqual(['.env', '.env.prod']);
    });

    it('should show correct file count in branch listing', async () => {
      const branches = await client.listBranches(BUCKET_NAME, TEST_PROJECT);
      const branch = branches.find(b => b.name === testBranch);
      
      expect(branch.fileCount).toBe(2);
    });
  });

  describe('listVersions', () => {
    it('should list versions of a file', async () => {
      // Upload a second version
      await client.upload(BUCKET_NAME, TEST_PROJECT, testBranch, '.env', 'UPDATED_KEY="new-value"');
      
      const versions = await client.listVersions(BUCKET_NAME, TEST_PROJECT, testBranch, '.env');
      
      expect(Array.isArray(versions)).toBe(true);
      // Note: versions require bucket versioning to be enabled
      // If not enabled, we'll have at least 1 version (current)
      expect(versions.length).toBeGreaterThanOrEqual(1);
      expect(versions[0].generation).toBeDefined();
      expect(versions[0].updated).toBeDefined();
      expect(versions[0].size).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw GCSError with hint for permission denied', async () => {
      // Try to access a bucket we don't have access to
      const restrictedClient = new GCSClient();
      
      try {
        await restrictedClient.download('some-restricted-bucket', 'project', 'branch', 'file');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GCSError);
      }
    });
  });
});
