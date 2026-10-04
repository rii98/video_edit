// `ev`: Claude's side of the bridge. Run as `npm run ev -- <command>`.
import { existsSync, readdirSync, readFileSync, statSync, watch } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { formatTime, layoutScenes, totalFrames } from '../src/shared/timeline.ts';
import type { AnalysisStep, EditRequest, ExportPreset, Timeline } from '../src/shared/types.ts';
import { commitAll, ensureRepo, listVersions } from '../server/git.ts';
import { getAsset as getAssetRecord, listAssets } from '../server/media/library.ts';
import {
  appendMessage,
  claimNextPending,
  ensureDirs,
  getRequest,
  HEARTBEAT_STALE_MS,
  listRequests,
  PROJECT_DIR,
  REQUESTS_DIR,
  ROOT,
  SNAPSHOTS_DIR,
  updateRequest,
  writeAgentStatus,
} from '../server/store.ts';

const HELP = `ev: Easy Video bridge for Claude

  wait [--timeout=SEC]   Block until the user sends an edit, claim it, print the briefing
  show <id>              Print the briefing for a request without claiming it
  snap <id>              Render the pinned frame with the pin drawn on it
  check <id> [frames..]  Render frames around the edit to verify it (no pin)
  still <frame> [--name=x]  Render any frame (named, e.g. for alternatives to show with ask)
  status "<message>"     Tell the UI what you are doing right now
  done <id> "<summary>" [--assumed="…"]  Commit the edit as a version; say what you had to assume
  ask <id> "<question>" [--choices="A|B"] [--images=a.png,b.png --labels="A|B"]
                         Ask in the request's thread instead of guessing (waits for the user)
  reply <id> "<text>"    Answer in the thread without editing (e.g. "why did you…?")
  fail <id> "<reason>"   Mark a request failed (nothing is committed)
  save "<message>"       Commit current project changes as a version (outside a request)
  list                   All requests
  versions               Version history

  ingest <file|dir>...   Add media to the project and analyze it
  media [id]             Media summary (all assets, or details for one)
  analyze <id> [--redo=step,step]  Re-run analysis steps (e.g. --redo=transcript)
  occupancy <id>         Sheet of the top and bottom bands of every second: where can new graphics go?
  remove <id> [--force]  Delete an asset (refuses while scenes use it)
  sfx <kind|all> [--seed=N] [--seconds=S]   Synthesize sound effects into the library
  tts "<text>" [--voice=aura-2-…]  Generate a voiceover with Deepgram (cached per text+voice)

  library                Components, themes and technique cards available to scenes
  demo <Name|all> [--theme=slug]   Render library demos (all → one labelled sheet)
  theme [slug]           Show themes, or apply one to the project (creates a version)

  export [final|draft]   Render the video to project/out (final: originals + -14 LUFS)

  project                List projects (the active one is marked)
  project new "<name>"   Create a project and switch to it
  project use <slug>     Switch projects (refused while analysis/export/an edit is running)

  intake                 Show the brief and treatments, and validate them
  treatments [frames..]  Render every treatment's motion test to one sheet (rows = treatments)`;

const rel = (p: string) => relative(ROOT, p);

function loadTimeline(): Timeline {
  return JSON.parse(readFileSync(join(PROJECT_DIR, 'timeline.json'), 'utf8')) as Timeline;
}

function requireRequest(arg: string | undefined): EditRequest {
  const request = arg ? getRequest(Number(arg)) : null;
  if (!request) fail(`No request with id "${arg ?? ''}". Try: npm run ev -- list`);
  return request;
}

function fail(message: string): never {
  console.error(`ev: ${message}`);
  process.exit(1);
}

/** Scene files follow `<sceneId>_<Name>.tsx`. */
function sceneFile(sceneId: string): string | null {
  const dir = join(PROJECT_DIR, 'scenes');
  const name = readdirSync(dir).find((f) => f.startsWith(`${sceneId}_`) && f.endsWith('.tsx'));
  return name ? join(dir, name) : null;
}

/** Finds the line that declares a layer id, so Claude can jump straight to it. */
function locateLayer(layer: string): string {
  const [sceneId, ...rest] = layer.split('.');
  const layerId = rest.join('.');
  const file = sceneId ? sceneFile(sceneId) : null;
  if (!file) return layer;
  const lines = readFileSync(file, 'utf8').split('\n');
  const idx = lines.findIndex((l) => l.includes(`id="${layerId}"`) || l.includes(`id='${layerId}'`));
  return idx >= 0 ? `${layer} → ${rel(file)}:${idx + 1}` : `${layer} → ${rel(file)}`;
}

