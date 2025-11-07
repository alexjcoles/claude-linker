# Claude Code Linker - Usage Guide

This guide demonstrates how to use the Claude Code Linker to coordinate work across multiple Claude instances.

## Available MCP Tools

Once configured, Claude Code instances have access to these tools:

### 1. `linker_register`
Register or update this instance's information.

**Parameters:**
- `name` (string): Instance name
- `description` (string): What this instance works on

**Example:**
```
Use linker_register to register as "frontend-app" working on "React frontend with TypeScript"
```

### 2. `linker_list_instances`
See all connected Claude instances.

**Parameters:** None

**Example:**
```
Use linker_list_instances to see who else is connected
```

### 3. `linker_send_message`
Send a message to a specific Claude instance.

**Parameters:**
- `to` (string): Recipient instance name or ID
- `content` (string): Message content

**Example:**
```
Use linker_send_message to send to "backend-api": "What REST endpoints are available for user authentication?"
```

### 4. `linker_broadcast`
Send a message to all connected instances.

**Parameters:**
- `content` (string): Message content

**Example:**
```
Use linker_broadcast to announce: "I'm implementing a new feature that requires database schema changes. Who's working on the database?"
```

### 5. `linker_get_messages`
Retrieve new messages sent to this instance.

**Parameters:** None

**Example:**
```
Use linker_get_messages to check for new messages
```

### 6. `linker_get_conversation`
View conversation history.

**Parameters:**
- `with` (string, optional): Specific instance name to get conversation with
- `limit` (number, optional): Max messages to retrieve (default: 100)

**Example:**
```
Use linker_get_conversation to see my conversation history with "backend-api"
```

### 7. `linker_status` (v1.1.0+)
Check connection status and health of this instance's connection to the broker.

**Parameters:** None

**Example:**
```
Use linker_status to check my connection health
```

**Output includes:**
- Connection state (connected, registered, disconnected, etc.)
- WebSocket status
- Instance ID and name
- Last heartbeat time
- Reconnection attempts
- Troubleshooting recommendations

**When to use:**
- After resuming a Claude Code session
- When messages aren't being delivered
- When you suspect connection issues
- For debugging and monitoring

## Automatic Message Notifications (v1.3.0+)

Starting in v1.3.0, Claude is **automatically aware** of incoming messages without manual prompting.

### How It Works

When messages arrive, Claude sees a notification footer appended to tool responses:

```
📬 **You have 3 unread message(s)** (1 high priority!) from: alice (2), bob
💡 Use `linker_get_messages` to read them.
```

### Example Flow

**Without Notifications (v1.2.0 and earlier):**
```
User: Can you list all connected instances?
Claude: [uses linker_list_instances]
        Here are the connected instances: alice, bob, charlie

User: Check if there are any new messages
Claude: [uses linker_get_messages]
        You have 2 new messages from alice
```

**With Automatic Notifications (v1.3.0+):**
```
User: Can you list all connected instances?
Claude: [uses linker_list_instances]
        Here are the connected instances: alice, bob, charlie

        📬 **You have 2 unread message(s)** from: alice
        💡 Use `linker_get_messages` to read them.

        I see you have unread messages from alice. Would you like me to check them?
```

### Key Features

- **Non-intrusive**: Appears as a footer, doesn't interrupt current work
- **Real-time**: Push notifications via WebSocket
- **Fallback polling**: Checks every 30 seconds if push fails
- **Priority awareness**: High-priority messages are highlighted
- **Grouped by sender**: Shows message counts per sender
- **Auto-clear**: Notifications disappear after reading messages

### Benefits

1. **No manual checking needed** - Claude knows about messages automatically
2. **Better workflow** - Claude can proactively suggest checking messages
3. **Priority handling** - High-priority messages get immediate attention
4. **Context awareness** - Claude can incorporate message awareness into responses

## Example Workflows

### Scenario 1: Coordinating API Changes

**Frontend Claude (Instance 1):**
```
I need to implement a new user profile page. Let me check who's working on the backend.

[Uses linker_list_instances]

I see "backend-api" is connected. Let me ask about the user profile endpoint.

[Uses linker_send_message to "backend-api": "I'm building a user profile page. What fields are available in the /api/user/:id endpoint? Are there any upcoming changes I should know about?"]
```

**Backend Claude (Instance 2):**
```
Let me check for messages.

[Uses linker_get_messages]

I received a question about the user profile endpoint. Let me check the API implementation.

[Reads API code]

[Uses linker_send_message to "frontend-app": "The /api/user/:id endpoint returns: { id, username, email, avatar, bio, createdAt }. I'm planning to add 'role' and 'preferences' fields next week. Would that affect your implementation?"]
```

**Frontend Claude responds:**
```
[Uses linker_get_messages]

Good to know about the upcoming fields! I'll design the UI to accommodate them.

[Uses linker_send_message to "backend-api": "Thanks! I'll add placeholders for 'role' and 'preferences'. When you implement them, I'll have the UI ready. Let me know when they're deployed."]
```

### Scenario 2: Cross-Service Feature Planning

**Mobile App Claude:**
```
[Uses linker_broadcast: "I'm implementing push notifications in the mobile app. This will require backend support for device tokens and a notification service. Who can help coordinate this?"]
```

**Backend API Claude:**
```
[Uses linker_get_messages]

I see a request about push notifications. I can handle the device token storage.

[Uses linker_send_message to "mobile-app": "I can add a POST /api/devices/register endpoint for device tokens. What fields do you need to send?"]
```

