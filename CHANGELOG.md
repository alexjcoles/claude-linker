# Changelog

All notable changes to Claude Code Linker will be documented in this file.

## [1.3.0] - 2025-11-07

### Added

#### Automatic Message Notification System
- **Push notifications** - Real-time message awareness for Claude
  - WebSocket push notifications when new messages arrive
  - Instant awareness without manual checking
  - Non-intrusive notification footer appended to tool responses
- **Pending notification tracking** - MCP server tracks unread messages
  - Maintains list of pending notifications
  - Groups notifications by sender
  - Highlights high-priority messages
  - Shows message preview (first 100 characters)
- **Fallback polling mechanism** - Ensures notifications aren't missed
  - Polls broker every 30 seconds for message count
  - Lightweight `get_message_count` endpoint
  - Catches notifications missed due to WebSocket issues
  - Silent failure (no log spam)
- **Smart notification display** - Context-aware notification presentation
  - Footer appended to all tool responses except `linker_get_messages`
  - Shows total unread count and high-priority count
  - Groups messages by sender with counts
  - Automatically clears when messages are retrieved
  - Example: "📬 **You have 3 unread message(s)** (1 high priority!) from: alice (2), bob"

#### Broker Enhancements
- **New handler: `handleGetMessageCount`** - Lightweight message count query
  - Returns message count without fetching full content
  - Provides sender names list
  - Includes high-priority count
  - Used by fallback polling mechanism
- **Enhanced message delivery** - Dual notification system
  - Sends both `new_message` (full content) and `message_notification` (metadata)
  - `message_notification` includes preview, priority, timestamp
  - Supports both direct messages and broadcasts
  - Non-blocking delivery

#### MCP Server Enhancements
- **Notification state management** - Tracks pending notifications
  - `pendingNotifications` array for unread message metadata
  - Automatic clearing when messages are retrieved
  - Persistence across tool calls
- **New method: `startNotificationPolling()`** - Fallback polling
  - Starts polling on connection open
  - 30-second interval
  - Stops on disconnection
  - Resumes on reconnection
- **New method: `getPendingNotificationSummary()`** - Format notifications
  - Generates user-friendly notification text
  - Groups by sender with counts
  - Highlights high-priority messages
  - Includes emoji indicators
- **New method: `appendNotificationToResponse()`** - Inject notifications
  - Appends notification footer to tool responses
  - Only for tools other than `linker_get_messages`
  - Non-destructive (appends to existing text)
- **New message handlers** - WebSocket message types
  - `message_notification`: Push notification from broker
  - `message_count`: Polling response with counts
- **Enhanced `handleGetMessages()`** - Auto-clear notifications
  - Calls `clearPendingNotifications()` after retrieving messages
  - Prevents duplicate notifications
  - Logs cleared count

### Changed

#### User Experience
- **Proactive message awareness** - Claude now knows about messages without prompting
  - Before: User must manually ask Claude to check messages
  - After: Claude sees notification footer on every tool response
  - Reduces interruption and improves workflow
- **Non-intrusive notifications** - Appears as footer, not interruption
  - Doesn't interrupt current task
  - Always visible but not distracting
  - Clears automatically when messages are read

#### Protocol
- New broker message type: `message_notification`
- New broker message type: `message_count`
- New broker request type: `get_message_count`

#### Version Numbers
- Broker: 1.2.0 → 1.3.0
- MCP Server: 1.2.0 → 1.3.0

### Performance

- **Reduced unnecessary message fetching** - Count-only queries
  - Lightweight polling doesn't fetch full message content
  - Reduces bandwidth and processing
  - Faster response times
- **Efficient notification tracking** - In-memory array
  - Fast append and clear operations
  - Minimal memory footprint
  - No persistence overhead

### Compatibility

- **Fully backward compatible** with v1.2.0
- No configuration changes required
- Existing tools work unchanged
- Old brokers work with new MCP servers (without notifications)
- New brokers work with old MCP servers (notifications ignored)

## [1.2.0] - 2025-11-06

### Added

#### Message Delivery Confirmation
- **Delivery receipts** - Automatic confirmation when messages are delivered
  - Sent automatically when recipient calls `linker_get_messages`
  - Real-time delivery notifications to senders
  - Track delivery status per message
- **Read receipts** - Confirmation when messages are read
  - New `linker_mark_read` tool to mark messages as read
  - Automatic read receipt delivery to senders
  - Distinguish between delivered and read status
- **Receipt tracking** - New `linker_get_receipts` tool
  - View delivery and read status of sent messages
  - Get receipts for specific messages or all recent messages
  - Shows timestamp for delivery and read events

#### Message Queue Improvements
- **Priority support** - Three priority levels for messages
  - High priority messages delivered first
  - Normal priority (default)
  - Low priority for non-urgent messages
  - Priority sorting in queue
