# Quiz Bank Format Reference

Use this reference for a compact explanation, checklist, and example. The exact schema is bundled at `references/quiz-bank.schema.json`.

## Required top-level shape

```json
{
  "bankId": "sample-bank-001",
  "title": "Sample Question Bank",
  "version": "1.0.0",
  "locale": "en-US",
  "questionTypes": {
    "single_choice": { "label": "Single choice", "defaultPoints": 1 },
    "multiple_choice": { "label": "Multiple choice", "defaultPoints": 2 },
    "true_false": { "label": "True/false", "defaultPoints": 1 }
  },
  "questions": []
}
```

Optional top-level fields: `description`, `subject`, `tags`, `sections`.

## Question rules

- Required question fields: `id`, `number`, `type`, `prompt`, `options`, `answer`.
- `type` must be one of `single_choice`, `multiple_choice`, `true_false`.
- Optional question fields: `sectionId`, `stem`, `points`, `difficulty`, `tags`, `source`, `explanation`.
- `difficulty` must be `easy`, `medium`, or `hard`.
- `source` may contain `importType`, `origin`, and `chapter`.
- `answer.correctOptionIds` contains one or more option IDs.
- For `true_false`, use exactly two options.
- Option IDs and answer IDs must be single uppercase letters such as `A`, `B`, `C`, `D`.

## Compact Example

```json
{
  "bankId": "intro-science-001",
  "title": "Intro Science Review",
  "description": "Small example generated from study notes.",
  "version": "1.0.0",
  "locale": "en-US",
  "subject": "Science",
  "tags": ["review"],
  "questionTypes": {
    "single_choice": { "label": "Single choice", "defaultPoints": 1 },
    "multiple_choice": { "label": "Multiple choice", "defaultPoints": 2 },
    "true_false": { "label": "True/false", "defaultPoints": 1 }
  },
  "sections": [
    {
      "id": "basics",
      "title": "Basics",
      "questionIds": ["q1", "q2", "q3"]
    }
  ],
  "questions": [
    {
      "id": "q1",
      "number": 1,
      "sectionId": "basics",
      "type": "single_choice",
      "prompt": "Which process do plants use to make food from sunlight?",
      "points": 1,
      "difficulty": "easy",
      "tags": ["plants"],
      "options": [
        { "id": "A", "label": "A", "text": "Photosynthesis" },
        { "id": "B", "label": "B", "text": "Evaporation" },
        { "id": "C", "label": "C", "text": "Condensation" },
        { "id": "D", "label": "D", "text": "Erosion" }
      ],
      "answer": { "correctOptionIds": ["A"] },
      "explanation": "Photosynthesis converts light energy into chemical energy stored as food."
    },
    {
      "id": "q2",
      "number": 2,
      "sectionId": "basics",
      "type": "multiple_choice",
      "prompt": "Which are states of matter?",
      "points": 2,
      "difficulty": "easy",
      "options": [
        { "id": "A", "label": "A", "text": "Solid" },
        { "id": "B", "label": "B", "text": "Liquid" },
        { "id": "C", "label": "C", "text": "Gas" },
        { "id": "D", "label": "D", "text": "Shadow" }
      ],
      "answer": { "correctOptionIds": ["A", "B", "C"] },
      "explanation": "Solid, liquid, and gas are common states of matter."
    },
    {
      "id": "q3",
      "number": 3,
      "sectionId": "basics",
      "type": "true_false",
      "prompt": "The Earth orbits the Sun.",
      "points": 1,
      "difficulty": "easy",
      "options": [
        { "id": "A", "label": "True", "text": "True" },
        { "id": "B", "label": "False", "text": "False" }
      ],
      "answer": { "correctOptionIds": ["A"] },
      "explanation": "Earth completes an orbit around the Sun roughly once per year."
    }
  ]
}
```

## Validation Checklist

- JSON parses without comments or trailing commas.
- No undeclared top-level or question properties when using the strict schema.
- All required `questionTypes` are present.
- Question IDs are unique within a bank.
- `sections[].questionIds`, when present, refer to existing questions.
- Each answer ID exists in that question's `options`.
- Single choice and true/false have exactly one correct answer.
- Multiple choice has at least one correct answer and normally more than one when the source supports it.
