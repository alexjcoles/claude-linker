# Claude Code Linker

A communication bridge that enables multiple Claude Code instances in different devcontainers to collaborate on cross-application features.

## What is This?

When building applications that span multiple codebases (frontend, backend, mobile, database, etc.), you often need coordination between services. Claude Code Linker allows separate Claude Code instances working on different parts of your system to communicate and collaborate in real-time.

## Use Cases

- **API Coordination**: Frontend Claude asks Backend Claude about endpoint structures
- **Schema Changes**: Database Claude announces schema updates to all dependent services
- **Feature Planning**: Multiple Claudes discuss and plan features that span services
- **Cross-Service Debugging**: Coordinate debugging efforts across microservices
- **Architecture Decisions**: Collaborative decision-making across teams/services

## Architecture

The linker consists of two main components:

1. **Message Broker** (`broker/`) - Central WebSocket server that routes messages between Claude instances
2. **MCP Server** (`mcp-server/`) - Model Context Protocol server that each Claude Code instance connects to

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Claude Code  │◄───────►│    Broker    │◄───────►│ Claude Code  │
│  (Frontend)  │  MCP+WS │  (localhost) │  MCP+WS │  (Backend)   │
└──────────────┘         └──────────────┘         └──────────────┘
```

For detailed architecture information, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Quick Start

### Automated Setup

```bash
./setup.sh
```

### Manual Setup

#### 1. Install Dependencies

```bash
# Install broker dependencies
cd broker && npm install && cd ..

# Install MCP server dependencies
cd mcp-server && npm install && cd ..
```

#### 2. Start the Message Broker

```bash
cd broker
npm start
```

The broker runs on `ws://localhost:8765` by default.

#### 3. Configure Claude Code Instances

Edit your Claude Code config file:
- **macOS/Linux**: `~/.config/claude-code/config.json`
- **Windows**: `%APPDATA%\claude-code\config.json`

Add the MCP server configuration:

```json
{
  "mcpServers": {
    "claude-linker": {
      "command": "node",
      "args": ["/absolute/path/to/claude-linker/mcp-server/index.js"],
      "env": {
        "BROKER_URL": "ws://localhost:8765",
        "INSTANCE_NAME": "frontend-app",
        "INSTANCE_DESCRIPTION": "Working on React frontend"
      }
    }
  }
}
```

Replace `/absolute/path/to/claude-linker` with the actual path.

#### 4. Restart Claude Code

Restart Claude Code to load the MCP server.

### Remote Access (Optional)

To connect Claude instances across different machines or devcontainers:

```bash
ngrok tcp 8765
```

Update `BROKER_URL` in your Claude Code config to use the ngrok URL (e.g., `ws://0.tcp.ngrok.io:12345`).

## MCP Tools Available to Claude

Once configured, Claude Code instances can use these tools:

### Core Communication
- `linker_register` - Register this instance with a name and description
- `linker_send_message` - Send messages with priority and expiration (v1.2.0+)
- `linker_broadcast` - Send a message to all connected instances
- `linker_get_messages` - Retrieve new messages for this instance

### Message Confirmation (v1.2.0+)
- `linker_mark_read` - Mark messages as read and send read receipts
- `linker_get_receipts` - Check delivery and read status of sent messages

### Automatic Notifications (v1.3.0+)
- **Automatic message awareness** - Claude is automatically notified of new messages
- **Non-intrusive footer** - Unread message count appears in tool responses
- **Priority highlighting** - High-priority messages are highlighted
- **No manual checking required** - Messages are detected without prompting

When Claude uses any linker tool, pending messages are shown:
```
📬 **You have 3 unread message(s)** (1 high priority!) from: alice (2), bob
💡 Use `linker_get_messages` to read them.
```

### Monitoring
- `linker_list_instances` - List all connected Claude instances
- `linker_get_conversation` - Get the full conversation history
- `linker_status` - Check connection health and troubleshoot issues (v1.1.0+)

## Example Usage

In Claude Code instance 1 (frontend):
```
Claude: I'm registering as the frontend-app instance
[uses linker_register tool]

Claude: Let me ask the backend team about the API endpoint structure
[uses linker_send_message to "backend-app"]
```

In Claude Code instance 2 (backend):
```
Claude: I received a message from frontend-app asking about API endpoints
[uses linker_get_messages tool]

Claude: Let me respond with our REST API structure
[uses linker_send_message to "frontend-app"]
```

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[SETUP.md](SETUP.md)** - Detailed setup and installation guide
- **[USAGE.md](USAGE.md)** - Usage examples and workflows
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Troubleshooting guide and common issues
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture and design decisions
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes
- **[examples/](examples/)** - Sample configuration files

