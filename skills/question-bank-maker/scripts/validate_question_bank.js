#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA = path.resolve(SCRIPT_DIR, "..", "references", "quiz-bank.schema.json");
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "bankId",
  "title",
  "description",
  "version",
  "locale",
  "subject",
  "tags",
  "questionTypes",
  "sections",
  "questions",
]);
const REQUIRED_TOP_LEVEL_KEYS = ["bankId", "title", "version", "locale", "questionTypes", "questions"];
const REQUIRED_QUESTION_TYPES = ["single_choice", "multiple_choice", "true_false"];
const ALLOWED_QUESTION_KEYS = new Set([
  "id",
  "number",
  "sectionId",
  "type",
  "prompt",
  "stem",
  "points",
  "difficulty",
  "tags",
  "source",
  "options",
  "answer",
  "explanation",
]);
const REQUIRED_QUESTION_KEYS = ["id", "number", "type", "prompt", "options", "answer"];
const ALLOWED_QUESTION_TYPES = new Set(REQUIRED_QUESTION_TYPES);
const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const OPTION_ID_PATTERN = /^[A-Z]$/;

function usage() {
  console.error("Usage: validate_question_bank.js [--schema PATH] <bank.json> [bank2.json ...]");
}

function parseArgs(argv) {
  const args = { schema: DEFAULT_SCHEMA, files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--schema") {
      index += 1;
      if (index >= argv.length) {
        throw new Error("--schema requires a path");
      }
      args.schema = path.resolve(argv[index]);
    } else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option ${arg}`);
    } else {
      args.files.push(path.resolve(arg));
    }
  }

  if (args.files.length === 0) {
    throw new Error("at least one question bank JSON file is required");
  }
  return args;
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code) {
      throw new Error(`${filePath}: cannot read file: ${error.message}`);
    }
    throw new Error(`${filePath}: invalid JSON: ${error.message}`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function addTypeError(errors, location, expected, value) {
  errors.push(`${location}: expected ${expected}, got ${typeName(value)}`);
}

function requireString(errors, object, key, location, minLength = 0) {
  const value = object[key];
  if (typeof value !== "string") {
    addTypeError(errors, `${location}.${key}`, "string", value);
    return false;
  }
  if (value.length < minLength) {
    errors.push(`${location}.${key}: must not be empty`);
    return false;
  }
  return true;
}

function validateStringArray(errors, value, location, minLength = 1, unique = false) {
  if (!Array.isArray(value)) {
    addTypeError(errors, location, "array", value);
    return;
  }

  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item !== "string") {
      addTypeError(errors, `${location}[${index}]`, "string", item);
      return;
    }
    if (item.length < minLength) {
      errors.push(`${location}[${index}]: must not be empty`);
    }
    if (unique && seen.has(item)) {
      errors.push(`${location}[${index}]: duplicate value ${JSON.stringify(item)}`);
    }
    seen.add(item);
  });
}

function validateTypeRule(errors, value, location) {
  if (!isPlainObject(value)) {
    addTypeError(errors, location, "object", value);
    return;
  }

  for (const key of Object.keys(value)) {
    if (key !== "label" && key !== "defaultPoints") {
      errors.push(`${location}.${key}: additional property is not allowed`);
    }
  }
  for (const key of ["label", "defaultPoints"]) {
    if (!(key in value)) {
      errors.push(`${location}: missing required property ${key}`);
    }
  }
  if ("label" in value) {
    requireString(errors, value, "label", location, 1);
  }
  if ("defaultPoints" in value) {
    if (typeof value.defaultPoints !== "number") {
      addTypeError(errors, `${location}.defaultPoints`, "number", value.defaultPoints);
    } else if (!(value.defaultPoints > 0)) {
      errors.push(`${location}.defaultPoints: must be greater than 0`);
    }
  }
}

function validateQuestionTypes(errors, value) {
  if (!isPlainObject(value)) {
    addTypeError(errors, "$.questionTypes", "object", value);
    return;
  }

  for (const key of Object.keys(value)) {
    if (!REQUIRED_QUESTION_TYPES.includes(key)) {
      errors.push(`$.questionTypes.${key}: additional property is not allowed`);
    }
  }
  for (const type of REQUIRED_QUESTION_TYPES) {
    if (!(type in value)) {
      errors.push(`$.questionTypes: missing required property ${type}`);
    } else {
      validateTypeRule(errors, value[type], `$.questionTypes.${type}`);
    }
  }
}

function validateSection(errors, value, index, sectionIds) {
  const location = `$.sections[${index}]`;
  if (!isPlainObject(value)) {
    addTypeError(errors, location, "object", value);
    return;
  }

  for (const key of Object.keys(value)) {
    if (!["id", "title", "description", "questionIds"].includes(key)) {
      errors.push(`${location}.${key}: additional property is not allowed`);
    }
  }
  for (const key of ["id", "title"]) {
    if (!(key in value)) {
      errors.push(`${location}: missing required property ${key}`);
    }
  }
  if ("id" in value && requireString(errors, value, "id", location, 1)) {
    if (sectionIds.has(value.id)) {
      errors.push(`${location}.id: duplicate section id ${JSON.stringify(value.id)}`);
    }
    sectionIds.add(value.id);
  }
  if ("title" in value) {
    requireString(errors, value, "title", location, 1);
  }
  if ("description" in value) {
    requireString(errors, value, "description", location);
  }
  if ("questionIds" in value) {
    validateStringArray(errors, value.questionIds, `${location}.questionIds`, 1, true);
  }
}

function validateOption(errors, value, location, optionIds) {
  if (!isPlainObject(value)) {
    addTypeError(errors, location, "object", value);
    return;
  }

  for (const key of Object.keys(value)) {
    if (!["id", "label", "text"].includes(key)) {
      errors.push(`${location}.${key}: additional property is not allowed`);
    }
  }
  for (const key of ["id", "label", "text"]) {
    if (!(key in value)) {
      errors.push(`${location}: missing required property ${key}`);
    }
  }
  if ("id" in value) {
    if (requireString(errors, value, "id", location, 1)) {
      if (!OPTION_ID_PATTERN.test(value.id)) {
        errors.push(`${location}.id: must match pattern ^[A-Z]$`);
      }
      if (optionIds.has(value.id)) {
        errors.push(`${location}.id: duplicate option id ${JSON.stringify(value.id)}`);
      }
      optionIds.add(value.id);
    }
  }
  if ("label" in value) {
    requireString(errors, value, "label", location, 1);
  }
  if ("text" in value) {
    requireString(errors, value, "text", location, 1);
  }
}

function validateAnswer(errors, value, location, optionIds, questionType) {
  if (!isPlainObject(value)) {
    addTypeError(errors, location, "object", value);
    return;
  }

  for (const key of Object.keys(value)) {
    if (key !== "correctOptionIds") {
      errors.push(`${location}.${key}: additional property is not allowed`);
    }
  }
  if (!("correctOptionIds" in value)) {
    errors.push(`${location}: missing required property correctOptionIds`);
    return;
  }

  const correctIds = value.correctOptionIds;
  validateStringArray(errors, correctIds, `${location}.correctOptionIds`, 1, true);
  if (!Array.isArray(correctIds)) {
    return;
  }
  if (correctIds.length < 1) {
    errors.push(`${location}.correctOptionIds: must contain at least one item`);
  }

  correctIds.forEach((id, index) => {
    if (typeof id !== "string") {
      return;
    }
    if (!OPTION_ID_PATTERN.test(id)) {
      errors.push(`${location}.correctOptionIds[${index}]: must match pattern ^[A-Z]$`);
    }
    if (!optionIds.has(id)) {
      errors.push(`${location}.correctOptionIds[${index}]: ${JSON.stringify(id)} is not present in this question's options`);
    }
  });

  if ((questionType === "single_choice" || questionType === "true_false") && correctIds.length !== 1) {
    errors.push(`${location}.correctOptionIds: ${questionType} questions must have exactly one correct option`);
  }
}