function briefing(r: EditRequest): string {
  const t = loadTimeline();
  const scenes = layoutScenes(t);
  const scene = scenes.find((s) => s.id === r.sceneId);
  const px = (n: number, size: number) => Math.round(n * size);
  const lines = [
    `#${r.id}  [${r.status}]  scope=${r.scope}`,
    `prompt: ${r.prompt}`,
    `frame:  ${r.frame} (${formatTime(r.frame, t.fps)}) of ${totalFrames(t)} @ ${t.fps}fps, ${t.width}x${t.height}`,
  ];
  if (scene) {
    lines.push(
      `scene:  ${scene.id} "${scene.name}", local frame ${r.frame - scene.from} of ${scene.durationInFrames} (global ${scene.from}-${scene.from + scene.durationInFrames - 1})`,
    );
  }
  if (r.range) {
    const covered = scenes.filter((s) => s.from <= r.range!.end && s.from + s.durationInFrames > r.range!.start).map((s) => s.id);
    lines.push(`range:  frames ${r.range.start}-${r.range.end} (${formatTime(r.range.start, t.fps)}–${formatTime(r.range.end, t.fps)}), scenes ${covered.join(', ')}`);
  }
  if (r.pin) lines.push(`pin:    (${r.pin.x.toFixed(3)}, ${r.pin.y.toFixed(3)}) = ${px(r.pin.x, t.width)},${px(r.pin.y, t.height)}px`);
  if (r.region) {
    const { x, y, w, h } = r.region;
    lines.push(`region: ${px(x, t.width)},${px(y, t.height)}px size ${px(w, t.width)}x${px(h, t.height)}px`);
  }
  lines.push(`layers: ${r.layers.length ? '' : '(none: the user pointed at background or the whole frame)'}`);
  for (const layer of r.layers) lines.push(`  - ${locateLayer(layer)}`);
  const file = scene ? sceneFile(scene.id) : null;
  lines.push(`files:  project/timeline.json${file ? `, ${rel(file)}` : ''}`);
  const thread = r.thread ?? [];
  if (thread.length) {
    lines.push(``, `THREAD (oldest first; the prompt above came first):`);
    for (const m of thread) {
      const who = m.from === 'user' ? 'USER' : m.from === 'claude' ? 'YOU' : 'SYSTEM';
      const extra = [m.choices?.length ? `choices: ${m.choices.join(' | ')}` : '', m.commit ? `version ${m.commit}${m.undone ? ' (undone)' : ''}` : '', m.assumed ? `assumed: ${m.assumed}` : '']
        .filter(Boolean)
        .join('; ');
      lines.push(`  ${who} [${m.kind}] ${m.text}${extra ? `  (${extra})` : ''}`);
    }
    const last = thread.at(-1)!;
    if (last.from === 'user') lines.push(``, `→ The user replied. Act on the LAST message, with the original pin/frame/layers as context.`, `  An answer to your question → do the edit. A tweak → edit again. A question ("why…?") → \`ev reply\`, no edit.`);
  } else if (r.result) lines.push(`result: ${r.result}`);
  lines.push(``, `next:   npm run ev -- snap ${r.id}   (see what the user saw)`);
  return lines.join('\n');
}

async function cmdWait(args: string[]) {
  ensureDirs();
  ensureRepo();
  const timeoutArg = args.find((a) => a.startsWith('--timeout='));
  const timeoutMs = timeoutArg ? Number(timeoutArg.split('=')[1]) * 1000 : Infinity;
  const started = Date.now();

  // Bound to the project that was active when we started. If the user switches projects,
  // stop (and never write status into the other project) rather than cross over.
  const { activeProject } = await import('../server/projects.ts');
  const startedIn = activeProject().slug;
  const switched = () => activeProject().slug !== startedIn;
  const listen = () => !switched() && writeAgentStatus({ state: 'listening', message: 'Waiting for your next edit', requestId: null });
  listen();
  const heartbeat = setInterval(listen, HEARTBEAT_STALE_MS / 4);
  const goOffline = () => writeAgentStatus({ state: 'offline', message: '', requestId: null });
  process.on('SIGINT', () => (goOffline(), process.exit(130)));
  process.on('SIGTERM', () => (goOffline(), process.exit(143)));

  let projectChanged = false;
  const request = await new Promise<EditRequest | null>((resolve) => {
    // fs.watch is the fast path; the interval catches any missed event and enforces the timeout.
    const tryClaim = () => {
      if (switched()) {
        projectChanged = true;
        return finish(null);
      }
      const claimed = claimNextPending();
      if (claimed) return finish(claimed);
      if (Date.now() - started > timeoutMs) finish(null);
    };
    const watcher = watch(REQUESTS_DIR, tryClaim);
    const poll = setInterval(tryClaim, 1000);
    let finished = false;
    function finish(r: EditRequest | null) {
      if (finished) return;
      finished = true;
      watcher.close();
      clearInterval(poll);
      resolve(r);
    }
    tryClaim();
  });

  clearInterval(heartbeat);
  if (projectChanged) {
    console.log(`ev: the user switched to project "${activeProject().name}". Run \`ev wait\` again to listen there.`);
    process.exit(3);
  }
  if (!request) {
    goOffline();
    console.log('ev: no edit request before timeout');
    process.exit(2);
  }
  writeAgentStatus({ state: 'working', message: 'Reading your request', requestId: request.id });
  console.log(briefing(request));
}

