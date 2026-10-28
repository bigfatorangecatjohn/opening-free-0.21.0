/**
 * dsh-opening-free — Host half.
 *
 * Intentionally empty. The whole sequence lives in the client half, and its
 * audio travels inside `client.js` as a data URI, so nothing here needs to
 * serve, watch or schedule anything — and touching no service means no service
 * contract to keep (a host half that reads a service it never declared fails
 * the bundle check).
 *
 * The exported `name` is what the profile row resolves against.
 */

export const name = 'dsh-opening-free';

export function apply() {}
