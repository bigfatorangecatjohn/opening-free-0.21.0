/**
 * @local/dsh-opening — Host half.
 *
 * Serves one static file, the boot-sequence audio track, at
 * `/dsh-opening/asset/boot.wav`. Nothing else: the animation itself is entirely
 * in the client half, and this route only exists so the browser can stream the
 * WAV instead of parsing a megabyte of base64 out of a JS module.
 *
 * If the host has no `webServer` (an Electron build that ships the front end
 * over file:// + IPC, for instance), the plugin stays applied and the sequence
 * simply plays silently — a missing soundtrack must never break the UI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const ASSET_DIR = path.join(PACKAGE_ROOT, 'assets');
const ROUTE_BASE = '/dsh-opening';
const TRACK_NAME = 'boot.wav';
const TRACK_PATH = path.join(ASSET_DIR, TRACK_NAME);
const TRACK_ROUTE = ROUTE_BASE + '/asset/' + TRACK_NAME;

export const name = 'dsh-opening';

function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined;
    if (viaGet) return viaGet;
  } catch (error) {
    /* fall through to the property */
  }
  return ctx.webServer;
}

function resolveConnection(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('connection') : undefined;
    if (viaGet) return viaGet;
  } catch (error) {
    /* fall through */
  }
  return ctx.connection;
}

/** Reject cross-origin reads the same way the shipped routes do. */
function rejected(connection, req, res) {
  try {
    if (!connection || typeof connection.requestRejection !== 'function') return false;
    const code = connection.requestRejection(req);
    if (code === undefined || code === null || code === false) return false;
    res.statusCode = typeof code === 'number' ? code : 403;
    res.end();
    return true;
  } catch (error) {
    return false;
  }
}

export function apply(ctx) {
  const webServer = resolveWebServer(ctx);
  if (!webServer || typeof webServer.register !== 'function') {
    try {
      ctx.logger?.warn?.(
        '[dsh-opening] this host exposes no webServer; the boot sequence will run without sound.',
      );
    } catch (error) {
      /* logging is best effort */
    }
    return;
  }

  let size = 0;
  try {
    size = fs.statSync(TRACK_PATH).size;
  } catch (error) {
    try {
      ctx.logger?.warn?.('[dsh-opening] missing audio track: ' + TRACK_PATH);
    } catch (nested) {
      /* ignore */
    }
    return;
  }

  const connection = resolveConnection(ctx);

  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: TRACK_ROUTE,
        handler: (req, res) => {
          if (rejected(connection, req, res)) return;
          if ((req.method || 'GET').toUpperCase() !== 'GET') {
            res.writeHead(405, { Allow: 'GET' });
            res.end();
            return;
          }

          const range = req.headers && req.headers.range;
          const match = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
          if (match) {
            const start = match[1] ? parseInt(match[1], 10) : 0;
            const end = match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
            if (Number.isNaN(start) || start > end || start >= size) {
              res.writeHead(416, { 'Content-Range': 'bytes */' + size });
              res.end();
              return;
            }
            res.writeHead(206, {
              'Content-Type': 'audio/wav',
              'Content-Length': String(end - start + 1),
              'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
              'Cache-Control': 'no-cache',
            });
            fs.createReadStream(TRACK_PATH, { start, end }).pipe(res);
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'audio/wav',
            'Content-Length': String(size),
            'Cache-Control': 'no-cache',
          });
          fs.createReadStream(TRACK_PATH).pipe(res);
        },
      }),
    'dsh-opening: audio route',
  );
}
