import * as core from "@actions/core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, statSync } from "fs";
import { basename } from "path";
import type { S3UploadResult } from "./types.js";

/**
 * Uploads a local file to S3 bucket
 * @param localPath - Path to the local file to upload
 * @param bucketName - S3 bucket name (will strip s3:// prefix if present)
 * @param region - Optional AWS region
 * @returns S3UploadResult containing bucket, key, and S3 URI
 */
export async function uploadFileToS3(
  localPath: string,
  bucketName: string,
  region?: string,
): Promise<S3UploadResult> {
  // Strip s3:// prefix if present
  const bucket = bucketName.replace(/^s3:\/\//, "");

  // Verify file exists
  try {
    const stats = statSync(localPath);
    if (!stats.isFile()) {
      throw new Error(`${localPath} is not a file`);
    }
  } catch (error) {
    throw new Error(
      `Cannot access local file: ${localPath}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Generate unique S3 key using timestamp and filename
  const timestamp = Date.now();
  const filename = basename(localPath);
  const key = `github-actions-transfer/${timestamp}-${filename}`;

  core.info(`Uploading ${localPath} to s3://${bucket}/${key}`);

  const s3Client = new S3Client(region ? { region } : {});

  try {
    // Read file contents
    const fileContent = readFileSync(localPath);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
    });

    await s3Client.send(command);

    const s3Uri = `s3://${bucket}/${key}`;
    core.info(`Successfully uploaded file to ${s3Uri}`);

    return {
      bucket,
      key,
      s3Uri,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to upload file to S3: ${errorMessage}`);
  }
}
