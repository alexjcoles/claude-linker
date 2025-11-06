# Claude Code Linker - Setup Guide

This guide will help you set up the Claude Code Linker to enable communication between multiple Claude Code instances.

## Prerequisites

- Node.js 18 or higher
- Claude Code installed in each devcontainer
- (Optional) ngrok for remote connections

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd claude-linker

# Install broker dependencies
cd broker
npm install

# Install MCP server dependencies
cd ../mcp-server
npm install
```

### 2. Start the Message Broker

The broker needs to run on a machine accessible to all Claude Code instances.

```bash
cd broker
npm start
```

You should see:
```
[BROKER] Claude Code Linker broker running on ws://0.0.0.0:8765
```

### 3. (Optional) Expose Broker with ngrok

If your Claude Code instances are in different devcontainers or machines:

```bash
ngrok tcp 8765
```

Note the forwarding URL (e.g., `tcp://0.tcp.ngrok.io:12345`) and convert it to WebSocket format:
`ws://0.tcp.ngrok.io:12345`

### 4. Configure Claude Code Instances

Each Claude Code instance needs its MCP server configured.

#### On macOS/Linux

Edit `~/.config/claude-code/config.json` (create if it doesn't exist):

```json
{
  "mcpServers": {
    "claude-linker": {
      "command": "node",
      "args": [
        "/absolute/path/to/claude-linker/mcp-server/index.js"
      ],
      "env": {
        "BROKER_URL": "ws://localhost:8765",
        "INSTANCE_NAME": "your-instance-name",
        "INSTANCE_DESCRIPTION": "Brief description of what this instance works on"
      }
    }
  }
}
```

#### On Windows

Edit `%APPDATA%\claude-code\config.json`:

Same configuration as above.

#### Important Configuration Notes

- **BROKER_URL**: The WebSocket URL of your broker
  - Local: `ws://localhost:8765`
  - Remote: `ws://your-ngrok-url`
- **INSTANCE_NAME**: Unique name for this Claude instance
  - Examples: `frontend-app`, `backend-api`, `mobile-app`, `database-service`
- **INSTANCE_DESCRIPTION**: What this Claude is working on
  - Helps other Claudes understand the context

### 5. Restart Claude Code

After adding the MCP configuration, restart Claude Code to load the linker.

## Verification

Once Claude Code restarts, the MCP server will automatically:
1. Connect to the broker
2. Register with the instance name you provided

You can verify the connection by checking the broker logs:
```
[BROKER] New connection established
[BROKER] New instance registered: frontend-app (uuid-here)
```

## Configuration Examples

See the `examples/` directory for sample configurations:

- `claude-config-instance1.json` - First instance (frontend)
- `claude-config-instance2.json` - Second instance (backend)
- `claude-config-remote.json` - Remote instance via ngrok

## Troubleshooting

### Claude Code doesn't see the MCP tools

1. Check that the config file path is correct
2. Verify the absolute path to `mcp-server/index.js` is correct
3. Restart Claude Code completely
4. Check Claude Code logs for MCP errors

### Cannot connect to broker

1. Verify the broker is running: `ps aux | grep node`
2. Check the BROKER_URL is correct
3. Test WebSocket connection: `wscat -c ws://localhost:8765`
4. Check firewall settings if using ngrok

### Instance registration fails

1. Check broker logs for errors
2. Verify Node.js version is 18+
3. Ensure MCP server dependencies are installed: `cd mcp-server && npm install`

## Next Steps

Once setup is complete, see [USAGE.md](USAGE.md) for examples of how to use the linker.
