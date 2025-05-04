#!/bin/bash
set -e
set -x

# Updated variables
EXT_UUID="nettotalssimplified@avrain27"  
EXT_HOME=~/.local/share/gnome-shell/extensions/${EXT_UUID}
PROJECT_HOME="https://raw.githubusercontent.com/avrain27/nettotalssimplified/main" 
# Remove old files (if any)
rm -rf "${EXT_HOME}"

# Create directory structure
mkdir -p "${EXT_HOME}/schemas"

# Array of required files
files=(
  "convenience.js"
  "extension.js"
  "metadata.json"
  "prefs.js"
  "stylesheet.css"
  "schemas/gschemas.compiled"
  "schemas/org.gnome.shell.extensions.nettotalssimplified.gschema.xml" 
)

# Download files with error handling
for file in "${files[@]}"; do
  if ! curl -f --silent --show-error "${PROJECT_HOME}/${file}" -o "${EXT_HOME}/${file}"; then
    echo "Error downloading ${file}"
    exit 1
  fi
done

# Optional files (skip if fails)
optional_files=("LICENSE" "README.md")
for file in "${optional_files[@]}"; do
  curl -f --silent --show-error "${PROJECT_HOME}/${file}" -o "${EXT_HOME}/${file}" || true
done

# Compile schemas if gschema.xml exists
if [ -f "${EXT_HOME}/schemas/org.gnome.shell.extensions.nettotalssimplified.gschema.xml" ]; then
  glib-compile-schemas "${EXT_HOME}/schemas"
fi

# Restart GNOME Shell (modern approach)
if dbus-send --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:'Meta.restart("Restarting for NetTotalSimplified update")'; then
  echo "GNOME Shell restart initiated"
else
  echo "Warning: Could not restart GNOME Shell automatically"
  echo "Please manually restart with Alt+F2, then 'r' + Enter"
fi

# Enable extension
sleep 3  # Give time for shell to restart
gnome-extensions enable "${EXT_UUID}" || echo "Warning: Extension enable failed. Try manually via Extensions app."

echo "Installation complete for ${EXT_UUID}"