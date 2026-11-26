# Implementation checklist

## Original six-phase roadmap

| Phase | Status |
| --- | --- |
| 1. Architecture and project setup | Complete |
| 2. PDF ingestion and validation | Complete for the initial workflow. Later document layouts and explanation imports remain in the backlog. |
| 3. Editorial administration | Core workflows implemented and verified. The user walkthrough is pending. |
| 4. Question bank and practice | Core formats implemented. Advanced PDF layout reconstruction and rich answer options remain. |
| 5. Study tools and analytics | Core workflows available. Includes study notes, activity, streaks, subject and topic performance, and saved-test time and skips. |
| 6. Release verification | Local build, browser, security, accessibility, visual, database, and extraction checks passed. Live Docker run deferred. |

## Original brief through Section 10

These section numbers follow the 38-section brief. The six implementation phases are listed separately above.

| Sections | Current coverage |
| --- | --- |
| 1–2. Product and scope | PDF-to-practice workflow, anonymous progress, and private editorial access. |
| 3–5. Stack, architecture, and organization | Next.js, PostgreSQL, and a separate Python job worker run locally. The full technology list, including a dedicated PDF.js viewer and Docling, is partly implemented. |
| 6. Admin console | Dashboard, import and retry history, draft editing, classification, publication, and revisions. Standalone taxonomy, settings, and duplicate-management screens remain open. |
| 7. PDF upload | Separate or combined paper and answer key, plus an optional explanation PDF. CSV, JSON, and standalone manual creation remain open. |
| 8. PDF processing pipeline | Persistent jobs with leases, progress, retry, OCR, answer mapping, and explanation extraction. Chunk-level retries and cross-import duplicate detection remain open. |
| 9. High-fidelity parsing | Verified Polity profile, inferred two-column reading order, source crops, source order, and alphabetic options. More complex formatting, merged grids, and numeric or Roman option auto-detection remain limited. |
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
- [ ] Extend automatic reconstruction of advanced PDF layouts and additional option numbering conventions.
- [ ] Review student features with the user.

## 5. Release readiness

- [x] Verify a local backup and restore, benchmark search and extraction, and compare table snapshots at desktop and phone widths.
- [ ] Run Docker Compose and verify the import and persistence checks on a Docker host. Deferred at the user's request.
- [x] Check public-mode access controls and audit Node.js and Python runtime dependencies.
- [x] Verify keyboard accessibility and automated contrast checks, and compare selected advanced-format screenshots in Chrome on macOS.
- [ ] Extend browser visual and accessibility coverage beyond the locally tested screens and run an independent security review.
- [ ] Review production readiness with the user.
