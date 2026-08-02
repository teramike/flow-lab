# Flow Lab

Generative backgrounds, made in your browser. Eleven scenes, a palette system that
mixes perceptually so blends stay vivid instead of going grey, procedural textures,
and export to PNG, seamless looping video, or an embeddable snippet.

**One HTML file. No install, no build step, no network.** Download it, open it,
it works. Offline, forever.

[Try it](https://teramike.com/flow-lab/)

## Using it

Open `flow-lab.html`. That is the whole thing.

Press `R` to shuffle, `1` to `0` to jump between scenes, `P` to shuffle the palette,
`S` to save a look. Hold space and move the mouse on the canvas to stir the paint.

Exports are phase locked, so video loops seamlessly at any duration.

## Working on it

The single file is built from modular sources, which are easier to edit:

```
index.html       markup and panel scaffolding
css/style.css    the whole stylesheet
js/shader.js     GLSL, all eleven scenes and the texture layer
js/state.js      palettes, scene defaults, the state shape
js/render.js     canvas and SVG overlay rendering
js/panels.js     the control panel
js/exports.js    PNG, video, embed snippet
js/main.js       wiring, keyboard, saved looks
```

Run `python3 -m http.server 8531` and open `index.html` to develop against the
modules, then:

```bash
python3 build.py                       # writes flow-lab.html
python3 build.py --out /some/dir       # also copies it as index.html
```

The build inlines Three.js, the mp4 muxer, the stylesheet, all six modules, and
the webfonts as base64. Fonts are latin only with no italics, which keeps the
bundle near 1.1 MB rather than 3 MB.

## Colour

Blending in sRGB pulls every overlap toward grey, because opposing components
cancel. Flow Lab accumulates in OKLab and restores the weighted mean chroma when
resolving, so an overlap stays as saturated as the colours that made it. That one
change is most of the difference between muddy and vivid.

## Licence

MIT. Yours to use, sell, take apart. No attribution required.

Made by Miguel, [@teramike_](https://x.com/teramike_).
