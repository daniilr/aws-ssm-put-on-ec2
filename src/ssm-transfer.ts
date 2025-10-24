import * as core from "@actions/core";
import {
  SSMClient,
  SendCommandCommand,
  GetCommandInvocationCommand,
  type SendCommandCommandOutput,
} from "@aws-sdk/client-ssm";
import type { S3UploadResult, SSMCommandResult } from "./types.js";

/**
 * Transfers file from S3 to EC2 instance using SSM
 * @param instanceId - EC2 instance ID
 * @param s3Result - S3 upload result containing bucket and key
 * @param remotePath - Destination path on EC2 instance
 * @param region - Optional AWS region
 * @returns SSMCommandResult with command execution details
 */
export async function transferFileViaSSM(
  instanceId: string,
  s3Result: S3UploadResult,
  remotePath: string,
  region?: string,
): Promise<SSMCommandResult> {
  const ssmClient = new SSMClient(region ? { region } : {});

  // Construct AWS CLI command to download from S3 to EC2
  const commands = [
    `mkdir -p $(dirname ${remotePath})`,
    `aws s3 cp ${s3Result.s3Uri} ${remotePath}`,
    `echo "File transferred successfully to ${remotePath}"`,
  ];

  core.info(
    `Executing SSM command on instance ${instanceId} to download file from ${s3Result.s3Uri}`,
  );

  try {
    // Send command via SSM
    const sendCommand = new SendCommandCommand({
      InstanceIds: [instanceId],
      DocumentName: "AWS-RunShellScript",
      Parameters: {
        commands,
      },
    });

    const response: SendCommandCommandOutput =
      await ssmClient.send(sendCommand);

    if (!response.Command?.CommandId) {
      throw new Error("SSM command was sent but no CommandId was returned");
    }

    const commandId = response.Command.CommandId;
    core.info(`SSM Command sent with ID: ${commandId}`);

    // Wait for command to complete and get result
    const result = await waitForCommandCompletion(
      ssmClient,
      commandId,
      instanceId,
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to transfer file via SSM: ${errorMessage}`);
  }
}

/**
 * Waits for SSM command to complete and retrieves the result
 * @param ssmClient - SSM client instance
 * @param commandId - SSM command ID to monitor
 * @param instanceId - EC2 instance ID
 * @param maxAttempts - Maximum number of polling attempts (default: 60)
 * @param delayMs - Delay between polling attempts in milliseconds (default: 2000)
 * @returns SSMCommandResult with execution status and output
 */
async function waitForCommandCompletion(
  ssmClient: SSMClient,
  commandId: string,
  instanceId: string,
  maxAttempts: number = 60,
  delayMs: number = 2000,
): Promise<SSMCommandResult> {
  core.info(`Waiting for SSM command ${commandId} to complete...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const getCommand = new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: instanceId,
      });

      const invocation = await ssmClient.send(getCommand);
      const status = invocation.Status;

      if (status === "Success") {
        core.info("SSM command completed successfully");
        return {
          commandId,
          status,
          output: invocation.StandardOutputContent || "",
        };
      } else if (status === "Failed" || status === "Cancelled") {
        const errorOutput =
          invocation.StandardErrorContent || "No error output";
        throw new Error(`SSM command ${status.toLowerCase()}: ${errorOutput}`);
      } else if (
        status === "InProgress" ||
        status === "Pending" ||
        status === "Delayed"
      ) {
        core.info(
          `Attempt ${attempt}/${maxAttempts}: Command status is ${status}`,
        );
        await sleep(delayMs);
      } else {
        throw new Error(`Unexpected SSM command status: ${status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "InvocationDoesNotExist") {
        // Command not yet available, wait and retry
        core.info(
          `Attempt ${attempt}/${maxAttempts}: Command invocation not yet available`,
        );
        await sleep(delayMs);
      } else {
        throw error;
      }
    }
  }

  throw new Error(
    `SSM command did not complete within ${(maxAttempts * delayMs) / 1000} seconds`,
  );
}

/**
 * Sleep utility function
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