function validateSource(errors, value, location) {
  if (!isPlainObject(value)) {
    addTypeError(errors, location, "object", value);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!["importType", "origin", "chapter"].includes(key)) {
      errors.push(`${location}.${key}: additional property is not allowed`);
    } else if (typeof value[key] !== "string") {
      addTypeError(errors, `${location}.${key}`, "string", value[key]);
    }
  }
}

function validateQuestion(errors, value, index, questionIds, sectionIds) {
  const location = `$.questions[${index}]`;
  if (!isPlainObject(value)) {
    addTypeError(errors, location, "object", value);
    return;
  }

  for (const key of Object.keys(value)) {
    if (!ALLOWED_QUESTION_KEYS.has(key)) {
      errors.push(`${location}.${key}: additional property is not allowed`);
    }
  }
  for (const key of REQUIRED_QUESTION_KEYS) {
    if (!(key in value)) {
      errors.push(`${location}: missing required property ${key}`);
    }
  }

  if ("id" in value && requireString(errors, value, "id", location, 1)) {
    if (questionIds.has(value.id)) {
      errors.push(`${location}.id: duplicate question id ${JSON.stringify(value.id)}`);
    }
    questionIds.add(value.id);
  }
  if ("number" in value) {
    if (!Number.isInteger(value.number)) {
      addTypeError(errors, `${location}.number`, "integer", value.number);
    } else if (value.number < 1) {
      errors.push(`${location}.number: must be at least 1`);
    }
  }
  if ("sectionId" in value) {
    if (requireString(errors, value, "sectionId", location, 1) && sectionIds.size > 0 && !sectionIds.has(value.sectionId)) {
      errors.push(`${location}.sectionId: unknown section id ${JSON.stringify(value.sectionId)}`);
    }
  }
  if ("type" in value) {
    if (requireString(errors, value, "type", location, 1) && !ALLOWED_QUESTION_TYPES.has(value.type)) {
      errors.push(`${location}.type: must be one of ${Array.from(ALLOWED_QUESTION_TYPES).join(", ")}`);
    }
  }
  if ("prompt" in value) {
    requireString(errors, value, "prompt", location, 1);
  }
  for (const key of ["stem", "explanation"]) {
    if (key in value) {
      requireString(errors, value, key, location);
    }
  }
  if ("points" in value) {
    if (typeof value.points !== "number") {
      addTypeError(errors, `${location}.points`, "number", value.points);
    } else if (!(value.points > 0)) {
      errors.push(`${location}.points: must be greater than 0`);
    }
  }
  if ("difficulty" in value) {
    if (requireString(errors, value, "difficulty", location, 1) && !ALLOWED_DIFFICULTIES.has(value.difficulty)) {
      errors.push(`${location}.difficulty: must be one of easy, medium, hard`);
    }
  }
  if ("tags" in value) {
    validateStringArray(errors, value.tags, `${location}.tags`, 1, true);
  }
  if ("source" in value) {
    validateSource(errors, value.source, `${location}.source`);
  }

  const optionIds = new Set();
  if ("options" in value) {
    if (!Array.isArray(value.options)) {
      addTypeError(errors, `${location}.options`, "array", value.options);
    } else {
      if (value.options.length < 2) {
        errors.push(`${location}.options: must contain at least two items`);
      }
      if (value.type === "true_false" && value.options.length !== 2) {
        errors.push(`${location}.options: true_false questions must have exactly two options`);
      }
      value.options.forEach((option, optionIndex) => {
        validateOption(errors, option, `${location}.options[${optionIndex}]`, optionIds);
      });
    }
  }

  if ("answer" in value) {
    validateAnswer(errors, value.answer, `${location}.answer`, optionIds, value.type);
  }
}

