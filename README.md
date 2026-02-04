# Command & Prompt Tracker

A VS Code extension for managing reusable commands and prompts with a premium native UI.

## Features

- **Icon-Based Grouping** — Commands and prompts are automatically organized by icon type into collapsible groups for better management
- **Triple-Tab Organization** — Separate tabs for Commands, Prompts, and a dedicated **Pinned** items view
- **Universal Search** — Filter entries instantly across all categories
- **Enhanced Design Toolkit** — Includes 15+ professional AI prompts for web design, UI/UX, accessibility, and refactoring
- **Customizable Icons & Colors** — Personalize each entry with VS Code Codicons and a curated color palette (including new design-specific icons: Paintcan, Layout, Pencil, Ruler)
- **Git Sync** — Sync your commands and prompts across machines via Git
- **Community Sync** — Subscribe to public GitHub repositories from friends to import their commands/prompts. Items are automatically kept in sync without overwriting your own personal data.

## Installation

### From VSIX

1. Download the `.vsix` file
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **Extensions: Install from VSIX...**
4. Select the downloaded `.vsix` file (e.g., `commandline-extention-1.3.1.vsix`)

## Usage

### Opening the Sidebar

Click the **Command Tracker** icon in the Activity Bar (left panel) to open the sidebar.

### Adding an Entry

1. Click the **+** button in the search bar
2. Enter a **Name** and **Content**
3. (Optional) Select a custom **Icon** and **Color**
4. Click **Save**

Entries will be automatically grouped by the icon you selected.

### Navigating Categories

- **Commands** — All command-style entries (Folder icon by default)
- **Prompts** — All AI and text prompts (Terminal icon by default)
- **Pinned** — Quick access to all pinned items across both categories

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

### Community Sync (New!)

1. Open the **Manage Sources** panel at the bottom of the sidebar.
2. Paste a GitHub repository URL from a friend.
3. The extension will fetch their `data.json` and merge the items into your view.
4. Friend items are labeled with their username and are kept in sync automatically.
5. If a friend's repository becomes private or deleted, your copies remain available as local "archived" items.

### GitHub Token Configuration

To access private repositories and enable full repository discovery:

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "Command Tracker Github Token"
3. Paste your GitHub Personal Access Token (with `repo` scope)

Generate a token at: [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)

### Reset Git Configuration

To change or remove your Git sync setup, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

**Command Tracker: Reset Git Configuration**

This gives you two options:

| Option | Description |
|--------|-------------|
| **Change remote URL** | Update the remote repository URL (e.g., switch to a different GitHub repo) |
| **Remove Git configuration completely** | Removes Git sync entirely. Your data files remain untouched, but automatic syncing stops. You can set up Git again anytime using the Sync button. |

## Icons

Over 40 codicons are available for customization, including design-themed icons:
- **Paintcan**
- **Layout**
- **Pencil**
- **Symbol Ruler**
- **Browser**
- **Symbol Color**

## Development

### Project Structure

```
commandline-extention/
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
