# Claude Code Linker - Architecture

This document describes the technical architecture and design decisions of the Claude Code Linker.

## Overview

The Claude Code Linker enables communication between multiple Claude Code instances running in different environments (devcontainers, machines, etc.) using a message broker pattern with MCP (Model Context Protocol) integration.

## Architecture Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Claude Code    │         │  Claude Code    │         │  Claude Code    │
│  Instance 1     │         │  Instance 2     │         │  Instance 3     │
│                 │         │                 │         │                 │
│  ┌───────────┐  │         │  ┌───────────┐  │         │  ┌───────────┐  │
│  │MCP Client │  │         │  │MCP Client │  │         │  │MCP Client │  │
│  └─────┬─────┘  │         │  └─────┬─────┘  │         │  └─────┬─────┘  │
└────────┼────────┘         └────────┼────────┘         └────────┼────────┘
         │ stdio                     │ stdio                     │ stdio
         │                           │                           │
    ┌────▼────┐                 ┌────▼────┐                 ┌────▼────┐
    │   MCP   │                 │   MCP   │                 │   MCP   │
    │  Server │                 │  Server │                 │  Server │
    │Instance1│                 │Instance2│                 │Instance3│
    └────┬────┘                 └────┬────┘                 └────┬────┘
         │ WebSocket                 │ WebSocket                 │ WebSocket
         │                           │                           │
         └───────────────┬───────────┴───────────────┬───────────┘
                         │                           │
                    ┌────▼───────────────────────────▼────┐
                    │     Message Broker (WebSocket)      │
                    │                                      │
                    │  ┌────────────────────────────────┐ │
                    │  │  Connection Manager            │ │
                    │  │  - Track connected instances   │ │
                    │  │  - Handle registration         │ │
                    │  │  - Manage presence             │ │
                    │  └────────────────────────────────┘ │
                    │                                      │
                    │  ┌────────────────────────────────┐ │
                    │  │  Message Router                │ │
                    │  │  - Route direct messages       │ │
                    │  │  - Handle broadcasts           │ │
                    │  │  - Queue messages              │ │
                    │  └────────────────────────────────┘ │
                    │                                      │
                    │  ┌────────────────────────────────┐ │
                    │  │  Storage                       │ │
                    │  │  - Message history             │ │
                    │  │  - Instance metadata           │ │
                    │  │  - Conversation threads        │ │
                    │  └────────────────────────────────┘ │
                    └──────────────────────────────────────┘
```

## Components

### 1. MCP Server (`mcp-server/`)

**Purpose**: Bridges Claude Code with the message broker

**Technology**: Node.js, MCP SDK, WebSocket client

**Responsibilities**:
- Implements MCP protocol for Claude Code integration
- Maintains WebSocket connection to message broker
- Provides tools for Claude to send/receive messages
- Handles automatic registration and reconnection
- Translates between MCP tool calls and broker messages

**Key Features**:
- Stdio transport for MCP communication
- Automatic reconnection with exponential backoff
- Heartbeat for connection health
- Environment-based configuration

**Tools Provided**:
| Tool | Purpose |
|------|---------|
| `linker_register` | Register/update instance identity |
| `linker_send_message` | Send direct message to another instance |
| `linker_broadcast` | Send message to all instances |
| `linker_get_messages` | Retrieve pending messages |
| `linker_list_instances` | List all connected instances |
| `linker_get_conversation` | View conversation history |

### 2. Message Broker (`broker/`)

**Purpose**: Central hub for message routing and persistence

**Technology**: Node.js, WebSocket (ws library)

**Responsibilities**:
- Accept WebSocket connections from MCP servers
- Route messages between instances
- Store message history
- Track instance presence and metadata
- Handle connection lifecycle

**Key Features**:
- Real-time message delivery
- Message queuing for offline instances
- Broadcast support
- Conversation history
- Instance registry

**Message Protocol**:

All messages follow this structure:
```javascript
{
  type: "message_type",
  payload: { /* type-specific data */ }
}
```

**Message Types**:

| Client → Broker | Broker → Client |
|----------------|-----------------|
| `register` | `connected` |
| `send_message` | `registered` |
| `get_messages` | `new_message` |
| `list_instances` | `messages` |
| `get_conversation` | `instances` |
| `heartbeat` | `conversation` |
| | `instance_joined` |
| | `heartbeat_ack` |
| | `error` |

### 3. Storage Layer (`broker/storage.js`)

**Purpose**: In-memory data persistence

**Technology**: JavaScript Map and Array

**Data Structures**:

```javascript
// Instance registry
Map<instanceId, {
  id: string,
  name: string,
  description: string,
  metadata: object,
  registeredAt: ISO8601,
  lastSeen: ISO8601
}>

