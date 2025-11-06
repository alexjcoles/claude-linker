#!/usr/bin/env node

/**
 * Claude Code Linker - MCP Server
 *
 * Provides tools for Claude Code to communicate with other Claude instances
 * through the message broker
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import WebSocket from 'ws';

const BROKER_URL = process.env.BROKER_URL || 'ws://localhost:8765';
const INSTANCE_NAME = process.env.INSTANCE_NAME || `claude-${Date.now()}`;
const INSTANCE_DESCRIPTION = process.env.INSTANCE_DESCRIPTION || 'A Claude Code instance';

class LinkerMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "claude-linker",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.ws = null;
    this.instanceId = null;
    this.pendingMessages = [];
    this.isRegistered = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    this.setupToolHandlers();
    this.connectToBroker();
  }

  connectToBroker() {
    console.error(`[MCP] Connecting to broker at ${BROKER_URL}...`);

    this.ws = new WebSocket(BROKER_URL);

    this.ws.on('open', () => {
      console.error('[MCP] Connected to broker');
      this.reconnectAttempts = 0;

      // Auto-register this instance
      this.registerInstance();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleBrokerMessage(message);
      } catch (error) {
        console.error('[MCP] Error parsing broker message:', error);
      }
    });

    this.ws.on('close', () => {
      console.error('[MCP] Disconnected from broker');
      this.isRegistered = false;
      this.attemptReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('[MCP] WebSocket error:', error.message);
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.error(`[MCP] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
      setTimeout(() => this.connectToBroker(), delay);
    } else {
      console.error('[MCP] Max reconnection attempts reached');
    }
  }

  registerInstance() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[MCP] Cannot register: not connected to broker');
      return;
    }

    this.sendToBroker({
      type: 'register',
      payload: {
        name: INSTANCE_NAME,
        description: INSTANCE_DESCRIPTION,
        metadata: {
          startedAt: new Date().toISOString()
        }
      }
    });
  }

  handleBrokerMessage(message) {
    const { type } = message;

    switch (type) {
      case 'connected':
        console.error('[MCP] Broker acknowledged connection');
        break;

      case 'registered':
        this.instanceId = message.instanceId;
        this.isRegistered = true;
        console.error(`[MCP] Registered as "${message.name}" (${this.instanceId})`);
        break;

      case 'new_message':
        console.error(`[MCP] Received message from ${message.message.fromName}`);
        this.pendingMessages.push(message.message);
        break;

      case 'instance_joined':
        console.error(`[MCP] Instance joined: ${message.instance.name}`);
        break;

      case 'error':
        console.error(`[MCP] Broker error: ${message.error}`);
        break;

      default:
        // Store other messages for tool responses
        break;
    }
  }

  sendToBroker(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('Not connected to broker');
    }
  }

  async sendAndWaitForResponse(message, responseType, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws.removeEventListener('message', handler);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      const handler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === responseType) {
            clearTimeout(timeout);
            this.ws.removeEventListener('message', handler);
            resolve(response);
          }
        } catch (error) {
          // Ignore parsing errors
        }
      };

      this.ws.on('message', handler);
      this.sendToBroker(message);
    });
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "linker_register",
          description: "Register this Claude instance with the linker. Usually called automatically, but can be used to update instance information.",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name for this Claude instance (e.g., 'frontend-app', 'backend-api')"
              },
              description: {
                type: "string",
                description: "Description of what this Claude instance is working on"
              }
            },
            required: ["name", "description"]
          }
        },
        {
          name: "linker_send_message",
          description: "Send a message to another Claude instance. Use this to communicate with other Claude Code instances working on related codebases.",
          inputSchema: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Name or ID of the recipient Claude instance"
              },
              content: {
                type: "string",
                description: "The message content to send"
              }
            },
            required: ["to", "content"]
          }
        },
        {
          name: "linker_broadcast",
          description: "Send a message to all connected Claude instances. Useful for announcements or questions to the group.",
          inputSchema: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "The message content to broadcast"
              }
            },
            required: ["content"]
          }
        },
        {
          name: "linker_get_messages",
          description: "Retrieve new messages sent to this Claude instance. Check this regularly to see if other instances have sent you messages.",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "linker_list_instances",
          description: "List all connected Claude instances. Use this to see who you can communicate with.",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "linker_get_conversation",
          description: "Get the conversation history between Claude instances. Useful for catching up on discussions.",
          inputSchema: {
            type: "object",
            properties: {
              with: {
                type: "string",
                description: "Optional: name or ID of specific instance to get conversation with. If omitted, gets all conversations."
              },
              limit: {
                type: "number",
                description: "Maximum number of messages to retrieve (default: 100)"
              }
            }
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "linker_register":
            return await this.handleRegister(args);

          case "linker_send_message":
            return await this.handleSendMessage(args);

          case "linker_broadcast":
            return await this.handleBroadcast(args);

          case "linker_get_messages":
            return await this.handleGetMessages();

          case "linker_list_instances":
            return await this.handleListInstances();

          case "linker_get_conversation":
            return await this.handleGetConversation(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async handleRegister(args) {
    const { name, description } = args;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to broker');
    }

    const response = await this.sendAndWaitForResponse(
      {
        type: 'register',
        payload: {
          name,
          description,
          metadata: { updatedAt: new Date().toISOString() }
        }
      },
      'registered'
    );

    this.instanceId = response.instanceId;
    this.isRegistered = true;

    return {
      content: [
        {
          type: "text",
          text: `Successfully registered as "${name}" (ID: ${this.instanceId})`
        }
      ]
    };
  }

  async handleSendMessage(args) {
    const { to, content } = args;

    if (!this.isRegistered) {
      throw new Error('Not registered with broker. Use linker_register first.');
    }

    this.sendToBroker({
      type: 'send_message',
      payload: { to, content }
    });

    return {
      content: [
        {
          type: "text",
          text: `Message sent to ${to}`
        }
      ]
    };
  }

  async handleBroadcast(args) {
    const { content } = args;

    if (!this.isRegistered) {
      throw new Error('Not registered with broker. Use linker_register first.');
    }

    this.sendToBroker({
      type: 'send_message',
      payload: {
        to: 'broadcast',
        content
      }
    });

    return {
      content: [
        {
          type: "text",
          text: `Message broadcast to all instances`
        }
      ]
    };
  }

  async handleGetMessages() {
    if (!this.isRegistered) {
      throw new Error('Not registered with broker. Use linker_register first.');
    }

    const response = await this.sendAndWaitForResponse(
      { type: 'get_messages' },
      'messages'
    );

    const messages = response.messages || [];

    if (messages.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No new messages"
          }
        ]
      };
    }

    const formattedMessages = messages.map(msg =>
      `From: ${msg.fromName}\nTime: ${msg.timestamp}\nMessage: ${msg.content}\n`
    ).join('\n---\n\n');

    return {
      content: [
        {
          type: "text",
          text: `You have ${messages.length} new message(s):\n\n${formattedMessages}`
        }
      ]
    };
  }

  async handleListInstances() {
    if (!this.isRegistered) {
      throw new Error('Not registered with broker. Use linker_register first.');
    }

    const response = await this.sendAndWaitForResponse(
      { type: 'list_instances' },
      'instances'
    );

    const instances = response.instances || [];

    if (instances.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No instances connected (this shouldn't happen if you're registered!)"
          }
        ]
      };
    }

    const formattedInstances = instances
      .map(inst => `- ${inst.name}: ${inst.description}\n  (ID: ${inst.id}, Last seen: ${inst.lastSeen})`)
      .join('\n');

    return {
      content: [
        {
          type: "text",
          text: `Connected Claude instances:\n\n${formattedInstances}`
        }
      ]
    };
  }

  async handleGetConversation(args) {
    if (!this.isRegistered) {
      throw new Error('Not registered with broker. Use linker_register first.');
    }

    const response = await this.sendAndWaitForResponse(
      {
        type: 'get_conversation',
        payload: args
      },
      'conversation'
    );

    const messages = response.messages || [];

    if (messages.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No conversation history"
          }
        ]
      };
    }

    const formattedMessages = messages.map(msg =>
      `[${msg.timestamp}] ${msg.fromName}: ${msg.content}`
    ).join('\n');

    return {
      content: [
        {
          type: "text",
          text: `Conversation history:\n\n${formattedMessages}`
        }
      ]
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("[MCP] Claude Linker MCP server running");
  }
}

// Start the server
const server = new LinkerMCPServer();
server.start().catch(console.error);
