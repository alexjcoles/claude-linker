#!/bin/bash

# Claude Code Linker - Quick Setup Script

set -e

echo "🔗 Claude Code Linker - Installation Script"
echo "==========================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install broker dependencies
echo "Installing broker dependencies..."
cd broker
npm install
cd ..
echo "✅ Broker dependencies installed"
echo ""

# Install MCP server dependencies
echo "Installing MCP server dependencies..."
cd mcp-server
npm install
cd ..
echo "✅ MCP server dependencies installed"
echo ""

# Get absolute path
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installation complete! 🎉"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Start the message broker:"
echo "   cd $INSTALL_DIR/broker"
echo "   npm start"
echo ""
echo "2. Configure Claude Code instances:"
echo "   Edit your Claude Code config file:"
echo "   - macOS/Linux: ~/.config/claude-code/config.json"
echo "   - Windows: %APPDATA%\\claude-code\\config.json"
echo ""
echo "   Add this configuration:"
echo '   {'
echo '     "mcpServers": {'
echo '       "claude-linker": {'
echo '         "command": "node",'
echo '         "args": ["'$INSTALL_DIR'/mcp-server/index.js"],'
echo '         "env": {'
echo '           "BROKER_URL": "ws://localhost:8765",'
echo '           "INSTANCE_NAME": "your-instance-name",'
echo '           "INSTANCE_DESCRIPTION": "Description of what this instance works on"'
echo '         }'
echo '       }'
echo '     }'
echo '   }'
echo ""
echo "3. Restart Claude Code"
echo ""
echo "📚 Documentation:"
echo "   - Setup Guide: $INSTALL_DIR/SETUP.md"
echo "   - Usage Guide: $INSTALL_DIR/USAGE.md"
echo "   - Examples: $INSTALL_DIR/examples/"
echo ""
echo "For remote access (optional):"
echo "   Install ngrok and run: ngrok tcp 8765"
echo ""
