import * as core from "@actions/core";
import type { ActionInputs } from "./types.js";
import { uploadFileToS3 } from "./s3-upload.js";
import { transferFileViaSSM } from "./ssm-transfer.js";

/**
 * Retrieves and validates action inputs
 * @returns ActionInputs object with all required parameters
 */
function getInputs(): ActionInputs {
  const localPath = core.getInput("local-path", { required: true });
  const remotePath = core.getInput("remote-path", { required: true });
  const instance = core.getInput("instance", { required: true });
  const intermediateS3 = core.getInput("intermediate-s3", { required: true });
  const region = core.getInput("region", { required: false }) || undefined;

  return {
    localPath,
    remotePath,
    instance,
    intermediateS3,
    region,
  };
}

/**
 * The main function for the action.
 * Transfers a local file to an EC2 instance via S3 and SSM.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    core.info("Starting file transfer to EC2 instance via S3 and SSM");

    // Get and validate inputs
    const inputs = getInputs();

    core.info(`Local path: ${inputs.localPath}`);
    core.info(`Remote path: ${inputs.remotePath}`);
    core.info(`Instance ID: ${inputs.instance}`);
    core.info(`S3 bucket: ${inputs.intermediateS3}`);
    if (inputs.region) {
      core.info(`AWS Region: ${inputs.region}`);
    }

    // Step 1: Upload file to S3
    core.startGroup("Uploading file to S3");
    const s3Result = await uploadFileToS3(
      inputs.localPath,
      inputs.intermediateS3,
      inputs.region,
    );
    core.endGroup();

    // Step 2: Transfer file from S3 to EC2 via SSM
    core.startGroup("Transferring file to EC2 instance via SSM");
    await transferFileViaSSM(
      inputs.instance,
      s3Result,
      inputs.remotePath,
      inputs.region,
    );
    core.endGroup();

    core.info("File transfer completed successfully!");
  } catch (error) {
    // Handle errors and fail the action
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unknown error occurred");
    }
  }
}
