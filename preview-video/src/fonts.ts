// Bebas Neue (display, broadcast-condensed) + Inter (UI), the faces the
// landing page already ships. @remotion/google-fonts wires delayRender() so
// frames never render before the faces are ready.
//
// Bebas Neue is a single-weight family (400). The brief asks for 700/900 in
// places; Chrome's headless renderer faux-bolds the single weight, which is
// the heaviest Bebas can render and matches the broadcast intent.
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

export const bebas = loadBebas('normal', {
  weights: ['400'],
  subsets: ['latin'],
}).fontFamily;

export const inter = loadInter('normal', {
  weights: ['400', '500', '700'],
  subsets: ['latin'],
}).fontFamily;
