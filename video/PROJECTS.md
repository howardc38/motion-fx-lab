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

`examples/films.json` (version 2, structure in [`tools/films-schema.json`](../tools/films-schema.json)) is the only
place a published film is described. Nothing in `media/` is published unless an entry lists it, and no film card,
list, table or count is written by hand.

Each entry gives:

- `layer`: `intro`, `use-case` (a familiar format to adapt), `demo` (several effects in a finished piece),
  `comparison` (one input, different treatments) or `effect-film` (a full render of one effect).
- `tier`: `hero` (the intro at the top of the page), `featured` (a card in the use-case or demo section), `listed`
  (the film list only) or `in-card` (effect films, played inside their effect cards).
- `title`, a one-line `summary`, `duration` (the page's `__DUR`), `format`, the editable `page`, `media`
  (`mp4`, `poster`; `preview`, the silent card loop, for every film with a card and the intro; `gif` only for the intro,
  the README hero), `card` copy (`headline`, `description`, `useFor`,
  `relation`, optional `guide`), `audience` and the build `groups`.
- Optional `fps` (24, 25, 30, 50 or 60; omitted means 30). The registered build passes it to the recorder.
  A page can declare `window.__FPS`; the media check compares the page, manifest and delivered file.
  For a direct `bash video/build.sh` call, set `RECORD_ARGS="--fps 60"` explicitly when required.
- `effects`: the catalogue ids the film's source actually runs, each with an optional `at: [start, end]` in seconds.
  A sampler gives every effect its segment, so each effect card can play its own part. Ids that only inspired the
  film go in `related`. The check needs evidence for each listed effect: either the page names it (`data-fx`,
  `data-demo` or the quoted id), or `proof: [file, text]` points to literal text in a file the page loads.
- Planned changes, while they are pending: `mergeInto` (another film id), `retire` (reason) or `becomes`
  (`{layer, headline}`), with an optional `plan` note.
- The top-level `layers` list sets the order, headings and singular names used by the generated list and counts.

```sh
node tools/films.cjs build <id|group>   # render one film or a group through video/build.sh
npm run sync:films                      # regenerate every films marker block and fx/films-data.js
node tools/films.cjs --check            # validate, and fail if any generated block is stale
node tools/films.cjs --verify           # print where each film's source runs each listed effect
npm run check:public                    # fail if a private or unregistered file would be committed
```

The generated blocks are `films:hero`, `films:uses`, `films:demos`, `films:summary`, `films:count` and `films` in
`index.html`, `films` in `README.md` and `films:guide` in `fx/VIEWING-GUIDE.md`. `fx/films-data.js` defines
`window.FXFilms` (id, layer, tier, title, duration, format, media and effects) for the gallery's effect → film
links. Counts name films only; no generated text states an exact number of effects.

To add a film: put the page under `examples/`, add its entry, build it, run `sync:films`, then both checks.
The build allows only its selected films' media to be missing, so it can create a new bundle; missing
source pages, guides, unselected bundles and unexpected media still fail. Publication checks require every bundle.

**Moving from version 1.** `node tools/films.cjs --migrate` reads a version 1 `examples/films.json` and writes
`examples/films.next.json`. It keeps every v1 value (`source` becomes `page`, `description` becomes `summary`, and
`kind`/`section` become `layer`/`tier`), keeps the v2-only fields already in `films.next.json`, and lists each v1
value with where it went. A v1 effect that the v2 entry no longer runs moves to `related` with its label. While
`films.json` is still version 1, the other commands read `films.next.json` and fail if it is stale or loses a v1
value. Replacing `films.json` with `films.next.json` completes the move.
