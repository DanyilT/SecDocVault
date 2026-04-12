/**
 * firebase/project.ts
 *
 * Small module exposing Firebase-hosting and auth configuration used by
 * email-link flows or other environment-specific helpers. Keeps the value in
 * a single place for tests and integration.
 */

export const FIREBASE_PROJECT_ID = 'docvault-third-year-project';

/**
 * Hosting domain used by the Firebase project (derived from the project id).
 * Example: `${FIREBASE_PROJECT_ID}.web.app`
 */
export const FIREBASE_HOSTING_DOMAIN = `${FIREBASE_PROJECT_ID}.web.app`;

/**
 * Path on the hosting domain that serves the email-link verification UI.
 */
export const FIREBASE_AUTH_EMAIL_LINK_PATH = '/auth/email-link';

/**
 * Fully-qualified email-link URL used by authentication flows that open the
 * hosted verification page. Example:
 * `https://<project>.web.app/auth/email-link`
 */
export const FIREBASE_AUTH_EMAIL_LINK_URL = `https://${FIREBASE_HOSTING_DOMAIN}${FIREBASE_AUTH_EMAIL_LINK_PATH}`;
