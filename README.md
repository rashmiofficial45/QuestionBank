# Study Atlas

Study Atlas is a local question bank and editorial workspace for civil services preparation. Study Atlas supports paired PDF uploads, asynchronous extraction, read-only review, draft editing, publication, and student practice.

## Local preview

Prerequisites are Node.js 22.13 or later, pnpm 12, Python 3.13+, PostgreSQL 18, and Tesseract 5 with the English language data. The worker uses Tesseract for image-only pages. Use a dedicated local PostgreSQL database named `question_bank`.

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

The fixture directory must contain `Test-01-Polity-01-QP-23-Nov-.pdf` and `Test-01-Polity-01-Answer-Key-23-Nov-.pdf`. Use a review database for this end-to-end test because it publishes the sample import. Set `CHROME_CHANNEL=chrome` to use installed Chrome. For additional OCR coverage, set `SCAN_FIXTURE_DIR` to a directory containing `scanned-paper.pdf` and `scanned-answer-key.pdf`. Set `POLITY_RASTER_FIXTURE_DIR` to include a full rasterized Polity regression in Pytest and Playwright. That directory should contain `polity-raster.pdf` and `polity-key-raster.pdf`. The test helpers in `worker/tests/test_extract.py` rasterize a PDF at 240 DPI with no native text layer.

## MVP coverage

The Polity parser handles the sample paper's known two-column layout and renders all nine tables as structured HTML, with links to the original PDF crops. The worker uses word coordinates to map cell text to rules from the native PDF or from the page raster. English scanned question papers and answer keys use Tesseract and require editorial source verification before publishing. Reviewers can open the separate answer key and edit individual cells, prompt text, answers, and optional explanations. The browser uses its native viewer for the full PDF.

The editor covers rectangular tables. Detected ambiguous or merged grids keep their source crops and a review flag. Scan clarity, table ruling, document rotation, and unfamiliar layouts can affect recognition. For an existing import with untouched source blocks, `worker/refresh_tables.py IMPORT_ID` upgrades verified table layouts while retaining question IDs, answers, edits to other fields, and attempts.

The question bank supports inline grading, highlighted search matches, and numbered shadcn pagination. The sidebar toggle saves its state in the browser. Practice runs a timed test with one question per screen, a scrollable navigator, saved selections, and optional marks for review. The arrows on the question strip move one question at a time and scroll when needed. Use Left and Right to change questions and Up and Down to focus an answer. Enter selects the focused answer or toggles its checkbox on multiple-answer questions. Maximize test hides the workspace navigation. Minimize test or Escape restores it.

The PDF importer detects explicit answer sets such as `1. A, C` or `1. (A) and (C)` and stages them as multiple-answer drafts. Editors verify the full answer set against the source before publishing and can choose **Multiple correct answers** manually in the draft editor. Conflicting entries and labels that do not match the question's options leave the answer unset for review. Students can find published questions with the Question format filter. Correct answers require an exact match with the published answer set.

The importer recognizes True/False questions when the paper has explicit True and False options. The key can use the original option letters or the words True and False. Editors can assign **True/False** manually in the draft editor. Publication requires one True option, one False option, and a single matching answer.

Submission opens Test ended with earned and total marks, accuracy, time taken, and a topic breakdown. Review answers opens the original questions and a table of selections, correct answers, and outcomes. Exit test returns to the practice setup and the most recent 20 scores. Deleting a review removes that test from the score table and keeps its individual attempts in Progress.

The default test uses 60 minutes and two marks per correct answer, with one-third of the marks deducted for an incorrect answer. The setup form can change those settings. Progress distinguishes test attempts from question-bank activity and shows performance by subject and topic. Revision lists questions whose latest attempt was incorrect. A correct retry clears the question from the queue.

The interface uses shadcn/ui with White and Black themes and semantic answer feedback. An explanation appears after grading when the saved question includes one.

## Editorial workflow

Edit a published question to prepare a draft revision. Publishing creates an immutable version and updates the student bank. Previous versions keep their original answers and options, including for someone already taking a test. Editors can reorder or add options, edit the classification, publish selected questions, archive or unarchive a published question, and restore a previous version to a draft. Import history includes changes and failed uploads can be retried from their stored PDFs.

Run editorial browser tests against a separate database and worker. Set `EDITORIAL_TEST_DATABASE=1`, `PREVIEW_URL` to that server, and the fixture directory variables above. Run `pnpm test:e2e tests/e2e/editorial.spec.ts`.

PostgreSQL holds the import queue, draft and original JSON content, published snapshots, attempts, and bookmarks. Full-text and trigram indexes support question search. Source PDFs and crop images use local persistent storage outside the checked-in workspace content. Review the [task checklist](tasks/todo.md) for subsequent milestones.
