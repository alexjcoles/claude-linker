# Changelog

All notable changes to Claude Code Linker will be documented in this file.

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
