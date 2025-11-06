/**
 * Simple in-memory storage for messages and conversation history
 * Can be extended to use SQLite or other persistence layer
 */

class Storage {
  constructor() {
    this.messages = [];
    this.instances = new Map();
    this.conversations = new Map();
  }

  /**
   * Register a new Claude instance
   */
  registerInstance(instanceId, name, description, metadata = {}) {
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
  }
}

module.exports = Storage;
