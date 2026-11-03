# quick-edit-nbl

**Spec Studio** — a local web app for writing and reviewing Markdown specs with an AI agent, then saving them to a local folder, Git or Google Drive and syncing them to Google NotebookLM.

This package ships a prebuilt production server: one command starts both the web UI and its API. Nothing is sent anywhere except the services you connect yourself.

## Requirements

- **Node.js 24+**

## Quick start

Spec Studio keeps its config (`.env.local`) and data in the folder you start it from, so give it a folder of its own:

```bash
mkdir ~/spec-studio && cd ~/spec-studio
npx quick-edit-nbl
```

Open http://localhost:3021.

### First run: Setup Wizard

When the folder has no `.env.local` yet, the app opens a **Setup Wizard** instead of the project list:

1. **Server and data** — ports, where data is stored (default `./.spec-studio/data`), optional encryption key. You can also **import an existing `.env` file** to fill the form.
2. **Google Drive** (optional) — OAuth Client ID / Secret for Drive storage and NotebookLM sync. Skip it if you don't need Drive.
3. **Review** — save writes `.env.local` in the current folder.

Google settings take effect immediately. Port, data and encryption changes need a restart: stop the server (Ctrl+C) and run `npx quick-edit-nbl` again in the same folder.

Change anything later in **Settings › System**.

## Install globally (optional)

```bash
npm install -g quick-edit-nbl
cd ~/spec-studio
quick-edit-nbl
```

Update with `npm install -g quick-edit-nbl@latest` (or `npx quick-edit-nbl@latest`).

## Command-line options

```
quick-edit-nbl [--port <n>] [--host <name>]
```

| Option | Default |
| --- | --- |
| `--port <n>` | `PORT_START` from `.env.local`, then `PORT`, then `3021` |
| `--host <name>` | `localhost` |

## Configuration

Settings are read from the shell environment, or from `.env.local` / `.env` in the folder you run the command from. The Setup Wizard and **Settings › System** write `.env.local` for you; editing it by hand works too.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT_START` | `3021` | Port the server listens on |
| `DATA_DRIVER` | `JSON` | `JSON` (files in `DATA_DIR`) or `POSTGRES` |
| `DATA_DIR` | `~/.spec-studio/data` (wizard sets `./.spec-studio/data`) | Data folder for the JSON driver |
| `DATABASE_URL` | — | Postgres connection string (when `DATA_DRIVER=POSTGRES`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google Drive storage and NotebookLM Drive sync |
| `SECRET_ENCRYPTION_KEY` | auto-generated `~/.spec-studio/master.key` | 32-byte key (base64 or hex) that encrypts stored tokens and API keys |
| `SPEC_STUDIO_HOME` | `~/.spec-studio` | App home folder (master key, default data) |

## Your data

- Tokens, API keys and passwords you enter are **encrypted** before they are stored. The encryption key lives in `SECRET_ENCRYPTION_KEY` or `~/.spec-studio/master.key`. **Back it up**: without it, stored secrets can't be read.
- Keep `.env.local` private. It is created with owner-only permissions; don't commit or share it.
- The package uses the `JSON` driver by default. `POSTGRES` needs a database whose schema is already migrated; migrations are not shipped in this package.

## License

MIT