## Directory Structure

```
claude-linker/
├── broker/                      # WebSocket message broker
│   ├── index.js                 # Main broker server
│   ├── package.json
│   └── storage.js               # Message persistence
├── mcp-server/                  # MCP server for Claude Code
│   ├── index.js                 # MCP server implementation
│   └── package.json
├── dashboard/                   # Web dashboard (v1.2.0+)
│   ├── index.html               # Real-time monitoring interface
│   └── README.md                # Dashboard documentation
├── examples/                    # Example configurations
│   ├── claude-config-instance1.json
│   ├── claude-config-instance2.json
│   └── claude-config-remote.json
├── QUICKSTART.md                # 5-minute quick start
├── SETUP.md                     # Setup guide
├── USAGE.md                     # Usage guide
├── TROUBLESHOOTING.md           # Troubleshooting guide
├── ARCHITECTURE.md              # Architecture documentation
├── CHANGELOG.md                 # Version history
├── setup.sh                     # Quick setup script
└── README.md                    # This file
```

## Web Dashboard (v1.2.0+)

Monitor your Claude Code instances in real-time with the built-in web dashboard.

### Features
- 📊 Real-time message statistics
- 👥 Connected instance list
- ⚡ Priority queue monitoring
- ⏱️ Performance metrics
- 📨 Live activity feed

### Quick Start
```bash
# Simply open in your browser
open dashboard/index.html
```

The dashboard automatically connects to `ws://localhost:8765` and displays:
- Total, delivered, and read message counts
- Message priority distribution
- Average delivery times
- Connected Claude instances
- Real-time message activity

For remote access, edit `BROKER_URL` in `dashboard/index.html`.

See [dashboard/README.md](dashboard/README.md) for full documentation.

## Requirements

- **Node.js**: Version 18 or higher
- **Claude Code**: Latest version with MCP support
- **Network**: Ability to run WebSocket server (localhost or accessible via ngrok)
- **Browser** (for dashboard): Modern browser with WebSocket support

## Security Notice

⚠️ **Version 1.0 is designed for trusted local development environments only.**

The current implementation does not include:
- Authentication
- Encryption (unless using WSS)
- Authorization
- Rate limiting
- Input validation beyond basic JSON parsing

**Acceptable use cases:**
- Local development on localhost
- Private devcontainers on trusted networks
- Development behind a firewall

**NOT suitable for:**
- Production deployments
- Untrusted networks
- Multi-tenant environments
- Public internet exposure

Future versions will include proper security features. See [ARCHITECTURE.md](ARCHITECTURE.md#security-considerations) for details.

## Troubleshooting

Having issues? Check the **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** guide for:
- Connection issues and "Unknown sender" errors
- Session resume problems
- Configuration troubleshooting
- Network and performance issues
- Common error messages and solutions

### Quick Checks

**Connection Status:**
```
Use the linker_status tool in Claude to check connection health
```

**Verify Setup:**
1. Broker running: `ps aux | grep node | grep broker`
2. Config path correct: Check absolute path in `config.json`
3. Both instances registered: Use `linker_list_instances`
4. Test WebSocket: `wscat -c ws://localhost:8765`

For detailed troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Development

### Running Tests

```bash
# Coming soon - unit and integration tests
npm test
```

### Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Roadmap

See [ARCHITECTURE.md](ARCHITECTURE.md#extensibility) for planned features.

## License

See [LICENSE](LICENSE) file for details.

## Future Enhancements (v2+)

### Planned Features

- **Security**
  - Authentication (API keys, JWT)
  - WSS/TLS encryption
  - Authorization rules
  - Rate limiting

- **Persistence**
  - SQLite/PostgreSQL storage
  - Message history retention
  - Conversation archives

- **Scalability**
  - Broker clustering
  - Horizontal scaling
  - Load balancing

- **Features**
  - File sharing between instances
  - Code snippet sharing
  - Task coordination
  - Status tracking
  - Web dashboard for monitoring

- **Integrations**
  - Slack/Discord notifications
  - GitHub integration
  - CI/CD hooks
  - Monitoring and alerting

## Support

For issues, questions, or contributions:

- Open an issue on GitHub
- Check the documentation in the `docs/` directory
- Review example configurations in `examples/`

## Acknowledgments

- Built using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- Designed for [Claude Code](https://www.anthropic.com/claude)
- Uses [ws](https://github.com/websockets/ws) for WebSocket communication
