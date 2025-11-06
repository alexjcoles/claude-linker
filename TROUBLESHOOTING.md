# Claude Code Linker - Troubleshooting Guide

## Connection Issues

### Symptom: "Unknown sender" errors in broker logs

**Example:**
```
[BROKER] Unknown sender: f73844e5-d083-4d4a-9b95-378d441efd2f
```

**Causes:**
1. **Session Resume (v1.0 only)**: Claude Code session was resumed with stale connection ID
2. **Network interruption**: Connection was lost and not properly re-established
3. **Broker restart**: Broker lost connection state

**Solutions:**

**v1.1.0+ (Automatic):**
- The broker now automatically resolves stale connection IDs within a 5-minute grace period
- The MCP server automatically detects stale connections and re-registers
- Heartbeat mechanism monitors connection health

**Manual Fix:**
1. Check connection status:
   ```
   Use linker_status tool in Claude
   ```

2. If disconnected, the MCP server will automatically reconnect

3. If issues persist, restart Claude Code to force a clean reconnection

### Symptom: Messages not being delivered

**Check:**
1. Use `linker_status` to verify connection state
2. Use `linker_list_instances` to see if both instances are connected
3. Check broker logs for errors

**Common causes:**
- One instance is not registered
- Instance names don't match (case-sensitive)
- Network connectivity issues
- Broker not running

**Solutions:**
1. Verify broker is running:
   ```bash
   ps aux | grep node | grep broker
   ```

2. Check MCP server logs (Claude Code logs)

3. Manually re-register if needed:
   ```
   Use linker_register tool
   ```

### Symptom: Connection timeout or heartbeat failures

**Example logs:**
```
[MCP] Heartbeat timeout - connection appears stale
[MCP] Detected stale connection, triggering reconnection...
```

**This is normal behavior** when:
- Network has temporary issues
- Broker was restarted
- Claude Code session was resumed

**Action required:** None - automatic reconnection will handle it

**If reconnection fails:**
1. Check broker is accessible:
   ```bash
   # Local
   nc -zv localhost 8765

   # Remote
   nc -zv your-ngrok-host port
   ```

2. Verify BROKER_URL in config is correct

3. Check firewall settings

### Symptom: Max reconnection attempts reached

**Example:**
```
[MCP] Max reconnection attempts reached - please restart the MCP server
```

**This indicates persistent connection failure**

**Solutions:**
1. Check broker is running and accessible
2. Verify BROKER_URL is correct in Claude Code config
3. Test WebSocket connection:
   ```bash
   npm install -g wscat
   wscat -c ws://localhost:8765
   ```
4. Restart Claude Code
5. If using ngrok, verify tunnel is active

## Configuration Issues

### Symptom: MCP server not loading

**Check:**
1. Is the path in config.json absolute?
   ```json
   "args": ["/absolute/path/to/claude-linker/mcp-server/index.js"]
   ```

2. Does the file exist?
   ```bash
   ls -l /absolute/path/to/claude-linker/mcp-server/index.js
   ```

3. Are dependencies installed?
   ```bash
   cd mcp-server
   npm install
   ```

4. Is Node.js version 18+?
   ```bash
   node -v
   ```

### Symptom: Claude doesn't see linker tools

**Solutions:**
1. Verify config.json is in the correct location:
   - macOS/Linux: `~/.config/claude-code/config.json`
   - Windows: `%APPDATA%\claude-code\config.json`

2. Check JSON syntax is valid:
   ```bash
   cat ~/.config/claude-code/config.json | jq .
   ```

3. Restart Claude Code completely (not just reload)

4. Check Claude Code logs for MCP initialization errors

## Session Resume Issues (v1.0)

**Problem:** In v1.0, when Claude Code sessions are resumed, the MCP server uses a stale connection ID.

**Symptoms:**
- "Unknown sender" errors immediately after session resume
- Messages fail to send
- New messages aren't received

**Solution:** Upgrade to v1.1.0+

**Workaround for v1.0:**
1. After resuming a Claude Code session, use `linker_register` to re-register
2. Or restart Claude Code instead of resuming sessions

## Performance Issues

### Symptom: High CPU usage

**Possible causes:**
- Too many heartbeats (check HEARTBEAT_INTERVAL)
- Large message history
- Many connected instances

**Solutions:**
1. Increase HEARTBEAT_INTERVAL in mcp-server/index.js (default: 30s)
2. Clear message history periodically (broker restart)
3. Monitor with `linker_status`

