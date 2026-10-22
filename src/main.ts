import { App } from './ui/app';
import { TitleScreen } from './ui/title';
import { BattleScreen } from './ui/battleScreen';
import { MapScreen } from './ui/map';

const root = document.getElementById('app')!;
const app = new App(root);

// Deep links for testing: index.html#stage=syr-2 or #map
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('stage')) app.show(new BattleScreen(app, hash.get('stage')!));
else if (hash.has('map')) app.show(new MapScreen(app));
else app.show(new TitleScreen(app));

// Debug hook for automated screenshots, only in dev builds (npm run dev). The build sets
// __DEV__ to a constant, so in the published dist/index.html this block is removed entirely.
declare const __DEV__: boolean;
if (__DEV__) (window as unknown as { __md: unknown }).__md = { app };
