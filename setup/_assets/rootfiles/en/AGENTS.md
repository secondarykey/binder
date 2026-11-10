# AGENTS.md

This directory is a binder of [Binder](https://github.com/secondarykey/binder), a Markdown editor.
These are the rules for AI agents that edit it.

## Before editing

- **Do not edit while Binder has this binder open.**
  If Binder and another tool write at the same time, `.git/index` and `db/*.csv` get corrupted.
  While Binder has the binder open, it holds a lock on `.git/binder-open.lock`.
  If you cannot open that file exclusively, Binder has it open (if the file exists but you can open it, Binder is closed).
- If there are unrecorded changes, ask the user to record them in Binder first.

## Layout

| Path | Contents |
|---|---|
| `notes/{id}.md` | Note bodies |
| `diagrams/{id}.md` | Diagrams (Mermaid) |
| `db/*.csv` | Lists and metadata. `structures.csv` is the tree (`parent_id` and `seq`) |
| `templates/` | Templates for the published pages |
| `docs/` | Generated HTML for publishing. Do not edit by hand |

## Write order

When you create something, always write in this order:

1. The entity file (`notes/{id}.md`, etc.)
2. The entity table row (`db/notes.csv`, etc.)
3. The `db/structures.csv` row

If you stop halfway, Binder can repair it the next time it opens the binder.
In the reverse order, Binder finds a row without its file and creates an empty one, and the content is lost.

- `id` is a UUID v7
- The CSV columns are defined by the header row and differ between versions. Always read the header row before writing
- In `name` / `detail`, replace `,` `"` space and newline with `&#44;` `&#34;` `&#32;` `&#10;`
- Delete only when asked to

## When you are done

- Record (commit) the changes with git. Changes to `db/*.csv` do not appear in Binder's list of unrecorded changes, so the user cannot see them unless they are recorded.
- If Binder repairs an inconsistency the next time it opens the binder, it shows what it fixed.

For reorganising notes (merging, splitting, restructuring the tree, inserting diagrams), the
[binder-organize](https://github.com/secondarykey/binder/tree/main/_docs/skills/binder-organize) skill has the procedure and validation scripts.
