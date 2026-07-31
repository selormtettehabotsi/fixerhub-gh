import { logoutServer } from '../api/auth';
import * as tokenStorage from './tokenStorage';

/**
 * SIGN OUT — local first, server revocation in the background.
 *
 * Sign-out used to take up to ~45 seconds on a slow connection, because every
 * screen did this:
 *
 *     await logoutServer(refreshToken);   // network, 15s timeout
 *     await tokenStorage.multiRemove(...) // only THEN clear locally
 *     router.replace('/(auth)/welcome');  // only THEN navigate
 *
 * Three problems compounded:
 *   1. The user waited on a network round trip to do something that is
 *      fundamentally local — forgetting credentials on this device.
 *   2. `/auth/logout` sends an access token that is often expired (they live
 *      15 minutes, and someone signing out has usually been idle). The 401
 *      interceptor then refreshed AND retried, so the worst case was three
 *      sequential 15s timeouts, not one.
 *   3. If the request hung and the user force-quit the app, tokens were still
 *      on the device — the opposite of what they asked for.
 *
 * Clearing local state first fixes all three. Revocation still happens, it
 * just no longer blocks the UI: the refresh token is captured before the wipe
 * and posted in the background.
 */

const SESSION_KEYS = [
  'token',
  'refreshToken',
  'role',
  'userId',
  'name',
  'email',
  'phone',
  'profilePicture',
];

export async function signOut(): Promise<void> {
  // Capture before wiping — the server needs it to revoke the session.
  let refreshToken: string | null = null;
  try {
    refreshToken = await tokenStorage.getItem('refreshToken');
  } catch {
    // Unreadable keychain shouldn't block signing out.
  }

  await tokenStorage.multiRemove(SESSION_KEYS);

  // Fire-and-forget. logoutServer already swallows its own errors; the void
  // and the catch are here so an unhandled rejection can't surface as a
  // redbox after the user has already left the screen.
  if (refreshToken) {
    void logoutServer(refreshToken).catch(() => {});
  }
}
