/**
 * Dev-server-only endpoint for saving a rendered frame of the Pixi scene:
 * POST /__capture  { name, dataUrl }  →  .captures/<name>.png
 *
 * Exists because embedded preview panes can render WebGL at 0 width. Never
 * included in production builds (`apply: 'serve'`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function capturePlugin(outDir = '.captures'): Plugin {
  return {
    name: 'insulin-hero-capture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => (body += chunk));
        req.on('end', () => {
          try {
            const { name, dataUrl } = JSON.parse(body) as { name: string; dataUrl: string };
            const safe = String(name).replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'frame';
            const b64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
            const dir = resolve(server.config.root, outDir);
            mkdirSync(dir, { recursive: true });
            const file = resolve(dir, `${safe}.png`);
            writeFileSync(file, Buffer.from(b64, 'base64'));
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ file }));
          } catch (e) {
            res.statusCode = 400;
            res.end(String(e));
          }
        });
      });
    },
  };
}
