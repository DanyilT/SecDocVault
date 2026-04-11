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
