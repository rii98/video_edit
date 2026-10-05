// Used by `npm run render` (Remotion CLI). Media lives outside the default public/ folder.
import { Config } from '@remotion/cli/config';

Config.setPublicDir('project/media');
// WebGL (Three.js scenes) needs ANGLE when rendering headless.
Config.setChromiumOpenGlRenderer('angle');
