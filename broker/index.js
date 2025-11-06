#!/usr/bin/env node

/**
 * Claude Code Linker - Message Broker
 *
 * Central WebSocket server that routes messages between Claude Code instances
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const Storage = require('./storage');

const PORT = process.env.PORT || 8765;
const HOST = process.env.HOST || '0.0.0.0';

class MessageBroker {
  constructor() {
    this.storage = new Storage();
    this.connections = new Map(); // instanceId -> WebSocket
    this.wss = null;
  }

  start() {
    this.wss = new WebSocket.Server({
      host: HOST,
      port: PORT
    });

    this.wss.on('connection', (ws) => {
      console.log('[BROKER] New connection established');

      // Generate temporary connection ID until instance registers
      const tempId = uuidv4();
      let instanceId = tempId;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          instanceId = this.handleMessage(ws, instanceId, message);
        } catch (error) {
          console.error('[BROKER] Error handling message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log(`[BROKER] Connection closed for instance: ${instanceId}`);
        this.connections.delete(instanceId);
        this.storage.unregisterInstance(instanceId);
      });

      ws.on('error', (error) => {
        console.error(`[BROKER] WebSocket error for ${instanceId}:`, error);
      });

      // Send acknowledgment
      this.sendMessage(ws, {
        type: 'connected',
        connectionId: tempId
      });
    });

    console.log(`[BROKER] Claude Code Linker broker running on ws://${HOST}:${PORT}`);
  }

  handleMessage(ws, currentInstanceId, message) {
    const { type, payload } = message;
    let instanceId = currentInstanceId;

    console.log(`[BROKER] Received ${type} from ${currentInstanceId}`);

    switch (type) {
      case 'register':
        instanceId = this.handleRegister(ws, payload);
        break;

      case 'send_message':
        this.handleSendMessage(currentInstanceId, payload);
        break;

      case 'get_messages':
        this.handleGetMessages(ws, currentInstanceId);
        break;

      case 'list_instances':
        this.handleListInstances(ws);
        break;

      case 'get_conversation':
        this.handleGetConversation(ws, payload);
        break;

      case 'heartbeat':
        this.handleHeartbeat(ws, currentInstanceId);
        break;

      default:
        this.sendError(ws, `Unknown message type: ${type}`);
    }

    return instanceId;
  }

  handleRegister(ws, payload) {
    const { name, description, metadata } = payload;

    // Check if name already exists
    const existingInstance = this.storage.getInstanceByName(name);
    let instanceId;

    if (existingInstance) {
      // Reuse existing instance ID if reconnecting with same name
      instanceId = existingInstance.id;
      console.log(`[BROKER] Instance reconnecting: ${name} (${instanceId})`);
    } else {
      instanceId = uuidv4();
      console.log(`[BROKER] New instance registered: ${name} (${instanceId})`);
    }

    this.connections.set(instanceId, ws);
    this.storage.registerInstance(instanceId, name, description, metadata);

    this.sendMessage(ws, {
      type: 'registered',
      instanceId,
      name
    });

    // Notify other instances about the new registration
    this.broadcastSystemMessage(instanceId, {
      type: 'instance_joined',
      instance: {
        id: instanceId,
        name,
        description
      }
    });

    return instanceId;
  }

  handleSendMessage(fromInstanceId, payload) {
    const { to, content } = payload;

    let actualFromId = fromInstanceId;
    let fromInstance = this.storage.getInstance(fromInstanceId);

    // If sender not found, try to resolve stale connection
    if (!fromInstance) {
      const resolvedId = this.storage.resolveStaleConnectionId(fromInstanceId);
      if (resolvedId) {
        actualFromId = resolvedId;
        fromInstance = this.storage.getInstance(resolvedId);
        console.log(`[BROKER] Resolved stale sender ID ${fromInstanceId} to ${resolvedId}`);

        // Send error back to the sender to trigger re-registration
        const senderWs = this.connections.get(resolvedId);
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
          this.sendError(senderWs, 'Connection ID was stale and has been updated. Please re-register if you see this message repeatedly.');
        }
      } else {
        console.error(`[BROKER] Unknown sender: ${fromInstanceId} (could not resolve to current connection)`);
        return;
      }
    }

    let toInstanceId;
    if (to === 'broadcast') {
      toInstanceId = 'broadcast';
    } else {
      // Support sending by name or ID
      const toInstance = this.storage.getInstanceByName(to) || this.storage.getInstance(to);
      if (!toInstance) {
        console.error(`[BROKER] Unknown recipient: ${to}`);
        return;
      }
      toInstanceId = toInstance.id;
    }

    const message = this.storage.storeMessage({
      id: uuidv4(),
      from: actualFromId,
      fromName: fromInstance.name,
      to: toInstanceId,
      content
    });

    console.log(`[BROKER] Message from ${fromInstance.name} to ${toInstanceId === 'broadcast' ? 'all' : to}`);

    // Try to deliver immediately
    if (toInstanceId === 'broadcast') {
      this.deliverBroadcast(message, actualFromId);
    } else {
      this.deliverMessage(toInstanceId, message);
    }
  }

  handleGetMessages(ws, instanceId) {
    const messages = this.storage.getMessagesFor(instanceId, true);

    this.sendMessage(ws, {
      type: 'messages',
      messages: messages.map(({ id, from, fromName, content, timestamp }) => ({
        id,
        from,
        fromName,
        content,
        timestamp
      }))
    });

    // Mark as delivered
    this.storage.markMessagesDelivered(messages.map(m => m.id));
  }

  handleListInstances(ws) {
    const instances = this.storage.getInstances();

    this.sendMessage(ws, {
      type: 'instances',
      instances: instances.map(({ id, name, description, registeredAt, lastSeen }) => ({
        id,
        name,
        description,
        registeredAt,
        lastSeen
      }))
    });
  }

  handleGetConversation(ws, payload) {
    const { limit = 100, with: withInstance } = payload || {};

    let conversation;
    if (withInstance) {
      const instance = this.storage.getInstanceByName(withInstance) ||
                      this.storage.getInstance(withInstance);
      if (instance) {
        conversation = this.storage.getConversationBetween(
          payload.instanceId,
          instance.id,
          limit
        );
      } else {
        conversation = [];
      }
    } else {
      conversation = this.storage.getConversation(limit);
    }

    this.sendMessage(ws, {
      type: 'conversation',
      messages: conversation
    });
  }

  handleHeartbeat(ws, instanceId) {
    this.storage.updateInstanceLastSeen(instanceId);
    this.sendMessage(ws, { type: 'heartbeat_ack' });
  }

  deliverMessage(toInstanceId, message) {
    const ws = this.connections.get(toInstanceId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      this.sendMessage(ws, {
        type: 'new_message',
        message: {
          id: message.id,
          from: message.from,
          fromName: message.fromName,
          content: message.content,
          timestamp: message.timestamp
        }
      });
    }
  }

  deliverBroadcast(message, excludeInstanceId) {
    this.connections.forEach((ws, instanceId) => {
      if (instanceId !== excludeInstanceId && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, {
          type: 'new_message',
          message: {
            id: message.id,
            from: message.from,
            fromName: message.fromName,
            content: message.content,
            timestamp: message.timestamp,
            broadcast: true
          }
        });
      }
    });
  }

  broadcastSystemMessage(excludeInstanceId, message) {
    this.connections.forEach((ws, instanceId) => {
      if (instanceId !== excludeInstanceId && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    });
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, error) {
    this.sendMessage(ws, {
      type: 'error',
      error
    });
  }
}

// Start the broker
const broker = new MessageBroker();
broker.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[BROKER] Shutting down...');
  broker.wss.close(() => {
    console.log('[BROKER] Server closed');
    process.exit(0);
  });
});
