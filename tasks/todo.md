# Implementation checklist

## Original six-phase roadmap

| Phase | Status |
| --- | --- |
| 1. Architecture and project setup | Complete |
| 2. PDF ingestion and validation | PDF and structured-data ingestion with validation, source review, and page checkpoints. |
| 3. Editorial administration | Independent Review, Edit, and Publish, plus manual drafts, export, taxonomy settings, and duplicate resolution. |
| 4. Question bank and practice | Core formats and rich choice options implemented. Difficult source layouts retain original regions for review. |
| 5. Study tools and analytics | Includes timed and untimed sessions, bookmarks, notes, revision, filters, and analytics. |
| 6. Release verification | Local build, browser, security, accessibility, visual, database, and extraction checks passed. Live Docker run deferred. |

## Original brief through Section 10

These section numbers follow the 38-section brief. The six implementation phases are listed separately above.

| Sections | Current coverage |
| --- | --- |
| 1–2. Product and scope | PDF-to-practice workflow, anonymous progress, and private editorial access. |
| 3–5. Stack, architecture, and organization | Next.js, PostgreSQL, and a separate Python job worker run locally. PDF.js is used for editorial source review. Extraction uses PyMuPDF and Tesseract. |
| 6. Admin console | Dashboard, import and retry history, draft editing, classification, publication, and revisions. Taxonomy, default scoring settings, and duplicate review have dedicated admin screens. |
| 7. PDF upload | Separate or combined paper and answer key, plus an optional explanation PDF. CSV and JSON import/export and standalone manual drafts share the editorial workflow. |
| 8. PDF processing pipeline | Persistent jobs with leases, progress, retry, OCR, answer mapping, and explanation extraction. Retries reuse completed page analysis. Duplicate review matches normalized questions across imports. |
| 9. High-fidelity parsing | Verified Polity profile, multi-page and clear mixed-column reading order, source regions, alphabetic/numeric/Roman choices, and geometry-backed merged tables. |
| 10. Question formats | Supported formats include image and equation choices. Automatic extraction of arbitrary diagrams, graphs, shared passages, and formulas remains limited. |

## 1. Working MVP preview

- [x] Search and browse published questions, submit an answer, and retain anonymous progress. Verified through the browser against PostgreSQL.
- [x] Upload a question paper and answer key, process asynchronously, and preserve source files. Verified 50 questions, 200 options in order, and 50 answer mappings. Inspected all nine table crops.
- [x] Review read-only, edit a draft, and publish validated questions. Verified publication and student visibility in one browser workflow.
- [x] Review the live desktop and mobile MVP with the user.

## 2. Document fidelity

- [x] Add English OCR for scanned question and answer-key pages and extract rectangular tables from native and scanned source geometry.
- [x] Render question cards in White and Black with shadcn/ui, inline grading, and saved practice history.
- [x] Add conservative two-column diagnostics, combined PDFs with an explicit Answer Key page, and optional explanation PDF imports.
- [x] Review extraction results with the user and incorporate their study-interface feedback.

## 3. Editorial administration

- [x] Add immutable revisions, editable choice lists and classification, selected publication, archive and restore, activity history, and import retry. Verify draft and published isolation.
- [x] Add search highlights, numbered pagination, and correct/incorrect answer styling to the question bank.
- [x] Add a timed, single-question practice workspace with a scrollable navigator, saved answers, marks for review, and scoring on submission.
- [ ] Review the administrative workflows with the user.

## 4. Study experience

- [x] Add a collapsible sidebar, test focus mode, a separate results and review flow, and deletable score history.
- [x] Add a revision queue and performance by subject and topic. Verify scoring, review deletion, and retry behavior in the browser.
- [x] Add keyboard shortcuts for navigating timed tests and selecting answers.
- [x] Move one question at a time with the question-strip arrows and keep the current number in view.
- [x] Add multiple-correct MCQs with editorial answer keys and exact-set grading.
- [x] Import explicit multiple-answer PDF keys and flag them for editorial verification.
- [x] Import, edit, filter, and grade True/False questions with explicit source options.
- [x] Preserve statement lists and source labels in imports, support editorial edits, and filter and grade statement-based questions.
- [x] Import, edit, filter, and grade explicitly labeled Assertion–Reason questions.
- [x] Add written and numerical grading, descriptive self-assessment, interactive pairs and ordering, and typed passage, code, and equation rendering.
- [x] Preserve embedded native prompt images with zoomable original crops.
- [x] Add browser-local notes and measured study activity, streaks, weak topics, and subject analytics.
- [x] Add image and equation answer options with editorial verification.
- [x] Cover explicit section numbering, numeric and Roman choices, multi-page continuations, clear mixed columns, merged cells, and section-aware explanations.
- [ ] Review student features with the user.

## Completion follow-up

- [x] Stage manual questions and CSV or JSON records as drafts. Export CSV and JSON with portable source images where available.
- [x] Manage subject, topic, subtopic, and tag suggestions. Save live default test settings.
- [x] Review exact normalized duplicates across imports and resolve them by keeping the group or excluding a draft and archiving its published revision.
- [x] Render synchronized source PDFs with PDF.js, page navigation, highlighting, zoom, and the original-document link.
- [x] Add, reorder, and remove rich blocks. Edit image descriptions, merged cells, lists, equations, code, and choices. Restore the original draft and use undo, redo, browser backup, or server autosave.
- [x] Filter by topic, difficulty, tag, and study status. Create and resume untimed practice sets, review finished sets, and mark questions for revision.
- [x] Persist editing settings and practice data with additive migrations. Existing question revisions and attempts retain their IDs and content.
- [x] Verify native builds, migrations, import and publication, retained revisions, activity, PDF rendering, and the new workflows in Chrome, including mobile Black and White checks.

Known limits

- Automatic reconstruction remains conservative for ambiguous layouts, unruled or nested tables, low-quality scans, and mathematical or graphical conventions without reliable geometry. Source review remains part of verification. Text matching for older PDFs highlights only unambiguous matches.
- Answer-key matching supports explicit section and booklet headings. Keys with unidentified or inconsistent booklet variants require editorial mapping. PDF import uses English OCR. Optional Docling and vision-based extraction providers are open.
- Duplicate matching uses normalized content. Near-duplicate paraphrases and image-dependent equivalence require editorial review. Classification changes affect suggestions and future edits while historical labels are preserved.
- Checkpoints persist page layout analysis. The final question assembly and transactional draft staging run again after a retry. Export reports missing and oversized source images.
- Student and editorial operations use typed server actions. A comprehensive external JSON API for every workflow is outside the delivered set.

## 5. Release readiness

- [x] Verify a local backup and restore, benchmark search and extraction, and compare table snapshots at desktop and phone widths.
- [ ] Run Docker Compose and verify the import and persistence checks on a Docker host. Deferred at the user's request.
- [x] Check public-mode access controls and audit Node.js and Python runtime dependencies.
- [x] Verify keyboard accessibility and automated contrast checks, and compare selected advanced-format screenshots in Chrome on macOS.
- [ ] Extend browser visual and accessibility coverage beyond the locally tested screens and run an independent security review.
- [ ] Review production readiness with the user.