async function cmdSnap(args: string[]) {
  const r = requireRequest(args[0]);
  writeAgentStatus({ state: 'working', message: 'Looking at the frame you picked', requestId: r.id });
  const { renderStills } = await import('./stills.ts');
  const [out] = await renderStills([{ frame: r.frame, output: join(SNAPSHOTS_DIR, `${r.id}.png`), props: { pin: r.pin, region: r.region } }]);
  console.log(rel(out!));
}

async function cmdCheck(args: string[]) {
  const r = requireRequest(args[0]);
  const t = loadTimeline();
  let frames = args.slice(1).map(Number).filter(Number.isFinite);
  if (frames.length === 0) {
    const scene = layoutScenes(t).find((s) => s.id === r.sceneId);
    frames = r.range
      ? [r.range.start, Math.round((r.range.start + r.range.end) / 2), r.range.end]
      : r.scope === 'scene' && scene
        ? [scene.from + 10, r.frame, scene.from + scene.durationInFrames - 10]
        : [r.frame - 10, r.frame, r.frame + 10];
  }
  const last = totalFrames(t) - 1;
  frames = [...new Set(frames.map((f) => Math.min(Math.max(0, Math.round(f)), last)))].sort((a, b) => a - b);
  writeAgentStatus({ state: 'working', message: 'Checking the result', requestId: r.id });
  const { renderStills } = await import('./stills.ts');
  const outs = await renderStills(frames.map((frame) => ({ frame, output: join(SNAPSHOTS_DIR, `${r.id}-check-${frame}.png`) })));
  outs.forEach((o) => console.log(rel(o)));
}

async function cmdStill(args: string[]) {
  const frame = Number(args[0]);
  if (!Number.isFinite(frame)) fail('usage: still <frame> [--name=<label>]');
  const { opts } = options(args.slice(1));
  const name = (opts.name ?? `still-${frame}`).replace(/[^\w-]+/g, '-');
  ensureDirs();
  const { renderStills } = await import('./stills.ts');
  const [out] = await renderStills([{ frame, output: join(SNAPSHOTS_DIR, `${name}.png`) }]);
  console.log(rel(out!));
}

/** `--name=value` options, and the remaining positional words. */
function options(args: string[]): { opts: Record<string, string>; words: string[] } {
  const opts: Record<string, string> = {};
  const words: string[] = [];
  for (const a of args) {
    const m = a.match(/^--([\w-]+)=([\s\S]*)$/);
    if (m) opts[m[1]!] = m[2]!;
    else words.push(a);
  }
  return { opts, words };
}

function cmdDone(args: string[]) {
  const { opts, words } = options(args);
  const r = requireRequest(words[0]);
  const summary = words.slice(1).join(' ').trim();
  if (!summary) fail('usage: done <id> "<what changed>" [--assumed="<what you had to assume>"]');
  const assumed = opts.assumed?.trim() || undefined;
  const commit = commitAll(`#${r.id} ${summary}`);
  appendMessage(r.id, { from: 'claude', kind: 'done', text: summary, ...(commit ? { commit } : {}), ...(assumed ? { assumed } : {}) }, { status: 'done', result: summary, ...(commit ? { commit } : {}) });
  writeAgentStatus({ state: 'listening', message: 'Waiting for your next edit', requestId: null });
  console.log(commit ? `#${r.id} done → version ${commit}` : `#${r.id} done (no file changes to commit)`);
}

function cmdSave(args: string[]) {
  const message = args.join(' ').trim();
  if (!message) fail('usage: save "<message>"');
  const commit = commitAll(message);
  console.log(commit ? `saved → version ${commit}` : 'nothing changed');
}

/**
 * Ask the user a question in the request's thread instead of guessing. Optional quick-pick
 * `--choices="A|B|C"`, or `--images=a.png,b.png --labels="A|B"` to show alternatives
 * (render each with `ev still <frame> --name=…` after making that variant).
 */
