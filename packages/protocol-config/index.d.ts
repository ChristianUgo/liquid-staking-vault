export const BeaconLiteVaultABI: readonly any[];
export const WithdrawalQueueABI: readonly any[];
export const MockValidatorAdapterABI: readonly any[];

export interface DeploymentEntry {
  name: string;
  vault: `0x${string}`;
  adapter: `0x${string}`;
  withdrawalQueue: `0x${string}`;
  deploymentBlock: number;
}

export const deployments: Record<string, DeploymentEntry>;
