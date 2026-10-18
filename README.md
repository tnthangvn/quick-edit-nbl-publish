# quick-edit-nbl

Spec Studio — a local web app for editing specs and syncing them to Google Drive / NotebookLM.

This package ships a prebuilt production server. Requires **Node.js 24+**.

## Run

```bash
npx quick-edit-nbl
```

Or install globally:

```bash
npm install -g quick-edit-nbl
quick-edit-nbl --port 3021
```

Then open http://localhost:3021.

Options: `--port <n>` (default `PORT_START`, `PORT`, then 3021), `--host <name>` (default `localhost`).

## Configuration

Environment variables are read from the shell, or from `.env.local` / `.env` in the directory you run the command from.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATA_DRIVER` | `JSON` | `JSON` (files in `DATA_DIR`) or `POSTGRES` |
| `DATA_DIR` | `~/.spec-studio/data` | Data folder for the JSON driver |
| `DATABASE_URL` | — | Postgres connection string (when `DATA_DRIVER=POSTGRES`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google Drive storage + NotebookLM Drive sync |
| `SECRET_ENCRYPTION_KEY` | auto-generated `~/.spec-studio/master.key` | 32-byte base64 key used to encrypt stored secrets |

## License

MIT