async function cmdAsk(args: string[]) {
  const { copyFileSync } = await import('node:fs');
  const { opts, words } = options(args);
  const r = requireRequest(words[0]);
  const question = words.slice(1).join(' ').trim();
  if (!question) fail('usage: ask <id> "<question>" [--choices="A|B"] [--images=a.png,b.png --labels="A|B"]');
  const choices = opts.choices?.split('|').map((c) => c.trim()).filter(Boolean);
  let images: { label: string; file: string }[] | undefined;
  if (opts.images) {
    const paths = opts.images.split(',').map((p) => p.trim()).filter(Boolean);
    const labels = opts.labels?.split('|').map((l) => l.trim()) ?? [];
    const n = (r.thread ?? []).length;
    images = paths.map((p, i) => {
      if (!existsSync(p)) fail(`image not found: ${p}`);
      const file = `thread-${r.id}-${n}-${i}.png`;
      copyFileSync(p, join(SNAPSHOTS_DIR, file));
      return { label: labels[i] || `Option ${i + 1}`, file };
    });
  }
  appendMessage(r.id, { from: 'claude', kind: 'question', text: question, ...(choices?.length ? { choices } : {}), ...(images ? { images } : {}) }, { status: 'needs-input' });
  writeAgentStatus({ state: 'listening', message: `Waiting for your answer on #${r.id}`, requestId: null });
  console.log(`#${r.id} asked; it's waiting for the user. Run \`ev wait\` again: the answer arrives as a reply.`);
}

/** Answer in the thread without editing (explanations, "why did you…?"). */
function cmdReply(args: string[]) {
  const r = requireRequest(args[0]);
  const text = args.slice(1).join(' ').trim();
  if (!text) fail('usage: reply <id> "<text>"');
  appendMessage(r.id, { from: 'claude', kind: 'note', text }, { status: 'done', result: r.result ?? text });
  writeAgentStatus({ state: 'listening', message: 'Waiting for your next edit', requestId: null });
  console.log(`#${r.id} replied`);
}

function cmdFail(args: string[]) {
  const r = requireRequest(args[0]);
  const reason = args.slice(1).join(' ').trim() || 'Could not apply this edit';
  appendMessage(r.id, { from: 'claude', kind: 'note', text: reason }, { status: 'failed', result: reason });
  writeAgentStatus({ state: 'listening', message: 'Waiting for your next edit', requestId: null });
  console.log(`#${r.id} failed: ${reason}`);
}

function cmdStatus(args: string[]) {
  const message = args.join(' ').trim();
  const working = listRequests().find((r) => r.status === 'working');
  writeAgentStatus({ state: 'working', message, requestId: working?.id ?? null });
}

function cmdList() {
  const requests = listRequests();
  if (requests.length === 0) return console.log('No requests yet.');
  for (const r of requests) console.log(`#${r.id}\t${r.status.padEnd(7)}\tf${r.frame}\t${r.prompt.slice(0, 70)}${r.result ? `  → ${r.result}` : ''}`);
}

function cmdVersions() {
  for (const v of listVersions()) console.log(`${v.short}  ${v.date.slice(0, 19).replace('T', ' ')}  ${v.subject}`);
}

// ---- Media ------------------------------------------------------------------------------

async function cmdIngest(args: string[]) {
  const { importFile, ensureMediaDirs } = await import('../server/media/library.ts');
  const { kindOf } = await import('../server/media/probe.ts');
  const { analyzeAsset } = await import('../server/media/analyze.ts');
  if (args.length === 0) fail('usage: ingest <file|dir>...');
  ensureMediaDirs();
  const files: string[] = [];
  for (const arg of args) {
    const path = resolve(arg);
    if (!existsSync(path)) fail(`not found: ${arg}`);
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) if (kindOf(name)) files.push(join(path, name));
    } else files.push(path);
  }
  for (const file of files) {
    const { asset, existing } = importFile(file);
    console.log(`${existing ? '=' : '+'} ${asset.id}  (${asset.kind}, ${basename(file)})${existing ? ' already in library' : ''}`);
    const done = await analyzeAsset(asset.id, { log: (m) => console.log(`  ${m}`) });
    if (!done) console.log(`  ${asset.id} is being analyzed by another process (the editor); check \`ev media\` shortly`);
  }
  console.log('');
  printMediaSummary();
}

async function cmdAnalyze(args: string[]) {
  const { analyzeAsset } = await import('../server/media/analyze.ts');
  const { getAsset } = await import('../server/media/library.ts');
  const id = args[0];
  if (!id || !getAsset(id)) fail(`unknown asset "${id ?? ''}". Try: npm run ev -- media`);
  const redoArg = args.find((a) => a.startsWith('--redo='));
  const redo = (redoArg?.split('=')[1]?.split(',').filter(Boolean) ?? []) as AnalysisStep[];
  const result = await analyzeAsset(id, { redo, log: (m) => console.log(m) });
  if (!result) fail(`${id} is being analyzed by another process; try again shortly`);
}

