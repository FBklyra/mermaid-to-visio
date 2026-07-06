# Publishing this project to a public GitHub repository

A step-by-step guide written for someone who has **not** done this before. It is
tailored to *this* project. Follow it top to bottom. Most steps are copy-paste.

- **You are on Windows.** Run the commands in **Git Bash** (installed with Git for
  Windows) or **PowerShell** — the `git`/`gh` commands are the same in both.
- Lines starting with `#` are comments (don't type them).
- Target: a public repo at **`https://github.com/FBklyra/mermaid-to-visio`**.

---

## 0. Before you start — two important checks

### 0.1 Who owns this code? (do not skip)
The project is published under **Klyra, AI-Enhanced Strategic Intelligence, Inc.**
Make sure Klyra actually owns this work. If any of it was created as part of
employment for another company (e.g. on their time/equipment/scope), publishing it
under Klyra could be a legal problem. If in doubt, confirm ownership or get a
written assignment **before** making anything public. Once it's public, people
clone and fork it — you can't fully take it back.

> This guide is practical help, **not legal advice**. For a company release, have
> Klyra's counsel glance at `LICENSE`, `DISCLAIMER.md`, and `NOTICE` once.

### 0.2 Quick secret scan
Make sure no passwords, API keys, or `.env` files are about to be published. From
the project root (`C:\Dev\visio-as-script`):

```bash
# should print nothing alarming
git ls-files | grep -iE "\.env|secret|password|\.pem|\.key" || echo "clean"
```

---

## 1. Install the tools

### 1.1 Git (required)
Check if you already have it:
```bash
git --version
```
If it errors, install **Git for Windows** from <https://git-scm.com/download/win>
and accept the defaults. It includes **Git Credential Manager**, which handles the
GitHub sign-in popup for you later.

### 1.2 GitHub CLI (recommended — makes this much easier)
Check:
```bash
gh --version
```
If it errors, install it (then **close and reopen** your terminal):
```bash
winget install --id GitHub.cli -e
```

---

## 2. Create a GitHub account and the Klyra organization

1. If you don't have one, sign up at <https://github.com/signup>.
2. Create an **Organization** (this makes it look like a company, not a personal
   side-project):
   - Top-right avatar → **Your organizations** → **New organization** →
     **Free** plan.
   - Organization name: **`klyra-tech`** (this becomes the URL prefix).
   - Add the display name "Klyra", a logo, and the website `https://klyra.tech`
     later under the org's **Settings → Profile**.

---

## 3. Sign in to GitHub from your computer

### If you installed the GitHub CLI (recommended)
```bash
gh auth login
```
Answer the prompts:
- **GitHub.com**
- **HTTPS**
- **Login with a web browser** → copy the one-time code → press Enter → approve in
  the browser.

That's it — you're authenticated for both pushing and creating repos.

### If you use plain Git instead
You don't need to log in now. The first time you `git push`, a browser window
(Git Credential Manager) will ask you to sign in to GitHub. Approve it once and
it's remembered.

---

## 4. Start a clean history (recommended for this repo)

**Why:** this project's current very first commit still contains a bundled copy of
Mermaid (we removed it later). Your rule is that the public repo ships **no copy of
Mermaid** — including in git history. The simplest way to guarantee that is to
start the public history fresh. The current working files are already correct
(Mermaid removed, `dist/` and `node_modules/` ignored).

From the project root:

```bash
cd /c/Dev/visio-as-script        # in PowerShell:  cd C:\Dev\visio-as-script

# 1. Remove the old local history (keeps all your files, only resets git)
rm -rf .git                       # in PowerShell:  Remove-Item -Recurse -Force .git

# 2. Start a fresh repository on a 'main' branch
git init -b main

# 3. Stage everything that isn't git-ignored, and verify what's included
git add -A
git status
```

**Check the `git status` list:** it should include `README.md`, `LICENSE`,
`DISCLAIMER.md`, `packages/`, `mermaid-to-visio/`, `visio-as-script/`,
`visio-as-script-web/`, etc. It should **NOT** include `node_modules/`, `dist/`,
any `mermaid/` engine folder, or local `*.zip` archives. (Confirm with the next
command.)

```bash
# These must print 0 — no Mermaid engine, no dependencies committed
git ls-files | grep -E "mermaid/(chunks|mermaid\.esm)" | wc -l
git ls-files | grep -c node_modules
```

Now make the first commit:

```bash
git commit -m "Initial public release: Mermaid → native Visio (.vsdx) editor, library, and CLI"
```

---

## 5. Create the public repository and push

### Option A — with the GitHub CLI (one command)
```bash
gh repo create FBklyra/mermaid-to-visio \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "Convert Mermaid diagrams to native Microsoft Visio (.vsdx) — real shapes & connectors, not an image. Live editor + npm library + CLI. Runs client-side; ships no copy of Mermaid."
```
This creates the repo under the **klyra-tech** org and pushes your `main` branch.
Done — skip to step 6.

### Option B — with the GitHub website + Git
1. Go to <https://github.com/new>.
2. **Owner:** select `klyra-tech`. **Repository name:** `visio-as-script`.
3. **Public**. Do **not** add a README, .gitignore, or license (you already have
   them).
4. Click **Create repository**, then run:
```bash
git remote add origin https://github.com/FBklyra/mermaid-to-visio.git
git push -u origin main
```
If a browser window asks you to sign in, approve it.

---

## 6. Make the repo look professional

On the repo page (`https://github.com/FBklyra/mermaid-to-visio`):

- **About** (gear icon, top-right): add the description and set **Website** to
  `https://klyra.tech`. Add **topics**: `mermaid`, `visio`, `vsdx`,
  `enterprise-architecture`, `togaf`, `diagrams`, `ai`, `klyra`.
- **Settings → Security → Code security → Private vulnerability reporting:**
  **Enable** (this matches your `SECURITY.md`).
- Confirm the green **MIT License** badge shows (GitHub detects `LICENSE`).

---

## 7. (Optional) Attach the ready-to-deploy bundle to a Release

Your `npm run package:web` bundle (with compiled Mermaid) is git-ignored, so it
isn't in the repo. To give people a downloadable copy, attach it to a **Release**:

```bash
# build the bundle (needs the official Mermaid once)
npm install mermaid
npm run package:web                 # creates dist/visio-as-script-web.zip

# create a v0.1.0 release and upload the zip (GitHub CLI)
gh release create v0.1.0 dist/visio-as-script-web.zip \
  --title "v0.1.0" \
  --notes "Ready-to-deploy web bundle (offline, official Mermaid included)."
```
Or, in the web UI: **Releases → Draft a new release → choose a tag `v0.1.0` →
attach `dist/visio-as-script-web.zip` → Publish**.

---

## 8. (Optional, later) Publish the npm packages

Only when you're ready to publish to the npm registry under the `@klyratech` scope:

```bash
# one-time: log in to npm and ensure the @klyratech org/scope exists on npmjs.com
npm login

# build the extension first (the library + editor ship its built output)
(cd ../mermaid-to-visio && npm install && npm run build)   # if editing the extension
npm run vendor                                             # sync built extension into the editor

# publish the three packages (library first — the CLI depends on it)
npm publish --workspace @klyratech/mermaid-to-visio   # the conversion library
npm publish --workspace @klyratech/visio-cli          # the CLI (vas render / vas serve)
npm publish --workspace @klyratech/visio-editor       # the runnable web editor (npx @klyratech/visio-editor)
```
Each package sets `publishConfig.access: public`, so scoped packages publish
free/public without extra flags. After publishing, anyone can:

```bash
npx @klyratech/visio-editor                     # run the editor instantly
npm install @klyratech/mermaid-to-visio mermaid # embed the .vsdx export in their app
npm install -g @klyratech/visio-cli             # vas render diagram.mmd  → diagram.vsdx
```

---

## 9. Everyday updates after publishing

When you change files later:
```bash
git add -A
git commit -m "Describe what you changed"
git push
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `git: command not found` | Install Git for Windows (step 1.1), reopen terminal. |
| `gh: command not found` | Install GitHub CLI (step 1.2), reopen terminal. |
| Push rejected / asks for password | GitHub no longer accepts your account password over HTTPS. Use `gh auth login`, or let Git Credential Manager's browser popup sign you in. |
| "remote origin already exists" | `git remote remove origin` then redo step 5B. |
| Accidentally committed `node_modules` or `dist` | They're in `.gitignore`; if already staged: `git rm -r --cached node_modules dist` then commit. |
| Want to undo before pushing | Nothing is public until `git push`. You can re-do steps 4–5 freely. |

---

## Quick checklist

- [ ] Confirmed Klyra owns the IP (step 0.1)
- [ ] Secret scan clean (step 0.2)
- [ ] Git (and ideally GitHub CLI) installed
- [ ] `klyra-tech` organization created
- [ ] Signed in (`gh auth login` or Credential Manager)
- [ ] Fresh history; `git status` shows no `node_modules/`, `dist/`, or `mermaid/` engine
- [ ] First commit made
- [ ] Repo created under `klyra-tech` and pushed
- [ ] Description, topics, website, vulnerability reporting set
- [ ] (Optional) Release with the web bundle; npm packages published