function validateBank(document) {
  const errors = [];
  if (!isPlainObject(document)) {
    return ["$: expected a question bank object"];
  }

  for (const key of Object.keys(document)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      errors.push(`$.${key}: additional property is not allowed`);
    }
  }
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in document)) {
      errors.push(`$: missing required property ${key}`);
    }
  }

  for (const key of ["bankId", "title", "version"]) {
    if (key in document) {
      requireString(errors, document, key, "$", 1);
    }
  }
  if ("locale" in document) {
    requireString(errors, document, "locale", "$", 2);
  }
  for (const key of ["description", "subject"]) {
    if (key in document) {
      requireString(errors, document, key, "$");
    }
  }
  if ("tags" in document) {
    validateStringArray(errors, document.tags, "$.tags", 1, true);
  }
  if ("questionTypes" in document) {
    validateQuestionTypes(errors, document.questionTypes);
  }

  const sectionIds = new Set();
  if ("sections" in document) {
    if (!Array.isArray(document.sections)) {
      addTypeError(errors, "$.sections", "array", document.sections);
    } else {
      document.sections.forEach((section, index) => {
        validateSection(errors, section, index, sectionIds);
      });
    }
  }

  const questionIds = new Set();
  if ("questions" in document) {
    if (!Array.isArray(document.questions)) {
      addTypeError(errors, "$.questions", "array", document.questions);
    } else {
      if (document.questions.length < 1) {
        errors.push("$.questions: must contain at least one item");
      }
      document.questions.forEach((question, index) => {
        validateQuestion(errors, question, index, questionIds, sectionIds);
      });
    }
  }

  if (Array.isArray(document.sections)) {
    document.sections.forEach((section, sectionIndex) => {
      if (!isPlainObject(section) || !Array.isArray(section.questionIds)) {
        return;
      }
      section.questionIds.forEach((questionId, questionRefIndex) => {
        if (typeof questionId === "string" && !questionIds.has(questionId)) {
          errors.push(`$.sections[${sectionIndex}].questionIds[${questionRefIndex}]: unknown question id ${JSON.stringify(questionId)}`);
        }
      });
    });
  }

  return errors;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    return 2;
  }

  try {
    loadJson(args.schema);
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  let hadError = false;
  for (const filePath of args.files) {
    let document;
    try {
      document = loadJson(filePath);
    } catch (error) {
      console.error(error.message);
      hadError = true;
      continue;
    }

    const errors = validateBank(document);
    if (errors.length > 0) {
      hadError = true;
      console.error(`${filePath}: invalid`);
      errors.forEach((error) => {
        console.error(`  - ${error}`);
      });
    } else {
      console.log(`${filePath}: valid`);
    }
  }

  return hadError ? 1 : 0;
}

process.exitCode = main();
