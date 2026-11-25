# Implementation checklist

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
- [x] Add multiple-correct MCQs with editorial answer keys and exact-set grading.
- [ ] Extend the remaining question formats and detect multiple-correct answer keys during import.
- [ ] Review student features with the user.

## 5. Release readiness

- [ ] Verify Docker deployment, recovery, accessibility, visual regressions, and performance benchmarks.
- [ ] Review production readiness with the user.
