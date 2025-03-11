import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  CreateMessageRequest,
  CreateMessageResultSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  Resource,
  SetLevelRequestSchema,
  SubscribeRequestSchema,
  Tool,
  ToolSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

/* Input schemas for tools implemented in this server */
const EchoSchema = z.object({
  message: z.string().describe("Message to echo"),
});

const AddSchema = z.object({
  a: z.number().describe("First number"),
  b: z.number().describe("Second number"),
});

const LongRunningOperationSchema = z.object({
  duration: z
    .number()
    .default(10)
    .describe("Duration of the operation in seconds"),
  steps: z.number().default(5).describe("Number of steps in the operation"),
});

const PrintEnvSchema = z.object({});

const SampleLLMSchema = z.object({
  prompt: z.string().describe("The prompt to send to the LLM"),
  maxTokens: z
    .number()
    .default(100)
    .describe("Maximum number of tokens to generate"),
});

// Example completion values
const EXAMPLE_COMPLETIONS = {
  style: ["casual", "formal", "technical", "friendly"],
  temperature: ["0", "0.5", "0.7", "1.0"],
  resourceId: ["1", "2", "3", "4", "5"],
};

const GetTinyImageSchema = z.object({});

const AnnotatedMessageSchema = z.object({
  messageType: z.enum(["error", "success", "debug"])
    .describe("Type of message to demonstrate different annotation patterns"),
  includeImage: z.boolean().default(false)
    .describe("Whether to include an example image")
});

enum ToolName {
  ECHO = "echo",
  ADD = "add"
}

enum PromptName {
  SIMPLE = "simple_prompt",
  COMPLEX = "complex_prompt",
}

export const createServer = () => {
  const server = new Server(
    {
      name: "example-servers/everything",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: { subscribe: true },
        tools: {},
        logging: {},
      },
    },
  );

  let subscriptions: Set<string> = new Set();
  let updateInterval: NodeJS.Timeout | undefined;

  // Set up update interval for subscribed resources
  updateInterval = setInterval(() => {
    for (const uri of subscriptions) {
      server.notification({
        method: "notifications/resources/updated",
        params: { uri },
      });
    }
  }, 5000);

  // Helper method to request sampling from client
  const requestSampling = async (
    context: string,
    uri: string,
    maxTokens: number = 100,
  ) => {
    const request: CreateMessageRequest = {
      method: "sampling/createMessage",
      params: {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Resource ${uri} context: ${context}`,
            },
          },
        ],
        systemPrompt: "You are a helpful test server.",
        maxTokens,
        temperature: 0.7,
        includeContext: "thisServer",
      },
    };

    return await server.request(request, CreateMessageResultSchema);
  };

  const ALL_RESOURCES: Resource[] = Array.from({ length: 100 }, (_, i) => {
    const uri = `test://static/resource/${i + 1}`;
    if (i % 2 === 0) {
      return {
        uri,
        name: `Resource ${i + 1}`,
        mimeType: "text/plain",
        text: `Resource ${i + 1}: This is a plaintext resource`,
      };
    } else {
      const buffer = Buffer.from(`Resource ${i + 1}: This is a base64 blob`);
      return {
        uri,
        name: `Resource ${i + 1}`,
        mimeType: "application/octet-stream",
        blob: buffer.toString("base64"),
      };
    }
  });

  const PAGE_SIZE = 10;

  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    const cursor = request.params?.cursor;
    let startIndex = 0;

    if (cursor) {
      const decodedCursor = parseInt(atob(cursor), 10);
      if (!isNaN(decodedCursor)) {
        startIndex = decodedCursor;
      }
    }

    const endIndex = Math.min(startIndex + PAGE_SIZE, ALL_RESOURCES.length);
    const resources = ALL_RESOURCES.slice(startIndex, endIndex);

    let nextCursor: string | undefined;
    if (endIndex < ALL_RESOURCES.length) {
      nextCursor = btoa(endIndex.toString());
    }

    return {
      resources,
      nextCursor,
    };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: [
        {
          uriTemplate: "test://static/resource/{id}",
          name: "Static Resource",
          description: "A static resource with a numeric ID",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri.startsWith("test://static/resource/")) {
      const index = parseInt(uri.split("/").pop() ?? "", 10) - 1;
      if (index >= 0 && index < ALL_RESOURCES.length) {
        const resource = ALL_RESOURCES[index];
        return {
          contents: [resource],
        };
      }
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    const { uri } = request.params;
    subscriptions.add(uri);

    // Request sampling from client when someone subscribes
    await requestSampling("A new subscription was started", uri);
    return {};
  });

  server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    subscriptions.delete(request.params.uri);
    return {};
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: PromptName.SIMPLE,
          description: "A prompt without arguments",
        },
        {
          name: PromptName.COMPLEX,
          description: "A prompt with arguments",
          arguments: [
            {
              name: "temperature",
              description: "Temperature setting",
              required: true,
            },
            {
              name: "style",
              description: "Output style",
              required: false,
            },
          ],
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === PromptName.SIMPLE) {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "This is a simple prompt without arguments.",
            },
          },
        ],
      };
    }

    if (name === PromptName.COMPLEX) {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `This is a complex prompt with arguments: temperature=${args?.temperature}, style=${args?.style}`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I understand. You've provided a complex prompt with temperature and style arguments. How would you like me to proceed?",
            },
          }
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: ToolName.ECHO,
        description: "Echoes back the input",
        inputSchema: zodToJsonSchema(EchoSchema) as ToolInput,
      },
      {
        name: ToolName.ADD,
        description: "Adds two numbers",
        inputSchema: zodToJsonSchema(AddSchema) as ToolInput,
      }
    ];

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === ToolName.ECHO) {
      const validatedArgs = EchoSchema.parse(args);
      return {
        content: [{ type: "text", text: `Echo: ${validatedArgs.message}` }],
      };
    }

    if (name === ToolName.ADD) {
      const validatedArgs = AddSchema.parse(args);
      const sum = validatedArgs.a + validatedArgs.b;
      return {
        content: [
          {
            type: "text",
            text: `The sum of ${validatedArgs.a} and ${validatedArgs.b} is ${sum}.`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  server.setRequestHandler(CompleteRequestSchema, async (request) => {
    const { ref, argument } = request.params;

    if (ref.type === "ref/resource") {
      const resourceId = ref.uri.split("/").pop();
      if (!resourceId) return { completion: { values: [] } };

      // Filter resource IDs that start with the input value
      const values = EXAMPLE_COMPLETIONS.resourceId.filter(id => 
        id.startsWith(argument.value)
      );
      return { completion: { values, hasMore: false, total: values.length } };
    }

    if (ref.type === "ref/prompt") {
      // Handle completion for prompt arguments
      const completions = EXAMPLE_COMPLETIONS[argument.name as keyof typeof EXAMPLE_COMPLETIONS];
      if (!completions) return { completion: { values: [] } };

      const values = completions.filter(value => 
        value.startsWith(argument.value)
      );
      return { completion: { values, hasMore: false, total: values.length } };
    }

    throw new Error(`Unknown reference type`);
  });

  server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const { level } = request.params;

    // Demonstrate different log levels
    await server.notification({
      method: "notifications/message",
      params: {
        level: "debug",
        logger: "test-server",
        data: `Logging level set to: ${level}`,
      },
    });

    return {};
  });

  const cleanup = async () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  };

  return { server, cleanup };
};

