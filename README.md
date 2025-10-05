# Net Totals Simplified

A clean network usage monitor showing cumulative data transfer.

## Features

- **Three display modes**:
  - Combined total (Σ)
  - Split upload/download (▼▲)
  - Quota mode (remaining data based on user-defined limit)
- Right-click to reset counters
- **Customizable display**:
  - Adjustable refresh rate (0.5-10 seconds)
  - Multiple font sizes (Default → Large)
  - Custom font family support
  - Text alignment (Left/Center/Right)
  - Minimum width control
  - Custom color or system theme matching
- **Advanced options**:
  - Lock reset function (disable right-click)
  - Counter wrap-around protection
  - Quota input with Enter key support
- Lightweight and efficient (~1MB RAM)

## Installation

### From Extensions.gnome.org
1. Visit [extensions.gnome.org](https://extensions.gnome.org)
2. Search for "Net Totals Simplified"
3. Click install

### Manual Installation
```bash
git clone https://github.com/avrain27/nettotalssimplified.git
mkdir -p ~/.local/share/gnome-shell/extensions/nettotalssimplified@avrain27
cp -r nettotalssimplified/* ~/.local/share/gnome-shell/extensions/nettotalssimplified@avrain27/
gnome-extensions enable nettotalssimplified@avrain27
```

## Usage

1. The extension appears in your top panel showing:
   - `Σ 1.2 GB` (combined mode)
   - `▼ 800 MB ▲ 400 MB` (split mode)
   - `1.2 GB left` (quota mode)
2. **Right-click** to reset counters
3. **Quota mode**: Set a data limit via the menu; supports input like 100MB, 1GB, etc.
4. Configure options through GNOME Extensions app

## Accessing Preferences
Open preferences via:
1. GNOME Extensions application
2. Command line:
```bash
gnome-extensions prefs nettotalssimplified@avrain27
```

## Compatibility
- GNOME Shell 48, 49
- Linux systems with `/proc/net/dev`
- Wayland and X11 supported

## Troubleshooting
If the display stops updating:
```bash
# Check logs
journalctl -f -o cat /usr/bin/gnome-shell | grep "NetTotalsSimplified"

# Reset settings
dconf reset -f /org/gnome/shell/extensions/nettotalssimplified/

# Restart GNOME Shell (Alt+F2 → 'r' on X11, or log out/in on Wayland)
```

## 💖 Support This Project
Enjoying this extension? Help support its development:
- [Patreon](https://patreon.com/avrain27) (Recurring support, get perks!)
- [PayPal](https://paypal.me/avrain27) (One-time donations)
- **Star the repo** ⭐ (Helps visibility!)

## Changelog
### v5
- Added GNOME Shell 49 compatibility
- Updated log prefix to [NetTotalsSimplified] for consistency

### v4
- Added quota display mode

### v3
- **Fixed**: Complete timeout management overhaul
- Removed unnecessary files
- Cleaned up metadata.json

### v2
- Added dual upload/download display mode
- Improved counter accuracy
- Fixed right-click reset behavior
- Added system theme color matching

### v1
- Initial release based on Net Speed Simplified
- Combined total mode with customizable display options

## Credits
Inspired by [Net Speed Simplified](https://github.com/prateekmedia/netspeedsimplified) by prateekmedia

## License
GNU GPL v3