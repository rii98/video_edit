// Demo components wrapped with a scene id and an optional theme override. Used by Remotion
// (Root: `Demo-<Name>` compositions) and by the editor's Library view (live previews).
import type { ComponentType } from 'react';
import { SceneProvider, ThemeProvider } from '../src/video/kit';
import { demos } from './demos';
import { themes } from './themes';

export type DemoProps = { theme: string | null };

function wrap(name: string): ComponentType<DemoProps> {
  const Demo = demos[name]!.component;
  return function DemoWithTheme({ theme }: DemoProps) {
    const body = (
      <SceneProvider id="DEMO">
        <Demo />
      </SceneProvider>
    );
    const tokens = theme ? themes[theme] : undefined;
    return tokens ? <ThemeProvider tokens={tokens}>{body}</ThemeProvider> : body;
  };
}

export const demoComponents: Record<string, ComponentType<DemoProps>> = Object.fromEntries(Object.keys(demos).map((name) => [name, wrap(name)]));
