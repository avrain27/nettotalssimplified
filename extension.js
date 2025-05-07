import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const ButtonName = "NetTotalsButton";

export default class NetTotalsSimplifiedExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this.settings = null;
        this.timeout = null;
        this.lastCount = 0;
        // this.resetCount = 0;
        // this.lastDownload = -1;
        // this.lastUpload = -1;
        // this.resetDownload = 0;
        // this.resetUpload = 0;

        this.totalDownload = 0;  // Cumulative download total
        this.totalUpload = 0;    // Cumulative upload total
        this.lastDownload = 0;   // Last raw download value
        this.lastUpload = 0;     // Last raw upload value
        this.resetDownload = 0;  // Reset offset for download
        this.resetUpload = 0;    // Reset offset for upload
        this.resetCount = 0;     // Combined reset offset

        this.currentSettings = null;

        this.tsLabel = null;
        this.nsButton = null;
        this.nsActor = null;

        this._buttonSignalId = null;
        this._settingsSignals = [];
    }

    safeDestroy(obj) {
        try {
            if (obj && !obj.is_destroyed && typeof obj.destroy === 'function') {
                obj.destroy();
            }
        } catch (e) {
            console.debug('Error destroying object:', e);
        }
        return null;
    }

    fetchSettings() {
        this.currentSettings = {
            refreshTime: this.settings.get_double('refreshtime'),
            minWidth: this.settings.get_double('minwidth'),
            textAlign: this.settings.get_int('textalign'),
            cusFont: this.settings.get_string('customfont'),
            systemColr: this.settings.get_boolean('systemcolr'),
            tsColor: this.settings.get_string('tscolor'),
            fontmode: this.settings.get_int('fontmode'),
            lockMouse: this.settings.get_boolean('lockmouse'),
            dualmode: this.settings.get_boolean('dualmode'),
        };
    }

    updateStyles() {
        if (!this.tsLabel || this.tsLabel.is_destroyed) return;

        let extraInfo = this.currentSettings.cusFont ? `font-family: ${this.currentSettings.cusFont}; ` : "";
        let extraLabelInfo = `${extraInfo}min-width: ${this.currentSettings.minWidth}em; `;
        extraLabelInfo += `text-align: ${["left", "right", "center"][this.currentSettings.textAlign]}; `;

        // Add monospace font for dual mode to prevent width jumps
        if (this.currentSettings.dualmode) {
            extraLabelInfo += "font-feature-settings: 'tnum' 1; "; // Tabular numbers
        }

        this.tsLabel.set_style(`${extraLabelInfo}${this.currentSettings.systemColr ? "" : `color: ${this.currentSettings.tsColor}`}`);
        this.tsLabel.style_class = `forall size-${this.currentSettings.fontmode}`;
    }

    updateMouseHandler() {
        if (this._buttonSignalId && this.nsButton) {
            this.nsButton.disconnect(this._buttonSignalId);
        }
    
        if (!this.currentSettings.lockMouse) {
            this._buttonSignalId = this.nsButton.connect(
                'button-press-event',
                (widget, event) => {
                    if (event.get_button() === 3) { // Right click
                        if (this.currentSettings.dualmode) {
                            this.resetDownload = this.totalDownload;
                            this.resetUpload = this.totalUpload;
                            this.updateLabel("▼ 0 B ▲ 0 B");
                        } else {
                            this.resetCount = this.totalDownload + this.totalUpload;
                            this.updateLabel("0 B");
                        }
                        // Force immediate update
                        this.parseStat();
                    }
                }
            );
        }
    }

    updateLabel(text) {
        if (this.tsLabel && !this.tsLabel.is_destroyed) {
            // Only add Σ prefix in single mode
            const displayText = this.currentSettings.dualmode ? text : `Σ ${text.trim()}`;
            this.tsLabel.set_text(displayText);
        }
    }

    createUI() {
        this.destroyUI();
    
        this.nsButton = new PanelMenu.Button(0.0, ButtonName, false);
        this.nsButton.reactive = true;
        this.nsButton.can_focus = false;
    
        // Create label with sum symbol prefix
        this.tsLabel = new St.Label({
            text: 'Σ --',  // Initial text with sum symbol
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: false
        });
    
        this.nsButton.add_child(this.tsLabel);
        Main.panel.addToStatusArea(ButtonName, this.nsButton, 0, "right");
    
        // Delay styling until allocation is ready
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!this.tsLabel || !this.tsLabel.allocation) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => this.updateStyles());
            } else {
                this.updateStyles();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    destroyUI() {
        // Disconnect signals first
        if (this._buttonSignalId && this.nsButton) {
            this.nsButton.disconnect(this._buttonSignalId);
            this._buttonSignalId = null;
        }
    
        // Remove from panel status area if it exists
        if (Main.panel.statusArea[ButtonName]) {
            try {
                Main.panel.statusArea[ButtonName].remove_child(this.nsButton);
            } catch (e) {
                console.debug('Error removing button from panel:', e);
            }
        }
    
        // Destroy children first
        this.tsLabel = this.safeDestroy(this.tsLabel);
    
        // Then destroy the button
        if (this.nsButton) {
            try {
                // Ensure we're not trying to remove the button from itself
                if (!this.nsButton.is_destroyed) {
                    this.nsButton.destroy();
                }
            } catch (e) {
                console.debug('Error destroying button:', e);
            }
            this.nsButton = null;
        }
    }

    parseStat() {
        try {
            let input_file = Gio.file_new_for_path('/proc/net/dev');
            let [, contents] = input_file.load_contents(null);
            contents = new TextDecoder().decode(contents);
    
            let currentDownload = 0;
            let currentUpload = 0;
            let lines = contents.split('\n');
    
            // Parse network interfaces
            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith('Inter-') || line.startsWith(' face')) continue;
    
                let fields = line.split(/\s+/).filter(f => f);
                if (fields.length < 10) continue;
    
                let iface = fields[0].replace(':', '');
                if (iface === "lo" || 
                    iface.match(/^ifb[0-9]+/) || 
                    iface.match(/^veth[0-9a-zA-Z]+/) ||
                    iface.match(/^tun[0-9]+/)) {
                    continue;
                }
    
                // Get current stats (RX = download, TX = upload)
                currentDownload += parseInt(fields[1]) || 0;
                currentUpload += parseInt(fields[9]) || 0;
            }
    
            // Handle counter wrap-around (32-bit or 64-bit max)
            const MAX_COUNTER = 4294967295; // 32-bit max
            if (this.lastDownload > 0 && currentDownload < this.lastDownload) {
                // Counter wrapped around
                this.totalDownload += (MAX_COUNTER - this.lastDownload) + currentDownload;
            } else {
                this.totalDownload += Math.max(0, currentDownload - this.lastDownload);
            }
    
            if (this.lastUpload > 0 && currentUpload < this.lastUpload) {
                // Counter wrapped around
                this.totalUpload += (MAX_COUNTER - this.lastUpload) + currentUpload;
            } else {
                this.totalUpload += Math.max(0, currentUpload - this.lastUpload);
            }
    
            // Update display
            if (this.currentSettings.dualmode) {
                const dl = this.formatBytes(this.totalDownload - this.resetDownload);
                const ul = this.formatBytes(this.totalUpload - this.resetUpload);
                this.updateLabel(`▼ ${dl} ▲ ${ul}`);
            } else {
                const total = this.formatBytes((this.totalDownload + this.totalUpload) - this.resetCount);
                this.updateLabel(total);
            }
    
            // Store current raw values
            this.lastDownload = currentDownload;
            this.lastUpload = currentUpload;
    
        } catch (e) {
            logError(`Error reading network stats: ${e}`);
            this.updateLabel(this.currentSettings.dualmode ? "▼ 0 B ▲ 0 B" : "0 B");
        }
        return true;
    }

    formatBytes(bytes) {
        bytes = Number(bytes) || 0;  // Force number conversion
        if (bytes <= 0) return "0 B";
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unit = 0;
        while (bytes >= 1000 && unit < units.length - 1) {
            bytes /= 1000;
            unit++;
        }
        return bytes.toFixed(1) + " " + units[unit];
    }

    handleSettingsChange() {
        this.fetchSettings();

        if (this.timeout) {
            GLib.source_remove(this.timeout);
            this.timeout = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                this.currentSettings.refreshTime,
                () => this.parseStat()
            );
        }

        // Delay styling after settings change as well
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!this.tsLabel || !this.tsLabel.allocation) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => this.updateStyles());
            } else {
                this.updateStyles();
            }
            return GLib.SOURCE_REMOVE;
        });

        this.updateMouseHandler();
        this.parseStat();
    }

    enable() {
        this.settings = this.getSettings();
        this.fetchSettings();
        // Reset all counters
        this.lastDownload = 0;
        this.lastUpload = 0;
        this.resetDownload = 0;
        this.resetUpload = 0;
        this.lastCount = 0;
        this.resetCount = 0;
        this.createUI();

        this.updateMouseHandler();

        this._settingsSignals = [
            this.settings.connect('changed', () => this.handleSettingsChange())
        ];

        this.timeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this.currentSettings.refreshTime,
            () => this.parseStat()
        );
    }

    disable() {
        // Disconnect settings signals
        this._settingsSignals.forEach(id => {
            try {
                if (this.settings) {
                    this.settings.disconnect(id);
                }
            } catch (e) {
                console.debug('Error disconnecting setting signal:', e);
            }
        });
        this._settingsSignals = [];
    
        // Remove timeout
        if (this.timeout) {
            GLib.source_remove(this.timeout);
            this.timeout = null;
        }
    
        // Clean up UI
        this.destroyUI();
    
        // Clear references
        this.settings = null;
        this.currentSettings = null;
    }
}