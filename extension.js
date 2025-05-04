// Imports
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const schema = 'org.gnome.shell.extensions.nettotalssimplified',
    ButtonName = "NetTotalsButton";

export default class NetTotalsSimplifiedExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        // Initialize all properties
        this.settings = null;
        this.timeout = null;
        this.lastCount = 0;
        this.resetCount = 0;
        this.currentSettings = null;
        
        this.tsLabel = null;
        this.tsIcon = null;
        this.nsButton = null;
        this.nsActor = null;
        this.nsLayout = null;
        
        this._buttonSignalId = null;
        this._settingsSignals = [];
    }

    // Safe destroy method with error handling
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
        // Destroy old elements
        this.tsLabel = this.safeDestroy(this.tsLabel);
        this.tsIcon = this.safeDestroy(this.tsIcon);

        // Create new elements with current settings
        let extraInfo = this.currentSettings.cusFont ? `font-family: ${this.currentSettings.cusFont}; ` : "";
        let extraLabelInfo = `${extraInfo}min-width: ${this.currentSettings.minWidth}em; `;
        extraLabelInfo += `text-align: ${["left", "right", "center"][this.currentSettings.textAlign]}; `;

        this.tsLabel = new St.Label({
            text: '--',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: `forall size-${this.currentSettings.fontmode}`,
            style: `${extraLabelInfo}${this.currentSettings.systemColr ? "" : `color: ${this.currentSettings.tsColor}`}`
        });

        this.tsIcon = new St.Label({
            text: "Σ",
            y_align: Clutter.ActorAlign.CENTER,
            style_class: `size-${this.currentSettings.fontmode}`,
            style: `${extraInfo}${this.currentSettings.systemColr ? "" : `color: ${this.currentSettings.tsColor}`}`
        });

        // Reattach to layout if it exists
        if (this.nsLayout && this.nsActor && !this.nsActor.is_destroyed) {
            this.nsActor.remove_all_children();
            this.nsLayout.attach(this.tsIcon, 0, 0, 1, 1);
            this.nsLayout.attach(this.tsLabel, 1, 0, 1, 1);
        }
    }

    updateMouseHandler() {
        if (this.nsButton) {
            // Disconnect previous handler if exists
            if (this._buttonSignalId) {
                this.nsButton.disconnect(this._buttonSignalId);
                this._buttonSignalId = null;
            }
            
            // Connect new handler if not locked
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
            this.tsLabel.set_text(text);
        }
    }

    createUI() {
        // Clean up any existing UI
        this.destroyUI();

        // Create layout
        this.nsLayout = new Clutter.GridLayout();
        this.nsActor = new Clutter.Actor({
            layout_manager: this.nsLayout,
            y_align: Clutter.ActorAlign.CENTER
        });

        // Create and attach labels
        this.updateStyles();

        // Create button
        this.nsButton = new PanelMenu.Button(0.0, ButtonName);
        this.updateMouseHandler();
        this.nsButton.add_child(this.nsActor);
        Main.panel.addToStatusArea(ButtonName, this.nsButton, 0, "right");
    }

    destroyUI() {
        if (this.nsButton) {
            if (this._buttonSignalId) {
                this.nsButton.disconnect(this._buttonSignalId);
                this._buttonSignalId = null;
            }
            this.nsButton.destroy();
            this.nsButton = null;
        }
        
        this.tsLabel = this.safeDestroy(this.tsLabel);
        this.tsIcon = this.safeDestroy(this.tsIcon);
        this.nsActor = this.safeDestroy(this.nsActor);
        this.nsLayout = null;
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
            let total = " " + this.formatBytes(count - this.resetCount);
            
            this.updateLabel(total);
            this.lastCount = count;

        } catch (e) {
            console.error('Error in parseStat:', e);
            return true; // Keep the timeout running
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
        // Get fresh settings
        this.fetchSettings();
        
        // Update refresh rate if changed
        if (this.timeout) {
            GLib.source_remove(this.timeout);
            this.timeout = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                this.currentSettings.refreshTime,
                () => this.parseStat()
            );
        }
        
        // Update styles
        this.updateStyles();
        
        // Update mouse handler
        this.updateMouseHandler();
        
        // Force immediate update
        this.parseStat();
    }

    enable() {
        this.settings = this.getSettings();
        
        // Connect settings change handlers
        this._settingsSignals = [
            this.settings.connect('changed', () => this.handleSettingsChange())
        ];
        
        // Initial setup
        this.fetchSettings();
        this.createUI();
        this.timeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this.currentSettings.refreshTime,
            () => this.parseStat()
        );
    }

    disable() {
        // Disconnect all signals
        this._settingsSignals.forEach(id => this.settings.disconnect(id));
        this._settingsSignals = [];
        
        if (this._buttonSignalId && this.nsButton) {
            this.nsButton.disconnect(this._buttonSignalId);
            this._buttonSignalId = null;
        }
        
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