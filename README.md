# Net Totals Simplified

![Extension Icon](https://raw.githubusercontent.com/avrain27/nettotalssimplified/main/images/icon-full.png)

A simplified network usage monitor showing only total data transfer (forked from Net Speed Simplified)

## Features

- Shows only total network usage (simplified interface)
- Right-click to reset counter
- Adjustable refresh rate (1-10 seconds)
- Customizable appearance:
  - Font size and family
  - Text color
  - Text alignment
  - Minimum width
- Settings apply immediately (no need to restart)
- Lightweight and efficient

## Installation

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/avrain27/nettotalssimplified.git
```

2. Copy to extensions folder:
```bash
mkdir -p ~/.local/share/gnome-shell/extensions/nettotalssimplified@avrain27
cp -r nettotalssimplified/* ~/.local/share/gnome-shell/extensions/nettotalssimplified@avrain27/
```

3. Enable the extension:
```bash
gnome-extensions enable nettotalssimplified@avrain27
```

### Using GH CLI

```bash
gh repo clone avrain27/nettotalssimplified ~/.local/share/gnome-shell/extensions/nettotalssimplified@avrain27
gnome-extensions enable nettotalssimplified@avrain27
```

## Usage

- The extension shows total network usage in your top panel
- Right-click to reset the counter
- Configure options in GNOME Extensions app

## Compatibility

- GNOME Shell 48
- Linux systems with /proc/net/dev

## Troubleshooting

If changes don't appear immediately:
1. Check logs:
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```
2. Restart GNOME Shell (Alt+F2, then type 'r')

## Support This Project
If you find this extension useful, consider supporting development:
- [Patreon](https://patreon.com/avrain27)
- [PayPal](https://paypal.me/avrain27)

## Credits

Forked from [Net Speed Simplified](https://github.com/prateekmedia/netspeedsimplified) by prateekmedia

## License

GNU GPL v3