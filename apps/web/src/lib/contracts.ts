import { BeaconLiteVaultABI, WithdrawalQueueABI, deployments } from '@beacon-lite/protocol-config';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export function getDeployment(chainId: number | undefined) {
  if (!chainId) return undefined;
  return deployments[String(chainId)];
}

export function isConfiguredAddress(address: string | undefined): address is `0x${string}` {
  return Boolean(address && address !== ZERO_ADDRESS);
}

export { BeaconLiteVaultABI, WithdrawalQueueABI };
