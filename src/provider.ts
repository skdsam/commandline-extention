import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { exec } from 'child_process';

export class CommandTrackerProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        vscode.window.showInformationMessage('Command Tracker Sidebar Loaded');

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'saveData':
                    this._saveData(data.value);
                    break;
                case 'loadData':
                    this._loadData();
                    break;
                case 'copyToClipboard':
                    vscode.env.clipboard.writeText(data.value);
                    vscode.window.showInformationMessage('Copied to clipboard!');
                    break;
                case 'sync':
                    this.syncWithGit();
                    break;
                case 'addSubscription':
                    await this._addSubscription(data.value);
                    break;
                case 'removeSubscription':
                    await this._removeSubscription(data.value);
                    break;
                case 'refreshSubscriptions':
                case 'checkForUpdates':
                    await this._refreshSubscriptions();
                    break;
            }
        });
    }

    public triggerAddEntry() {
        if (this._view) {
            this._view.show?.(true);
            this._view.webview.postMessage({ type: 'triggerAdd' });
        }
    }

    private async _execGit(args: string[]): Promise<string> {
        const storagePath = this._context.globalStorageUri.fsPath;

        // Ensure storage directory exists
        if (!fs.existsSync(storagePath)) {
            try {
                fs.mkdirSync(storagePath, { recursive: true });
            } catch (err: any) {
                throw new Error(`Failed to create storage directory: ${err.message}`);
            }
        }

        return new Promise((resolve, reject) => {
            exec(`git ${args.join(' ')}`, { cwd: storagePath }, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    const detailedError = stderr || stdout || error.message;
                    reject(`Git execution failed (cwd: ${storagePath}): ${detailedError}`);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    public async resetGitConfig() {
        const storagePath = this._context.globalStorageUri.fsPath;
        const gitPath = path.join(storagePath, '.git');

        if (!fs.existsSync(gitPath)) {
            vscode.window.showInformationMessage('Git is not configured. Use "Sync with Git" to set it up.');
            return;
        }

        const choice = await vscode.window.showQuickPick(
            ['Change remote URL', 'Remove Git configuration completely'],
            { placeHolder: 'What would you like to do?' }
        );

        if (!choice) {
            return;
        }

        if (choice === 'Remove Git configuration completely') {
            const confirm = await vscode.window.showWarningMessage(
                'This will remove Git sync. Your data will remain but won\'t sync. Continue?',
                'Yes, Remove', 'Cancel'
            );
            if (confirm === 'Yes, Remove') {
                try {
                    fs.rmSync(gitPath, { recursive: true, force: true });
                    vscode.window.showInformationMessage('Git configuration removed. Click "Sync with Git" to set up again.');
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to remove Git: ${err.message}`);
                }
            }
        } else if (choice === 'Change remote URL') {
            const newUrl = await vscode.window.showInputBox({
                prompt: 'Enter the new Git remote URL',
                placeHolder: 'https://github.com/user/repo.git'
            });
            if (newUrl) {
                try {
                    await this._execGit(['remote', 'set-url', 'origin', newUrl]);
                    vscode.window.showInformationMessage(`Remote URL updated to: ${newUrl}`);
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to update remote: ${err}`);
                }
            }
        }
    }

    public async syncWithGit() {
        const storagePath = this._context.globalStorageUri.fsPath;

        try {
            // Check if git is initialized
            if (!fs.existsSync(path.join(storagePath, '.git'))) {
                const setup = await vscode.window.showInformationMessage(
                    'Git is not initialized in the storage folder. Would you like to set it up?',
                    'Yes', 'No'
                );
                if (setup === 'Yes') {
                    const remote = await vscode.window.showInputBox({
                        prompt: 'Enter your Git remote URL (e.g., https://github.com/user/repo.git)'
                    });
                    if (remote) {
                        try {
                            // Initialize git with main as default branch
                            await this._execGit(['init', '-b', 'main']);
                            await this._execGit(['remote', 'add', 'origin', remote]);

                            // Create data.json if it doesn't exist
                            const dataPath = path.join(storagePath, 'data.json');
                            if (!fs.existsSync(dataPath)) {
                                fs.writeFileSync(dataPath, '[]');
                            }

                            // Make initial commit
                            await this._execGit(['add', 'data.json']);
                            await this._execGit(['commit', '-m', '"Initial commit"']);

                            vscode.window.showInformationMessage('Git initialized with initial commit.');
                        } catch (err: any) {
                            vscode.window.showErrorMessage(`Failed to initialize Git: ${err}`);
                            return;
                        }
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            }

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Syncing Commands...",
                cancellable: false
            }, async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
                try {
                    // Check for active merge/rebase
                    if (fs.existsSync(path.join(storagePath, '.git', 'MERGE_HEAD')) ||
                        fs.existsSync(path.join(storagePath, '.git', 'rebase-merge')) ||
                        fs.existsSync(path.join(storagePath, '.git', 'rebase-apply'))) {
                        const abort = await vscode.window.showWarningMessage(
                            'A previous sync was interrupted and left Git in a conflicted state. Should I try to reset it?',
                            'Yes, Reset', 'No'
                        );
                        if (abort === 'Yes, Reset') {
                            try {
                                await this._execGit(['merge', '--abort']).catch(() => { });
                                await this._execGit(['rebase', '--abort']).catch(() => { });
                            } catch (e) { }
                        } else {
                            throw new Error('Sync cancelled: repository is in a conflicted state.');
                        }
                    }

                    progress.report({ message: "Adding changes..." });
                    await this._execGit(['add', 'data.json']);

                    progress.report({ message: "Committing..." });
                    try {
                        const status = await this._execGit(['status', '--porcelain']);
                        if (status.includes('data.json')) {
                            await this._execGit(['commit', '-m', `"Sync: ${new Date().toISOString()}"`]);
                        }
                    } catch (e) {
                        // Likely no changes to commit
                    }

                    // Try to pull first
                    progress.report({ message: "Pulling latest..." });
                    try {
                        // Attempt standard rebase pull
                        await this._execGit(['pull', 'origin', 'main', '--rebase']);
                    } catch (pullErr: any) {
                        // If unrelated histories, attempt to reconcile
                        if (pullErr.includes('unrelated histories')) {
                            progress.report({ message: "Reconciling unrelated histories..." });
                            await this._execGit(['pull', 'origin', 'main', '--allow-unrelated-histories', '--no-edit']);
                        } else if (pullErr.includes('CONFLICT')) {
                            throw new Error('Sync conflict detected in data.json. Please resolve it manually or reset Git config.');
                        } else {
                            // Other pull errors (e.g. offline) - we might still be able to push if remote is just ahead
                            console.log(`Pull failed: ${pullErr}`);
                        }
                    }

                    progress.report({ message: "Pushing..." });
                    await this._execGit(['push', '-u', 'origin', 'main']);

                    vscode.window.showInformationMessage('Sync complete!');
                    this._loadData(); // Reload in case pull changed data.json
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Sync failed: ${err}`);
                }
            });

        } catch (err: any) {
            vscode.window.showErrorMessage(`Git error: ${err}`);
        }
    }

    private async _saveData(data: any) {
        try {
            const storagePath = path.join(this._context.globalStorageUri.fsPath, 'data.json');
            if (!fs.existsSync(this._context.globalStorageUri.fsPath)) {
                fs.mkdirSync(this._context.globalStorageUri.fsPath, { recursive: true });
            }

            // Ensure we are saving in the correct object format
            let dataToSave = data;
            if (Array.isArray(data)) {
                // If the frontend sent an array, it likely doesn't have the subscriptions part yet
                // We should try to preserve existing subscriptions if we have them
                const existing = this._getRawData();
                dataToSave = {
                    items: data,
                    subscriptions: existing.subscriptions || []
                };
            }

            fs.writeFileSync(storagePath, JSON.stringify(dataToSave, null, 2));

            // Auto-sync with Git after each save
            await this._autoSync();
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to save data: ${err.message}`);
        }
    }

    private async _autoSync() {
        const storagePath = this._context.globalStorageUri.fsPath;

        // Only sync if git is initialized
        if (!fs.existsSync(path.join(storagePath, '.git'))) {
            return;
        }

        // Don't auto-sync if in a conflicted state
        if (fs.existsSync(path.join(storagePath, '.git', 'MERGE_HEAD')) ||
            fs.existsSync(path.join(storagePath, '.git', 'rebase-merge'))) {
            return;
        }

        try {
            const status = await this._execGit(['status', '--porcelain']);
            if (!status.includes('data.json')) {
                return;
            }

            await this._execGit(['add', 'data.json']);
            await this._execGit(['commit', '-m', `"Auto-sync: ${new Date().toISOString()}"`]);

            // Pull and push silently in background
            try {
                await this._execGit(['pull', 'origin', 'main', '--rebase']);
            } catch (e) {
                // If pull fails (conflicts, etc.), we stop auto-sync for now to avoid mess
                return;
            }

            await this._execGit(['push', '-u', 'origin', 'main']);
        } catch (err: any) {
            console.log(`Auto-sync failed: ${err}`);
        }
    }

    private _getRawData(): any {
        try {
            const storagePath = path.join(this._context.globalStorageUri.fsPath, 'data.json');
            if (fs.existsSync(storagePath)) {
                const content = fs.readFileSync(storagePath, 'utf8');
                const parsed = JSON.parse(content);

                // Migration: If it's an array, convert to object
                if (Array.isArray(parsed)) {
                    return {
                        items: parsed,
                        subscriptions: []
                    };
                }
                return parsed;
            }
        } catch (e) {
            console.error('Failed to read raw data', e);
        }
        return { items: [], subscriptions: [] };
    }

    private _loadData() {
        try {
            const data = this._getRawData();
            this._view?.webview.postMessage({ type: 'dataLoaded', value: data });
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to load data: ${err.message}`);
        }
    }

    private async _addSubscription(url: string) {
        // Basic URL validation and normalization
        // Convert https://github.com/user/repo to raw URL: https://raw.githubusercontent.com/user/repo/main/data.json
        let cleanUrl = url.trim().replace(/\/$/, "");
        if (!cleanUrl.startsWith('http')) {
            vscode.window.showErrorMessage('Please enter a valid GitHub URL');
            return;
        }

        const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
            vscode.window.showErrorMessage('Invalid GitHub repository URL');
            return;
        }

        const username = match[1];
        const repo = match[2];
        const rawUrl = `https://raw.githubusercontent.com/${username}/${repo}/main/data.json`;

        const data = this._getRawData();
        if (data.subscriptions.some((s: any) => s.url === cleanUrl)) {
            vscode.window.showInformationMessage('This repository is already added');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Adding ${username}'s commands...`,
            cancellable: false
        }, async () => {
            try {
                const friendData: any = await this._fetchJson(rawUrl);
                const friendItems = Array.isArray(friendData) ? friendData : (friendData.items || []);

                // Merge items
                const newItems = [...data.items];
                let addedCount = 0;
                let updatedCount = 0;

                friendItems.forEach((fItem: any) => {
                    // Check if we already have this item from this source via originalId
                    const existingIndex = newItems.findIndex(i => i.source === username && i.originalId === fItem.id);

                    if (existingIndex !== -1) {
                        // Update existing
                        newItems[existingIndex] = {
                            ...fItem,
                            id: newItems[existingIndex].id, // Keep our local random ID
                            source: username,
                            originalId: fItem.id,
                            pinned: newItems[existingIndex].pinned // Preserve our pin state
                        };
                        updatedCount++;
                    } else {
                        // Check if item with same name exists in local (conflict avoidance)
                        const nameConflict = newItems.some(i => i.name === fItem.name && (!i.source || i.source === 'local'));

                        if (!nameConflict) {
                            newItems.push({
                                ...fItem,
                                id: Date.now() + Math.random().toString(36).substr(2, 9),
                                source: username,
                                originalId: fItem.id,
                                pinned: false
                            });
                            addedCount++;
                        }
                    }
                });

                data.items = newItems;
                data.subscriptions.push({
                    id: Date.now().toString(),
                    username: username,
                    url: cleanUrl,
                    status: 'active',
                    lastSynced: new Date().toISOString()
                });

                await this._saveData(data);
                this._loadData();
                vscode.window.showInformationMessage(`Added ${username}: ${addedCount} new, ${updatedCount} updated.`);
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to add subscription: ${err.message}`);
            }
        });
    }

    private async _removeSubscription(subscriptionId: string) {
        const data = this._getRawData();
        const subIndex = data.subscriptions.findIndex((s: any) => s.id === subscriptionId);

        if (subIndex === -1) return;

        const username = data.subscriptions[subIndex].username;
        const confirm = await vscode.window.showWarningMessage(
            `Remove @${username}'s subscription?`,
            'Yes, and remove items', 'Yes, but keep items as archived', 'Cancel'
        );

        if (confirm === 'Cancel' || !confirm) return;

        if (confirm === 'Yes, and remove items') {
            data.items = data.items.filter((i: any) => i.source !== username);
        } else {
            // Label as archived
            data.items = data.items.map((i: any) => {
                if (i.source === username) {
                    return { ...i, source: `${username} (Archived)` };
                }
                return i;
            });
        }

        data.subscriptions.splice(subIndex, 1);
        await this._saveData(data);
        this._loadData();
    }

    private async _refreshSubscriptions() {
        const data = this._getRawData();
        if (data.subscriptions.length === 0) return;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Checking for updates from friends...`,
            cancellable: false
        }, async () => {
            for (const sub of data.subscriptions) {
                try {
                    const match = sub.url.match(/github\.com\/([^/]+)\/([^/]+)/);
                    if (!match) continue;
                    const username = match[1];
                    const repo = match[2];
                    const rawUrl = `https://raw.githubusercontent.com/${username}/${repo}/main/data.json`;

                    const friendData = await this._fetchJson(rawUrl);
                    const friendItems = Array.isArray(friendData) ? friendData : (friendData.items || []);

                    friendItems.forEach((fItem: any) => {
                        const existingIndex = data.items.findIndex((i: any) => i.source === username && i.originalId === fItem.id);
                        if (existingIndex !== -1) {
                            data.items[existingIndex] = {
                                ...fItem,
                                id: data.items[existingIndex].id,
                                source: username,
                                originalId: fItem.id,
                                pinned: data.items[existingIndex].pinned
                            };
                        } else {
                            // New item from friend
                            const nameConflict = data.items.some((i: any) => i.name === fItem.name && (!i.source || i.source === 'local'));
                            if (!nameConflict) {
                                data.items.push({
                                    ...fItem,
                                    id: Date.now() + Math.random().toString(36).substr(2, 9),
                                    source: username,
                                    originalId: fItem.id,
                                    pinned: false
                                });
                            }
                        }
                    });

                    sub.status = 'active';
                    sub.lastSynced = new Date().toISOString();
                } catch (e) {
                    sub.status = 'unreachable';
                }
            }
            await this._saveData(data);
            this._loadData();
        });
    }

    private _fetchJson(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Status Code: ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')).with({ query: `v=${Date.now()}` });
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.css'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <link href="${codiconsUri}" rel="stylesheet">
                <title>Command Tracker</title>
            </head>
            <body>
                <div id="app">
                    <div class="tabs">
                        <button class="tab-btn active" data-tab="commands">Commands</button>
                        <button class="tab-btn" data-tab="prompts">Prompts</button>
                        <button class="tab-btn" data-tab="pinned">Pinned</button>
                    </div>
                    
                    <div class="search-container">
                        <input type="text" id="search" placeholder="Search..." />
                        <button id="collapse-all-btn" class="icon-action-btn" title="Collapse All"><span class="codicon codicon-collapse-all"></span></button>
                        <button id="expand-all-btn" class="icon-action-btn" title="Expand All"><span class="codicon codicon-expand-all"></span></button>
                        <button id="add-btn">+</button>
                    </div>

                    <!-- Missing Repos Container -->
                    <div id="missing-repos-container" class="missing-repos-container hidden">
                        <div id="missing-repos-header" class="missing-repos-header">
                            <span class="codicon codicon-chevron-down"></span>
                            <span>Missing Repositories</span>
                        </div>
                        <div id="missing-repos-list" class="missing-repos-list"></div>
                    </div>

                    <div id="list-container" class="list-container">
                        <!-- Items will be injected here -->
                    </div>

                    <div class="sync-footer">
                        <button id="sync-btn">Sync with Git</button>
                        <button id="pull-btn" class="hidden">Pull Updates</button>
                    </div>
                </div>

                <div id="modal" class="modal hidden">
                    <div class="modal-content">
                        <h3 id="modal-title">Add Entry</h3>
                        <div class="modal-body">
                            <input type="text" id="entry-name" placeholder="Name" />
                            <textarea id="entry-content" placeholder="Content / Command"></textarea>
                            <textarea id="entry-notes" placeholder="Notes (Optional)"></textarea>
                            
                            <div class="picker-row">
                                <button id="icon-picker-trigger" class="picker-btn">
                                    <span id="current-icon-display" class="codicon codicon-symbol-folder"></span>
                                    <span id="current-icon-name">Folder</span>
                                </button>
                                <button id="color-picker-trigger" class="picker-btn">
                                    <div id="current-color-display" class="color-dot" style="background-color: var(--vscode-button-background);"></div>
                                    <span id="current-color-name">Default</span>
                                </button>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button id="cancel-modal">Cancel</button>
                            <button id="save-modal">Save</button>
                        </div>
                    </div>
                </div>

                <!-- Dropdown Pickers -->
                <div id="icon-picker-dropdown" class="picker-dropdown hidden">
                    <input type="text" id="icon-search" placeholder="Search icons..." />
                    <div id="icon-list" class="picker-list"></div>
                </div>

                <div id="color-picker-dropdown" class="picker-dropdown hidden">
                    <input type="text" id="color-search" placeholder="Search colors..." />
                    <div id="color-list" class="picker-list"></div>
                </div>

                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
