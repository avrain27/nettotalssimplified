import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const schema = "org.gnome.shell.extensions.nettotalssimplified";

let settings, currentSettings, vbox;

function fetchSettings() {
    currentSettings = {
        refreshtime: settings.get_double('refreshtime'),
        fontmode: settings.get_int('fontmode'),
        minwidth: settings.get_double('minwidth'),
        textalign: settings.get_int('textalign'),
        customfont: settings.get_string('customfont'),
        systemcolr: settings.get_boolean('systemcolr'),
        tscolor: settings.get_string('tscolor'),
        lockmouse: settings.get_boolean('lockmouse')
    };
}

function addIt(element, child) {
    element.append(child);
}

function newGtkBox() {
    return new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        margin_top: 10,
        margin_bottom: 10
    });
}

class NssSpinBtn {
    constructor(name, whichHbox, getLbl = "", getTooTip = "", lwer, uper, stpInc = 1, digs = 0) {
        let boolComp = (currentSettings[name] === settings.get_default_value(name).unpack());
        getLbl = boolComp ? getLbl : `<i>${getLbl}</i>`;
        
        let whichLbl = new Gtk.Label({
            label: getLbl,
            use_markup: true,
            xalign: 0,
            tooltip_text: getTooTip
        });
        
        let whichSpinBtn = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: lwer,
                upper: uper,
                step_increment: stpInc
            }),
            digits: digs
        });
        
        whichSpinBtn.set_value(currentSettings[name]);
        whichSpinBtn.connect('value-changed', () => {
            let newValue = parseFloat(whichSpinBtn.get_value().toFixed(1));
            if (currentSettings[name] !== newValue) {
                settings.set_double(name, newValue);
                // settings.set_boolean('restartextension', true);
                currentSettings[name] = newValue;
            }
        });
        
        whichLbl.set_hexpand(true);
        addIt(whichHbox, whichLbl);
        addIt(whichHbox, whichSpinBtn);
        addIt(vbox, whichHbox);
    }
}

class NssComboBox {
    constructor(name, whichHbox, getLbl, aRray = [], getTooTip = "") {
        let boolComp = (currentSettings[name] == settings.get_default_value(name).unpack());
        getLbl = boolComp ? getLbl : `<i>${getLbl}</i>`;
        
        let whichLbl = new Gtk.Label({
            label: getLbl,
            use_markup: true,
            xalign: 0,
            tooltip_text: getTooTip
        });
        
        let whichVlue = new Gtk.ComboBoxText({
            halign: Gtk.Align.END
        });

        aRray.forEach(val => whichVlue.append_text(val));
        whichVlue.set_active(currentSettings[name]);
        
        whichVlue.connect('changed', (widget) => {
            let valueMode = widget.get_active();
            settings.set_int(name, valueMode);
            // settings.set_boolean('restartextension', true);
            currentSettings[name] = valueMode;
        });
        
        whichLbl.set_hexpand(true);
        addIt(whichHbox, whichLbl);
        addIt(whichHbox, whichVlue);
        addIt(vbox, whichHbox);
    }
}

class NssToggleBtn {
    constructor(whichHbox, getLbl, name, getTooTip = "") {
        let boolComp = (currentSettings[name] == settings.get_default_value(name).unpack());
        getLbl = boolComp ? getLbl : `<i>${getLbl}</i>`;
        
        let whichLbl = new Gtk.Label({
            label: getLbl,
            use_markup: true,
            xalign: 0,
            tooltip_text: getTooTip
        });
        
        let whichVlue = new Gtk.Switch({
            active: currentSettings[name]
        });
        
        whichVlue.connect('notify::active', (widget) => {
            settings.set_boolean(name, widget.active);
            // settings.set_boolean('restartextension', true);
            currentSettings[name] = widget.active;
        });

        whichLbl.set_hexpand(true);
        addIt(whichHbox, whichLbl);
        addIt(whichHbox, whichVlue);
        addIt(vbox, whichHbox);
    }
}

class NssColorBtn {
    constructor(whichHbox, getLbl, name, getToolTip = "") {
        let boolComp = (currentSettings[name] == settings.get_default_value(name).unpack());
        getLbl = boolComp ? getLbl : `<i>${getLbl}</i>`;
        
        let whichLbl = new Gtk.Label({
            label: getLbl,
            use_markup: true,
            xalign: 0,
            tooltip_text: getToolTip
        });
        
        let rgba = new Gdk.RGBA();
        rgba.parse(currentSettings[name]);
        
        let colorButton = new Gtk.ColorButton();
        colorButton.set_rgba(rgba);
        colorButton.connect('color-set', (widget) => {
            rgba = widget.get_rgba();
            settings.set_string(name, rgba.to_string());
            // settings.set_boolean('restartextension', true);
            currentSettings[name] = rgba.to_string();
        });

        whichLbl.set_hexpand(true);
        addIt(whichHbox, whichLbl);
        addIt(whichHbox, colorButton);
        addIt(vbox, whichHbox);
    }
}

