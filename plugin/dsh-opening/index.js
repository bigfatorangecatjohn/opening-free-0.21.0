/**
 * Host half of the `@local/dsh-opening` bundle.
 *
 * The boot sequence is a Client module (see `client.js`); the host side owns no
 * service, no tool and no config, so `apply` stays empty on purpose. Keeping the
 * empty row is what makes this a bundle: the patch inserts it, the Client half
 * rides along on the same package name.
 */
export function apply() {}
