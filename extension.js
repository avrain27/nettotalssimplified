import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import Shell from 'gi://Shell';

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
        // this.menu = null;
        this._notifiedLow = false;
        this._notificationSource = null;
    }

    _removeAllTimeouts() {
        [this.timeout, this._styleTimeout, this._allocationTimeout].forEach(id => {
            if (id) {
                GLib.source_remove(id);
                // log(`Removed timeout ${id}`);
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
            mode: this.settings.get_int('mode'),
            usageLimit: this.settings.get_double('usagelimit'),
            alertThreshold: this.settings.get_double('alertthreshold')
        };
    }

    updateStyles() {
        if (!this.tsLabel || this.tsLabel.is_destroyed) return;

        let extraInfo = this.currentSettings.cusFont ? `font-family: ${this.currentSettings.cusFont}; ` : "";
        let extraLabelInfo = `${extraInfo}min-width: ${this.currentSettings.minWidth}em; `;
        extraLabelInfo += `text-align: ${["left", "right", "center"][this.currentSettings.textAlign]}; `;

        if (this.currentSettings.mode === 1) {
            extraLabelInfo += "font-feature-settings: 'tnum' 1; ";
        }

        this.tsLabel.set_style(`${extraLabelInfo}${this.currentSettings.systemColr ? "" : `color: ${this.currentSettings.tsColor}`}`);
        this.tsLabel.style_class = `forall size-${this.currentSettings.fontmode}`;
    }

    updateMouseHandler() {
        // Disconnect any existing signal to prevent multiple connections
        if (this._buttonSignalId && this.nsButton) {
            this.nsButton.disconnect(this._buttonSignalId);
            this._buttonSignalId = null;
        }
    
        if (this.nsButton) { // Ensure the button exists before connecting
            this._buttonSignalId = this.nsButton.connect(
                'button-press-event',
                (widget, event) => {
                    const button = event.get_button();

                    // Handle Right-Click (Button 3)
                    if (button === 3) {
                        // Crucially, close the menu immediately if it's open
                        // This prevents the menu from appearing even if the internal
                        // PanelMenu.Button logic would try to open it on release.
                        if (this.nsButton.menu && this.nsButton.menu.isOpen) {
                            this.nsButton.menu.close();
                        }

                        // Check the lockMouse setting
                        if (this.currentSettings.lockMouse) {
                            // If locked, we still stop the event to prevent the system context menu
                            // or any other unwanted right-click behavior on the panel item.
                            return Clutter.EVENT_STOP; 
                        } else {
                            // If lockMouse is false, perform the reset action
                            switch (this.currentSettings.mode) {
                                case 1: // Dual Mode
                                    this.resetDownload = this.totalDownload;
                                    this.resetUpload = this.totalUpload;
                                    this.updateLabel("▼ 0 B ▲ 0 B");
                                    break;
                                case 2: // Quota Mode
                                    this.resetCount = this.totalDownload + this.totalUpload;
                                    this.updateLabel("0 B");
                                    break;
                                default: // Single (Total) Mode
                                    this.resetCount = this.totalDownload + this.totalUpload;
                                    this.updateLabel("0 B");
                            }
                            this.parseStat(); // Recalculate and update immediately

                            // Stop the event propagation to prevent any other default actions
                            // (like the system context menu)
                            return Clutter.EVENT_STOP; 
                        }
                    }

                    // Handle Left-Click (Button 1)
                    // For left-clicks, we *want* the PanelMenu.Button's default behavior
                    // to open its menu. So, we return Clutter.EVENT_PROPAGATE to allow
                    // the event to continue to PanelMenu.Button's internal handlers.
                    if (button === 1) {
                        return Clutter.EVENT_PROPAGATE;
                    }

                    // For any other button clicks (e.g., middle click), allow propagation by default.
                    return Clutter.EVENT_PROPAGATE;
                }
            );
        }
    }

    updateLabel(text) {
    if (!this.tsLabel || this.tsLabel.is_destroyed) return;

    let displayText;
    switch (this.currentSettings.mode) {
        case 1: // dualmode
            displayText = text;
            break;
        case 2: // remaining
            const used = this.totalDownload + this.totalUpload - this.resetCount;
            const remaining = this.currentSettings.usageLimit - used;
            const remainingFormatted = this.formatBytes(Math.abs(remaining));
            displayText = `${remaining < 0 ? "-" : ""}${remainingFormatted} left`;
            break;
        default:
            displayText = `Σ ${text.trim()}`;
    }

    this.tsLabel.set_text(displayText);
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
    
        // Create the menu
        this.createMenu();
        
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

    createMenu() {
        const menu = this.nsButton.menu;
        menu.removeAll();  // Clear existing items

        const singleModeItem = new PopupMenu.PopupMenuItem(_('Single Mode (Total)'));
        singleModeItem.connect('activate', () => {
            this.settings.set_int('mode', 0);
            this.handleSettingsChange();
        });
        menu.addMenuItem(singleModeItem);

        const dualModeItem = new PopupMenu.PopupMenuItem(_('Dual Mode (Up/Down)'));
        dualModeItem.connect('activate', () => {
            this.settings.set_int('mode', 1);
            this.handleSettingsChange();
        });
        menu.addMenuItem(dualModeItem);

        const quotaModeItem = new PopupMenu.PopupMenuItem(_('Quota Mode (Remaining)'));
        quotaModeItem.connect('activate', () => {
            this.settings.set_int('mode', 2);
            this.handleSettingsChange();
        });
        menu.addMenuItem(quotaModeItem);

        // Quota input section
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const quotaBox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 8px;'
        });

        const quotaLabel = new St.Label({
            text: _('Quota:'),
            x_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'min-width: 50px; width: 50px; text-align: right; padding-right: 4px;'
        });
        const quotaEntry = new St.Entry({
            text: '',
            can_focus: true,
            x_expand: true,
            reactive: true,
            style: 'min-width: 100px;'
        });
        const quotaButton = new St.Button({
            label: _('Set'),
            can_focus: true,
            reactive: true,
            x_expand: false,
            style: 'min-width: 40px; width: 40px; padding: 0px 4px;'
        });

        quotaBox.add_child(quotaLabel);
        quotaBox.add_child(quotaEntry);
        quotaBox.add_child(quotaButton);

        const quotaItem = new PopupMenu.PopupBaseMenuItem({ reactive: true, can_focus: true });
        quotaItem.add_child(quotaBox); // Use add_child instead of actor.add_child for GNOME 48
        menu.addMenuItem(quotaItem);

        // Function to handle setting the quota (reused for button and Enter key)
        const setQuota = () => {
            try {
                const input = quotaEntry.get_text().trim().toUpperCase();
                // log(`[Quota Set Triggered] Input: ${input}`);

                const match = input.match(/^(\d+(?:\.\d+)?)([KMGTP]?B)?$/);
                if (!match) {
                    quotaEntry.set_text(_('Invalid'));
                    return;
                }

                const value = parseFloat(match[1]);
                const unit = match[2] || 'B';
                const unitMap = {
                    B: 1, KB: 1_000, MB: 1_000_000, GB: 1_000_000_000,
                    TB: 1_000_000_000_000, PB: 1_000_000_000_000_000
                };
                const multiplier = unitMap[unit] || 1;
                const bytes = Math.floor(value * multiplier);

                // log(`[Quota Set Triggered] Parsed: ${bytes} bytes`);
                this.settings.set_double('usagelimit', bytes);
                this.handleSettingsChange();
                menu.close(); // Close the menu after setting
            } catch (e) {
                logError(`Set quota error: ${e}`);
            }
        };

        // When the "Set" button is clicked
        quotaButton.connect('clicked', setQuota);

        // When a key is pressed in the quotaEntry
        quotaEntry.connect('key-press-event', (actor, event) => {
            const symbol = event.get_key_symbol();
            // Check for Enter key (Return or KP_Enter)
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                setQuota();
                return Clutter.EVENT_STOP; // Stop event propagation
            }
            return Clutter.EVENT_PROPAGATE; // Allow other key events to propagate
        });

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const resetItem = new PopupMenu.PopupMenuItem(_('Reset Counters'));
        resetItem.connect('activate', () => {
            switch (this.currentSettings.mode) {
                case 1:
                    this.resetDownload = this.totalDownload;
                    this.resetUpload = this.totalUpload;
                    this.updateLabel("▼ 0 B ▲ 0 B");
                    break;
                case 2:
                    this.resetCount = this.totalDownload + this.totalUpload;
                    this.updateLabel("0 B");
                    break;
                default:
                    this.resetCount = this.totalDownload + this.totalUpload;
                    this.updateLabel("0 B");
            }
            this.parseStat();
            menu.close(); // Close the menu after resetting
        });
        menu.addMenuItem(resetItem);
    }

    destroyUI() {
        if (this._buttonSignalId && this.nsButton) {
            this.nsButton.disconnect(this._buttonSignalId);
            this._buttonSignalId = null;
        }
        
        // This is no longer needed since PanelMenu.Button handles its own menu lifecycle.
        // if (this.menu) {
        //     this.menu.destroy();
        //     this.menu = null;
        // }

        if (this.nsButton) {
            if (Main.panel.statusArea[ButtonName]) {
                try {
                    Main.panel.statusArea[ButtonName].remove_child(this.nsButton);
                } catch (e) {
                    console.debug('Error removing button:', e);
                }
            }
            this.nsButton.destroy();
            this.nsButton = null;
        }
        
        this.tsLabel = this.safeDestroy(this.tsLabel);
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
    
            if (this.currentSettings.mode === 1) {
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
            this.updateLabel((this.currentSettings.mode === 1) ? "▼ 0 B ▲ 0 B" : "0 B");
        }
        if (this.currentSettings.mode === 2) {
            const used = this.totalDownload + this.totalUpload - this.resetCount;
            const remaining = this.currentSettings.usageLimit - used;

            if (remaining <= this.currentSettings.alertThreshold) {
                if (!this._notifiedLow) {
                    this.notifyUsageLow(remaining);
                    this._notifiedLow = true;
                }
            } else {
                this._notifiedLow = false; // Reset once back above threshold
            }
        }
        return true;
    }

    notifyUsageLow(remaining) {
        Main.notify(
            'Net Totals',
            `Remaining quota: ${this.formatBytes(Math.max(remaining, 0))}`
        );
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
        // Initialize resetCount if switching to quota mode
        if (this.currentSettings.mode === 2 && this.resetCount === 0) {
            this.resetCount = this.totalDownload + this.totalUpload;
        }
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