// Message queue
Array<{
  id: string,
  from: instanceId,
  fromName: string,
  to: instanceId | "broadcast",
  content: string,
  timestamp: ISO8601,
  delivered: boolean
}>
```

**Future Enhancement**: Can be replaced with SQLite, Redis, or PostgreSQL for persistence.

## Communication Flow

### Instance Registration

```
┌──────────┐                ┌──────────┐                ┌────────┐
│  Claude  │                │   MCP    │                │ Broker │
│   Code   │                │  Server  │                │        │
└─────┬────┘                └────┬─────┘                └───┬────┘
      │                          │                          │
      │  Start with MCP config   │                          │
      ├─────────────────────────►│                          │
      │                          │  WebSocket connect       │
      │                          ├─────────────────────────►│
      │                          │                          │
      │                          │  {type: "connected"}     │
      │                          │◄─────────────────────────┤
      │                          │                          │
      │                          │  {type: "register"}      │
      │                          ├─────────────────────────►│
      │                          │                          │
      │                          │  {type: "registered"}    │
      │                          │◄─────────────────────────┤
      │                          │                          │
```

### Sending a Message

```
┌──────────┐                ┌──────────┐                ┌────────┐                ┌──────────┐
│ Claude 1 │                │  MCP 1   │                │ Broker │                │  MCP 2   │
└─────┬────┘                └────┬─────┘                └───┬────┘                └────┬─────┘
      │                          │                          │                          │
      │  Use linker_send_message │                          │                          │
      ├─────────────────────────►│                          │                          │
      │                          │  {type: "send_message"}  │                          │
      │                          ├─────────────────────────►│                          │
      │                          │                          │  Store in queue          │
      │                          │                          │                          │
      │                          │                          │  {type: "new_message"}   │
      │                          │                          ├─────────────────────────►│
      │                          │                          │                          │
      │  "Message sent"          │                          │                          │
      │◄─────────────────────────┤                          │                          │
      │                          │                          │                          │
```

### Retrieving Messages

```
┌──────────┐                ┌──────────┐                ┌────────┐
│ Claude 2 │                │  MCP 2   │                │ Broker │
└─────┬────┘                └────┬─────┘                └───┬────┘
      │                          │                          │
      │  Use linker_get_messages │                          │
      ├─────────────────────────►│                          │
      │                          │  {type: "get_messages"}  │
      │                          ├─────────────────────────►│
      │                          │                          │
      │                          │  {type: "messages"}      │
      │                          │◄─────────────────────────┤
      │                          │                          │
      │  Display messages        │                          │
      │◄─────────────────────────┤                          │
      │                          │                          │
