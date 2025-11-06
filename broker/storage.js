/**
 * Simple in-memory storage for messages and conversation history
 * Can be extended to use SQLite or other persistence layer
 */

class Storage {
  constructor() {
    this.messages = [];
    this.instances = new Map(); // instanceId -> instance data
    this.conversations = new Map();
    this.connectionHistory = new Map(); // name -> { currentId, previousIds: [{id, disconnectedAt}] }
    this.disconnectionGracePeriod = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Register a new Claude instance
   * Handles reconnections by tracking connection history
   */
  registerInstance(instanceId, name, description, metadata = {}) {
    // Check if this name was previously registered
    const history = this.connectionHistory.get(name);

    if (history && history.currentId && history.currentId !== instanceId) {
      // Previous connection exists, mark it as disconnected
      const now = new Date().toISOString();
      history.previousIds = history.previousIds || [];
      history.previousIds.push({
        id: history.currentId,
        disconnectedAt: now
      });

      // Clean up old previous IDs outside grace period
      history.previousIds = history.previousIds.filter(prev => {
        const disconnectTime = new Date(prev.disconnectedAt).getTime();
        return (Date.now() - disconnectTime) < this.disconnectionGracePeriod;
      });

      console.log(`[STORAGE] Instance "${name}" reconnecting with new ID ${instanceId} (old: ${history.currentId})`);
    }

    // Update connection history
    this.connectionHistory.set(name, {
      currentId: instanceId,
      previousIds: history?.previousIds || []
    });

    // Register the instance
    this.instances.set(instanceId, {
      id: instanceId,
      name,
      description,
      metadata,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    });
  }

  /**
   * Update instance last seen timestamp
   */
  updateInstanceLastSeen(instanceId) {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.lastSeen = new Date().toISOString();
    }
  }

  /**
   * Unregister an instance
   */
  unregisterInstance(instanceId) {
    this.instances.delete(instanceId);
  }

  /**
   * Get all registered instances
   */
  getInstances() {
    return Array.from(this.instances.values());
  }

  /**
   * Get a specific instance by ID
   */
  getInstance(instanceId) {
    return this.instances.get(instanceId);
  }

  /**
   * Get an instance by name
   */
  getInstanceByName(name) {
    return Array.from(this.instances.values()).find(i => i.name === name);
  }

  /**
   * Try to resolve a stale connection ID to the current one
   * Returns the current instance ID if the given ID is recently disconnected
   */
  resolveStaleConnectionId(staleId) {
    // Search through connection history to find if this ID recently disconnected
    for (const [name, history] of this.connectionHistory.entries()) {
      if (history.previousIds) {
        const recentDisconnect = history.previousIds.find(prev => {
          if (prev.id !== staleId) return false;
          const disconnectTime = new Date(prev.disconnectedAt).getTime();
          return (Date.now() - disconnectTime) < this.disconnectionGracePeriod;
        });

        if (recentDisconnect && history.currentId) {
          const instance = this.instances.get(history.currentId);
          if (instance) {
            console.log(`[STORAGE] Resolved stale connection ${staleId} to current ${history.currentId} for "${name}"`);
            return history.currentId;
          }
        }
      }
    }
    return null;
  }

  /**
   * Get connection history for debugging
   */
  getConnectionHistory(name) {
    return this.connectionHistory.get(name);
  }

