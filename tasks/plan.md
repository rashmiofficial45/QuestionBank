# Question Bank implementation plan

The first review is a local MVP that demonstrates the product's core workflow with a real question paper and separate answer key. Next.js serves the student and admin experiences. PostgreSQL stores imports, published snapshots, and anonymous study activity. An independent Python worker extracts and stages content.

After the preview, each subsequent milestone ends with implementation, verification, and user review before the next milestone starts. See the [task checklist](todo.md).

The first slice targets native-text single-choice PDFs, including the Polity sample where evidence supports the extraction. Original source crops preserve visually complex prompts during the first review. The worker flags unresolved layouts and answer mappings for editorial review.
