# Implementation checklist

## Original six-phase roadmap

| Phase | Status |
| --- | --- |
| 1. Architecture and project setup | Complete |
| 2. PDF ingestion and validation | Complete for the initial workflow. Later document layouts and explanation imports remain in the backlog. |
| 3. Editorial administration | Core workflows implemented and verified. The user walkthrough is pending. |
| 4. Question bank and practice | In progress. Additional question formats remain. |
| 5. Study tools and analytics | Started. Bookmarks, progress, revision, and topic analytics are available. |
| 6. Release verification | Pending. Integration and browser regressions run during each increment. |

## 1. Working MVP preview

- [x] Search and browse published questions, submit an answer, and retain anonymous progress. Verified through the browser against PostgreSQL.
- [x] Upload a question paper and answer key, process asynchronously, and preserve source files. Verified 50 questions, 200 options in order, and 50 answer mappings. Inspected all nine table crops.
- [x] Review read-only, edit a draft, and publish validated questions. Verified publication and student visibility in one browser workflow.
- [x] Review the live desktop and mobile MVP with the user.

## 2. Document fidelity

- [x] Add English OCR for scanned question and answer-key pages and extract rectangular tables from native and scanned source geometry.
- [x] Render question cards in White and Black with shadcn/ui, inline grading, and saved practice history.
- [ ] Extend complex layout diagnostics and add explanation imports in a later document milestone.
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
- [ ] Extend the remaining question formats.
- [ ] Review student features with the user.

## 5. Release readiness

- [ ] Verify Docker deployment, recovery, accessibility, visual regressions, and performance benchmarks.
- [ ] Review production readiness with the user.
