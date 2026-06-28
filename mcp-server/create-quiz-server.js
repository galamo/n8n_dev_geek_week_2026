/**
 * Creates the Quiz MCP server with tools and prompts.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { normalizeObjectSchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import { z } from "zod";
import {
  listTopics,
  getNextQuestion,
  checkAnswer,
  getTopic,
  addTopic,
} from "./lib/quiz-store.js";

const ADD_TOPIC_AUTH_TOKEN = "1234";
const HEADER_AUTHORIZATION = "header_authorization";
const EMPTY_OBJECT_JSON_SCHEMA = { type: "object", properties: {} };

const topicIdSchema = z
  .enum(["sports", "mcp", "langchain", "agents"])
  .describe("Topic id: sports, mcp, langchain, or agents");

const topicSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  questionCount: z.number(),
});

const listTopicsOutputSchema = z.object({
  topics: z.array(topicSummarySchema),
});

const getQuestionOutputSchema = z.object({
  error: z.string().optional(),
  done: z.boolean().optional(),
  message: z.string().optional(),
  topicId: z.string().optional(),
  topicName: z.string().optional(),
  questionId: z.string().optional(),
  question: z.string().optional(),
});

const checkAnswerOutputSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
  expectedAnswer: z.string().nullable(),
  questionId: z.string().optional(),
});

const addTopicOutputSchema = z.object({
  error: z.string().optional(),
  topicId: z.string().optional(),
  name: z.string().optional(),
  questionCount: z.number().optional(),
});

function structuredToolResult(structuredContent) {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

function hasValidHeaderAuth(authInfo, requiredToken = ADD_TOPIC_AUTH_TOKEN) {
  return authInfo?.token === requiredToken;
}

function toolRequiresHeaderAuth(meta) {
  return meta?.[HEADER_AUTHORIZATION] != null;
}

function buildToolDefinition(name, tool) {
  const toolDefinition = {
    name,
    title: tool.title,
    description: tool.description,
    inputSchema: (() => {
      const obj = normalizeObjectSchema(tool.inputSchema);
      return obj
        ? toJsonSchemaCompat(obj, {
            strictUnions: true,
            pipeStrategy: "input",
          })
        : EMPTY_OBJECT_JSON_SCHEMA;
    })(),
    annotations: tool.annotations,
    execution: tool.execution,
    _meta: tool._meta,
  };

  if (tool.outputSchema) {
    const obj = normalizeObjectSchema(tool.outputSchema);
    if (obj) {
      toolDefinition.outputSchema = toJsonSchemaCompat(obj, {
        strictUnions: true,
        pipeStrategy: "output",
      });
    }
  }

  return toolDefinition;
}

function installAuthAwareListTools(server, toolsByName) {
  server.server.setRequestHandler(ListToolsRequestSchema, (_request, extra) => ({
    tools: [...toolsByName.entries()]
      .filter(([, tool]) => {
        if (!tool.enabled) return false;
        if (!toolRequiresHeaderAuth(tool._meta)) return true;
        const requiredToken = tool._meta?.[HEADER_AUTHORIZATION]?.token;
        return hasValidHeaderAuth(extra.authInfo, requiredToken);
      })
      .map(([name, tool]) => buildToolDefinition(name, tool)),
  }));
}

function registerTrackedTool(server, toolsByName, name, config, handler) {
  const registered = server.registerTool(name, config, handler);
  toolsByName.set(name, registered);
  return registered;
}

export function createQuizMcpServer() { // abstraction 
  const server = new McpServer(
    { name: "lab10-quiz-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, prompts: {} } }
  );
  const toolsByName = new Map();

  registerTrackedTool(
    server,
    toolsByName,
    "list_topics", // unique yes 
    {
      name: "list_topics", 
      description: "List available quiz topics with question counts.", //ai
      inputSchema: z.object({}),
      title: "List Of Topics - the best topics ever", // human
      outputSchema: listTopicsOutputSchema
    },
    async () => {
      const topics = listTopics();
      return {
        content: [{ type: "text", text: JSON.stringify(topics, null, 2) }],
        structuredContent: { topics },
      };
    }
  );

  registerTrackedTool(
    server,
    toolsByName,
    "get_question",
    {
      description:
        "Fetch the next quiz question for a topic. Pass afterQuestionId to get the following question, or omit it for the first question.",
      inputSchema: z.object({
        topicId: topicIdSchema,
        afterQuestionId: z
          .string()
          .optional()
          .nullable()
          .describe("Previous question id; omit for the first question"),
      }),
      outputSchema: getQuestionOutputSchema,
    },
    async ({ topicId, afterQuestionId }) => {
      const topic = getTopic(topicId);
      if (!topic) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Unknown topic: ${topicId}` }) }],
          isError: true,
        };
      }

      const question = getNextQuestion(topicId, afterQuestionId ?? null);
      if (!question) {
        return structuredToolResult({
          done: true,
          message: `No more questions in topic "${topic.name}".`,
        });
      }

      return structuredToolResult({
        topicId,
        topicName: topic.name,
        questionId: question.id,
        question: question.question,
      });
    }
  );

  registerTrackedTool(
    server,
    toolsByName,
    "check_answer",
    {
      description: "Validate the user's answer for a quiz question.",
      inputSchema: z.object({
        topicId: topicIdSchema,
        questionId: z.string().describe("Question id from get_question"),
        userAnswer: z.string().describe("The user's answer text"),
      }),
      outputSchema: checkAnswerOutputSchema,
    },
    async ({ topicId, questionId, userAnswer }) => {
      const result = checkAnswer(topicId, questionId, userAnswer);
      return structuredToolResult(result);
    }
  );

  registerTrackedTool(
    server,
    toolsByName,
    "add_topic",
    {
      description:
        "Add a new quiz topic to the data store. Requires Authorization header with token 1234.",
      inputSchema: z.object({
        topicId: z
          .string()
          .min(1)
          .describe("Unique topic id (e.g. history, science)"),
        name: z.string().min(1).describe("Human-readable topic name"),
      }),
      outputSchema: addTopicOutputSchema,
      _meta: {
        [HEADER_AUTHORIZATION]: {
          type: "bearer",
          token: ADD_TOPIC_AUTH_TOKEN,
          description: "Send Authorization: Bearer 1234 or Authorization: token:1234",
        },
      },
    },
    async ({ topicId, name }, extra) => {
      const requiredToken = ADD_TOPIC_AUTH_TOKEN;
      if (!hasValidHeaderAuth(extra.authInfo, requiredToken)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error:
                  "Unauthorized. Provide Authorization header with token 1234 (Bearer 1234 or token:1234).",
              }),
            },
          ],
          isError: true,
        };
      }

      const result = addTopic(topicId, name);
      if (result.error) {
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: true,
        };
      }

      return structuredToolResult(result);
    }
  );

  installAuthAwareListTools(server, toolsByName);

  server.registerPrompt(
    "start_quiz",
    {
      description: "Start a quiz session on a topic. Returns instructions for the quiz agent.",
      argsSchema: {
        topicId: topicIdSchema,
      },
    },
    async ({ topicId }) => {
      const topic = getTopic(topicId);
      if (!topic) {
        return {
          messages: [
            {
              role: "user",
              content: { type: "text", text: `Unknown topic: ${topicId}` },
            },
          ],
        };
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Start a quiz on "${topic.name}" (${topic.questions.length} questions).`,
                "Use get_question to fetch each question one at a time.",
                "Ask the user to answer. When they respond, use check_answer to validate.",
                "Give brief feedback, then fetch the next question until done.",
                "Do not answer quiz questions yourself — only ask and evaluate.",
              ].join(" "),
            },
          },
        ],
      };
    }
  );

  return server;
}
