# Implementation checklist

## 1. Working MVP preview

- [x] Search and browse published questions, submit an answer, and retain anonymous progress. Verified through the browser against PostgreSQL.
- [x] Upload a question paper and answer key, process asynchronously, and preserve source files. Verified 50 questions, 200 options in order, and 50 answer mappings. Inspected all nine table crops.
- [x] Review read-only, edit a draft, and publish validated questions. Verified publication and student visibility in one browser workflow.
- [ ] Review the live desktop and mobile MVP with the user.

## 2. Document fidelity

- [ ] Add OCR, richer layout analysis, structured tables, explanation imports, and extraction diagnostics. Verify using representative scanned and native fixtures.
- [ ] Review extraction results and measured accuracy with the user.

## 3. Editorial administration

- [ ] Extend revision workflows, rich editing, taxonomy, bulk operations, audit history, and retry controls. Verify draft and published isolation.
- [ ] Review the administrative workflows with the user.

## 4. Study experience

- [ ] Add remaining question formats, revision, full test mode, and topic analytics. Verify grading, history, and mobile workflows.
- [ ] Review student features with the user.

## 5. Release readiness

- [ ] Verify Docker deployment, recovery, accessibility, visual regressions, and performance benchmarks.
- [ ] Review production readiness with the user.