async function cmdOccupancy(args: string[]) {
  const { getAsset, mediaPath } = await import('../server/media/library.ts');
  const { FFMPEG } = await import('../server/media/ffmpeg.ts');
  const { execFileSync } = await import('node:child_process');
  const a = args[0] ? getAsset(args[0]) : null;
  if (!a || a.kind !== 'video') fail('usage: occupancy <video asset id>');
  ensureDirs();
  const font = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc'].find(existsSync);
  const stamp = font ? `,drawtext=fontfile='${font}':text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.7` : '';
  const seconds = Math.ceil(a.duration ?? 1);
  const cols = Math.min(13, seconds);
  const rows = Math.ceil(seconds / cols);
  const outs: string[] = [];
  // Top 25% (titles, counters) and bottom 45% (captions, lower thirds, CTAs), one tile per second.
  for (const [band, crop] of [['top', 'crop=iw:ih*0.25:0:0'], ['bottom', 'crop=iw:ih*0.45:0:ih*0.55']] as const) {
    const out = join(SNAPSHOTS_DIR, `occupancy-${a.id}-${band}.jpg`);
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', mediaPath(a.proxy ?? a.file), '-vf', `fps=1,${crop},scale=160:-2${stamp},tile=${cols}x${rows}:padding=3`, '-frames:v', '1', out]);
    outs.push(out);
  }
  outs.forEach((o) => console.log(rel(o)));
  console.log('Read both: anything already drawn in a band at a given second (titles, cards, captions) means new graphics there will collide.');
}

async function cmdRemove(args: string[]) {
  const { removeAsset } = await import('../server/media/library.ts');
  if (!args[0]) fail('usage: remove <id> [--force]');
  removeAsset(args[0], { force: args.includes('--force') });
  console.log(`removed ${args[0]}`);
}

async function cmdSfx(args: string[]) {
  const { SFX_KINDS, synthesize, toWav } = await import('../server/media/sfx.ts');
  const { importFile, ensureMediaDirs, RAW_DIR } = await import('../server/media/library.ts');
  const { analyzeAsset } = await import('../server/media/analyze.ts');
  const { writeFileSync } = await import('node:fs');
  const which = args[0];
  const kinds = Object.keys(SFX_KINDS) as (keyof typeof SFX_KINDS)[];
  if (!which || (which !== 'all' && !kinds.includes(which as never))) {
    console.log(`usage: sfx <kind|all> [--seed=N] [--seconds=S]\n${kinds.map((k) => `  ${k.padEnd(8)} ${SFX_KINDS[k].seconds}s  ${SFX_KINDS[k].use}`).join('\n')}`);
    process.exit(which ? 1 : 0);
  }
  const seed = Number(args.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 1);
  const secondsArg = args.find((a) => a.startsWith('--seconds='))?.split('=')[1];
  ensureMediaDirs();
  for (const kind of which === 'all' ? kinds : [which as keyof typeof SFX_KINDS]) {
    const seconds = secondsArg ? Number(secondsArg) : undefined;
    const tmp = join(RAW_DIR, `.incoming-sfx-${kind}-${process.pid}.wav`);
    writeFileSync(tmp, toWav(synthesize(kind, { seed, seconds })));
    const suffix = [seed !== 1 ? `s${seed}` : '', seconds ? `${seconds}s` : ''].filter(Boolean).join('-');
    const { asset, existing } = importFile(tmp, { name: `sfx-${kind}${suffix ? `-${suffix}` : ''}.wav`, move: true, origin: 'sfx' });
    if (!existing) await analyzeAsset(asset.id);
    console.log(`${asset.id}${existing ? ' (already in library)' : ''}   <Sfx id="${asset.id}" at={…} />`);
  }
}

async function cmdTts(args: string[]) {
  const { synthesizeSpeech } = await import('../server/media/tts.ts');
  const { analyzeAsset } = await import('../server/media/analyze.ts');
  const voice = args.find((a) => a.startsWith('--voice='))?.split('=')[1];
  const text = args.filter((a) => !a.startsWith('--')).join(' ');
  if (!text.trim()) fail('usage: tts "<text>" [--voice=aura-2-thalia-en]');
  const { asset, cached } = await synthesizeSpeech(text, voice);
  const done = cached ? asset : await analyzeAsset(asset.id, { log: (m) => console.log(`  ${m}`) });
  console.log(`${asset.id}${cached ? ' (cached, no API call)' : ''}  ${done?.facts.join(' · ') ?? ''}\n<Voiceover id="${asset.id}" at={…} />`);
}

