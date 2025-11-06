# Claude Code Linker - Quick Start (5 Minutes)

Get two Claude Code instances talking to each other in 5 minutes.

## Step 1: Install (1 minute)

```bash
cd /path/to/claude-linker
./setup.sh
```

## Step 2: Start Broker (30 seconds)

In a terminal:

```bash
cd broker
npm start
```

Leave this running. You should see:
```
[BROKER] Claude Code Linker broker running on ws://0.0.0.0:8765
```

## Step 3: Configure First Claude Instance (1 minute)

Find your Claude Code config file:
- **Mac/Linux**: `~/.config/claude-code/config.json`
- **Windows**: `%APPDATA%\claude-code\config.json`

Add this (replace the path):

```json
{
  "mcpServers": {
    "claude-linker": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/claude-linker/mcp-server/index.js"],
      "env": {
        "BROKER_URL": "ws://localhost:8765",
        "INSTANCE_NAME": "alice",
        "INSTANCE_DESCRIPTION": "First Claude instance"
      }
    }
  }
}
```

Restart Claude Code.

## Step 4: Configure Second Claude Instance (1 minute)

In a different project/devcontainer, edit its Claude Code config:

```json
{
  "mcpServers": {
    "claude-linker": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/claude-linker/mcp-server/index.js"],
      "env": {
        "BROKER_URL": "ws://localhost:8765",
        "INSTANCE_NAME": "bob",
        "INSTANCE_DESCRIPTION": "Second Claude instance"
      }
    }
  }
}
```

Restart Claude Code.

## Step 5: Test Communication (1 minute)

### In Claude Instance "alice":

```
You: Can you list all connected Claude instances?

Claude: [uses linker_list_instances]

You: Send a message to bob saying "Hello from alice!"

Claude: [uses linker_send_message]
```

### In Claude Instance "bob":

```
You: Check for new messages

Claude: [uses linker_get_messages]
> You have 1 new message:
> From: alice
> Message: Hello from alice!

You: Reply to alice with "Hi alice, nice to meet you!"

Claude: [uses linker_send_message to "alice"]
```

### Back in Claude Instance "alice":

```
You: Check for messages

Claude: [uses linker_get_messages]
> You have 1 new message:
> From: bob
> Message: Hi alice, nice to meet you!
```

## Success! 🎉

Your Claude instances are now communicating!

## What's Next?

### Try a real workflow:

**In Claude "alice" (frontend project):**
```
You: I'm implementing a user profile page. Ask bob about the user API endpoint structure.

Claude: [uses linker_send_message to "bob"]
```

**In Claude "bob" (backend project):**
```
You: Check for messages and respond

Claude: [reads message, checks code, responds with API details]
```

### Other useful commands:

```
# Broadcast to everyone
"Send a broadcast: I'm deploying a breaking change to the auth API"

# View conversation history
"Show me my conversation with bob"

# Check who's online
"List all connected instances"
```

## Troubleshooting

**Can't see the linker tools?**
- Check the absolute path is correct in the config
- Make sure you restarted Claude Code
- Verify Node.js 18+ is installed: `node -v`

**Can't connect to broker?**
- Check broker is running: `ps aux | grep node`
- Verify BROKER_URL is `ws://localhost:8765`
- Check firewall settings

**Messages not delivered?**
- Use `linker_list_instances` to verify both are connected
- Check instance names match (case-sensitive!)
- Look at broker terminal for error messages

## Remote Setup (Devcontainers)

If your Claude instances are in different devcontainers:

**1. Install ngrok:**
```bash
brew install ngrok  # or download from ngrok.com
```

**2. Expose the broker:**
```bash
ngrok tcp 8765
```

**3. Update BROKER_URL in configs:**
```json
"BROKER_URL": "ws://0.tcp.ngrok.io:12345"
```
(Use the URL from ngrok)

**4. Restart both Claude Code instances**

## Learn More

- [Full Documentation](README.md)
- [Setup Guide](SETUP.md)
- [Usage Examples](USAGE.md)
- [Architecture Details](ARCHITECTURE.md)
