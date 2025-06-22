// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  users;
  conversations;
  messages;
  agentSessions;
  currentUserId;
  currentConversationId;
  currentMessageId;
  currentAgentSessionId;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.conversations = /* @__PURE__ */ new Map();
    this.messages = /* @__PURE__ */ new Map();
    this.agentSessions = /* @__PURE__ */ new Map();
    this.currentUserId = 1;
    this.currentConversationId = 1;
    this.currentMessageId = 1;
    this.currentAgentSessionId = 1;
  }
  // Users
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.currentUserId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  // Conversations
  async getConversation(id) {
    return this.conversations.get(id);
  }
  async getConversationsByUserId(userId) {
    return Array.from(this.conversations.values()).filter((conv) => !userId || conv.userId === userId).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  async createConversation(insertConversation) {
    const id = this.currentConversationId++;
    const now = /* @__PURE__ */ new Date();
    const conversation = {
      ...insertConversation,
      id,
      createdAt: now,
      updatedAt: now,
      userId: insertConversation.userId ?? null
    };
    this.conversations.set(id, conversation);
    return conversation;
  }
  async updateConversation(id, updates) {
    const conversation = this.conversations.get(id);
    if (!conversation) return void 0;
    const updated = {
      ...conversation,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.conversations.set(id, updated);
    return updated;
  }
  async deleteConversation(id) {
    const deleted = this.conversations.delete(id);
    if (deleted) {
      Array.from(this.messages.entries()).forEach(([messageId, message]) => {
        if (message.conversationId === id) {
          this.messages.delete(messageId);
        }
      });
      Array.from(this.agentSessions.entries()).forEach(([sessionId, session]) => {
        if (session.conversationId === id) {
          this.agentSessions.delete(sessionId);
        }
      });
    }
    return deleted;
  }
  // Messages
  async getMessage(id) {
    return this.messages.get(id);
  }
  async getMessagesByConversationId(conversationId) {
    return Array.from(this.messages.values()).filter((message) => message.conversationId === conversationId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  async createMessage(insertMessage) {
    const id = this.currentMessageId++;
    const message = {
      ...insertMessage,
      id,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: insertMessage.metadata ?? null
    };
    this.messages.set(id, message);
    const conversation = this.conversations.get(insertMessage.conversationId);
    if (conversation) {
      await this.updateConversation(insertMessage.conversationId, { updatedAt: /* @__PURE__ */ new Date() });
    }
    return message;
  }
  async deleteMessage(id) {
    return this.messages.delete(id);
  }
  // Agent Sessions
  async getAgentSession(conversationId) {
    return Array.from(this.agentSessions.values()).find((session) => session.conversationId === conversationId);
  }
  async createAgentSession(insertSession) {
    const id = this.currentAgentSessionId++;
    const now = /* @__PURE__ */ new Date();
    const session = {
      ...insertSession,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.agentSessions.set(id, session);
    return session;
  }
  async updateAgentSession(conversationId, state) {
    const existing = await this.getAgentSession(conversationId);
    if (!existing) return void 0;
    const updated = {
      ...existing,
      state,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.agentSessions.set(existing.id, updated);
    return updated;
  }
};
var storage = new MemStorage();

// server/services/agent.ts
import { GoogleGenAI } from "@google/genai";
var KoomenjueAgent = class {
  ai;
  model;
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
    });
    this.model = "gemini-2.5-flash";
  }
  async processMessage(userMessage, conversationHistory = [], agentState) {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const conversationContext = this.buildConversationContext(conversationHistory);
      const fullPrompt = `${systemPrompt}

${conversationContext}

User: ${userMessage}

KOOMENJUE:`;
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: fullPrompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      });
      const content = response.text || "I apologize, but I couldn't generate a response. Please try again.";
      return {
        content,
        metadata: {
          model: this.model,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          tokensUsed: response.usage?.totalTokens || 0
        }
      };
    } catch (error) {
      console.error("Error processing message with KOOMENJUE agent:", error);
      throw new Error(`Agent processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  buildSystemPrompt() {
    return `You are KOOMENJUE, an advanced AI powered assistant. You are designed to be helpful, knowledgeable, and engaging in technical discussions.

Your capabilities include:
- Providing detailed explanations about software development, AI, and technology
- Helping with code reviews and technical problem-solving
- Offering guidance on best practices and architectural decisions
- Assisting with LangGraph, React, Node.js, and full-stack development
- Explaining complex concepts in an accessible way

Your personality:
- Professional yet friendly and approachable
- Patient and thorough in explanations
- Enthusiastic about technology and learning
- Honest about limitations and uncertainties

Guidelines:
- Always provide accurate, helpful information
- If you're unsure about something, acknowledge it honestly
- Offer practical solutions and actionable advice
- Use examples and code snippets when helpful
- Ask clarifying questions when needed to better assist the user`;
  }
  buildConversationContext(messages2) {
    if (messages2.length === 0) {
      return "This is the start of a new conversation.";
    }
    const recentMessages = messages2.slice(-10);
    const context = recentMessages.map((msg) => {
      const role = msg.role === "user" ? "User" : "KOOMENJUE";
      return `${role}: ${msg.content}`;
    }).join("\n");
    return `Previous conversation context:
${context}`;
  }
  async analyzeMessage(content) {
    try {
      const prompt = `Analyze the following user message and provide a JSON response with:
- intent: the main intent/purpose of the message
- confidence: confidence score (0-1)
- entities: important entities or topics mentioned
- complexity: simple/medium/complex based on technical depth needed

Message: "${content}"

Respond with valid JSON only.`;
      const response = await this.ai.models.generateContent({
        model: this.model,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              intent: { type: "string" },
              confidence: { type: "number" },
              entities: {
                type: "array",
                items: { type: "string" }
              },
              complexity: {
                type: "string",
                enum: ["simple", "medium", "complex"]
              }
            },
            required: ["intent", "confidence", "entities", "complexity"]
          }
        },
        contents: prompt
      });
      const rawJson = response.text;
      if (rawJson) {
        return JSON.parse(rawJson);
      } else {
        throw new Error("Empty response from model");
      }
    } catch (error) {
      console.error("Error analyzing message:", error);
      return {
        intent: "general_inquiry",
        confidence: 0.5,
        entities: [],
        complexity: "medium"
      };
    }
  }
  async generateTitle(messages2) {
    try {
      if (messages2.length === 0) return "New Chat";
      const firstMessage = messages2.find((m) => m.role === "user");
      if (!firstMessage) return "New Chat";
      const prompt = `Generate a concise, descriptive title (max 6 words) for a conversation that starts with this message:

"${firstMessage.content}"

Respond with just the title, no quotes or extra text.`;
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          maxOutputTokens: 50,
          temperature: 0.3
        }
      });
      const title = response.text?.trim() || "New Chat";
      return title.length > 50 ? title.substring(0, 47) + "..." : title;
    } catch (error) {
      console.error("Error generating title:", error);
      return "New Chat";
    }
  }
};
var koomenjueAgent = new KoomenjueAgent();

// shared/schema.ts
import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  state: jsonb("state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true
});
var insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
});
var insertAgentSessionSchema = createInsertSchema(agentSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// server/routes.ts
import { z } from "zod";
async function registerRoutes(app2) {
  app2.get("/api/conversations", async (req, res) => {
    try {
      const conversations2 = await storage.getConversationsByUserId();
      res.json(conversations2);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({
        error: "Failed to fetch conversations",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({
        error: "Failed to fetch conversation",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/conversations", async (req, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid conversation data",
          details: error.errors
        });
      }
      console.error("Error creating conversation:", error);
      res.status(500).json({
        error: "Failed to create conversation",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.delete("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }
      const deleted = await storage.deleteConversation(id);
      if (!deleted) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({
        error: "Failed to delete conversation",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }
      const messages2 = await storage.getMessagesByConversationId(conversationId);
      res.json(messages2);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({
        error: "Failed to fetch messages",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messageData = insertMessageSchema.parse({
        ...req.body,
        conversationId
      });
      if (messageData.role !== "user") {
        return res.status(400).json({ error: "Only user messages are allowed via this endpoint" });
      }
      const userMessage = await storage.createMessage(messageData);
      const conversationHistory = await storage.getMessagesByConversationId(conversationId);
      const agentResponse = await koomenjueAgent.processMessage(
        messageData.content,
        conversationHistory.slice(0, -1)
        // Exclude the message we just added
      );
      const aiMessage = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: agentResponse.content,
        metadata: agentResponse.metadata
      });
      if (conversationHistory.length <= 1) {
        const title = await koomenjueAgent.generateTitle([userMessage]);
        await storage.updateConversation(conversationId, { title });
      }
      res.json({
        userMessage,
        aiMessage,
        conversation: await storage.getConversation(conversationId)
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid message data",
          details: error.errors
        });
      }
      console.error("Error processing message:", error);
      res.status(500).json({
        error: "Failed to process message",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/agent/status", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      res.json({
        status: apiKey ? "connected" : "disconnected",
        agent: "KOOMENJUE",
        model: "gemini-2.5-flash",
        capabilities: [
          "conversational AI",
          "code assistance",
          "technical guidance",
          "problem solving"
        ]
      });
    } catch (error) {
      console.error("Error getting agent status:", error);
      res.status(500).json({
        error: "Failed to get agent status",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
