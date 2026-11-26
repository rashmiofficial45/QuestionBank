# Study Atlas

Study Atlas is a local question bank and editorial workspace for civil services preparation. Study Atlas supports question paper and detailed answer PDF uploads, asynchronous extraction, read-only review, draft editing, publication, and student practice.

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

Visit [the student workspace](http://127.0.0.1:3000/) or [PDF imports](http://127.0.0.1:3000/admin/imports). Upload a question paper and its detailed answer PDF. The importer supports a key followed by numbered explanations and an **Answers & Explanations** document with inline labels such as `Q 1. A`. A standalone answer key is optional and is cross-checked when supplied. The worker matches solutions by question number, verifies the answer labels, and keeps images of the original explanation pages. Open **Review** for a read-only source comparison, **Edit** to save a draft, or **Publish** to send eligible questions to the student bank. Detailed explanations open after grading and are available in submitted test reviews. Attempts and bookmarks are associated with a browser cookie.

## Deployment boundary

The admin console is unauthenticated. Keep **all** admin pages, administrative actions, and source PDF access on loopback or behind a network boundary that restricts access to authorized administrators. Run the public-facing app with `ENABLE_PRIVATE_ADMIN=0`. Set `STUDY_COOKIE_SECURE=1` for HTTPS deployments. The application host check supplements loopback binding and is unsuitable as a public access control. An anonymous browser identifier stores progress and provides no authentication.

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

The fixture directory must contain `Test-01-Polity-01-QP-23-Nov-.pdf`, `Test-01-Polity-01-Answer-Key-23-Nov-.pdf`, and `Test-01-Polity-01-Detailed-Explaination-23-Nov-.pdf`. Use a review database for this end-to-end test because it publishes the sample import. Set `CHROME_CHANNEL=chrome` to use installed Chrome. For additional OCR coverage, set `SCAN_FIXTURE_DIR` to a directory containing `scanned-paper.pdf` and `scanned-answer-key.pdf`. Set `POLITY_RASTER_FIXTURE_DIR` to include a full rasterized Polity regression in Pytest and Playwright. That directory should contain `polity-raster.pdf` and `polity-key-raster.pdf`. Set `POLITY_DETAILED_RASTER_FIXTURE` to an image-only copy of the detailed answer PDF under 10 MB to test all three scanned uploads and verified publication in Chrome. The test helpers in `worker/tests/test_extract.py` rasterize a PDF at 240 DPI with no native text layer.

## MVP coverage

The Polity parser handles the sample paper's known two-column layout and renders all nine tables as structured HTML, with links to the original PDF crops. The worker uses word coordinates to map cell text to rules from the native PDF or from the page raster. English scanned question papers and answer keys use Tesseract and require editorial source verification before publishing. Reviewers can open the separate answer key and edit individual cells, prompt text, answers, and optional explanations. The editorial workspace uses a local PDF.js viewer with page navigation, zoom, and source highlighting. The original PDF can also be opened directly.

The editor covers rectangular tables. Detected ambiguous or merged grids keep their source crops and a review flag. Scan clarity, table ruling, document rotation, and unfamiliar layouts can affect recognition. For an existing import with untouched source blocks, `worker/refresh_tables.py IMPORT_ID` upgrades verified table layouts while retaining question IDs, answers, edits to other fields, and attempts.

For layouts without a verified profile, the worker infers reading order from numbered question anchors, including mixed-width pages and questions continuing to another page. Those drafts include the source crop and a verification flag. The parser also recognizes plain alphabetic labels like `A.` and `B)` in addition to parenthesized labels. Numeric and Roman choices are recognized when the source has clear markers. Merged cells are retained when the source geometry describes a complete, non-overlapping grid. Ambiguous layouts, unruled tables, and diagram interpretation require source inspection.

Choice questions can retain embedded source images found between option markers. Review each image against the source before publication. In **Edit**, turn on **Render option as LaTeX** to render the option's text as an equation. Image and equation choices keep their original option identifiers and grade in both the question bank and timed practice. Imported and manually entered explanations are revealed after checking an answer or in a submitted test review.

The question bank supports inline grading, highlighted search matches, and numbered shadcn pagination. The sidebar toggle saves its state in the browser. Practice runs a timed test with one question per screen, a scrollable navigator, saved selections, and optional marks for review. The arrows on the question strip move one question at a time and scroll when needed. Use Left and Right to change questions and Up and Down to focus an answer. Enter selects the focused answer or toggles its checkbox on multiple-answer questions. Maximize test hides the workspace navigation. Minimize test or Escape restores it.

The PDF importer detects explicit answer sets such as `1. A, C` or `1. (A) and (C)` and stages them as multiple-answer drafts. Editors verify the full answer set against the source before publishing and can choose **Multiple correct answers** manually in the draft editor. Conflicting entries and labels that do not match the question's options leave the answer unset for review. Students can find published questions with the Question format filter. Correct answers require an exact match with the published answer set.

The importer recognizes True/False questions when the paper has explicit True and False options. The key can use the original option letters or the words True and False. Editors can assign **True/False** manually in the draft editor. Publication requires one True option, one False option, and a single matching answer.

Statement-based questions keep consecutive numbered or Roman-numeral statements as a list, with the original labels and surrounding prompt text. Editors can edit each extracted statement. The question bank's **Statement-based questions** filter also finds matching lists in older imports. The statement layout preserves the source's answer interaction and key.

Assertion–Reason questions imported with explicit Assertion and Reason labels on separate lines display the two parts separately. Editors can update each part and learners can find the format in the question bank. Grading follows the answer key and options from the source. Prompts without a recognizable pair retain their original text.

Submission opens Test ended with earned and total marks, accuracy, time taken, and a topic breakdown. Review answers opens the original questions and a table of selections, correct answers, and outcomes. Exit test returns to the practice setup and the most recent 20 scores. Deleting a timed review removes that test from the score table and keeps its individual attempts in Progress. Untimed practice sets can be filtered by subject, topic, and difficulty, resumed, and reviewed after completion. Use **Mark for revision** to retain a question in Revision independently of its latest answer.

The default test uses 60 minutes and two marks per correct answer, with one-third of the marks deducted for an incorrect answer. The setup form can change those settings. Progress distinguishes test attempts from question-bank activity and shows performance by subject and topic. Revision lists questions whose latest attempt was incorrect. A correct retry clears the question from the queue.

The interface uses shadcn/ui with White and Black themes and semantic answer feedback. An explanation appears after grading when the saved question includes one.

## Editorial workflow

In **PDF imports**, use **Create question** or **Import CSV or JSON** to stage drafts without a PDF. CSV accepts `question,option_a,option_b,answer,explanation`; number and classification columns are optional. Export an import to see the structured CSV and JSON formats. Exports embed source images up to 1 MB each; missing or larger images return an explicit error. Imports accept up to 1,000 questions and 5 MB per file.

Use **Settings** to manage classification suggestions and default timed-test settings. **Review duplicates** groups exact normalized prompts and choices. Excluding a duplicate keeps its draft and archives any published version.

The draft editor supports adding, moving, and removing blocks, including text styles, tables, and PNG or JPEG images. It backs up unsaved edits in the browser. Enable **Autosave valid drafts** to write them to PostgreSQL. **History** can restore the original content or a published revision. Editorial verification and publication remain explicit.


Edit a published question to prepare a draft revision. Publishing creates an immutable version and updates the student bank. Previous versions keep their original answers and options, including for someone already taking a test. Editors can reorder or add options, edit the classification, publish selected questions, archive or unarchive a published question, and restore a previous version to a draft. Import history includes changes and failed uploads can be retried from their stored PDFs.

Run editorial browser tests against a separate database and worker. Set `EDITORIAL_TEST_DATABASE=1`, `PREVIEW_URL` to that server, and the fixture directory variables above. Run `pnpm test:e2e tests/e2e/editorial.spec.ts`.

PostgreSQL holds the import queue, draft and original JSON content, published snapshots, attempts, and bookmarks. Full-text and trigram indexes support question search. Source PDFs and crop images use local persistent storage outside the checked-in workspace content. Review the [task checklist](tasks/todo.md) for subsequent milestones.

## Release verification

See [the local release report](tasks/release-verification.md) for measured search and extraction results, the backup and restore drill, and the remaining deployment checks. The database-backed readiness endpoint is `/api/health`.

The editor supports numerical, fill-in-the-blank, and short-answer questions with deterministic grading. Descriptive responses reveal a reference answer after the learner submits their draft and are excluded from scored tests. For matching and ordering, configure the expected sequence using the original option labels. Pair matching also needs one prompt per line. Set Question layout to classify coded matching, chronological, and comprehension questions independently from how they are answered. The text block style supports passages, quotations, headings, code, and KaTeX equations. Embedded prompt images in supported native PDFs are retained in original source crops.