async function cmdMedia(args: string[]) {
  if (args[0]) return printMediaDetail(args[0]);
  printMediaSummary();
}

function printMediaSummary() {
  const assets = listAssets();
  if (assets.length === 0) return console.log('No media yet. Add some with: npm run ev -- ingest <file|dir>');
  console.log(`${assets.length} asset${assets.length === 1 ? '' : 's'} (files under project/media/)`);
  for (const a of assets) {
    const pending = Object.entries(a.steps).filter(([, s]) => s.state === 'pending' || s.state === 'running').map(([k]) => k);
    const failed = Object.entries(a.steps).filter(([, s]) => s.state === 'failed').map(([k, s]) => `${k}: ${s.note}`);
    console.log(`- ${a.id}  ${a.kind}  ${a.facts.join(' · ')}`);
    if (pending.length) console.log(`    analyzing: ${pending.join(', ')}`);
    if (failed.length) console.log(`    failed: ${failed.join('; ')}`);
  }
  console.log(`\nDetails: npm run ev -- media <id>`);
}

function printMediaDetail(id: string) {
  const a = getAssetRecord(id);
  if (!a) fail(`unknown asset "${id}"`);
  const dir = join('project/media/analysis', a.id);
  const read = <T>(name: string): T | null => (existsSync(join(ROOT, dir, name)) ? (JSON.parse(readFileSync(join(ROOT, dir, name), 'utf8')) as T) : null);
  const t = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  console.log(`${a.id}  (${a.kind}, "${a.name}", ${(a.bytes / 1e6).toFixed(1)} MB)`);
  console.log(`facts:  ${a.facts.join(' · ') || '-'}`);
  for (const [step, s] of Object.entries(a.steps)) if (s.state !== 'done') console.log(`${step.padEnd(10)} ${s.state}${s.note ? `: ${s.note}` : ''}`);
  const usage = a.kind === 'video' ? `<Footage id="${a.id}" />` : a.kind === 'image' ? `<Picture id="${a.id}" />` : `<Music id="${a.id}" />`;
  console.log(`use:    ${usage}`);

  const shots = read<{ shots: { start: number; end: number }[] }>('shots.json');
  if (shots) console.log(`shots:  ${shots.shots.map((s, i) => `#${i + 1} ${t(s.start)}-${t(s.end)}`).join(', ')}`);
  if (a.sheet) console.log(`sheet:  ${join('project/media', a.sheet)}  (Read it to see the footage; tiles are labelled with their timestamps)`);
  const audio = read<{ loudness: number; activeRatio: number; silences: { start: number; end: number }[] }>('audio.json');
  if (audio) {
    const gaps = audio.silences.filter((s) => s.end - s.start >= 1).map((s) => `${t(s.start)}-${t(s.end)}`);
    console.log(`audio:  ${audio.loudness} LUFS, sound ${Math.round(audio.activeRatio * 100)}% of runtime${gaps.length ? `; silent gaps ≥1s: ${gaps.slice(0, 12).join(', ')}` : ''}`);
  }
  const beats = read<{ bpm: number; confidence: number; beats: number[]; downbeats: number[]; sections: { start: number; energy: string }[] }>('beats.json');
  if (beats) {
    console.log(`beats:  ${beats.bpm} BPM (confidence ${beats.confidence}), ${beats.beats.length} beats, first at ${beats.beats[0] ?? '-'}s`);
    console.log(`bars:   downbeats ${beats.downbeats.slice(0, 16).map((d) => d.toFixed(2)).join(', ')}${beats.downbeats.length > 16 ? ', …' : ''}  (full list: ${dir}/beats.json)`);
    console.log(`energy: ${beats.sections.map((s) => `${t(s.start)} ${s.energy}`).join(' → ')}`);
  }
  if (existsSync(join(ROOT, dir, 'transcript.txt'))) {
    const lines = readFileSync(join(ROOT, dir, 'transcript.txt'), 'utf8').trim().split('\n');
    console.log(`transcript (${dir}/transcript.txt, word timings in transcript.json):`);
    for (const line of lines.slice(0, 15)) console.log(`  ${line}`);
    if (lines.length > 15) console.log(`  … ${lines.length - 15} more lines`);
  }
}

// ---- Library ---------------------------------------------------------------------------

const TECHNIQUES_DIR = join(ROOT, 'library/techniques');

function frontmatter(md: string): Record<string, string> {
  const block = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  return Object.fromEntries(block.split('\n').map((l) => l.split(/:\s*/, 2) as [string, string]).filter(([k, v]) => k && v));
}

async function cmdLibrary() {
  const { catalog } = await import('../library/catalog.ts');
  const { listThemes, currentThemeName } = await import('../server/themes.ts');
  console.log(`COMPONENTS (import from '../../library' in scenes; each takes an id → Layer)`);
  for (const c of catalog) console.log(`- ${c.name}: ${c.summary}\n    ${c.usage}`);
  const current = currentThemeName();
  console.log(`\nTHEMES (npm run ev -- theme <slug>)`);
  for (const t of listThemes()) console.log(`- ${t.slug}${t.tokens.name === current ? ' (current)' : ''}: ${t.tokens.description}`);
  console.log(`\nTECHNIQUES (read the card before using a technique: library/techniques/<slug>.md)`);
  for (const f of readdirSync(TECHNIQUES_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()) {
    const fm = frontmatter(readFileSync(join(TECHNIQUES_DIR, f), 'utf8'));
    console.log(`- ${f.replace(/\.md$/, '')}: ${fm.summary ?? fm.title ?? ''}`);
  }
}

async function cmdDemo(args: string[]) {
  const { catalog } = await import('../library/catalog.ts');
  const { listThemes } = await import('../server/themes.ts');
  const { renderStills } = await import('./stills.ts');
  const { DEMO_FRAMES } = await import('../library/demo-frames.ts');
  const which = args[0];
  if (!which) fail('usage: demo <Name|all> [--theme=slug]');
  const theme = args.find((a) => a.startsWith('--theme='))?.split('=')[1] ?? null;
  if (theme && !listThemes().some((t) => t.slug === theme)) fail(`unknown theme "${theme}"`);
  const names = which === 'all' ? catalog.map((c) => c.name) : [which];
  for (const n of names) if (!catalog.some((c) => c.name === n)) fail(`unknown component "${n}"`);
  ensureDirs();
  const tag = theme ?? 'project';
  const outs = await renderStills(
    names.map((name) => ({ composition: `Demo-${name}`, frame: DEMO_FRAMES[name] ?? 60, output: join(SNAPSHOTS_DIR, `demo-${tag}-${name}.png`), props: { theme } })),
  );
  if (names.length === 1) return console.log(rel(outs[0]!));
  // One labelled sheet is far cheaper to look at than 13 separate images.
  const { makeSheet } = await import('./sheet.ts');
  const sheet = makeSheet(outs, names, join(SNAPSHOTS_DIR, `demo-sheet-${tag}.jpg`), { cols: 4, tileWidth: 640 });
  console.log(rel(sheet));
}

async function cmdTheme(args: string[]) {
  const { listThemes, applyTheme, currentThemeName } = await import('../server/themes.ts');
  if (!args[0]) {
    const current = currentThemeName();
    for (const t of listThemes()) console.log(`${t.tokens.name === current ? '*' : ' '} ${t.slug.padEnd(18)} ${t.tokens.description}`);
    return;
  }
  const commit = applyTheme(args[0]);
  console.log(commit ? `Applied ${args[0]} → version ${commit}` : `${args[0]} is already the project theme`);
}

async function cmdExport(args: string[]) {
  const { runExport } = await import('../server/exporter.ts');
  const preset = (args[0] ?? 'final') as ExportPreset;
  const job = await runExport(preset, (m) => console.log(m));
  const size = job.bytes ? `${(job.bytes / 1e6).toFixed(1)} MB` : '';
  console.log(`project/out/${job.file}  ${size}${job.loudness ? `  loudness ${job.loudness.before} → ${job.loudness.after} LUFS` : ''}`);
}

// ---- Projects --------------------------------------------------------------------------

/** Switches go through the editor's server when it runs, so its safety checks and restart apply. */
async function viaEditor(path: string, body: unknown): Promise<{ project: { name: string; slug: string } } | null> {
  try {
    const res = await fetch(`http://127.0.0.1:5173/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Easy-Video': '1' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as { project: { name: string; slug: string }; error?: string };
    if (!res.ok) fail(data.error ?? `editor refused (${res.status})`);
    return data;
  } catch (err) {
    if ((err as { cause?: { code?: string } }).cause?.code === 'ECONNREFUSED') return null; // editor not running
    throw err;
  }
}

async function cmdProject(args: string[]) {
  const projects = await import('../server/projects.ts');
  const [sub, ...rest] = args;
  if (!sub) {
    for (const p of projects.listProjects()) console.log(`${p.active ? '*' : ' '} ${p.slug.padEnd(28)} ${p.name}`);
    return;
  }
  if (sub === 'new') {
    const name = rest.join(' ').trim();
    if (!name) fail('usage: project new "<name>"');
    const remote = await viaEditor('/projects', { name });
    if (remote) return console.log(`Created and switched to "${remote.project.name}" (${remote.project.slug}); the editor reloads.`);
    const { info, dir } = projects.createProject(name);
    ensureRepo(dir);
    projects.switchProject(info.slug);
    return console.log(`Created and switched to "${info.name}" (${info.slug}).`);
  }
  if (sub === 'use') {
    const slug = rest[0];
    if (!slug) fail('usage: project use <slug>');
    const remote = await viaEditor('/projects/switch', { slug });
    const project = remote?.project ?? projects.switchProject(slug);
    return console.log(`Switched to "${project.name}"${remote ? '; the editor reloads' : ''}.`);
  }
  fail(`unknown: project ${sub}`);
}

// ---- Intake ----------------------------------------------------------------------------

async function cmdIntake() {
  const { readIntake, validateIntake } = await import('../server/intake.ts');
  const intake = readIntake();
  const { width, height, fps } = intake.format;
  console.log(`format: ${width}x${height} @ ${fps}fps${intake.chosen ? `   chosen: ${intake.chosen}` : ''}`);
  if (intake.brief) {
    console.log('BRIEF');
    for (const [k, v] of Object.entries(intake.brief)) console.log(`  ${k.padEnd(10)} ${Array.isArray(v) ? v.join('; ') : v}`);
  } else console.log('BRIEF: not written yet');
  for (const t of intake.treatments) {
    const secs = t.outline.reduce((s, o) => s + o.seconds, 0);
    console.log(`\n${t.id}. ${t.title}  [theme ${t.theme}; ${t.techniques.join(', ')}]\n   ${t.pitch}\n   ${t.outline.length} scenes, ${secs}s · music: ${t.music}`);
  }
  const errors = validateIntake(intake);
  console.log(errors.length ? `\nPROBLEMS:\n${errors.map((e) => `  - ${e}`).join('\n')}` : `\nvalid ✓`);
  if (errors.length) process.exitCode = 1;
}

async function cmdTreatments(args: string[]) {
  const { readIntake, validateIntake } = await import('../server/intake.ts');
  const { renderStills } = await import('./stills.ts');
  const { makeSheet } = await import('./sheet.ts');
  const intake = readIntake();
  const errors = validateIntake(intake);
  if (errors.length) fail(`fix the intake first:\n  - ${errors.join('\n  - ')}`);
  if (!intake.treatments.length) fail('no treatments yet');
  ensureDirs();
  // Default: three moments per motion test, so pacing and the "landed" look are both visible.
  const fractions = args.length ? null : [0.25, 0.55, 0.9];
  const jobs = intake.treatments.flatMap((t) => {
    const frames = fractions ? fractions.map((f) => Math.floor(t.durationInFrames * f)) : args.map(Number);
    return frames.map((frame) => ({ composition: `Treatment-${t.id}`, frame, output: join(SNAPSHOTS_DIR, `treatment-${t.id}-${frame}.png`), props: { proxy: true }, label: `${t.id} · ${t.title} · f${frame}` }));
  });
  const outs = await renderStills(jobs);
  const perRow = jobs.length / intake.treatments.length;
  const vertical = intake.format.height > intake.format.width;
  const sheet = makeSheet(outs, jobs.map((j) => j.label), join(SNAPSHOTS_DIR, 'treatments-sheet.jpg'), { cols: perRow, tileWidth: vertical ? 360 : 640 });
  console.log(rel(sheet));
}

const [command, ...args] = process.argv.slice(2);
const commands: Record<string, (args: string[]) => unknown> = {
  wait: cmdWait,
  show: (a) => console.log(briefing(requireRequest(a[0]))),
  snap: cmdSnap,
  check: cmdCheck,
  still: cmdStill,
  status: cmdStatus,
  done: cmdDone,
  fail: cmdFail,
  ask: cmdAsk,
  reply: cmdReply,
  save: cmdSave,
  list: cmdList,
  versions: cmdVersions,
  ingest: cmdIngest,
  media: cmdMedia,
  analyze: cmdAnalyze,
  sfx: cmdSfx,
  remove: cmdRemove,
  occupancy: cmdOccupancy,
  tts: cmdTts,
  library: cmdLibrary,
  demo: cmdDemo,
  theme: cmdTheme,
  export: cmdExport,
  project: cmdProject,
  intake: cmdIntake,
  treatments: cmdTreatments,
};

const run = command ? commands[command] : undefined;
if (!run) {
  console.log(HELP);
  process.exit(command ? 1 : 0);
}
await run(args);
