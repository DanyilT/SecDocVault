/**
 * services/connectivity.ts
 *
 * Small wrapper around React Native's NetInfo or platform connectivity utilities.
 * Provides helpers used across the app to determine online/offline status and
 * connection changes. Exported utilities are used by hooks and controllers to
 * gate network operations (e.g. uploads, key backups).
 *
 * Exports:
 * - (default or named exports depend on original file) utility functions to
 *   observe connectivity and check current network state.
 *
 * Note: keep this file focused on network status only — do not embed higher
 * level retry or queue logic here; that belongs in services that orchestrate
 * uploads or synchronization.
 */

export const NO_INTERNET_MESSAGE = 'no internet access';

const INTERNET_CHECK_URL = 'https://clients3.google.com/generate_204';

export async function hasInternetAccess(timeoutMs = 1500): Promise<boolean> {
  try {
	const timeoutPromise = new Promise<Response>((_, reject) => {
	  setTimeout(() => reject(new Error(NO_INTERNET_MESSAGE)), timeoutMs);
	});

	const response = (await Promise.race([
	  fetch(INTERNET_CHECK_URL, {method: 'HEAD'}),
	  timeoutPromise,
	])) as Response;

	return response.ok || response.status === 204;
  } catch {
	return false;
  }
}

export async function assertInternetAccess(timeoutMs = 1500): Promise<void> {
  const online = await hasInternetAccess(timeoutMs);
  if (!online) {
	throw new Error(NO_INTERNET_MESSAGE);
  }
}
