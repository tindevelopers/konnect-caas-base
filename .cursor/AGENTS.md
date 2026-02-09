# Cursor Agents Configuration

## Abacus AI Agent

The Abacus AI Agent extension is installed and can be activated in several ways:

### How to Access Abacus and All Its Functions

**Step-by-Step Guide:**

1. **Open Command Palette (Multiple Options)**
   
   **Option A: F1 Key**
   - Press `F1` - This is the universal shortcut for Command Palette in VS Code/Cursor
   - Works even if other apps have taken over `Cmd+Shift+P`
   
   **Option B: View Menu**
   - Click `View` in the top menu bar
   - Select `Command Palette...` from the dropdown
   
   **Option C: Custom Keyboard Shortcut**
   - If F1 doesn't work, you can set a custom shortcut:
     - Press `Cmd+K Cmd+S` (or `Ctrl+K Ctrl+S` on Windows/Linux) to open Keyboard Shortcuts
     - Search for "Command Palette"
     - Assign a new shortcut (e.g., `Cmd+Shift+;` or `Cmd+Option+P`)
   
   **Option D: If Perplexity has Cmd+Shift+P**
   - You can disable Perplexity's shortcut or change it in macOS System Preferences
   - Or use one of the options above instead

2. **Search for Abacus Commands**
   - Type `Abacus` in the command palette
   - You should see all available Abacus AI Agent commands listed, such as:
     - `Abacus: Open Abacus`
     - `Abacus: Start New Session`
     - `Abacus: Show Abacus Panel`
     - Any other Abacus-specific commands

3. **Select a Command to Activate**
   - Click on any Abacus command (e.g., "Abacus: Open Abacus")
   - This will activate the extension and open the Abacus interface

4. **View Kind Setting**
   - The current setting is `"abacus.viewKind": "editor"` which displays Abacus in the editor area
   - Alternative options you can try:
     - `"sidebar"` - Shows Abacus in the sidebar
     - `"panel"` - Shows Abacus in the bottom panel
   - To change: Open Settings → Search for "Abacus: View Kind" → Select your preferred location

5. **Access All Functions**
   - Once Abacus is open, you should see:
     - A chat interface for interacting with the AI agent
     - Function buttons or menus for different capabilities
     - Code generation tools
     - Integration options
   - If functions aren't visible, try:
     - Resizing the Abacus panel/view
     - Looking for a menu button (☰) or settings icon
     - Checking if there's a "More" or "Functions" dropdown

### Activation Methods

1. **Command Palette Activation (Recommended)**
   - Press `F1` (universal shortcut) OR `Cmd+Shift+P` (if not taken by another app)
   - Alternative: `View` menu → `Command Palette...`
   - Type "Abacus" or "Abacus AI Agent"
   - Select any Abacus-related command to activate the extension
   - **This is the most reliable way to see all available functions**

2. **Using Cursor's Agent Feature**
   - Press `Cmd+I` (Mac) or `Ctrl+I` (Windows/Linux) to open Cursor's Agent interface
   - The Abacus AI Agent should be available in the agent list
   - Select it to start a session
   - **Note:** This opens Cursor's built-in agent interface, not necessarily the Abacus extension UI

3. **Extension View**
   - Open the Extensions sidebar (left sidebar, Extensions icon)
   - Find "Abacus AI Agent"
   - Click on it to open its details
   - Look for an "Open" or "Activate" button

4. **Reload Window**
   - Sometimes extensions need a window reload to fully activate
   - Press `F1` (or `Cmd+Shift+P` if available) → Type "Reload Window" → Select "Developer: Reload Window"

### Troubleshooting: Can't See All Functions

If you can't see all the functions:

1. **Check if Extension is Activated**
   - Open Command Palette (`F1` or `View` → `Command Palette...`)
   - Type "Abacus" - if you see commands, the extension is installed
   - Run any Abacus command to activate it

2. **Try Different View Kind Settings**
   - Open Settings (`Cmd+,` or `Ctrl+,`)
   - Search for "Abacus: View Kind"
   - Try changing from "editor" to "sidebar" or "panel"
   - Reload the window after changing

3. **Check Extension Status**
   - Go to Extensions sidebar
   - Verify "Abacus AI Agent" shows as installed (not disabled)
   - Check if there are any error messages or warnings
   - Click the gear icon → Check "Extension Settings"

4. **View Container Issue**
   - The warning "View container 'abacus' does not exist" is usually resolved when:
     - The extension is activated through a command (Command Palette)
     - The extension's views are opened
     - The window is reloaded

5. **Manual Activation**
   - Open Command Palette (`F1` or `View` → `Command Palette...`)
   - Type and run: `Abacus: Open Abacus` or `Abacus: Show Abacus Panel`
   - This should force the extension to activate and show its interface

6. **Check Extension Logs**
   - Open Output panel (`Cmd+Shift+U` or `Ctrl+Shift+U`)
   - Select "Abacus AI Agent" from the dropdown to see logs
   - Look for any error messages that might indicate what's wrong

7. **Verify Extension Installation**
   - In Extensions sidebar, search for "Abacus AI Agent"
   - Make sure it's enabled (not disabled)
   - If it shows as disabled, click "Enable"
   - If it's not installed, search for it in the Extensions marketplace and install it

### Usage

Once activated and visible, the Abacus AI Agent can help with:
- Cursor skill creation
- GoHighLevel (GHL) integrations
- Code generation and automation
- AI-powered development tasks
- Deep Agent functionality for complex coding tasks

### Quick Access Tips

- **Keyboard Shortcut**: Check if Abacus has a keyboard shortcut assigned (Settings → Keyboard Shortcuts → Search "Abacus")
- **Sidebar Icon**: Look for an Abacus icon in the left sidebar after activation
- **Status Bar**: Check the bottom status bar for Abacus indicators or buttons

For more information, check the extension's documentation or visit the Abacus AI website.