  /**
   * Store a message
   */
  storeMessage(message) {
    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
      status: 'sent', // sent, delivered, read
      delivered: false, // Legacy compatibility
      deliveredAt: null,
      readAt: null,
      expiresAt: message.ttl ? new Date(Date.now() + message.ttl).toISOString() : null,
      priority: message.priority || 'normal', // high, normal, low
      retryCount: 0,
      maxRetries: message.maxRetries || 3
    };
    this.messages.push(messageWithTimestamp);
    return messageWithTimestamp;
  }

  /**
   * Get messages for a specific instance
   * Filters out expired messages
   */
  getMessagesFor(instanceId, undeliveredOnly = true) {
    const now = Date.now();

    return this.messages.filter(msg => {
      // Check if message is expired
      if (msg.expiresAt && new Date(msg.expiresAt).getTime() < now) {
        return false;
      }

      const isForInstance = msg.to === instanceId || msg.to === 'broadcast';
      return undeliveredOnly ? (isForInstance && msg.status === 'sent') : isForInstance;
    }).sort((a, b) => {
      // Sort by priority: high > normal > low
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Mark messages as delivered
   */
  markMessagesDelivered(messageIds) {
    const now = new Date().toISOString();
    messageIds.forEach(id => {
      const message = this.messages.find(m => m.id === id);
      if (message) {
        message.delivered = true; // Legacy
        message.status = 'delivered';
        message.deliveredAt = now;
      }
    });
    return messageIds;
  }

  /**
   * Mark messages as read
   */
  markMessagesRead(messageIds) {
    const now = new Date().toISOString();
    const marked = [];

    messageIds.forEach(id => {
      const message = this.messages.find(m => m.id === id);
      if (message) {
        message.status = 'read';
        message.readAt = now;
        marked.push({
          id: message.id,
          from: message.from,
          to: message.to
        });
      }
    });

    return marked;
  }

  /**
   * Get message by ID
   */
  getMessage(messageId) {
    return this.messages.find(m => m.id === messageId);
  }

  /**
   * Update message status
   */
  updateMessageStatus(messageId, status) {
    const message = this.messages.find(m => m.id === messageId);
    if (message) {
      message.status = status;
      if (status === 'delivered' && !message.deliveredAt) {
        message.deliveredAt = new Date().toISOString();
        message.delivered = true; // Legacy
      } else if (status === 'read' && !message.readAt) {
        message.readAt = new Date().toISOString();
      }
      return message;
    }
    return null;
  }

  /**
   * Get delivery receipts for messages sent by an instance
   */
  getDeliveryReceipts(fromInstanceId) {
    return this.messages
      .filter(m => m.from === fromInstanceId)
      .map(({ id, to, status, deliveredAt, readAt, timestamp }) => ({
        id,
        to,
        status,
        sentAt: timestamp,
        deliveredAt,
        readAt
      }));
  }

  /**
   * Clean up expired messages
   */
  cleanupExpiredMessages() {
    const now = Date.now();
    const before = this.messages.length;

    this.messages = this.messages.filter(msg => {
      if (!msg.expiresAt) return true;
      return new Date(msg.expiresAt).getTime() >= now;
    });

    const removed = before - this.messages.length;
    if (removed > 0) {
      console.log(`[STORAGE] Cleaned up ${removed} expired messages`);
    }
    return removed;
  }

  /**
   * Get message queue statistics
   */
  getMessageStats() {
    const stats = {
      total: this.messages.length,
      byStatus: { sent: 0, delivered: 0, read: 0 },
      byPriority: { high: 0, normal: 0, low: 0 },
      expired: 0,
      avgDeliveryTime: 0
    };

    const deliveryTimes = [];
    const now = Date.now();

    this.messages.forEach(msg => {
      stats.byStatus[msg.status] = (stats.byStatus[msg.status] || 0) + 1;
      stats.byPriority[msg.priority] = (stats.byPriority[msg.priority] || 0) + 1;

      if (msg.expiresAt && new Date(msg.expiresAt).getTime() < now) {
        stats.expired++;
      }

      if (msg.deliveredAt) {
        const sentTime = new Date(msg.timestamp).getTime();
        const deliveredTime = new Date(msg.deliveredAt).getTime();
        deliveryTimes.push(deliveredTime - sentTime);
      }
    });

    if (deliveryTimes.length > 0) {
      stats.avgDeliveryTime = Math.round(
        deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      );
    }

    return stats;
  }

  /**
   * Get conversation history
   */
  getConversation(limit = 100) {
    return this.messages
      .slice(-limit)
      .map(({ id, from, to, content, timestamp }) => ({
        id,
        from,
        to,
        content,
        timestamp
      }));
  }

  /**
   * Get conversation between two instances
   */
  getConversationBetween(instanceId1, instanceId2, limit = 100) {
    return this.messages
      .filter(msg =>
        (msg.from === instanceId1 && msg.to === instanceId2) ||
        (msg.from === instanceId2 && msg.to === instanceId1)
      )
      .slice(-limit)
      .map(({ id, from, to, content, timestamp }) => ({
        id,
        from,
        to,
        content,
        timestamp
      }));
  }

  /**
   * Clear all data (for testing)
   */
  clear() {
    this.messages = [];
    this.instances.clear();
    this.conversations.clear();
    this.connectionHistory.clear();
  }
}



module.exports = Storage;
