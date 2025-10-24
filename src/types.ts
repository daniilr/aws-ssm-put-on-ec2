/**
 * Action input parameters with proper TypeScript types
 */
export interface ActionInputs {
  /**
   * Path to the local file to transfer (directories not supported)
   */
  localPath: string;

  /**
   * Path where the file should be placed on the remote EC2 instance
   */
  remotePath: string;

  /**
   * EC2 instance ID (e.g., i-1234567890abcdef0)
   */
  instance: string;

  /**
   * S3 bucket name to use as intermediate storage for file transfer
   * Format: bucket-name or s3://bucket-name
   */
  intermediateS3: string;
}

/**
 * S3 upload result containing the object key
 */
export interface S3UploadResult {
  bucket: string;
  key: string;
  s3Uri: string;
}

/**
 * SSM command execution result
 */
export interface SSMCommandResult {
  commandId: string;
  status: string;
  output?: string;
}
