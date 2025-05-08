import { EventFragment, Fragment, FunctionFragment, Interface } from '@ethersproject/abi';
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

export function combineInterfaces(interfaces: Interface[]): Interface {
  // Use a Map to store unique fragments, keyed by their string representation
  const uniqueFragments = new Map<string, Fragment>();

  interfaces.forEach((interfaceInstance: Interface) => {
    interfaceInstance.fragments.forEach((fragment: Fragment) => {
      let key: string;

      if (fragment instanceof FunctionFragment) {
        // For functions, use the signature as the key
        // This includes name and parameter types
        key = fragment.format();
      } else if (fragment instanceof EventFragment) {
        // For events, use the signature as the key
        key = fragment.format();
      } else {
        // For other fragment types (like errors), use their string representation
        key = fragment.toString();
      }

      // Only add if we haven't seen this signature before
      if (!uniqueFragments.has(key)) {
        uniqueFragments.set(key, fragment);
      }
    });
  });

  // Convert the Map values back to an array
  const dedupedFragments = Array.from(uniqueFragments.values());

  // Create a new interface with the deduped fragments
  return new Interface(dedupedFragments);
};