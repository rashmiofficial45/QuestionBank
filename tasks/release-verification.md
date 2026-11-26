# Local release verification

The production build, 11 TypeScript unit tests, 27 PDF worker tests, and 19 Chrome end-to-end tests passed. The Chrome run compared six checked-in screenshot baselines. The live Docker run is deferred.

After the follow-up through Section 10 of the original brief, the production build, 11 TypeScript unit tests, 31 PDF worker tests, and 21 Chrome end-to-end tests passed. New cases verified combined PDFs, numbered explanations, inferred two-column layouts, and publication and grading of image and equation options.

## Measured performance

PostgreSQL 18.4 on macOS, using a separate synthetic database. Each measurement is based on 25 sequential calls after one warm-up. Search calls include PostgreSQL result counting and the first page of results through the application query. These are local application timings, excluding browser rendering and network latency.

| Rows | Query | p50 | p95 |
| ---: | --- | ---: | ---: |
| 5,000 | Selective search | 17.13 ms | 20.40 ms |
| 5,000 | Broad search | 16.71 ms | 17.17 ms |
| 5,000 | Question lookup | 0.29 ms | 0.31 ms |
| 50,000 | Selective search | 2.94 ms | 3.10 ms |
| 50,000 | Broad search | 67.81 ms | 74.14 ms |
| 50,000 | Question lookup | 0.30 ms | 0.39 ms |

The selective query matched 10 and 100 questions respectively. Query plans can change as the corpus grows. Use these measurements as a local baseline.

The supplied Polity paper yielded 50 questions and 200 options in both runs. The regression checks all 50 answer mappings and all nine structured tables.

| Input | Extractor elapsed | Python peak RSS |
| --- | ---: | ---: |
| Original text PDF | 0.92 s | 79.2 MiB |
| 240 DPI raster-only copy | 33.19 s | 167.8 MiB |

RSS covers the Python process. Tesseract runs separately. Extraction timings exclude upload, the queue, asset file writes, and publication. With eight concurrent application readers and the raster extractor running on the same host, 200 mixed broad and selective searches measured 110.69 ms p50 and 706.30 ms p95. That extraction took 38.01 seconds. This is a bounded local concurrency check.

## Repeat the checks

Create a disposable, empty PostgreSQL database named `question_bank_benchmark`, run migrations with its `DATABASE_URL`, then use `pnpm exec tsx scripts/benchmark-search.ts`. Run `PYTHONPATH=worker .venv/bin/python scripts/benchmark-extraction.py <paper> <key>` for each PDF pair. To exercise local concurrency, add `--concurrent` to the search benchmark after seeding and run it during raster extraction.

The browser suite covers editable draft isolation, publication, desktop and mobile, Black and White modes, keyboard navigation, grading, and answer-key revisions. Set `PREVIEW_SCREENSHOT_DIR` to capture review images. Run `VISUAL_REGRESSION=1 CHROME_CHANNEL=chrome pnpm test:e2e tests/e2e/visual.spec.ts` to compare the table-question layout against the checked-in macOS Chrome desktop and mobile baselines. Set `ADVANCED_VISUAL=1` when running `tests/e2e/editorial.spec.ts` with the dedicated database and fixtures to also compare Assertion–Reason, equations, and pair matching. These baselines cover Chrome on macOS.

The Chrome accessibility checks use axe-core rules for WCAG 2.0 and 2.1 levels A and AA. They exercise student routes in both themes, a 390 px practice test with keyboard navigation, the results table and its horizontal scrolling, answer review, selected editorial screens, numeric and pair-matching responses, and populated Progress in both themes. The suite also verifies the skip link moves focus to the main content. These are automated scans of specific states and keyboard checks along selected workflows.

## Recovery and deployment

A custom-format `pg_dump` of the synthetic benchmark database was restored to a separate database with `pg_restore --exit-on-error`. The restored database contained 50,000 questions with 50,000 distinct slugs.

For a real backup, pause the web and worker writes and create a PostgreSQL archive with `pg_dump -Fc -f question-bank.dump "$DATABASE_URL"`. Back up the entire source-files directory or Docker volume while writes are paused. Keep the database archive and source archive together, with access limited to the operators. Restore the database to an empty compatible instance with `pg_restore --exit-on-error -d "$RESTORE_DATABASE_URL" question-bank.dump`, restore the source files under the corresponding storage path, run migrations, and verify question counts and a published source PDF before switching traffic.

The Compose manifest was parsed locally. It defines a one-shot migration service, loopback-only web binding, a database-backed readiness endpoint, and worker restart and shutdown settings. The live Docker run is deferred at the project owner's request. On a Docker host, run `docker compose up --build --wait` and verify `/api/health`, migrations, a sample PDF import, and persistence across a restart.

## Security boundary

The supported editor runs on loopback or inside a restricted operator network. Public deployments must set `ENABLE_PRIVATE_ADMIN=0` and keep administrative routes and the source storage volume private. The local public-mode check verified that admin routes and original PDFs return 404, active question crops remain available, and responses include the expected security headers. Browser checks verified that a different profile cannot access another profile's test. Archiving a question revokes public access to its crop while the owner of a pinned test retains access through their test. The Node.js production and Python dependency audits reported zero matching advisories.

An anonymous browser cookie associates attempts, notes, and bookmarks with the current browser. It uses HttpOnly and SameSite=Lax, and HTTPS deployments can enforce the Secure attribute with `STUDY_COOKIE_SECURE=1`. Uploads are size-bounded and checked for a PDF signature. The worker limits pages and raster dimensions and processes files locally. Equation rendering disables trusted KaTeX commands and falls back to text on parse errors. Independent security review and production traffic checks are outside this local verification.
