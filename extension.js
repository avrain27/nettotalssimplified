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
        this._styleTimeout = null;
        this._allocationTimeout = null;
        
        this.totalDownload = 0;
        this.totalUpload = 0;
        this.lastDownload = 0;
        this.lastUpload = 0;
        this.resetDownload = 0;
        this.resetUpload = 0;
        this.resetCount = 0;
        
        this.currentSettings = null;
        this.tsLabel = null;
        this.nsButton = null;
        this._buttonSignalId = null;
        this._settingsSignals = [];
    }

    _removeAllTimeouts() {
        [this.timeout, this._styleTimeout, this._allocationTimeout].forEach(id => {
            if (id) {
                GLib.source_remove(id);
                log(`Removed timeout ${id}`);
            }
        });
        this.timeout = this._styleTimeout = this._allocationTimeout = null;
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

        if (this.currentSettings.dualmode) {
            extraLabelInfo += "font-feature-settings: 'tnum' 1; ";
        }

        this.tsLabel.set_style(`${extraLabelInfo}${this.currentSettings.systemColr ? "" : `color: ${this.currentSettings.tsColor}`}`);
        this.tsLabel.style_class = `forall size-${this.currentSettings.fontmode}`;
    }

    updateMouseHandler() {
        if (this._buttonSignalId && this.nsButton) {
            this.nsButton.disconnect(this._buttonSignalId);
            this._buttonSignalId = null;
        }
    
        if (!this.currentSettings.lockMouse && this.nsButton) {
            this._buttonSignalId = this.nsButton.connect(
                'button-press-event',
                (widget, event) => {
                    if (event.get_button() === 3) {
                        if (this.currentSettings.dualmode) {
                            this.resetDownload = this.totalDownload;
                            this.resetUpload = this.totalUpload;
                            this.updateLabel("▼ 0 B ▲ 0 B");
                        } else {
                            this.resetCount = this.totalDownload + this.totalUpload;
                            this.updateLabel("0 B");
                        }
                        this.parseStat();
                    }
                }
            );
        }
    }

    updateLabel(text) {
        if (this.tsLabel && !this.tsLabel.is_destroyed) {
            const displayText = this.currentSettings.dualmode ? text : `Σ ${text.trim()}`;
            this.tsLabel.set_text(displayText);
        }
    }

    createUI() {
        this.destroyUI();
    
        this.nsButton = new PanelMenu.Button(0.0, ButtonName, false);
        this.nsButton.reactive = true;
        this.nsButton.can_focus = false;
    
        this.tsLabel = new St.Label({
            text: 'Σ --',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: false
        });
    
        this.nsButton.add_child(this.tsLabel);
        Main.panel.addToStatusArea(ButtonName, this.nsButton, 0, "right");
    
        if (!this.tsLabel.allocation) {
            this._styleTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._styleTimeout = null;
                this.updateStyles();
                return GLib.SOURCE_REMOVE;
            });
        } else {
            this.updateStyles();
        }
    }

    destroyUI() {
        if (this._buttonSignalId && this.nsButton) {
            this.nsButton.disconnect(this._buttonSignalId);
            this._buttonSignalId = null;
        }
    
        if (Main.panel.statusArea[ButtonName]) {
            try {
                Main.panel.statusArea[ButtonName].remove_child(this.nsButton);
            } catch (e) {
                console.debug('Error removing button:', e);
            }
        }
    
        this.tsLabel = this.safeDestroy(this.tsLabel);
        this.nsButton = this.safeDestroy(this.nsButton);
    }

    parseStat() {
        try {
            let input_file = Gio.file_new_for_path('/proc/net/dev');
            let [, contents] = input_file.load_contents(null);
            contents = new TextDecoder().decode(contents);
    
            let currentDownload = 0;
            let currentUpload = 0;
            let lines = contents.split('\n');
    
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
    
                currentDownload += parseInt(fields[1]) || 0;
                currentUpload += parseInt(fields[9]) || 0;
            }
    
            const MAX_COUNTER = 4294967295;
            if (this.lastDownload > 0 && currentDownload < this.lastDownload) {
                this.totalDownload += (MAX_COUNTER - this.lastDownload) + currentDownload;
            } else {
                this.totalDownload += Math.max(0, currentDownload - this.lastDownload);
            }
    
            if (this.lastUpload > 0 && currentUpload < this.lastUpload) {
                this.totalUpload += (MAX_COUNTER - this.lastUpload) + currentUpload;
            } else {
                this.totalUpload += Math.max(0, currentUpload - this.lastUpload);
            }
    
            if (this.currentSettings.dualmode) {
                const dl = this.formatBytes(this.totalDownload - this.resetDownload);
                const ul = this.formatBytes(this.totalUpload - this.resetUpload);
                this.updateLabel(`▼ ${dl} ▲ ${ul}`);
            } else {
                const total = this.formatBytes((this.totalDownload + this.totalUpload) - this.resetCount);
                this.updateLabel(total);
            }
    
            this.lastDownload = currentDownload;
            this.lastUpload = currentUpload;
    
        } catch (e) {
            logError(`Error reading network stats: ${e}`);
            this.updateLabel(this.currentSettings.dualmode ? "▼ 0 B ▲ 0 B" : "0 B");
        }
        return true;
    }

    formatBytes(bytes) {
        bytes = Number(bytes) || 0;
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
        this._removeAllTimeouts();
        
        this.timeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this.currentSettings.refreshTime,
            () => this.parseStat()
        );

        if (!this.tsLabel || !this.tsLabel.allocation) {
            this._allocationTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._allocationTimeout = null;
                this.updateStyles();
                return GLib.SOURCE_REMOVE;
            });
        } else {
            this.updateStyles();
        }

        this.updateMouseHandler();
        this.parseStat();
    }

    enable() {
        this._removeAllTimeouts();
        this.settings = this.getSettings();
        this.fetchSettings();
        
        this.totalDownload = 0;
        this.totalUpload = 0;
        this.lastDownload = 0;
        this.lastUpload = 0;
        this.resetDownload = 0;
        this.resetUpload = 0;
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
        this._removeAllTimeouts();
        
        this._settingsSignals.forEach(id => {
            try {
                if (this.settings) {
                    this.settings.disconnect(id);
                }
            } catch (e) {
                console.debug('Error disconnecting signal:', e);
            }
        });
        this._settingsSignals = [];
        
        this.destroyUI();
        
        this.settings = null;
        this.currentSettings = null;
    }
}