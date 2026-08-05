# Oh My Theme

**Oh My Theme** is an npm CLI and local visual browser for [Oh My Posh](https://ohmyposh.dev/) themes.

It keeps downloaded themes in a directory you choose, lets you inspect them in a browser, and can apply a selected theme to your shell profile. The browser binds only to `127.0.0.1`.

## Install

```bash
npm install --global oh-my-theme
```

The short alias `omt` is installed alongside `oh-my-theme`.

> Requires Node.js 20.9 or newer and [Oh My Posh](https://ohmyposh.dev/docs/installation) on your `PATH` to render previews or apply themes.

## First-time setup

```bash
oh-my-theme init
# or
omt init
```

The interactive setup asks for:

- **Theme directory** — defaults to `~/.oh-my-theme/themes`
- **Shell** — PowerShell, zsh, bash, or fish
- **Shell profile path** — used when applying a theme
- Whether to add an Oh My Posh initialization line to that profile

Configuration is saved at `~/.oh-my-theme/config.json`. Re-run `init` at any time to change it.

## Commands

### Start the visual browser

```bash
oh-my-theme ui
omt ui
```

This starts the local browser at `http://127.0.0.1:4310` and opens it automatically. Use a custom port or prevent automatic browser launch when needed:

```bash
oh-my-theme ui --port 4311 --no-open
```

In the browser:

- All copy is in English.
- Select a theme to open its preview.
- Use **Left** and **Right** arrow keys, or the visible controls, to move through the current filtered results.
- Use **Install theme** directly in a preview to copy a built-in theme into your configured directory, then **Apply theme** to make it active.
- Use **Download Themes** to install additional official themes from GitHub.
- Applying a theme creates a timestamped backup of the shell profile before changing it; open a new terminal or reload the profile afterward.

### List installed and built-in themes

```bash
oh-my-theme ls
omt ls
```

Use `--json` for machine-readable output:

```bash
oh-my-theme ls --json
```

### Install an official theme

```bash
oh-my-theme install jandedobbeleer
```

This downloads the theme into the configured theme directory. To install and apply it in one step:

```bash
oh-my-theme install jandedobbeleer --apply
```

### Apply an installed theme

```bash
oh-my-theme apply jandedobbeleer
```

Applying a theme updates the configured shell profile and creates a timestamped backup beside that profile.

### Choose interactively

```bash
oh-my-theme select
```

Use `--no-apply` to select without changing the shell profile.

### Inspect configuration

```bash
oh-my-theme config
```

## Development

```bash
npm install
npm run dev       # Next.js development server
npm run cli -- --help
npm run lint
npm run build
```

To run the same checks enforced by CI and the publishing workflow:

```bash
npm run verify
```

## Releases

Publishing is automated by [`.github/workflows/publish-npm.yml`](.github/workflows/publish-npm.yml). It runs the release checks, confirms that a pushed `v*` tag matches the version in `package.json`, and publishes with npm provenance.

### One-time repository setup

1. In npm, configure **Trusted Publisher** for this package using **GitHub Actions** and enter this repository's owner/name, the `npm` environment, and `.github/workflows/publish-npm.yml` as the workflow file. Trusted publishing supplies the short-lived npm credential; do not add an `NPM_TOKEN` repository secret.
2. In the GitHub repository, create an environment named `npm`. Optionally require reviewers or limit deployment tags in that environment to protect releases.
3. Ensure GitHub Actions is allowed to use its default `GITHUB_TOKEN` permissions. The workflow explicitly requests `contents: read` and `id-token: write`, which npm Trusted Publishing requires.

### Publish a version

1. Update the version in `package.json` (for example, with `npm version <major|minor|patch>`).
2. Run `npm run verify` locally.
3. Commit the version change and push a matching tag such as `v0.1.1`:

   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```

The tag must exactly match `v` plus the package version. The workflow can also be started manually from GitHub Actions for a controlled re-run; confirm the version has not already been published before doing so.

## Terminology

- **Install** downloads a theme into your configured themes directory.
- **Apply** updates your shell profile to use an already-installed theme.

Keeping these operations separate makes profile-changing behavior explicit.
