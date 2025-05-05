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
        this.resetCount = 0;
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
            lockMouse: this.settings.get_boolean('lockmouse')
        };
    }

    updateStyles() {
        if (!this.tsLabel || this.tsLabel.is_destroyed) {
            return;
        }

        // Ensure label has been allocated before styling
        if (!this.tsLabel.allocation) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => this.updateStyles());
            return GLib.SOURCE_REMOVE;
        }

        try {
            let extraInfo = this.currentSettings.cusFont ? `font-family: ${this.currentSettings.cusFont}; ` : "";
            let extraLabelInfo = `${extraInfo}min-width: ${this.currentSettings.minWidth}em; `;
            extraLabelInfo += `text-align: ${["left", "right", "center"][this.currentSettings.textAlign]}; `;

            this.tsLabel.set_style(`${extraLabelInfo}${this.currentSettings.systemColr ? "" : `color: ${this.currentSettings.tsColor}`}`);
            this.tsLabel.style_class = `forall size-${this.currentSettings.fontmode}`;
        } catch (e) {
            console.error('Error in updateStyles:', e);
        }
    }

    updateMouseHandler() {
        if (this.nsButton) {
            if (this._buttonSignalId) {
                this.nsButton.disconnect(this._buttonSignalId);
                this._buttonSignalId = null;
            }

            if (!this.currentSettings.lockMouse) {
                this._buttonSignalId = this.nsButton.connect(
                    'button-press-event',
                    (widget, event) => {
                        if (event.get_button() === 3) { // Right click
                            this.resetCount = this.lastCount;
                            this.updateLabel(this.formatBytes(0));
                        }
                    }
                );
            }
        }
    }

    updateLabel(text) {
        if (this.tsLabel && !this.tsLabel.is_destroyed) {
            // Keep the sum symbol prefix while updating the value
            this.tsLabel.set_text(`Σ ${text.trim()}`);
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
            let lines = contents.split('\n');
    
            let count = 0;
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                let fields = line.split(/\W+/);
                if (fields.length <= 2) continue;
    
                if (fields[0] != "lo" &&
                    !fields[0].match(/^ifb[0-9]+/) &&
                    !fields[0].match(/^veth[0-9a-zA-Z]+/) &&
                    !isNaN(parseInt(fields[1]))) {
                    count += parseInt(fields[1]) + parseInt(fields[9]);
                }
            }
    
            if (this.lastCount === 0) this.lastCount = count;
            let total = this.formatBytes(count - this.resetCount);
    
            // Update label with sum symbol
            this.updateLabel(total);
            this.lastCount = count;
    
        } catch (e) {
            console.error('Error in parseStat:', e);
            return true;
        }
        return true;
    }

    formatBytes(bytes) {
        if (bytes === 0) return "0 B";
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