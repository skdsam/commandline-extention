# Command & Prompt Tracker

A VS Code extension for managing reusable commands and prompts with a premium native UI.

## Features

- **Dual-Tab Organization** — Separate tabs for Commands and Prompts
- **Quick Search** — Filter entries instantly with search
- **Customizable Icons & Colors** — Personalize each entry with VS Code Codicons and a curated color palette
- **Pin Important Entries** — Pinned items appear at the top with a red 📌 indicator
- **One-Click Copy** — Click any entry to copy its content to clipboard
- **Git Sync** — Sync your commands and prompts across machines via Git

## Installation

### From VSIX

1. Download the `.vsix` file
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **Extensions: Install from VSIX...**
4. Select the downloaded `.vsix` file

### From Source

```bash
git clone https://github.com/skdsam/commandline-extention.git
cd command-extention
npm install
npm run compile
```

Then press `F5` to launch the Extension Development Host.

## Usage

### Opening the Sidebar

Click the **Command Tracker** icon in the Activity Bar (left panel) to open the sidebar.

### Adding an Entry

1. Click the **+** button in the search bar
2. Enter a **Name** and **Content**
3. (Optional) Select a custom **Icon** and **Color**
4. Click **Save**

### Managing Entries

| Action | How |
|--------|-----|
| **Copy** | Click entry or the copy icon |
| **Edit** | Click the pencil icon |
| **Pin/Unpin** | Click the pin icon |
| **Delete** | Click the trash icon |

### Git Sync

**Automatic Sync:** Once Git is set up, every add, edit, or delete operation automatically syncs to your remote repository.

**Initial Setup:**
1. Click **Sync with Git** at the bottom of the sidebar
2. You'll be prompted to initialize Git and add a remote repository URL
3. After setup, all changes sync automatically in the background

**Manual Sync:** You can still click **Sync with Git** to force a manual sync if needed.

## Icons

Entries default to:
- **Terminal** icon for Prompts
- **Folder** icon for Commands

Over 30 codicons are available for customization.

## Development

### Project Structure

```
command-extention/
├── src/
│   ├── extension.ts    # Extension entry point
│   └── provider.ts     # Webview provider
├── media/
│   ├── main.js         # Frontend logic
│   ├── sidebar.css     # Styles
│   └── icon.svg        # Activity bar icon
├── package.json
└── tsconfig.json
```

### Build Commands

```bash
npm run compile    # Build the extension
npm run watch      # Watch mode for development
npx vsce package   # Generate .vsix file
```

## Requirements

- VS Code 1.80.0 or higher
- Git (optional, for sync feature)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT

---

**Author:** [skdsam](https://github.com/skdsam)
