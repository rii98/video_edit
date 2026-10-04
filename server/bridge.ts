// Vite plugin: the UI's only window onto the project. It writes edit requests for Claude and
// streams request/agent/version state back over SSE. There is no remote API anywhere.
import { createReadStream, createWriteStream, existsSync, rmSync, statSync, watch, type FSWatcher } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Plugin } from 'vite';
import type { ServerState } from '../src/shared/types.ts';
import { listVersions, restoreVersion, revertCommit } from './git.ts';
import { applyTheme } from './themes.ts';
import { chooseTreatment } from './intake.ts';
import { activeProject, createProject, listProjects, switchProject } from './projects.ts';
import { ensureRepo } from './git.ts';
import { renderComparison } from './compare.ts';
import { deleteExport, getExport, isExporting, listExports, OUT_DIR, PRESETS, runExport } from './exporter.ts';
import type { ExportPreset } from '../src/shared/types.ts';
import { appendMessage, createRequest, ensureDirs, EV_DIR, getRequest, listRequests, parseNewRequest, readAgentStatus, replyToRequest, SNAPSHOTS_DIR, updateRequest } from './store.ts';
import { analyzeAsset, needsAnalysis } from './media/analyze.ts';
import { ANALYSIS_DIR, ensureMediaDirs, importFile, listAssets, RAW_DIR, removeAsset } from './media/library.ts';
import { kindOf } from './media/probe.ts';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_UPLOAD_BYTES = 20 * 1024 ** 3;

function snapshot(): ServerState {
  return { project: activeProject(), projects: listProjects(), requests: listRequests(), agent: readAgentStatus(), versions: listVersions(), media: listAssets(), exports: listExports() };
}

