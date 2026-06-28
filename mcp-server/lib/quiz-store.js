import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "questions.json");

let cache = null;

function loadData() {
  if (!cache) {
    cache = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  }
  return cache;
}

export function listTopics() {
  const { topics } = loadData();
  return Object.entries(topics).map(([id, topic]) => ({
    id,
    name: topic.name,
    questionCount: topic.questions.length,
  }));
}

export function getTopic(topicId) {
  const { topics } = loadData();
  const topic = topics[topicId];
  if (!topic) return null;
  return topic;
}

export function getQuestion(topicId, questionId) {
  const topic = getTopic(topicId);
  if (!topic) return null;
  return topic.questions.find((q) => q.id === questionId) ?? null;
}

export function getNextQuestion(topicId, afterQuestionId = null) {
  const topic = getTopic(topicId);
  if (!topic) return null;

  if (!afterQuestionId) {
    return topic.questions[0] ?? null;
  }

  const idx = topic.questions.findIndex((q) => q.id === afterQuestionId);
  if (idx === -1) return topic.questions[0] ?? null;
  return topic.questions[idx + 1] ?? null;
}

function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function addTopic(topicId, name) {
  const data = loadData();
  if (data.topics[topicId]) {
    return { error: `Topic already exists: ${topicId}` };
  }

  data.topics[topicId] = { name, questions: [] };
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`);
  cache = data;

  return { topicId, name, questionCount: 0 };
}

export function checkAnswer(topicId, questionId, userAnswer) {
  const question = getQuestion(topicId, questionId);
  if (!question) {
    return { correct: false, feedback: "Question not found.", expectedAnswer: null };
  }

  const expected = normalize(question.answer);
  const given = normalize(userAnswer);
  const correct = expected === given || expected.includes(given) || given.includes(expected);

  return {
    correct,
    feedback: correct
      ? "Correct!"
      : `Not quite. The expected answer was: ${question.answer}`,
    expectedAnswer: question.answer,
    questionId: question.id,
  };
}
