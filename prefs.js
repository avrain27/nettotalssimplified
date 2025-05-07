import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SCHEMA_ID = 'org.gnome.shell.extensions.nettotalssimplified';

export default class NetTotalsSimplifiedPreferences extends ExtensionPreferences {
    getPreferencesWidget() {
        const settings = this.getSettings(SCHEMA_ID);
        let currentSettings = this._fetchSettings(settings);

        const vbox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_start: 25,
            margin_end: 25,
            vexpand: true,
        });

        vbox.append(new Gtk.Label({
            label: '<b>Total Network Usage Settings</b>',
            use_markup: true,
            xalign: 0,
            margin_top: 15,
        }));

        const resetBtn = new Gtk.Button({ 
            label: 'Restore Defaults', 
            margin_bottom: 15 
        });
        resetBtn.connect('clicked', () => {
            [
                ['double', 'refreshtime'],
                ['int', 'fontmode'],
                ['double', 'minwidth'],
                ['int', 'textalign'],
                ['string', 'customfont'],
                ['boolean', 'systemcolr'],
                ['string', 'tscolor'],
                ['boolean', 'lockmouse'],
                ['boolean', 'dualmode'],
            ].forEach(([type, key]) => {
                const defaultValue = settings.get_default_value(key).unpack();
                settings[`set_${type}`](key, defaultValue);
            });
            currentSettings = this._fetchSettings(settings);
        });
        vbox.append(resetBtn);

        // Add all your preference widgets
        this._addSpin(vbox, settings, currentSettings, 'refreshtime', 'Refresh Time (seconds)', 'How often to update the display', 1.0, 10.0, 0.1, 1);
        this._addCombo(vbox, settings, currentSettings, 'fontmode', 'Font Size', ['Default', 'Smallest', 'Smaller', 'Small', 'Large'], 'Size of the displayed text');
        this._addSpin(vbox, settings, currentSettings, 'minwidth', 'Minimum Width (em)', 'Minimum width of the display', 3.0, 10.0, 0.5, 1);
        this._addCombo(vbox, settings, currentSettings, 'textalign', 'Text Alignment', ['Left', 'Right', 'Center'], 'How to align the text');
        this._addEntry(vbox, settings, currentSettings, 'customfont', 'Custom Font', 'Enter a custom font family (e.g., "Roboto Bold")');
        this._addToggle(vbox, settings, currentSettings, 'systemcolr', 'Use System Colors', 'Match the system theme colors');
        this._addColor(vbox, settings, currentSettings, 'tscolor', 'Total Color', 'Color for the total network usage display');
        this._addToggle(vbox, settings, currentSettings, 'lockmouse', 'Lock Reset Function', 'Prevent right-click from resetting the total count');
        this._addToggle(
            vbox, 
            settings, 
            currentSettings, 
            'dualmode', 
            'Show Upload/Download Separately', 
            'Display two totals (upload + download) instead of one combined total'
        );

        const scrolled = new Gtk.ScrolledWindow();
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scrolled.set_child(vbox);

        return scrolled;
    }

    _fetchSettings(settings) {
        return {
            refreshtime: settings.get_double('refreshtime'),
            fontmode: settings.get_int('fontmode'),
            minwidth: settings.get_double('minwidth'),
            textalign: settings.get_int('textalign'),
            customfont: settings.get_string('customfont'),
            systemcolr: settings.get_boolean('systemcolr'),
            tscolor: settings.get_string('tscolor'),
            lockmouse: settings.get_boolean('lockmouse'),
            dualmode: settings.get_boolean('dualmode'),
        };
    }

    _addSpin(parent, settings, current, key, labelText, tooltip, lower, upper, step, digits) {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 10, margin_bottom: 10 });
        const label = new Gtk.Label({
            label: this._markupLabel(settings, key, labelText),
            use_markup: true,
            xalign: 0,
            tooltip_text: tooltip,
            hexpand: true,
        });
        const spin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower, upper, step_increment: step }),
            digits,
        });
        spin.set_value(current[key]);
        spin.connect('value-changed', () => {
            const value = parseFloat(spin.get_value().toFixed(digits));
            if (current[key] !== value) {
                settings.set_double(key, value);
                current[key] = value;
            }
        });
        box.append(label);
        box.append(spin);
        parent.append(box);
    }

    _addCombo(parent, settings, current, key, labelText, items, tooltip) {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 10, margin_bottom: 10 });
        const label = new Gtk.Label({
            label: this._markupLabel(settings, key, labelText),
            use_markup: true,
            xalign: 0,
            tooltip_text: tooltip,
            hexpand: true,
        });
        const combo = new Gtk.ComboBoxText({ halign: Gtk.Align.END });
        items.forEach(i => combo.append_text(i));
        combo.set_active(current[key]);
        combo.connect('changed', () => {
            const idx = combo.get_active();
            settings.set_int(key, idx);
            current[key] = idx;
        });
        box.append(label);
        box.append(combo);
        parent.append(box);
    }

    _addToggle(parent, settings, current, key, labelText, tooltip) {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 10, margin_bottom: 10 });
        const label = new Gtk.Label({
            label: this._markupLabel(settings, key, labelText),
            use_markup: true,
            xalign: 0,
            tooltip_text: tooltip,
            hexpand: true,
        });
        const toggle = new Gtk.Switch({ active: current[key] });
        toggle.connect('notify::active', () => {
            settings.set_boolean(key, toggle.active);
            current[key] = toggle.active;
        });
        box.append(label);
        box.append(toggle);
        parent.append(box);
    }

    _addColor(parent, settings, current, key, labelText, tooltip) {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 10, margin_bottom: 10 });
        const label = new Gtk.Label({
            label: this._markupLabel(settings, key, labelText),
            use_markup: true,
            xalign: 0,
            tooltip_text: tooltip,
            hexpand: true,
        });
        const rgba = new Gdk.RGBA();
        rgba.parse(current[key]);
        const color = new Gtk.ColorButton();
        color.set_rgba(rgba);
        color.connect('color-set', () => {
            const newRgba = color.get_rgba();
            const str = newRgba.to_string();
            settings.set_string(key, str);
            current[key] = str;
        });
        box.append(label);
        box.append(color);
        parent.append(box);
    }

    _addEntry(parent, settings, current, key, labelText, tooltip) {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 10, margin_bottom: 10 });
        const label = new Gtk.Label({
            label: this._markupLabel(settings, key, labelText),
            use_markup: true,
            xalign: 0,
            tooltip_text: tooltip,
            hexpand: true,
        });
        const entry = new Gtk.Entry({
            text: current[key],
            placeholder_text: 'Press Enter to apply',
        });
        entry.connect('activate', () => {
            const text = entry.get_text();
            settings.set_string(key, text);
            current[key] = text;
        });
        box.append(label);
        box.append(entry);
        parent.append(box);
    }

    _markupLabel(settings, key, text) {
        const isDefault = settings.get_default_value(key).equal(settings.get_value(key));
        return isDefault ? text : `<i>${text}</i>`;
    }
}