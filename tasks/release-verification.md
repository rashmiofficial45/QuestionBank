# Local release verification

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
| Original text PDF | 0.84 s | 85.0 MiB |
| 240 DPI raster-only copy | 33.19 s | 167.8 MiB |

RSS covers the Python process. Tesseract runs separately. Extraction timings exclude upload, the queue, asset file writes, and publication. The benchmark does not establish concurrent traffic capacity.

## Repeat the checks

Create a disposable, empty PostgreSQL database named `question_bank_benchmark`, run migrations with its `DATABASE_URL`, then use `pnpm exec tsx scripts/benchmark-search.ts`. Run `PYTHONPATH=worker .venv/bin/python scripts/benchmark-extraction.py <paper> <key>` for each PDF pair.

The browser suite covers editable draft isolation, publication, desktop and mobile, Black and White modes, keyboard navigation, grading, and answer-key revisions. Set `PREVIEW_SCREENSHOT_DIR` to capture review images. The visual checks are manual screenshot review and browser layout assertions. Automated pixel baselines remain pending.

## Recovery and deployment

A custom-format `pg_dump` of the synthetic benchmark database was restored to a separate database with `pg_restore --exit-on-error`. The restored database contained 50,000 questions with 50,000 distinct slugs.

For a real backup, pause the web and worker writes and create a PostgreSQL archive with `pg_dump -Fc -f question-bank.dump "$DATABASE_URL"`. Back up the entire source-files directory or Docker volume while writes are paused. Keep the database archive and source archive together, with access limited to the operators. Restore the database to an empty compatible instance with `pg_restore --exit-on-error -d "$RESTORE_DATABASE_URL" question-bank.dump`, restore the source files under the corresponding storage path, run migrations, and verify question counts and a published source PDF before switching traffic.

The Compose manifest was parsed locally. It defines a one-shot migration service, loopback-only web binding, a database-backed readiness endpoint, and worker restart and shutdown settings. Docker runtime verification remains pending because this host has no Docker CLI or daemon. On a Docker host, run `docker compose up --build --wait` and verify `/api/health`, migrations, a sample PDF import, and persistence across a restart.

## Security boundary

The supported editor runs on loopback or inside a restricted operator network. Public deployments must set `ENABLE_PRIVATE_ADMIN=0` and keep administrative routes and the source storage volume private. The application has no user login. An anonymous browser cookie associates attempts, notes, and bookmarks with the current browser. Uploads are size-bounded and checked for a PDF signature. The worker limits pages and raster dimensions and processes files locally. Equation rendering disables trusted KaTeX commands and falls back to text on parse errors. Independent security testing and concurrent traffic testing remain release gates.