/** Streams an upload straight to disk (no buffering), then hands it to the library. */
async function receiveUpload(req: IncomingMessage, name: string) {
  if (!kindOf(name)) throw new Error(`Unsupported file type: ${name}`);
  if (Number(req.headers['content-length'] ?? 0) > MAX_UPLOAD_BYTES) throw new Error('File is larger than 20 GB');
  const tmp = join(RAW_DIR, `.incoming-${randomUUID()}${extname(name).toLowerCase()}`);
  try {
    await pipeline(req, createWriteStream(tmp));
    return importFile(tmp, { name, move: true });
  } finally {
    rmSync(tmp, { force: true }); // no-op after a successful move
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('request body too large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/**
 * Requests become instructions Claude acts on, so a random web page must not be able to post
 * them to localhost. Requiring a custom header forces a CORS preflight, which we never answer.
 */
function isTrustedWrite(req: IncomingMessage): boolean {
  if (req.headers['x-easy-video'] !== '1') return false;
  const origin = req.headers.origin;
  return !origin || new URL(origin).host === req.headers.host;
}

export function bridge(): Plugin {
  return {
    name: 'easy-video-bridge',
    configureServer(server) {
      ensureDirs();
      ensureMediaDirs();
      const log = (message: string) => server.config.logger.info(`[media] ${message}`, { timestamp: true });
      const clients = new Set<ServerResponse>();
      let timer: NodeJS.Timeout | undefined;

      const broadcast = () => {
        if (clients.size === 0) return;
        const payload = `data: ${JSON.stringify(snapshot())}\n\n`;
        for (const client of clients) client.write(payload);
      };
      // Coalesce bursts (a request + status + commit land within milliseconds of each other).
      const scheduleBroadcast = () => {
        clearTimeout(timer);
        timer = setTimeout(broadcast, 80);
      };

      const watchers: FSWatcher[] = [watch(EV_DIR, { recursive: true }, scheduleBroadcast), watch(ANALYSIS_DIR, { recursive: true }, scheduleBroadcast)];
      // Re-evaluates heartbeat staleness even when no file changes.
      const ticker = setInterval(broadcast, 5_000);
      server.httpServer?.on('close', () => {
        watchers.forEach((w) => w.close());
        clearInterval(ticker);
      });

      // Analysis runs one asset at a time: ffmpeg already uses every core.
      const queue: string[] = [];
      let draining = false;
      const enqueue = (id: string) => {
        if (!queue.includes(id)) queue.push(id);
        void drain();
      };
      const drain = async () => {
        if (draining) return;
        draining = true;
        while (queue.length) {
          const id = queue.shift()!;
          try {
            await analyzeAsset(id, { log });
          } catch (err) {
            log(`${id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        draining = false;
      };
      // Resume anything a previous run didn't finish.
      listAssets().filter(needsAnalysis).forEach((a) => enqueue(a.id));

      server.middlewares.use('/api', async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        try {
          if (req.method === 'GET' && url.pathname === '/state') {
            return sendJson(res, 200, snapshot());
          }

          if (req.method === 'GET' && url.pathname === '/events') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
            res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
            clients.add(res);
            req.on('close', () => clients.delete(res));
            return;
          }

          const download = url.pathname.match(/^\/exports\/([\w-]+)\/file$/);
          if (req.method === 'GET' && download) {
            const job = getExport(download[1]!);
            const path = job?.file ? join(OUT_DIR, job.file) : null;
            if (!path || !existsSync(path)) return sendJson(res, 404, { error: 'not found' });
            res.writeHead(200, {
              'Content-Type': 'video/mp4',
              'Content-Length': statSync(path).size,
              'Content-Disposition': `attachment; filename="${job!.file}"`,
            });
            createReadStream(path).pipe(res);
            return;
          }

          const snapshotFile = url.pathname.match(/^\/snapshots\/([\w.-]+\.png)$/);
          if (req.method === 'GET' && snapshotFile) {
            const path = join(SNAPSHOTS_DIR, snapshotFile[1]!);
            if (!existsSync(path)) return sendJson(res, 404, { error: 'not found' });
            res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
            createReadStream(path).pipe(res);
            return;
          }

          if (req.method !== 'POST') return next();
          if (!isTrustedWrite(req)) return sendJson(res, 403, { error: 'forbidden' });

          if (url.pathname === '/media/upload') {
            const name = url.searchParams.get('name') ?? '';
            const { asset, existing } = await receiveUpload(req, name);
            if (!existing) enqueue(asset.id);
            scheduleBroadcast();
            return sendJson(res, existing ? 200 : 201, { asset, existing });
          }

          const removeMedia = url.pathname.match(/^\/media\/([a-z0-9-]+)\/remove$/);
          if (removeMedia) {
            removeAsset(removeMedia[1]!);
            scheduleBroadcast();
            return sendJson(res, 200, { removed: true });
          }

          if (url.pathname === '/requests') {
            const created = createRequest(parseNewRequest(await readJson(req)));
            scheduleBroadcast();
            return sendJson(res, 201, created);
          }

          const cancel = url.pathname.match(/^\/requests\/(\d+)\/cancel$/);
          if (cancel) {
            const request = getRequest(Number(cancel[1]));
            if (!request) return sendJson(res, 404, { error: 'not found' });
            if (request.status !== 'pending' && request.status !== 'needs-input') return sendJson(res, 409, { error: 'only queued or waiting requests can be cancelled' });
            return sendJson(res, 200, updateRequest(request.id, { status: 'failed', result: 'Cancelled' }));
          }

          if (url.pathname === '/compare') {
            const { sha, frame } = (await readJson(req)) as { sha?: unknown; frame?: unknown };
            const files = await renderComparison(String(sha ?? ''), Number(frame ?? 0));
            const bust = Date.now();
            return sendJson(res, 200, { current: `/api/snapshots/${files.current}?v=${bust}`, version: `/api/snapshots/${files.version}?v=${bust}` });
          }

          if (url.pathname === '/export') {
            const { preset } = (await readJson(req)) as { preset?: string };
            if (!preset || !(preset in PRESETS)) return sendJson(res, 400, { error: `preset must be one of ${Object.keys(PRESETS).join(', ')}` });
            if (isExporting()) return sendJson(res, 409, { error: 'An export is already running' });
            // Runs in the background; progress streams to the editor through the job file.
            runExport(preset as ExportPreset, (m) => log(`export: ${m}`)).catch((err) => log(`export failed: ${err instanceof Error ? err.message : err}`));
            return sendJson(res, 202, { started: true });
          }

          const removeExport = url.pathname.match(/^\/exports\/([\w-]+)\/delete$/);
          if (removeExport) {
            deleteExport(removeExport[1]!);
            scheduleBroadcast();
            return sendJson(res, 200, { deleted: true });
          }

          if (url.pathname === '/intake/choose') {
            const { id, notes } = (await readJson(req)) as { id?: unknown; notes?: unknown };
            const request = chooseTreatment(String(id ?? ''), typeof notes === 'string' ? notes.slice(0, 2000) : '');
            scheduleBroadcast();
            return sendJson(res, 201, request);
          }

          // Projects. Switching swaps folders, so nothing may be writing into project/ at the time;
          // then the server restarts so every module, watcher and cache is bound to the new one.
          if (url.pathname === '/projects' || url.pathname === '/projects/switch') {
            const busy = draining
              ? 'media is still being analyzed'
              : isExporting()
                ? 'an export is running'
                : listRequests().some((r) => r.status === 'working')
                  ? 'Claude is mid-edit'
                  : null;
            if (busy) return sendJson(res, 409, { error: `Can't switch projects while ${busy}. Try again in a moment.` });
            const body = (await readJson(req)) as { name?: unknown; slug?: unknown };
            let slug: string;
            if (url.pathname === '/projects') {
              const { info, dir } = createProject(String(body.name ?? ''));
              ensureRepo(dir); // its own version history, starting at v0
              slug = info.slug;
            } else slug = String(body.slug ?? '');
            const project = switchProject(slug);
            sendJson(res, 200, { project });
            log(`switched to project "${project.name}"; restarting`);
            setTimeout(() => void server.restart(), 50);
            return;
          }

          if (url.pathname === '/theme') {
            if (listRequests().some((r) => r.status === 'working')) {
              return sendJson(res, 409, { error: 'Claude is mid-edit; change the theme after it finishes' });
            }
            const { slug } = (await readJson(req)) as { slug?: unknown };
            const commit = applyTheme(String(slug ?? ''));
            broadcast();
            return sendJson(res, 200, { commit });
          }

          const reply = url.pathname.match(/^\/requests\/(\d+)\/reply$/);
          if (reply) {
            const { text } = (await readJson(req)) as { text?: unknown };
            const updated = replyToRequest(Number(reply[1]), typeof text === 'string' ? text : '');
            scheduleBroadcast();
            return sendJson(res, 200, updated);
          }

          // Undo the latest edit a request made (a precise revert; later edits survive).
          const undo = url.pathname.match(/^\/requests\/(\d+)\/undo$/);
          if (undo) {
            if (listRequests().some((r) => r.status === 'working')) return sendJson(res, 409, { error: 'Claude is mid-edit; undo after it finishes' });
            const request = getRequest(Number(undo[1]));
            if (!request) return sendJson(res, 404, { error: 'not found' });
            const thread = request.thread ?? [];
            const index = thread.findLastIndex((m) => m.kind === 'done' && m.commit && !m.undone);
            if (index < 0) return sendJson(res, 409, { error: 'nothing to undo on this request' });
            const target = thread[index]!;
            const commit = revertCommit(target.commit!, `Undo #${request.id}: ${target.text}`);
            const marked = thread.map((m, i) => (i === index ? { ...m, undone: true } : m));
            updateRequest(request.id, { thread: marked });
            const updated = appendMessage(request.id, { from: 'system', kind: 'note', text: `Undid version ${target.commit} (now version ${commit}).`, commit });
            broadcast();
            return sendJson(res, 200, updated);
          }

          if (url.pathname === '/versions/restore') {
            if (listRequests().some((r) => r.status === 'working')) {
              return sendJson(res, 409, { error: 'Claude is mid-edit; restore after it finishes' });
            }
            const { sha } = (await readJson(req)) as { sha?: unknown };
            const commit = restoreVersion(String(sha ?? ''));
            broadcast();
            return sendJson(res, 200, { commit });
          }

          next();
        } catch (err) {
          sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}
