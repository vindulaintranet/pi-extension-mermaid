# Releasing

This package is released as a Git tag that Pi can install directly.

## Before you tag

1. Make sure `README.md` reflects the current behavior.
2. Make sure `CHANGELOG.md` has the final notes for the release.
3. Confirm `package.json` version matches the intended tag version.
4. Run the full validation suite:

```bash
npm install
npm run validate
```

## Standard release flow

For `v0.1.0`:

```bash
git status
npm run validate
git add .
git commit -m "chore: prepare v0.1.0 release"
git tag -a v0.1.0 -m "v0.1.0"
git push origin main --follow-tags
```

## If the commit is already ready

If the repository is already in the desired release state, you can skip the extra release-prep commit and just tag the current commit:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin main --follow-tags
```

## What the tag triggers

The GitHub Actions release workflow will:
- install dependencies with `npm ci`
- run `npm run validate`
- create the package tarball
- create a GitHub Release for the tag
- attach the generated `.tgz`

## Verification checklist

After pushing the tag, verify:

1. the tag exists on GitHub
2. the `release` workflow completed successfully
3. the GitHub Release page for the tag exists
4. the `.tgz` artifact is attached
5. Pi can install the pinned tag:

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid@v0.1.0
```

## Versioning guidance

- Use a new tag for any user-visible behavior change.
- Do not reuse an existing tag.
- Keep `package.json` and the Git tag aligned.

## How Pi users update

### Moving branch install

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid
pi update
```

### Pinned install

```bash
pi install git:github.com/vindulaintranet/pi-extension-mermaid@v0.1.0
```

Pinned installs stay on that exact ref until the user explicitly upgrades to another tag or commit.
