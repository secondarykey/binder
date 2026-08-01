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

# Requirements

## Build

Common to every platform:

- Go 1.25+
- Node.js + npm
- Wails v3 CLI — `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`
- Task — `go install github.com/go-task/task/v3/cmd/task@latest`

Wails v3 builds through cgo against the native webview of each OS, so a
platform toolchain and its development headers are also required.
`wails3 doctor` reports what is missing on your machine.

### Linux

Wails v3 uses the GTK4 + WebKitGTK 6.0 stack. On Debian / Ubuntu (the
combination the CI builds with):

```bash
sudo apt-get install -y \
  build-essential pkg-config \
  libgtk-4-dev \
  libwebkitgtk-6.0-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

`libwebkitgtk-6.0-dev` is packaged from Ubuntu 24.04 / Debian 13 onward.
On other distributions install the equivalent GTK 4 and WebKitGTK 6.0
development packages (`gtk4-devel` / `webkitgtk6.0-devel` on Fedora,
`gtk4` / `webkitgtk-6.0` on Arch).

### macOS

- macOS 12.0 or later
- Xcode Command Line Tools — `xcode-select --install`

Signing and notarizing a release additionally needs `xcrun notarytool`,
which ships with Xcode / the Command Line Tools.

### Windows

- The WebView2 runtime, preinstalled on Windows 11 and installable on
  Windows 10 from Microsoft's Evergreen distribution

# Install

The release archives contain the built binaries only — no installer and no
package metadata — so shared libraries are never pulled in automatically.
Install the runtime dependencies of your platform yourself.

## Linux

```bash
# Debian / Ubuntu
sudo apt-get install -y libgtk-4-1 libwebkitgtk-6.0-4
```

The equivalents are `gtk4` / `webkitgtk6.0` on Fedora and RHEL family
distributions, and `gtk4` / `webkitgtk-6.0` on Arch.

## macOS

Binder requires macOS 12.0 or later.

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

## Windows

Binder runs on Windows 10 / 11 and needs the WebView2 runtime, which is
preinstalled on Windows 11.