- **Message expiration (TTL)** - Time-to-live for messages
  - Set expiration time in milliseconds
  - Automatic cleanup of expired messages
  - Prevents stale message delivery
- **Automatic cleanup** - Periodic cleanup of expired messages
  - Runs every 5 minutes
  - Removes messages past their TTL
  - Keeps message queue lean
- **Enhanced message states** - Comprehensive status tracking
  - States: sent, delivered, read
  - Timestamp tracking for each state transition
  - Better visibility into message lifecycle

#### Web Dashboard
- **Real-time monitoring interface** - New web-based dashboard
  - Single HTML file, no build required
  - Dark theme optimized for monitoring
  - Responsive design
- **Live statistics display**
  - Total, delivered, and read message counts
  - Message priority distribution
  - Average delivery time metrics
  - Connected instance count
- **Instance monitoring**
  - List of all connected Claude instances
  - Instance descriptions and metadata
  - Last seen timestamps
  - Filters out dashboard connections
- **Activity feed**
  - Real-time message activity log
  - Delivery and read receipt tracking
  - Color-coded message types
  - Priority indicators
  - Keeps last 100 messages

#### MCP Server Enhancements
- **New tool: `linker_mark_read`** - Mark messages as read
  - Accepts array of message IDs
  - Sends read receipts to senders
  - Updates message status in broker
- **New tool: `linker_get_receipts`** - View delivery receipts
  - Get receipts for specific message or all messages
  - Shows delivery and read timestamps
  - Helps track message confirmation
- **Enhanced `linker_send_message`** - Additional parameters
  - `priority`: Set message priority (high/normal/low)
  - `ttl`: Time to live in milliseconds
  - `maxRetries`: Maximum delivery attempts
  - Backward compatible (all parameters optional)
- **Receipt storage** - In-memory receipt tracking
  - Separate maps for delivery and read receipts
  - Automatic receipt collection
  - Available via `linker_get_receipts`

#### Broker Enhancements
- **New handler: `handleMarkRead`** - Process read confirmations
  - Marks messages as read in storage
  - Sends read receipts to senders
  - Returns confirmation count
- **New handler: `handleGetReceipts`** - Provide receipt information
  - Returns delivery receipts for sender's messages
  - Includes status and timestamps
- **New handler: `handleGetStats`** - Provide system statistics
  - Message counts by status
  - Message counts by priority
  - Average delivery time
  - Instance statistics
- **Enhanced message storage** - Rich message metadata
  - Priority field with sorting
  - TTL with automatic expiration
  - Status tracking (sent/delivered/read)
  - Timestamps for all state changes
  - Retry count and max retries
- **Periodic cleanup** - Automatic maintenance
  - Cleanup interval every 5 minutes
  - Removes expired messages
  - Logs cleanup activity
- **Graceful shutdown** - Clean termination
  - Clears cleanup interval
  - Closes WebSocket server properly

### Changed

#### Message Format
- Messages now include `priority` field
- Delivery includes priority in all messages
- Backward compatible with v1.1.0 clients

#### Storage Layer
- Messages use status instead of simple delivered boolean
- Additional fields: deliveredAt, readAt, expiresAt, priority
- Legacy `delivered` field maintained for compatibility
- New methods: markMessagesRead, updateMessageStatus, getDeliveryReceipts
- Enhanced getMessagesFor with expiration filtering and priority sorting

#### Version Numbers
- Broker: 1.1.0 → 1.2.0
- MCP Server: 1.1.0 → 1.2.0

### Performance

- **Message queue optimization** - Priority-based delivery
- **Automatic cleanup** - Prevents memory growth from expired messages
- **Efficient receipt tracking** - In-memory maps for fast lookups

### Documentation

- Updated README.md with v1.2.0 features
- Added dashboard/README.md
- Updated USAGE.md with new tools
- Updated directory structure documentation

## [1.1.0] - 2025-11-06

### Added

#### MCP Server
- **Heartbeat mechanism** to detect stale connections
  - Sends ping/pong every 30 seconds
  - Detects connection health issues proactively
  - Automatically triggers reconnection on timeout
- **Enhanced connection state tracking**
  - New `connectionState` property (disconnected, connecting, connected, registered, failed)
  - Better visibility into connection lifecycle
- **Automatic connection ID invalidation**
  - Clears old instance ID on reconnection
  - Forces re-registration with broker after reconnect
  - Prevents stale connection ID errors
- **Error handling for stale connections**
  - Detects "Unknown sender" errors from broker
  - Automatically triggers re-registration
  - Logs clear messages for debugging
- **New tool: `linker_status`**
  - Check connection health and status
  - View heartbeat timing
  - Get troubleshooting recommendations
  - Monitor reconnection attempts

#### Broker
- **Connection ID mapping with grace period**
  - Tracks connection history per instance name
  - Maintains previous connection IDs for 5 minutes
  - Automatically resolves stale connection IDs to current ones
  - Prevents "Unknown sender" errors during session resume
