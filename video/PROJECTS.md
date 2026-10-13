# Rendering projects and the public film list

## A project outside this repository

Films can live in their own folder and still use this library's engine, effects and recorder.

```sh
FX_PROJECT_ROOT=/path/to/project FX_OUTPUT_DIR=/path/to/project/out FX_FILM_NAME=my-film \
  bash video/build.sh /path/to/project/film.html
```

- The page may import `/video/engine.js`, `/fx/...` and `/assets/...`. The project's own file wins; otherwise the
  library's copy is served. Everything in this repository is also reachable under `/_fxlab/`.
- Outputs must be outside this repository: `build.sh` and `record.cjs` refuse an external project's output path
  inside it. Debug frames from a failed render go to `<project>/.render/`.
- The server binds to 127.0.0.1, refuses hidden paths and `node_modules`, and refuses files whose real path leaves
  the project or the library, so a symlink cannot widen what it serves.
- Sound: `window.__audio = { src, sha256 }` uses that mixed file as the whole soundtrack (relative to the page, or
  `/...` from the project root); nothing is synthesised. Without it the page must declare `window.__music`, and
  every scene after the first adds a whoosh cue.
- Delivered MP4s carry no edit list. `deliver.py` therefore delays the AAC track to meet the first frame and fails a
  file whose sound leads or trails the picture by more than 5 ms against the mix.

## The public film list

`examples/films.json` owns the published films: each entry names its `source` page, its three `media` files
(MP4, GIF, poster), a `section` and the build `groups` it belongs to. Nothing in `media/` is published unless an
entry lists it.

```sh
node tools/films.cjs build <id|group>   # render one film or a group through video/build.sh
npm run sync:films                      # regenerate the film tables between the films markers in README and index
node tools/films.cjs --check            # fail if those tables are stale or media/ differs from the manifest
npm run check:public                    # fail if a private or unregistered file would be committed
```

To add a film: put the page under `examples/`, add its entry, build it, run `sync:films`, then both checks.
