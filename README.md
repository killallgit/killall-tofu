# 🔥 Killall-Tofu

> Automatic Terraform infrastructure destruction with a friendly menu bar interface

Killall-Tofu is a macOS menu bar application that automatically destroys Terraform infrastructure after a specified timeout. Never forget to tear down temporary development environments again!

## Features

- 🔍 **Auto-Discovery** - Monitors directories for `.killall.yaml` configuration files
- ⏰ **Natural Language Timeouts** - Specify timeouts like "2 hours" or "30 minutes"  
- 📊 **Visual Countdown** - See time remaining in the menu bar with color-coded warnings
- 🔔 **Smart Notifications** - Get alerts before infrastructure is destroyed
- 🔄 **Retry Logic** - Automatic retry for failed destructions
- 📝 **Comprehensive Logging** - Full audit trail of all operations
- 🎯 **Flexible Control** - Extend timers or cancel destructions on the fly

## Installation

### Download Release (Recommended)

Download the latest `.dmg` file from [Releases](https://github.com/yourusername/killall-tofu/releases) and install like any macOS application.

### Build from Source

```bash
# Clone repository
git clone https://github.com/yourusername/killall-tofu.git
cd killall-tofu

# Install dependencies
npm install

# Run development version
npm run dev

# Build for production
npm run build
npm run package
```

## Quick Start

1. **Launch Killall-Tofu** - The 🔥 icon appears in your menu bar
2. **Configure watch directories** - Click the icon and go to Settings
3. **Add `.killall.yaml` to your Terraform project**:

```yaml
version: 1
timeout: "2 hours"
name: "Development Environment"
```

4. **That's it!** - Your infrastructure will be destroyed automatically after the timeout

## Configuration

### Project Configuration (`.killall.yaml`)

Place this file in your Terraform project root:

```yaml
version: 1
timeout: "2 hours"              # Required: When to destroy
name: "My Project"              # Optional: Display name
command: "terraform destroy -auto-approve"  # Optional: Custom command
tags: ["dev", "temporary"]     # Optional: Tags for organization

# Optional: Override execution settings
execution:
  timeout: 600
  environment:
    AWS_PROFILE: "development"
    TF_VAR_environment: "dev"

# Optional: Run commands before/after destruction
hooks:
  pre_destroy:
    - "terraform output -json > outputs.json"
  post_destroy:
    - "rm -rf .terraform"
```

### Global Configuration

Global settings are stored in `~/.killall/killall.yaml`:

```yaml
version: 1

scanner:
  watch_dirs:
    - ~/terraform
    - ~/projects
  interval: 30  # Scan every 30 seconds

notifications:
  warning_times: [60, 15, 5, 1]  # Minutes before destruction
  sound:
    enabled: true
```

## Usage Examples

### Basic Usage

```yaml
# Destroy after 2 hours
version: 1
timeout: "2 hours"
```

### Development Environment

```yaml
version: 1
timeout: "8 hours"
name: "Dev Stack"
tags: ["development"]
execution:
  environment:
    AWS_PROFILE: "dev"
```

### Testing Environment

```yaml
version: 1
timeout: "30 minutes"
name: "Test Infrastructure"
hooks:
  pre_destroy:
    - "npm run integration-tests"
  post_destroy:
    - "notify-slack 'Test environment cleaned up'"
```

## Menu Bar Interface

The menu bar dropdown shows:

- **Active Infrastructure** - Projects scheduled for destruction with countdown timers
  - 🟢 Green: >1 hour remaining
  - 🟡 Yellow: 15-60 minutes remaining
  - 🔴 Red: <15 minutes remaining
- **Quick Actions** - Extend timers or cancel destructions
- **Recent Activity** - History of destroyed infrastructure
- **Settings** - Configure watch directories and notifications

## Natural Language Timeouts

Supported formats:
- `30 seconds`, `30s`
- `15 minutes`, `15m`, `15 min`
- `2 hours`, `2h`, `2 hr`
- `1 day`, `1d`
- `1 week`, `1w`

## File Structure

```
~/.killall/
├── killall.yaml        # Global configuration
├── ignore             # Ignore patterns (gitignore format)
├── killall.db         # SQLite database
└── logs/
    ├── app.log       # Application log
    └── executions/   # Terraform execution logs
```

## Ignore Patterns

Create `~/.killall/ignore` to exclude directories:

```gitignore
# Ignore patterns (gitignore syntax)
*.tfstate*
.terraform/
.terragrunt-cache/
**/archived/
**/production/
```

## Safety Features

- **Visual Warnings** - Icon pulses when destruction is imminent
- **Notification Alerts** - System notifications at configurable intervals
- **Cancellation** - Cancel any scheduled destruction from the menu
- **Timer Extensions** - Add more time with one click
- **Execution Logs** - Full logs of all terraform commands

## Troubleshooting

### Infrastructure not being discovered

1. Check that the directory is in your watch list
2. Verify `.killall.yaml` syntax is valid
3. Ensure the file isn't excluded by ignore patterns

### Destruction failed

1. Check execution logs in `~/.killall/logs/executions/`
2. Verify terraform credentials are configured
3. Ensure terraform state is not locked
4. Check retry settings in configuration

### High CPU usage

Adjust scan interval in `~/.killall/killall.yaml`:

```yaml
scanner:
  interval: 60  # Increase interval to reduce CPU usage
```

## Development

See [CLAUDE.md](./CLAUDE.md) for development standards and guidelines.

### Project Structure

```
src/
├── main/          # Electron main process
├── renderer/      # React UI components
└── shared/        # Shared utilities
```

### Commands

```bash
npm run dev        # Start development server
npm run test       # Run tests
npm run build      # Build application
npm run package    # Create distributables
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow standards in [CLAUDE.md](./CLAUDE.md)
4. Submit a pull request

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Specification

See [SPECIFICATION.md](./SPECIFICATION.md) for complete technical documentation.

## License

MIT

## Security

- Never logs sensitive environment variables
- Respects file system permissions
- No network connections except for notifications
- All operations are local only

## Support

- Report issues: [GitHub Issues](https://github.com/yourusername/killall-tofu/issues)
- Documentation: [Wiki](https://github.com/yourusername/killall-tofu/wiki)

## Why "Killall-Tofu"?

Because we're destroying infrastructure gently, like cutting through tofu! 🥢

---

**⚠️ Warning**: This tool will destroy infrastructure automatically. Always verify your `.killall.yaml` configuration and ensure you're not using this in production environments!