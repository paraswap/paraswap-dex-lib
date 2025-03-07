import { HooksConfigMap } from './hooks/balancer-hook-event-subscriber';

export function getUniqueHookNames(hooksConfigMap: HooksConfigMap): string {
  // Use Object.values to get all HookConfig objects
  // Then map to extract just the names
  // Use Set to get unique names
  // Convert back to array and join with comma
  return Array.from(
    new Set(Object.values(hooksConfigMap).map(hook => hook.apiName)),
  ).join(', ');
}
