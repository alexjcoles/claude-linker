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
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 10000; // 10 seconds

class LinkerMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "claude-linker",
        version: "1.2.0",
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
    this.deliveryReceipts = new Map(); // messageId -> receipt
    this.readReceipts = new Map(); // messageId -> receipt
    this.isRegistered = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.lastHeartbeat = null;
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, registered

    this.setupToolHandlers();
    this.connectToBroker();
  }

  connectToBroker() {
    console.error(`[MCP] Connecting to broker at ${BROKER_URL}...`);
    this.connectionState = 'connecting';

    // Clean up old connection if exists
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
    }

    // Clear old heartbeat
    this.stopHeartbeat();

    this.ws = new WebSocket(BROKER_URL);

    this.ws.on('open', () => {
      console.error('[MCP] Connected to broker');
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;

      // Clear old instance ID to force re-registration
      const oldInstanceId = this.instanceId;
      this.instanceId = null;
      this.isRegistered = false;

      if (oldInstanceId) {
        console.error(`[MCP] Previous connection ID ${oldInstanceId} invalidated, will re-register`);
      }

      // Auto-register this instance
      this.registerInstance();

      // Start heartbeat
      this.startHeartbeat();
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
      this.connectionState = 'disconnected';
      this.isRegistered = false;
      this.stopHeartbeat();
      this.attemptReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('[MCP] WebSocket error:', error.message);
      this.connectionState = 'disconnected';
    });

    // Setup ping/pong for connection health
    this.ws.on('ping', () => {
      this.lastHeartbeat = Date.now();
    });

    this.ws.on('pong', () => {
      this.lastHeartbeat = Date.now();
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = null;
      }
    });
  }

  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    this.lastHeartbeat = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send ping to broker
        this.ws.ping();

        // Set timeout for pong response
        this.heartbeatTimeout = setTimeout(() => {
          console.error('[MCP] Heartbeat timeout - connection appears stale');
          this.handleStaleConnection();
        }, HEARTBEAT_TIMEOUT);

        // Also send application-level heartbeat
        try {
          this.sendToBroker({ type: 'heartbeat' });
        } catch (error) {
          console.error('[MCP] Failed to send heartbeat:', error.message);
        }
      } else {
        console.error('[MCP] Connection not open, stopping heartbeat');
        this.stopHeartbeat();
      }
    }, HEARTBEAT_INTERVAL);

    console.error('[MCP] Heartbeat started');
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  handleStaleConnection() {
    console.error('[MCP] Detected stale connection, triggering reconnection...');
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.error(`[MCP] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
      setTimeout(() => this.connectToBroker(), delay);
    } else {
      console.error('[MCP] Max reconnection attempts reached - please restart the MCP server');
      this.connectionState = 'failed';
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
        this.connectionState = 'registered';
        console.error(`[MCP] Registered as "${message.name}" (${this.instanceId})`);
        break;

      case 'new_message':
        console.error(`[MCP] Received message from ${message.message.fromName}`);
        this.pendingMessages.push(message.message);
        break;

      case 'instance_joined':
        console.error(`[MCP] Instance joined: ${message.instance.name}`);
        break;

      case 'heartbeat_ack':
        // Heartbeat acknowledged
        this.lastHeartbeat = Date.now();
        break;

      case 'delivery_receipt':
        // Message was delivered to recipient
        console.error(`[MCP] Delivery receipt: message ${message.receipt.messageId} ${message.receipt.status}`);
        this.deliveryReceipts.set(message.receipt.messageId, message.receipt);
        break;

      case 'read_receipt':
        // Message was read by recipient
        console.error(`[MCP] Read receipt: message ${message.receipt.messageId} read by ${message.receipt.to}`);
        this.readReceipts.set(message.receipt.messageId, message.receipt);
        break;

      case 'error':
        console.error(`[MCP] Broker error: ${message.error}`);

        // Check if error is due to unknown sender (stale connection)
        if (message.error && message.error.includes('Unknown sender')) {
          console.error('[MCP] Connection ID not recognized by broker - re-registering...');
          this.isRegistered = false;
          this.instanceId = null;
          this.registerInstance();
        }
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
          description: "Send a message to another Claude instance. Use this to communicate with other Claude Code instances working on related codebases. Supports priority and expiration.",
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
              },
              priority: {
                type: "string",
                enum: ["high", "normal", "low"],
                description: "Message priority (default: normal). High-priority messages are delivered first."
              },
              ttl: {
                type: "number",
                description: "Time to live in milliseconds. Message expires after this time (optional)."
              },
              maxRetries: {
                type: "number",
                description: "Maximum delivery retry attempts (default: 3)"
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
        },
        {
          name: "linker_status",
          description: "Check the connection status and health of this Claude instance's connection to the broker. Use this to troubleshoot connection issues.",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "linker_mark_read",
          description: "Mark messages as read. Sends read receipts to the senders. Use this after you've processed messages to let senders know you've seen them.",
          inputSchema: {
            type: "object",
            properties: {
              messageIds: {
                type: "array",
                items: { type: "string" },
                description: "Array of message IDs to mark as read"
              }
            },
            required: ["messageIds"]
          }
        },
        {
          name: "linker_get_receipts",
          description: "Get delivery and read receipts for messages you've sent. Check if your messages were delivered and read.",
          inputSchema: {
            type: "object",
            properties: {
              messageId: {
                type: "string",
                description: "Optional: specific message ID to get receipt for. If omitted, gets all recent receipts."
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

          case "linker_status":
            return await this.handleStatus();

          case "linker_mark_read":
            return await this.handleMarkRead(args);

          case "linker_get_receipts":
            return await this.handleGetReceipts(args);

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
    const { to, content, priority, ttl, maxRetries } = args;

    if (!this.isRegistered) {
      throw new Error('Not registered with broker. Use linker_register first.');
    }

    const payload = { to, content };
    if (priority) payload.priority = priority;
    if (ttl) payload.ttl = ttl;
    if (maxRetries) payload.maxRetries = maxRetries;

    this.sendToBroker({
      type: 'send_message',
      payload
    });

    let statusText = `Message sent to ${to}`;
    if (priority && priority !== 'normal') {
      statusText += ` (priority: ${priority})`;
    }
    if (ttl) {
      statusText += ` (expires in ${ttl / 1000}s)`;
    }

    return {
      content: [
        {
          type: "text",
          text: statusText
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

  async handleMarkRead(args) {
    const { messageIds } = args;

    if (!this.isRegistered) {
      throw new Error('Not registered with broker. Use linker_register first.');
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      throw new Error('messageIds must be a non-empty array');
    }

    const response = await this.sendAndWaitForResponse(
      {
        type: 'mark_read',
        payload: { messageIds }
      },
      'marked_read'
    );

    return {
      content: [
        {
          type: "text",
          text: `Marked ${response.count} message(s) as read. Read receipts sent to senders.`
        }
      ]
    };
  }

  async handleGetReceipts(args) {
    const { messageId } = args || {};

    if (!this.isRegistered) {
      throw new Error('Not registered with broker. Use linker_register first.');
    }

    if (messageId) {
      // Get receipt for specific message
      const delivery = this.deliveryReceipts.get(messageId);
      const read = this.readReceipts.get(messageId);

      if (!delivery && !read) {
        return {
          content: [
            {
              type: "text",
              text: `No receipt found for message ${messageId}`
            }
          ]
        };
      }

      const receiptInfo = [];
      if (delivery) {
        receiptInfo.push(`Delivered to ${delivery.to} at ${delivery.deliveredAt}`);
      }
      if (read) {
        receiptInfo.push(`Read by ${read.to} at ${read.readAt}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Receipt for message ${messageId}:\n${receiptInfo.join('\n')}`
          }
        ]
      };
    } else {
      // Get all receipts
      const deliveryCount = this.deliveryReceipts.size;
      const readCount = this.readReceipts.size;

      if (deliveryCount === 0 && readCount === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No receipts available. Receipts appear after your messages are delivered/read."
            }
          ]
        };
      }

      const receipts = [];

      // Format delivery receipts
      this.deliveryReceipts.forEach((receipt, msgId) => {
        receipts.push(`Message ${msgId.substring(0, 8)}: Delivered to ${receipt.to} at ${receipt.deliveredAt}`);
      });

      // Format read receipts
      this.readReceipts.forEach((receipt, msgId) => {
        receipts.push(`Message ${msgId.substring(0, 8)}: Read by ${receipt.to} at ${receipt.readAt}`);
      });

      return {
        content: [
          {
            type: "text",
            text: `Recent receipts (${deliveryCount} delivered, ${readCount} read):\n\n${receipts.join('\n')}`
          }
        ]
      };
    }
  }

  async handleStatus() {
    const wsState = this.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.ws.readyState] : 'NO_CONNECTION';
    const timeSinceHeartbeat = this.lastHeartbeat ? Date.now() - this.lastHeartbeat : null;

    let statusEmoji = '🔴';
    let statusText = 'Disconnected';

    if (this.connectionState === 'registered') {
      statusEmoji = '🟢';
      statusText = 'Connected and Registered';
    } else if (this.connectionState === 'connected') {
      statusEmoji = '🟡';
      statusText = 'Connected (not registered)';
    } else if (this.connectionState === 'connecting') {
      statusEmoji = '🟡';
      statusText = 'Connecting...';
    } else if (this.connectionState === 'failed') {
      statusEmoji = '🔴';
      statusText = 'Connection Failed';
    }

    const statusInfo = [
      `${statusEmoji} Status: ${statusText}`,
      ``,
      `Connection Details:`,
      `- State: ${this.connectionState}`,
      `- WebSocket: ${wsState}`,
      `- Broker URL: ${BROKER_URL}`,
      `- Instance Name: ${INSTANCE_NAME}`,
      `- Instance ID: ${this.instanceId || 'Not registered'}`,
      `- Registered: ${this.isRegistered ? 'Yes' : 'No'}`,
      ``,
      `Health:`,
      `- Last heartbeat: ${timeSinceHeartbeat !== null ? `${Math.floor(timeSinceHeartbeat / 1000)}s ago` : 'Never'}`,
      `- Reconnect attempts: ${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
      `- Pending messages: ${this.pendingMessages.length}`
    ].join('\n');

    let recommendation = '';
    if (this.connectionState === 'disconnected' || this.connectionState === 'failed') {
      recommendation = '\n\nRecommendation: Connection is down. The MCP server should automatically reconnect. If the issue persists, check that the broker is running and accessible.';
    } else if (!this.isRegistered && this.connectionState === 'connected') {
      recommendation = '\n\nRecommendation: Connected but not registered. Registration should happen automatically. If this persists, try using linker_register manually.';
    } else if (timeSinceHeartbeat && timeSinceHeartbeat > HEARTBEAT_INTERVAL * 2) {
      recommendation = '\n\nWarning: Heartbeat is overdue. Connection may be stale. Automatic reconnection should trigger soon.';
    }

    return {
      content: [
        {
          type: "text",
          text: statusInfo + recommendation
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