class NssEntry {
    constructor(whichHbox, getLbl, name, getTooTip = "") {
        let boolComp = (currentSettings[name] == settings.get_default_value(name).unpack());
        getLbl = boolComp ? getLbl : `<i>${getLbl}</i>`;
        
        let whichLbl = new Gtk.Label({
            label: getLbl,
            use_markup: true,
            xalign: 0,
            tooltip_text: getTooTip
        });
        
        let whichVlue = new Gtk.Entry({
            text: currentSettings[name],
            placeholder_text: "Press Enter to apply"
        });
        
        whichVlue.connect('activate', (widget) => {
            settings.set_string(name, widget.get_text());
            // settings.set_boolean('restartextension', true);
            currentSettings[name] = widget.get_text();
        });

        whichLbl.set_hexpand(true);
        addIt(whichHbox, whichLbl);
        addIt(whichHbox, whichVlue);
        addIt(vbox, whichHbox);
    }
}

export default class NetTotalsSimplifiedPreferences extends ExtensionPreferences {
    getPreferencesWidget() {
        settings = this.getSettings(schema);
        fetchSettings();

        let frame = new Gtk.ScrolledWindow();
        let label = new Gtk.Label({
            label: "<b>Total Network Usage Settings</b>",
            use_markup: true,
            xalign: 0,
            margin_top: 15
        });
        
        vbox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_start: 25,
            margin_end: 25,
            vexpand: true,
        });
        
        let resetBtn = new Gtk.Button({
            label: "Restore Defaults",
            margin_bottom: 15
        });

        resetBtn.connect("clicked", () => {
            const settingsToReset = [
                {type: 'double', name: 'refreshtime'},
                {type: 'int', name: 'fontmode'},
                {type: 'double', name: 'minwidth'},
                {type: 'int', name: 'textalign'},
                {type: 'string', name: 'customfont'},
                {type: 'boolean', name: 'systemcolr'},
                {type: 'string', name: 'tscolor'}
            ];
            
            settingsToReset.forEach(({type, name}) => {
                settings[`set_${type}`](name, settings.get_default_value(name).unpack());
            });
            
            // settings.set_boolean('restartextension', true);
            fetchSettings();
        });

        addIt(vbox, label);
        
        // Refresh time
        let hboxRTime = newGtkBox();
        new NssSpinBtn("refreshtime", hboxRTime, "Refresh Time (seconds)", 
                      "How often to update the display", 1.0, 10.0, 0.1, 1);

        // Font size
        let hboxFontMode = newGtkBox();
        new NssComboBox("fontmode", hboxFontMode, "Font Size", 
                        ["Default", "Smallest", "Smaller", "Small", "Large"], 
                        "Size of the displayed text");

        // Minimum width
        let hboxMinWidth = newGtkBox();
        new NssSpinBtn("minwidth", hboxMinWidth, "Minimum Width (em)", 
                      "Minimum width of the display", 3.0, 10.0, 0.5, 1);

        // Text alignment
        let hboxText = newGtkBox();
        new NssComboBox("textalign", hboxText, "Text Alignment", 
                        ["Left", "Right", "Center"], 
                        "How to align the text");

        // Custom font
        let hboxCustFont = newGtkBox();
        new NssEntry(hboxCustFont, "Custom Font", "customfont", 
                    "Enter a custom font family (e.g., 'Roboto Bold')");

        // System colors
        let hboxSysColr = newGtkBox();
        new NssToggleBtn(hboxSysColr, "Use System Colors", "systemcolr", 
                        "Match the system theme colors");

        // Total color
        let tsColorButton = newGtkBox();
        new NssColorBtn(tsColorButton, "Total Color", "tscolor", 
                        "Color for the total network usage display");

        // Add new toggle for mouse control
        let hboxLockMouse = newGtkBox();
        new NssToggleBtn(hboxLockMouse, "Lock Reset Function", "lockmouse", 
                        "Prevent right-click from resetting the total count");

        addIt(vbox, resetBtn);
        frame.child = vbox;

        return frame;
    }
}