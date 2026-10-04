import { useCallback, useEffect, useState } from 'react';
import type { EditRequest, ExportPreset, NewEditRequest, ProjectInfo, ServerState } from '../shared/types.ts';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    // The custom header is what the bridge uses to reject cross-site writes.
    headers: { 'Content-Type': 'application/json', 'X-Easy-Video': '1' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export const api = {
  submit: (request: NewEditRequest) => post<EditRequest>('/requests', request),
  cancel: (id: number) => post<EditRequest>(`/requests/${id}/cancel`, {}),
  reply: (id: number, text: string) => post<EditRequest>(`/requests/${id}/reply`, { text }),
  undo: (id: number) => post<EditRequest>(`/requests/${id}/undo`, {}),
  restore: (sha: string) => post<{ commit: string | null }>('/versions/restore', { sha }),
  applyTheme: (slug: string) => post<{ commit: string | null }>('/theme', { slug }),
  chooseTreatment: (id: string, notes: string) => post<EditRequest>('/intake/choose', { id, notes }),
  removeMedia: (id: string) => post<{ removed: boolean }>(`/media/${id}/remove`, {}),
  createProject: (name: string) => post<{ project: ProjectInfo }>('/projects', { name }),
  switchProject: (slug: string) => post<{ project: ProjectInfo }>('/projects/switch', { slug }),
  compare: (sha: string, frame: number) => post<{ current: string; version: string }>('/compare', { sha, frame }),
  exportVideo: (preset: ExportPreset) => post<{ started: boolean }>('/export', { preset }),
  deleteExport: (id: string) => post<{ deleted: boolean }>(`/exports/${id}/delete`, {}),
};

/** Live server state over SSE. EventSource reconnects on its own if the dev server restarts. */
export function useServerState(): { state: ServerState | null; connected: boolean } {
  const [state, setState] = useState<ServerState | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const source = new EventSource('/api/events');
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (e) => setState(JSON.parse(e.data as string) as ServerState);
    return () => source.close();
  }, []);
  return { state, connected };
}

export interface Upload {
  key: string;
  name: string;
  progress: number;
  error?: string;
}

/** XHR rather than fetch: fetch has no upload progress events. Streams the File as-is. */
function uploadFile(file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/media/upload?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader('X-Easy-Video', '1');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      try {
        reject(new Error((JSON.parse(xhr.responseText) as { error?: string }).error ?? `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed: is the dev server running?'));
    xhr.send(file);
  });
}

/** Uploads one file at a time; finished uploads disappear (the asset shows up via SSE). */
export function useUploads(): { uploads: Upload[]; upload: (files: File[]) => void } {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const upload = useCallback((files: File[]) => {
    const batch = files.map((file) => ({ file, key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}` }));
    setUploads((u) => [...u, ...batch.map(({ file, key }) => ({ key, name: file.name, progress: 0 }))]);
    void (async () => {
      for (const { file, key } of batch) {
        const patch = (p: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...p } : x)));
        try {
          await uploadFile(file, (progress) => patch({ progress }));
          setUploads((u) => u.filter((x) => x.key !== key));
        } catch (err) {
          patch({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    })();
  }, []);
  return { uploads, upload };
}
