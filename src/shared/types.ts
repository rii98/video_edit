// Contracts shared by the UI, the dev-server bridge and the `ev` CLI.
// Coordinates are normalized to the composition (0..1), so they survive any preview size.

export interface Point {
  x: number;
  y: number;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How far an edit should reach: around the pinned moment, its scene, a timeline range, or everything. */
export type Scope = 'frame' | 'scene' | 'range' | 'video';

/** Inclusive global frame range. */
export interface FrameRange {
  start: number;
  end: number;
}

/** `needs-input`: Claude asked a question in the thread and is waiting for the user. */
export type RequestStatus = 'pending' | 'working' | 'needs-input' | 'done' | 'failed';

/** One message in a request's thread (the request's prompt is the implicit first message). */
export interface ThreadMessage {
  from: 'user' | 'claude' | 'system';
  /** question: Claude asks · reply: an answer or follow-up · done: an edit was made · note: no edit (explanations, failures, undo) */
  kind: 'question' | 'reply' | 'done' | 'note';
  text: string;
  at: string;
  /** Quick-pick answers for a question. */
  choices?: string[];
  /** Alternatives rendered as stills (file names in .ev/snapshots), each with a label. */
  images?: { label: string; file: string }[];
  /** The version an edit produced (kind 'done'), for undo. */
  commit?: string;
  /** What Claude had to assume to make the edit, if anything. Shown prominently. */
  assumed?: string;
  /** Set once this edit has been undone. */
  undone?: boolean;
}

export interface EditRequest {
  id: number;
  createdAt: string;
  updatedAt: string;
  status: RequestStatus;
  prompt: string;
  scope: Scope;
  /** Global frame the user was looking at. */
  frame: number;
  sceneId: string | null;
  pin: Point | null;
  region: Region | null;
  /** Layer ids under the pin/region, most specific first. */
  layers: string[];
  /** Set when scope is 'range' (Shift+drag on the timeline). */
  range?: FrameRange | null;
  /** Claude's summary on done, or the reason on failure. */
  result?: string;
  commit?: string;
  /** Conversation about this request: questions, answers, follow-up tweaks, explanations. */
  thread?: ThreadMessage[];
  /** When it last entered the queue (creation or a user reply). Claude works oldest first. */
  queuedAt?: string;
}

export type NewEditRequest = Pick<
  EditRequest,
  'prompt' | 'scope' | 'frame' | 'sceneId' | 'pin' | 'region' | 'layers'
> & { range?: FrameRange | null };

export type AgentState = 'offline' | 'listening' | 'working';

export interface AgentStatus {
  state: AgentState;
  message: string;
  requestId: number | null;
  heartbeat: string;
}

export interface Version {
  sha: string;
  short: string;
  date: string;
  subject: string;
}

export interface ProjectInfo {
  slug: string;
  name: string;
  createdAt: string;
}

export interface ServerState {
  project: ProjectInfo;
  projects: (ProjectInfo & { active: boolean })[];
  requests: EditRequest[];
  agent: AgentStatus;
  versions: Version[];
  media: MediaAsset[];
  exports: ExportJob[];
}

// ---- Media ----------------------------------------------------------------------------

export type MediaKind = 'video' | 'image' | 'audio';
export type StepState = 'pending' | 'running' | 'done' | 'skipped' | 'failed';
export type AnalysisStep = 'probe' | 'proxy' | 'poster' | 'shots' | 'sheet' | 'audio' | 'beats' | 'transcript';

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  /** Original file name, for display. */
  name: string;
  /** Paths below are relative to project/media (the static root). */
  file: string;
  proxy?: string;
  poster?: string;
  sheet?: string;
  bytes: number;
  addedAt: string;
  updatedAt: string;
  width?: number;
  height?: number;
  fps?: number;
  /** Seconds. */
  duration?: number;
  hasAudio: boolean;
  steps: Partial<Record<AnalysisStep, { state: StepState; note?: string }>>;
  /** Short facts shown in the UI and to Claude, e.g. "7 shots", "122 BPM". */
  facts: string[];
  /** How the asset was made; generated audio skips analysis that doesn't apply to it. */
  origin?: 'upload' | 'sfx' | 'tts';
}

/** project/media.json: what scenes need to resolve an asset id to a file. */
export interface MediaManifest {
  assets: Record<string, Pick<MediaAsset, 'kind' | 'file' | 'proxy' | 'width' | 'height' | 'fps' | 'duration' | 'hasAudio'>>;
}

export type TransitionType = 'fade' | 'slide' | 'wipe';

export interface SceneEntry {
  id: string;
  name: string;
  durationInFrames: number;
  /** Transition from this scene into the next one. Overlaps both scenes. */
  transition?: { type: TransitionType; durationInFrames: number };
}

export interface Timeline {
  fps: number;
  width: number;
  height: number;
  scenes: SceneEntry[];
}

/** Props of the Main composition. Pin/region are only set when rendering annotated snapshots. */
// A type alias (not an interface) so it satisfies Remotion's Record<string, unknown> props bound.
export type MainProps = {
  pin: Point | null;
  region: Region | null;
  /** Use lightweight proxies (preview and snapshots). Final renders use originals. */
  proxy: boolean;
};

// ---- Themes ---------------------------------------------------------------------------

/** project/theme/tokens.json and library/themes/*.json. Font names refer to src/video/fonts.ts. */
export interface ThemeTokens {
  name: string;
  description: string;
  colors: { bg: string; surface: string; text: string; muted: string; accent: string; accent2: string };
  fonts: { display: string; body: string; mono: string };
  type: { displayWeight: number; displayTracking: string; uppercaseDisplay: boolean };
  /** Cubic-bezier control points. */
  easing: { standard: number[]; emphasized: number[] };
  /** Multiplies all animation durations: >1 calmer, <1 snappier. */
  tempo: number;
  /** Frames between staggered items (words, list items). */
  stagger: number;
  radius: number;
}

// ---- Intake (creative brief → treatments) ------------------------------------------------

/** project/intake/intake.json. Written by Claude during intake, read by the editor and Remotion. */
export interface Intake {
  brief: Brief | null;
  /** Canvas for the motion tests (and the video to be built). */
  format: { width: number; height: number; fps: number };
  treatments: Treatment[];
  /** Set when the user picks a direction in the editor. */
  chosen: string | null;
}

export interface Brief {
  goal: string;
  platform: string;
  audience: string;
  message: string;
  feel: string;
  pacing: string;
  length: string;
  music: string;
  mustHaves: string[];
}

export interface Treatment {
  /** "A", "B", "C": also the component key in project/intake/index.ts. */
  id: string;
  title: string;
  /** Two or three sentences: the idea and why it fits this brief. */
  pitch: string;
  /** Theme preset slug (library/themes). */
  theme: string;
  /** Technique card slugs (library/techniques). */
  techniques: string[];
  outline: { scene: string; seconds: number; beat: string }[];
  music: string;
  /** Length of the motion test, in frames. */
  durationInFrames: number;
}

// ---- Export ---------------------------------------------------------------------------

export type ExportPreset = 'final' | 'draft';

export interface ExportJob {
  id: string;
  preset: ExportPreset;
  status: 'rendering' | 'finishing' | 'done' | 'failed';
  /** 0..1 */
  progress: number;
  /** File name in project/out once done. */
  file: string | null;
  bytes?: number;
  /** Integrated loudness (LUFS) before and after normalization. */
  loudness?: { before: number; after: number };
  error?: string;
  startedAt: string;
  finishedAt?: string;
}
