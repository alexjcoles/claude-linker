# Claude Code Linker - Web Dashboard

Real-time monitoring dashboard for Claude Code Linker.

## Features

- **Live Connection Status** - See broker connection in real-time
- **Message Statistics** - Track total, delivered, and read messages
- **Priority Queue Monitor** - View messages by priority (high/normal/low)
- **Performance Metrics** - Average delivery time tracking
- **Connected Instances** - List of all active Claude instances
- **Activity Feed** - Real-time message activity log

## Usage

### Local Development

Open the dashboard in your browser:

```bash
open dashboard/index.html
# or
firefox dashboard/index.html
# or just double-click the file
```

The dashboard connects to `ws://localhost:8765` by default.

### Custom Broker URL

Edit `dashboard/index.html` and change the `BROKER_URL` constant:

```javascript
const BROKER_URL = 'ws://your-broker-host:8765';
```

### With HTTP Server

For better development experience, serve with a local HTTP server:

```bash
cd dashboard
python3 -m http.server 8080
```

Then open http://localhost:8080

## Dashboard Interface

### Statistics Cards

- **Message Stats**: Total messages, delivery rate, read rate
- **Priority Queue**: Distribution of messages by priority
- **Performance**: Average delivery time in milliseconds

### Connected Instances

Shows all active Claude Code instances with:
- Instance name
- Description
- Last seen timestamp

### Activity Feed

Real-time log showing:
- New messages sent
- Delivery receipts (✓)
- Read receipts (✓✓)
- Message priority indicators
- Timestamps

## Requirements

- Modern web browser with WebSocket support
- Access to Claude Code Linker broker

## Security Note

⚠️ The dashboard is designed for local development only. Do not expose to public networks without:
- Authentication
- TLS/WSS encryption
- Proper access controls

## Customization

The dashboard is a single HTML file with inline CSS and JavaScript. You can easily customize:

### Colors

Edit the CSS variables in the `<style>` section:

```css
body {
    background: #0f1419;  /* Dark background */
    color: #e0e0e0;       /* Text color */
}

.card {
    background: #1a1f2e;  /* Card background */
}
```

### Refresh Rate

Change the stats request interval (default: 5 seconds):

```javascript
setInterval(requestStats, 5000);  // 5000ms = 5 seconds
```

### Message Log Size

Change the maximum number of logged messages:

```javascript
const MAX_LOG_SIZE = 100;  // Keep last 100 messages
```

## Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Dashboard shows "Disconnected"

1. Verify broker is running: `ps aux | grep node | grep broker`
2. Check broker URL is correct (default: `ws://localhost:8765`)
3. Check browser console for errors (F12)
4. Verify firewall allows WebSocket connections

### No instances showing

1. Make sure Claude Code instances are running
2. Verify MCP servers are connected to broker
3. Check broker logs for instance registrations

### Activity feed is empty

- Messages only appear when they're sent
- Old messages before dashboard connection won't show
- Try sending a test message between two Claude instances

## Development

The dashboard is intentionally simple and self-contained. To add features:

1. Edit `dashboard/index.html`
2. Reload browser to see changes
3. No build step required

Common additions:
- More detailed statistics
- Message search/filter
- Export functionality
- Alert notifications
- Historical graphs

## Screenshots

The dashboard features:
- Dark theme optimized for monitoring
- Real-time updates with smooth animations
- Responsive grid layout
- Color-coded message types
- Priority indicators

## License

Same as main Claude Code Linker project. See root LICENSE file.