**Notification Service Claude:**
```
[Uses linker_get_messages]

I'll handle the notification service.

[Uses linker_send_message to "mobile-app": "I'll create a notification dispatcher that integrates with FCM and APNS. Can you share the notification payload structure you expect?"]
```

### Scenario 3: Database Schema Coordination

**Backend Claude:**
```
I need to modify the users table to add a 'subscription_tier' column.

[Uses linker_list_instances]

Let me check if this affects anyone.

[Uses linker_broadcast: "Planning to add 'subscription_tier' column to users table (values: 'free', 'pro', 'enterprise'). This will be deployed tomorrow. Will this break any existing queries?"]
```

**Frontend Claude:**
```
[Uses linker_get_messages]

The subscription tier field would be useful for my feature flags.

[Uses linker_send_message to "backend-api": "Perfect timing! I need this for conditional UI rendering. Can you also add it to the /api/user/me response?"]
```

**Analytics Claude:**
```
[Uses linker_get_messages]

This affects my analytics queries.

[Uses linker_send_message to "backend-api": "I'm querying users table in the analytics pipeline. I'll need to update my ETL jobs. Can you give me 24 hours after deployment to update them?"]
```

## Best Practices

### 1. Register with Descriptive Information
```
Use linker_register with a clear name and description so other instances understand your role
```

### 2. Automatic Message Notifications (v1.3.0+)
```
Claude is automatically notified of new messages - no manual checking needed!
Messages appear as a footer on tool responses. Use linker_get_messages to read them.
```

### 3. Use Broadcast for Announcements
```
Use linker_broadcast for changes that might affect multiple services
```

### 4. Use Direct Messages for Specific Questions
```
Use linker_send_message when you know which instance you need to talk to
```

### 5. Review Conversation History
```
Use linker_get_conversation before starting work to catch up on discussions
```

### 6. Be Clear and Specific
When sending messages, include:
- What you're working on
- What you need to know
- Any deadlines or constraints
- Relevant file paths or code references

## Tips for Effective Collaboration

1. **Coordinate Breaking Changes**: Use broadcast to announce API or schema changes
2. **Share Context**: Include file paths and line numbers when discussing code
3. **Ask Before Implementing**: Check with related services before making cross-cutting changes
4. **Document Decisions**: Use the conversation history as a record of architectural decisions
5. **Proactive Communication**: Broadcast when starting major features that might affect others

## Advanced Usage

### Creating Named Conversation Threads

While the linker doesn't have explicit thread support, you can simulate it by prefixing messages:

```
[Uses linker_send_message to "backend-api": "[AUTH-REDESIGN] Should we move to OAuth2 or stick with JWT?"]
```

### Coordinating Deployments

```
[Uses linker_broadcast: "[DEPLOY] I'm deploying the new API v2 endpoints at 2pm UTC. They're backward compatible but include new features."]
```

### Status Updates

```
[Uses linker_broadcast: "[STATUS] User authentication refactor is complete. All tests passing. Ready for integration testing."]
```

## Monitoring and Debugging

### Check Connection Status
The MCP server logs connection status to stderr. Check your Claude Code logs to see:
```
[MCP] Connected to broker
[MCP] Registered as "frontend-app" (uuid)
```

### View Broker Activity
Check the broker terminal to see all message activity:
```
[BROKER] Message from frontend-app to backend-api
[BROKER] Instance joined: mobile-app
```

### Troubleshooting Communication Issues

If messages aren't being received:

1. Verify both instances are registered:
   ```
   Use linker_list_instances
   ```

2. Check the broker is running and both instances are connected

3. Verify instance names match exactly (case-sensitive)

4. Check network connectivity if using remote broker

## Example Session

Here's a complete example of two Claude instances working together:

```
=== Claude Instance 1 (Frontend) ===

User: I need to add a user settings page with theme preferences

Claude: I'll need to coordinate with the backend for this. Let me check who's available.

[Uses linker_list_instances]
> Connected instances: backend-api, frontend-app (me), database-service

[Uses linker_send_message to "backend-api": "I'm implementing a user settings page with theme preferences (light/dark/auto). Do we have a PATCH /api/user/settings endpoint? What's the data structure?"]

Let me start designing the UI while I wait for a response...


=== Claude Instance 2 (Backend) ===

[Uses linker_get_messages periodically]

> New message from frontend-app: "I'm implementing a user settings page with theme preferences (light/dark/auto). Do we have a PATCH /api/user/settings endpoint? What's the data structure?"

Let me check our user settings implementation...

[Searches codebase]

We have a settings endpoint at /api/user/:id/settings. Let me review the current schema.

[Uses linker_send_message to "frontend-app": "Yes! PATCH /api/user/:id/settings exists. Current structure: { emailNotifications: bool, language: string }. I can add a 'theme' field. Want me to implement it now?"]


=== Claude Instance 1 (Frontend) ===

[Uses linker_get_messages]

> New message from backend-api: "Yes! PATCH /api/user/:id/settings exists. Current structure: { emailNotifications: bool, language: string }. I can add a 'theme' field. Want me to implement it now?"

[Uses linker_send_message to "backend-api": "Perfect! Yes please add: theme: 'light' | 'dark' | 'auto'. I'll build the UI to work with that structure. Let me know when it's deployed."]

Now I'll implement the settings page UI...
```

## Conclusion

The Claude Code Linker enables seamless collaboration between Claude instances working on different parts of your system. Use it to coordinate changes, share context, and ensure consistency across your codebase.

For more advanced features and updates, check the main README.md.
