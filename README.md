# Study Atlas

Study Atlas is a local question bank and editorial workspace for civil services preparation. The MVP supports paired PDF uploads, asynchronous extraction, read-only review, draft editing, publication, and student practice.

## Local preview

Prerequisites are Node.js 22.13 or later, pnpm 12, Python 3.13+, and PostgreSQL 18. Use a dedicated local PostgreSQL database named `question_bank`.

```sh
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm db:migrate
python3 -m venv .venv
.venv/bin/pip install -r worker/requirements.txt
```

Set the PostgreSQL connection string in `.env.local`. The worker reads its settings from the shell. Run both processes from the repository root, in separate terminals.

```sh
pnpm dev
```

```sh
set -a
source .env.local
set +a
.venv/bin/python worker/main.py
```

Visit [the student workspace](http://127.0.0.1:3000/) or [PDF imports](http://127.0.0.1:3000/admin/imports). Upload the question paper and separate answer key. Open **Review** for a read-only comparison with the original, **Edit** to save a draft, or **Publish** to send eligible questions to the student bank. Student answers are graded on the server; attempts and bookmarks are associated with a browser cookie.

## Deployment boundary

The admin console is unauthenticated. Keep **all** admin pages, administrative actions, and source PDF access on loopback or behind a network boundary that restricts access to authorized administrators. Run the public-facing app with `ENABLE_PRIVATE_ADMIN=0`. The application host check supplements loopback binding and is unsuitable as a public access control. An anonymous browser identifier stores progress and provides no authentication.

For Docker Compose, set `POSTGRES_PASSWORD` and `COMPOSE_DATABASE_URL` in `.env`. Use the `database` hostname and URI-encode the database password in the URL, for example `postgresql://question_bank:YOUR_ENCODED_PASSWORD@database:5432/question_bank`. Then run `docker compose up --build`. Compose binds the website to host loopback and runs migrations before starting the web and worker processes.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
.venv/bin/pip install pytest
PYTHONPATH=worker POLITY_FIXTURE_DIR=/path/to/fixtures .venv/bin/pytest -q worker/tests
pnpm exec playwright install chromium
POLITY_FIXTURE_DIR=/path/to/fixtures pnpm test:e2e
```

The fixture directory must contain `Test-01-Polity-01-QP-23-Nov-.pdf` and `Test-01-Polity-01-Answer-Key-23-Nov-.pdf`. Use a review database for this end-to-end test because it publishes the sample import. Set `CHROME_CHANNEL=chrome` to use installed Chrome.

## MVP coverage

The Polity parser handles the sample paper's known two-column layout and retains original crops for its nine identified tables. The parser stages sufficiently structured native-text papers with unfamiliar layouts for editorial verification. Scanned PDFs require the later OCR milestone. Options, answer selection, and explanations are editable. Table prompts use the original image with a text transcription. The full PDF uses the browser's native preview.

PostgreSQL holds the import queue, draft and original JSON content, published snapshots, attempts, and bookmarks. Full-text and trigram indexes support question search. Source PDFs and crop images use local persistent storage outside the checked-in workspace content. Review the [task checklist](tasks/todo.md) for subsequent milestones.
