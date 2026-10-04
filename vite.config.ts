import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { bridge } from './server/bridge.ts';
import { ensureMediaDirs } from './server/media/library.ts';

// Scenes import project/media.json, so it must exist before the first transform.
ensureMediaDirs();

export default defineConfig({
  plugins: [react(), bridge()],
  // Imported media (raw files, proxies, posters) is served from here, which is also the
  // folder Remotion uses for staticFile() in stills and renders.
  publicDir: 'project/media',
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Bridge state and renders change constantly and are not part of the module graph.
    // Inactive projects (projects/) aren't part of the app; switching restarts the server.
    watch: { ignored: ['**/project/.ev/**', '**/project/out/**', '**/project/.git/**', '**/projects/**'] },
  },
});
