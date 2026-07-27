# binder

[!CAUTION]
There is still only an experimental implementation
binder is markdown editor.

# Why?

I wanted to write technical texts in text format, so I wanted to create an editor that could be used exclusively for it.

# use

- wails(template react)
- go-git

- marked
- mermaid

# Install

## macOS

Releases built without an Apple Developer ID certificate are ad-hoc signed only.
Because macOS attaches the `com.apple.quarantine` attribute to downloaded files,
Gatekeeper refuses to launch them with:

> "binder" is damaged and can't be opened. You should move it to the Trash.

The app is not actually damaged. Remove the quarantine attribute after moving it
to `/Applications`:

```bash
xattr -dr com.apple.quarantine /Applications/binder.app
```

Do the same for Binder Lite if you use it:

```bash
xattr -dr com.apple.quarantine /Applications/binder-lite.app
```

This step is unnecessary for releases that are signed with a Developer ID
certificate and notarized by Apple.