```

## Design Decisions

### Why MCP?

**Decision**: Use Model Context Protocol instead of custom Claude Code integration

**Rationale**:
- Claude Code has native MCP support
- MCP provides standardized tool interface
- Easier to maintain and extend
- Better isolation from Claude Code internals
- Can be used by other AI assistants that support MCP

### Why WebSocket for Broker?

**Decision**: Use WebSocket instead of HTTP polling or gRPC

**Rationale**:
- Real-time bi-directional communication
- Lower latency than polling
- Simpler than gRPC for this use case
- Wide support across languages and platforms
- Easy to tunnel through ngrok

### Why In-Memory Storage?

**Decision**: Start with in-memory storage instead of database

**Rationale**:
- Simpler initial implementation
- Sufficient for v1 with few instances
- Easy to migrate to database later
- Lower operational complexity
- Faster development iteration

**Trade-offs**:
- Messages lost on broker restart
- No persistence across sessions
- Limited scalability

**Future**: Will add SQLite or PostgreSQL option

### Why Broker Pattern vs P2P?

**Decision**: Use central broker instead of peer-to-peer connections

**Rationale**:
- Simpler connection management
- Easier to implement broadcast
- Better for 3+ instances
- Centralized message history
- Simpler presence tracking

**Trade-offs**:
- Single point of failure
- Requires running broker process
- Additional network hop

## Security Considerations

### Current Implementation (v1)

⚠️ **WARNING**: v1 is designed for trusted local networks only

**Current Security Posture**:
- No authentication
- No encryption (unless using wss://)
- No authorization
- No rate limiting
- No input validation beyond JSON parsing

**Acceptable Use Cases**:
- Local development on localhost
- Private devcontainers
- Trusted network with firewall

### Future Security (v2+)

Planned security enhancements:

1. **Authentication**
   - API key or JWT-based auth
   - Per-instance credentials
   - Broker validates all connections

2. **Authorization**
   - Instance-level permissions
   - Message filtering rules
   - Admin vs regular instances

3. **Encryption**
   - TLS/WSS support
   - End-to-end message encryption option
   - Certificate management

4. **Input Validation**
   - Message size limits
   - Content sanitization
   - Rate limiting per instance

5. **Audit Logging**
   - Track all message activity
   - Connection history
   - Security events

## Scalability

### Current Limitations (v1)

- **Instances**: ~10-20 (limited by single broker)
- **Messages**: ~1000s (limited by in-memory storage)
- **Throughput**: ~100 msg/sec (not optimized)
- **Persistence**: None (in-memory only)

### Scaling Strategies (Future)

1. **Horizontal Scaling**
   - Multiple broker instances
   - Load balancer
   - Shared Redis for state

2. **Persistence**
   - SQLite for single-machine
   - PostgreSQL for multi-machine
   - Message TTL and cleanup

3. **Performance**
   - Message batching
   - Compression
   - Binary protocol option

4. **Reliability**
   - Broker clustering
   - Message acknowledgments
   - Delivery guarantees

## Extensibility

The architecture supports these future extensions:

### 1. File Sharing
```javascript
// New tool
linker_send_file({
  to: "instance-name",
  file_path: "/path/to/file",
  description: "Updated API schema"
})
```

### 2. Code Snippets
```javascript
linker_share_code({
  to: "instance-name",
  language: "typescript",
  code: "...",
  description: "Proposed interface"
})
```

### 3. Task Coordination
```javascript
linker_create_task({
  title: "Implement OAuth",
  assignee: "backend-api",
  description: "...",
  deadline: "2024-12-01"
})
```

### 4. Status Tracking
```javascript
linker_update_status({
  status: "working_on",
  description: "Implementing user authentication"
})
```

### 5. Web Dashboard
- Real-time message viewer
- Instance monitoring
- Conversation visualization
- Analytics and insights

## Testing Strategy

### Unit Tests (Future)

- Storage layer operations
- Message routing logic
- Protocol message handling
- Tool implementation

### Integration Tests (Future)

- MCP server ↔ Broker communication
- Multi-instance message flow
- Connection failure recovery
- Broadcast delivery

### Manual Testing (Current)

1. Start broker
2. Configure two Claude Code instances
3. Send messages between them
4. Verify delivery and history
5. Test reconnection

## Deployment Options

### Development (Current)

```
Laptop/Workstation
├── Broker (localhost:8765)
├── Claude Code 1 + MCP Server
└── Claude Code 2 + MCP Server
```

### Multi-Container (Docker)

```
Host Machine
├── Broker Container
├── DevContainer 1
│   └── Claude Code + MCP
└── DevContainer 2
    └── Claude Code + MCP
```

### Remote (ngrok)

```
Machine A (Broker)
└── ngrok → Broker

Machine B
└── Claude Code + MCP → ngrok URL

Machine C
└── Claude Code + MCP → ngrok URL
```

### Cloud (Future)

```
Cloud Provider
├── Load Balancer
├── Broker Cluster
│   ├── Instance 1
│   ├── Instance 2
│   └── Instance 3
├── Redis (state)
└── PostgreSQL (persistence)

↕

Developer Machines
├── Claude Code + MCP → Cloud URL
└── Claude Code + MCP → Cloud URL
```

## Monitoring and Observability

### Current Logging

- Console logs to stderr
- Connection events
- Message activity
- Errors

### Future Observability

1. **Metrics**
   - Message throughput
   - Instance count
   - Connection duration
   - Error rates

2. **Tracing**
   - Message path tracking
   - Latency measurement
   - Performance profiling

3. **Alerting**
   - Connection failures
   - Message delivery failures
   - Broker health

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [WebSocket Protocol (RFC 6455)](https://tools.ietf.org/html/rfc6455)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
