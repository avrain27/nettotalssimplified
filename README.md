# Net Totals Simplified

A clean network usage monitor showing cumulative data transfer (forked from Net Speed Simplified)

## Features

- **Dual display modes**:
  - Combined total (Σ) 
  - Split upload/download (▼▲)
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
2. **Right-click** to reset counters
3. Configure options through GNOME Extensions app

## Accessing Preferences
Open preferences via:
1. GNOME Extensions application
2. Command line:
```bash
gnome-extensions prefs nettotalssimplified@avrain27
```

## Compatibility
- GNOME Shell 48+
- Linux systems with `/proc/net/dev`
- Wayland and X11 supported

## Troubleshooting
If the display stops updating:
```bash
# Check logs
journalctl -f -o cat /usr/bin/gnome-shell | grep "NetTotals"

# Reset settings
dconf reset -f /org/gnome/shell/extensions/nettotalssimplified/

# Restart GNOME Shell (Alt+F2 → 'r')
```

## 💖 Support This Project
Enjoying this extension? Help support its development:
- [Patreon](https://patreon.com/avrain27) (Recurring support, get perks!)
- [PayPal](https://paypal.me/avrain27) (One-time donations)
- **Star the repo** ⭐ (Helps visibility!)

## Changelog
### v48.1.0
- Added dual upload/download display mode
- Improved counter accuracy
- Fixed right-click reset behavior
- Added system theme color matching

## Credits
Forked from [Net Speed Simplified](https://github.com/prateekmedia/netspeedsimplified) by prateekmedia

## License
GNU GPL v3