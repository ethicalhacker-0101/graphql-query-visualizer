# GraphQL Query Visualizer

A lightweight, static frontend tool for understanding GraphQL queries with:

- syntax-highlighted query display,
- simple structure visualization,
- query metadata (operation type, name, field count, depth),
- field-by-field analysis.

## Run locally

No build step is required.

### Option 1: Open directly
Open `index.html` in your browser.

### Option 2: Serve over a local static server (recommended)
From the repository root, run one of:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Project structure

- `index.html` — App layout and UI sections.
- `script.js` — App behavior, query analysis, rendering.
- `styles.css` — Visual styling.

## Current parser limitations

The current analyzer is intentionally simple and uses regular expressions and line-by-line parsing. It is best for beginner-friendly or straightforward GraphQL queries.

Known limitations include:

- partial/incorrect handling of fragments,
- aliases may not be represented accurately,
- directives are not fully modeled,
- multiline or deeply nested argument objects are not robustly parsed,
- tree output is indentation-based, not a full AST tree.

## Suggested roadmap

1. Replace regex parsing with GraphQL AST parsing.
2. Add automated tests for query analysis behavior.
3. Improve error presentation (inline UI errors vs. browser alerts).
4. Evolve indentation tree into a nested structural tree.

## Contributing notes

- Keep the app static and dependency-light unless a change requires otherwise.
- Prefer readable JavaScript over clever parsing shortcuts.
- Run formatting before commit.
