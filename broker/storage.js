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
      delivered: false
    };
    this.messages.push(messageWithTimestamp);
    return messageWithTimestamp;
  }

  /**
   * Get messages for a specific instance
   */
  getMessagesFor(instanceId, undeliveredOnly = true) {
    return this.messages.filter(msg => {
      const isForInstance = msg.to === instanceId || msg.to === 'broadcast';
      return undeliveredOnly ? (isForInstance && !msg.delivered) : isForInstance;
    });
  }

  /**
   * Mark messages as delivered
   */
  markMessagesDelivered(messageIds) {
    messageIds.forEach(id => {
      const message = this.messages.find(m => m.id === id);
      if (message) {
        message.delivered = true;
      }
    });
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
