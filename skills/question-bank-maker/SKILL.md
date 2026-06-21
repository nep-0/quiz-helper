---
name: question-bank-maker
description: Create one or more JSON question banks from conversation context, notes, study material, source files, PDFs, markdown, or pasted text using the Quiz Question Bank schema. Use when Codex is asked to generate, convert, extract, normalize, validate, repair, split, or provide examples of question banks compatible with quiz-bank.schema.json.
---

# Question Bank Maker

## Workflow

1. Load the bundled schema contract before writing output.
   - Use `references/quiz-bank.schema.json` as the canonical schema.
   - Read `references/quiz-bank-format.md` when a compact explanation or example is useful.
   - Use a project-local schema only when the user explicitly says to target that local variant.

2. Gather source material.
   - Use conversation context, pasted text, or files named by the user.
   - For large files, extract only the relevant sections first.
   - Preserve source language unless the user asks for translation.

3. Decide the bank split.
   - Create one bank unless the source clearly contains separate subjects, exams, chapters, or the user asks for multiple banks.
   - Use stable lowercase `bankId` values with hyphens.
   - Use stable question IDs such as `q1`, `q2`, or chapter-prefixed IDs when combining sources.

4. Generate schema-compatible JSON.
   - Include required top-level fields: `bankId`, `title`, `version`, `locale`, `questionTypes`, `questions`.
   - Support only `single_choice`, `multiple_choice`, and `true_false`.
   - Use option IDs matching `^[A-Z]$`; keep `label` and `text` non-empty.
   - Store correct answers in `answer.correctOptionIds`.
   - Preserve mathematical formulas as LaTeX wrapped in dollar signs, for example `$x^2 + y^2 = z^2$`.
   - Add `sections`, `difficulty`, `tags`, and `source` when inferable.
   - Write full, self-contained `explanation` text for each question whenever the source supports it.
   - Explain why the correct answer is correct, and for multiple choice or plausible distractors explain why incorrect options are not correct when useful.
   - Do not use explanations that only point back to material, such as "see the textbook", "according to the source", "refer to chapter 3", or page/section citations without the actual reasoning.

5. Validate before finalizing.
   - If working in a repo with Node tooling, use an existing validator if present.
   - Otherwise inspect JSON carefully for required fields, valid enums, unique IDs, option-answer consistency, and strict JSON syntax.
   - Do not invent facts from weak source material. Mark uncertainty in explanations only if useful to the user.

## Output Rules

- Return valid JSON or create `.json` files as requested.
- For multiple banks, output an array only if the user asks for a combined artifact; otherwise create separate bank files.
- Keep all generated content schema-valid, not merely human-readable.
- Do not include markdown fences when the user wants a file-ready JSON blob.

## Reference

Read `references/quiz-bank.schema.json` for the exact JSON Schema contract. Read `references/quiz-bank-format.md` for a compact explanation, validation checklist, and example.