- **Enhanced storage layer**
  - New `connectionHistory` map tracking instance reconnections
  - `resolveStaleConnectionId()` method for stale connection resolution
  - Automatic cleanup of expired connection history
- **Better error handling**
  - Informative error messages when resolving stale connections
  - Logs connection state transitions
  - Notifies clients when connection ID is updated

#### Documentation
- **TROUBLESHOOTING.md** - Comprehensive troubleshooting guide
  - Connection issues
  - Configuration problems
  - Session resume issues
  - Network debugging
  - Common error messages
- **CHANGELOG.md** - Version history and changes

### Changed

#### MCP Server
- Increased `maxReconnectAttempts` from 5 to 10
- Version bumped to 1.1.0
- Improved reconnection logic with proper cleanup
- Enhanced logging with clearer connection state messages
- Better WebSocket cleanup on reconnection

#### Broker
- Version bumped to 1.1.0
- Modified `handleSendMessage` to resolve stale connection IDs
- Enhanced instance registration to track reconnections
- Improved logging for connection lifecycle events

### Fixed

#### Major Fixes
- **Session Resume Issue** (#1)
  - Fixed "Unknown sender" errors when Claude Code sessions are resumed
  - MCP server now properly detects and handles stale connections
  - Broker resolves stale connection IDs within grace period
  - Automatic re-registration after connection state changes

#### MCP Server
- Connection state not properly reset on reconnection
- Heartbeat not starting after connection established
- Old WebSocket listeners not being cleaned up
- Reconnection attempts continuing even after successful reconnection

#### Broker
- Connection ID not recognized after broker restart
- Instances with same name not being handled correctly on reconnection
- Stale messages being sent from expired connection IDs

### Performance

- **Reduced reconnection delay** - More aggressive reconnection for better user experience
- **Heartbeat optimization** - Efficient ping/pong with timeout handling
- **Memory management** - Automatic cleanup of old connection history

## [1.0.0] - 2025-11-06

### Added

#### Initial Release
- **Message Broker** - WebSocket server for routing messages between Claude instances
- **MCP Server** - Model Context Protocol integration for Claude Code
- **Basic Tools**:
  - `linker_register` - Register Claude instance
  - `linker_send_message` - Send direct messages
  - `linker_broadcast` - Broadcast to all instances
  - `linker_get_messages` - Retrieve messages
  - `linker_list_instances` - List connected instances
  - `linker_get_conversation` - View conversation history
- **Storage Layer** - In-memory message and instance storage
- **Connection Management** - WebSocket connection handling with basic reconnection
- **Documentation**:
  - README.md - Project overview and quick start
  - SETUP.md - Detailed installation guide
  - USAGE.md - Usage examples and workflows
  - ARCHITECTURE.md - Technical architecture
  - QUICKSTART.md - 5-minute setup guide
- **Examples** - Sample configuration files
- **Setup Script** - Automated installation script

### Features
- Real-time message delivery
- Message queuing for offline instances
- Broadcast support
- Conversation history
- Instance registry
- Automatic registration
- Basic reconnection with exponential backoff

### Known Issues
- Session resume causes connection ID mismatch → **Fixed in v1.1.0**
- No heartbeat mechanism → **Fixed in v1.1.0**
- Stale connections not handled → **Fixed in v1.1.0**

## [Unreleased]

### Planned for v1.2.0
- Web dashboard for monitoring connections
- Message delivery confirmation and acknowledgments
- Message queuing improvements
- Better error recovery

### Planned for v2.0.0
- Authentication and authorization
- Persistent storage (SQLite/PostgreSQL)
- Encryption (WSS/TLS)
- File sharing between instances
- Code snippet sharing
- Task coordination
- Status tracking
- Broker clustering
- Horizontal scaling
- Cloud deployment option

---

## Version Format

This project follows [Semantic Versioning](https://semver.org/):
- MAJOR version for incompatible API changes
- MINOR version for backwards-compatible functionality additions
- PATCH version for backwards-compatible bug fixes

## Release Process

1. Update version in package.json files
2. Update CHANGELOG.md
3. Update documentation if needed
4. Commit changes
5. Tag release
6. Push to repository

## Migration Guide

### Upgrading from v1.0.0 to v1.1.0

**No breaking changes** - v1.1.0 is fully backward compatible with v1.0.0.

**Steps:**
1. Stop the broker
2. Pull latest changes
3. Run `npm install` in both `broker/` and `mcp-server/`
4. Restart the broker
5. Restart Claude Code instances

**New features available immediately:**
- Automatic stale connection resolution
- Heartbeat monitoring
- `linker_status` tool
- Better error messages

**No configuration changes required** - existing configs continue to work.

**Benefits:**
- No more "Unknown sender" errors on session resume
- Better connection reliability
- Easier troubleshooting with `linker_status`
- More resilient to network issues