### Symptom: High memory usage

**Causes:**
- Message history growing unbounded
- Connection history not being cleaned up

**Solutions:**
1. Restart broker periodically (clears in-memory data)
2. Future: Use persistent storage with TTL

## Network Issues

### Symptom: Connection works locally but not remotely

**Check:**
1. Is ngrok running and forwarding to correct port?
   ```bash
   ngrok tcp 8765
   ```

2. Is BROKER_URL using the ngrok URL?
   ```json
   "BROKER_URL": "ws://0.tcp.ngrok.io:12345"
   ```

3. Test connection from remote machine:
   ```bash
   wscat -c ws://0.tcp.ngrok.io:12345
   ```

### Symptom: Connection drops frequently

**Possible causes:**
- Unstable network
- Ngrok tunnel timing out
- Firewall interfering with WebSocket

**Solutions:**
1. Use WSS (secure WebSocket) if possible
2. Increase HEARTBEAT_INTERVAL if network is stable but slow
3. Check firewall settings for WebSocket support
4. For ngrok, consider paid plan for more stable tunnels

## Debugging Tips

### Enable verbose logging

The MCP server logs to stderr, which Claude Code captures. To see more details:

1. Check Claude Code's log file location (varies by platform)
2. Monitor broker output in real-time:
   ```bash
   cd broker
   npm start | tee broker.log
   ```

### Use linker_status proactively

Add this to your workflow:
```
Periodically check linker_status to monitor connection health
```

### Test with simple messages

Before complex workflows, verify basic connectivity:
```
1. Use linker_list_instances - should see both instances
2. Send simple message: "test"
3. Check message received with linker_get_messages
```

### Monitor broker logs

Keep broker terminal visible to see:
- Connection events
- Registration events
- Message routing
- Error messages
- Stale connection resolutions

### Check connection history

In v1.1.0+, the broker tracks connection history. This is logged when:
- An instance reconnects with a new connection ID
- A stale connection ID is resolved

Look for logs like:
```
[STORAGE] Instance "patentsafe" reconnecting with new ID abc (old: xyz)
[STORAGE] Resolved stale connection xyz to current abc for "patentsafe"
```

## Common Error Messages

### "Not registered with broker. Use linker_register first."

**Cause:** MCP server lost registration (connection was reset)

**Solution:** Automatic re-registration should handle this. If not, manually use `linker_register`

### "Not connected to broker"

**Cause:** WebSocket connection is not established

**Solution:** Check broker is running and accessible. MCP server will auto-reconnect.

### "Request timeout"

**Cause:** Broker didn't respond within timeout period (default: 5s)

**Solutions:**
- Check broker is running and responsive
- Increase timeout if network is slow (requires code change)
- Verify no firewall blocking traffic

### "Connection ID was stale and has been updated"

**Cause:** (v1.1.0+) Broker resolved a stale connection ID

**Action:** This is informational. The message was still delivered. MCP server will re-register automatically.

## Best Practices

### For Development

1. **Keep broker running** - Start it once and leave it running
2. **Monitor connection status** - Use `linker_status` if things seem off
3. **Test after resume** - When resuming a Claude Code session, send a test message
4. **Watch broker logs** - Keep the broker terminal visible during development

### For Production Use (Future)

1. Use persistent storage (SQLite/PostgreSQL)
2. Enable authentication
3. Use WSS (secure WebSocket)
4. Monitor connection metrics
5. Set up alerting for connection failures
6. Use broker clustering for reliability

## Getting Help

If you're still stuck:

1. Check the [ARCHITECTURE.md](ARCHITECTURE.md) for design details
2. Review [USAGE.md](USAGE.md) for usage examples
3. Check [README.md](README.md) for basic setup
4. Look at broker logs for specific error messages
5. Use `linker_status` to get current connection state
6. File an issue with:
   - Version (v1.0 or v1.1+)
   - Broker logs
   - MCP server logs (from Claude Code)
   - Output of `linker_status`
   - Steps to reproduce

## Version-Specific Issues

### v1.0
- Session resume causes connection issues → **Upgrade to v1.1.0**
- No heartbeat mechanism → **Upgrade to v1.1.0**
- No stale connection resolution → **Upgrade to v1.1.0**

### v1.1.0+
- All major connection issues resolved
- Automatic reconnection and re-registration
- Stale connection resolution with 5-minute grace period
- Connection health monitoring with heartbeats
