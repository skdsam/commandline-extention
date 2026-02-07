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
                    let pullSuccess = false;
                    try {
                        // Attempt standard rebase pull
                        await this._execGit(['pull', 'origin', 'main', '--rebase']);
                        pullSuccess = true;
                    } catch (pullErr: any) {
                        // If unrelated histories, attempt to reconcile
                        if (pullErr.includes('unrelated histories')) {
                            progress.report({ message: "Reconciling unrelated histories..." });
                            try {
                                await this._execGit(['pull', 'origin', 'main', '--allow-unrelated-histories', '--no-edit']);
                                pullSuccess = true;
                            } catch (reconcileErr: any) {
                                throw new Error(`Failed to reconcile histories: ${reconcileErr}`);
                            }
                        } else if (pullErr.includes('CONFLICT')) {
                            // Try JSON-level merge to auto-resolve
                            progress.report({ message: "Resolving conflict with JSON merge..." });
                            const resolved = await this._resolveConflictWithJsonMerge();
                            if (resolved) {
                                pullSuccess = true;
                            } else {
                                throw new Error('Sync conflict could not be auto-resolved. Please resolve manually or reset Git config.');
                            }
                        } else {
                            // If pull failed for other reasons (e.g. network, or non-fast-forward that rebase couldn't handle automatically)
                            throw new Error(`Pull failed: ${pullErr}. Please check your connection or resolve conflicts manually.`);
                        }
                    }

                    if (pullSuccess) {
                        try {
                            progress.report({ message: "Pushing..." });
                            await this._execGit(['push', '-u', 'origin', 'main']);
                            vscode.window.showInformationMessage('Sync complete!');
                            this._loadData(); // Reload in case pull changed data.json
                        } catch (pushErr: any) {
                            if (pushErr.includes('[rejected]') || pushErr.includes('non-fast-forward')) {
                                const resolution = await vscode.window.showWarningMessage(
                                    'Sync Conflict: Your local version and the GitHub version have diverged. How would you like to resolve this?',
                                    'Sync from GitHub (Overwrite Local)',
                                    'Sync to GitHub (Overwrite Remote)',
                                    'Cancel'
                                );

                                if (resolution === 'Sync from GitHub (Overwrite Local)') {
                                    progress.report({ message: "Resetting to remote..." });
                                    await this._execGit(['fetch', 'origin']);
                                    await this._execGit(['reset', '--hard', 'origin/main']);
                                    this._loadData();
                                    vscode.window.showInformationMessage('Local data has been overwritten with the GitHub version.');
                                } else if (resolution === 'Sync to GitHub (Overwrite Remote)') {
                                    progress.report({ message: "Force pushing to remote..." });
                                    await this._execGit(['push', '-f', 'origin', 'main']);
                                    vscode.window.showInformationMessage('GitHub version has been overwritten with your local data.');
                                }
                            } else {
                                throw pushErr;
                            }
                        }
                    }
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

            // Deduplicate items before saving
            dataToSave.items = this._deduplicate(dataToSave.items);

            fs.writeFileSync(storagePath, JSON.stringify(dataToSave, null, 2));

            // Auto-sync with Git after each save
            await this._autoSync();
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to save data: ${err.message}`);
        }
    }

    private _deduplicate(items: any[]): any[] {
        const seen = new Set();
        return items.filter(item => {
            // Key based on source (lowercased) and originalId for sourced items
            // Key based on id for local items
            const sourceKey = item.source ? item.source.toLowerCase() : 'local';
            const idKey = item.originalId || item.id;
            const key = `${sourceKey}:${idKey}`;

            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
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

    private async _getGithubUsername(): Promise<string | null> {
        try {
            const url = await this._execGit(['remote', 'get-url', 'origin']);
            // Standard https or git@ format
            const match = url.match(/github\.com[:/]([^/]+)\//);
            return match ? match[1].toLowerCase() : null;
        } catch (e) {
            return null;
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

    private async _loadData() {
        try {
            // Pre-fetch and merge with remote to minimize future conflicts
            await this._prefetchAndMerge();

            const data = this._getRawData();
            const username = await this._getGithubUsername();
            this._view?.webview.postMessage({
                type: 'dataLoaded',
                value: data,
                username: username
            });
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to load data: ${err.message}`);
        }
    }

    private async _addSubscription(url: string) {
        // Basic URL validation and normalization
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

        const username = match[1].toLowerCase();
        const repo = match[2];
        const rawUrl = `https://raw.githubusercontent.com/${username}/${repo}/main/data.json`;

        const data = this._getRawData();
        if (data.subscriptions.some((s: any) => s.url.toLowerCase() === cleanUrl.toLowerCase())) {
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
                    const existingIndex = newItems.findIndex(i =>
                        i.source && i.source.toLowerCase() === username &&
                        (i.originalId === fItem.id || i.id === fItem.id)
                    );

                    if (existingIndex !== -1) {
                        newItems[existingIndex] = {
                            ...fItem,
                            id: newItems[existingIndex].id,
                            source: username,
                            originalId: fItem.id,
                            pinned: newItems[existingIndex].pinned
                        };
                        updatedCount++;
                    } else {
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
                    const username = match[1].toLowerCase();
                    const repo = match[2];
                    const rawUrl = `https://raw.githubusercontent.com/${username}/${repo}/main/data.json`;

                    const friendData = await this._fetchJson(rawUrl);
                    const friendItems = Array.isArray(friendData) ? friendData : (friendData.items || []);

                    friendItems.forEach((fItem: any) => {
                        const existingIndex = data.items.findIndex((i: any) =>
                            i.source && i.source.toLowerCase() === username &&
                            (i.originalId === fItem.id || i.id === fItem.id)
                        );
                        if (existingIndex !== -1) {
                            data.items[existingIndex] = {
                                ...fItem,
                                id: data.items[existingIndex].id,
                                source: username,
                                originalId: fItem.id,
                                pinned: data.items[existingIndex].pinned
                            };
                        } else {
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

    /**
     * JSON-level merge for data.json files.
     * Merges items from local and remote versions:
     * - Items with the same ID: prefer newer (by timestamp in ID or lastModified)
     * - Different items: keep both
     * - Subscriptions: merge by URL, avoid duplicates
     */
    private _mergeJsonData(localData: any, remoteData: any): any {
        // Normalize both to object format
        const local = Array.isArray(localData)
            ? { items: localData, subscriptions: [] }
            : { items: localData.items || [], subscriptions: localData.subscriptions || [] };

        const remote = Array.isArray(remoteData)
            ? { items: remoteData, subscriptions: [] }
            : { items: remoteData.items || [], subscriptions: remoteData.subscriptions || [] };

        // Merge items by ID
        const itemMap = new Map<string, any>();

        // Add all remote items first
        for (const item of remote.items) {
            const key = item.source
                ? `${item.source.toLowerCase()}:${item.originalId || item.id}`
                : `local:${item.id}`;
            itemMap.set(key, { ...item, _fromRemote: true });
        }

        // Then add/update with local items (local wins for same ID if newer)
        for (const item of local.items) {
            const key = item.source
                ? `${item.source.toLowerCase()}:${item.originalId || item.id}`
                : `local:${item.id}`;

            const existing = itemMap.get(key);
            if (existing) {
                // Compare timestamps - prefer newer
                const localTime = this._extractTimestamp(item.id);
                const remoteTime = this._extractTimestamp(existing.id);

                if (localTime >= remoteTime) {
                    // Local is newer or same, keep local but preserve pinned status from both
                    itemMap.set(key, {
                        ...item,
                        pinned: item.pinned || existing.pinned
                    });
                } else {
                    // Remote is newer, keep it but merge pinned status
                    itemMap.set(key, {
                        ...existing,
                        pinned: item.pinned || existing.pinned,
                        _fromRemote: undefined
                    });
                }
            } else {
                // New local item, add it
                itemMap.set(key, item);
            }
        }

        // Clean up and convert back to array
        const mergedItems = Array.from(itemMap.values()).map(item => {
            const { _fromRemote, ...cleanItem } = item;
            return cleanItem;
        });

        // Merge subscriptions by URL (avoid duplicates)
        const subMap = new Map<string, any>();
        for (const sub of [...remote.subscriptions, ...local.subscriptions]) {
            const key = sub.url.toLowerCase();
            if (!subMap.has(key)) {
                subMap.set(key, sub);
            } else {
                // Keep the one with more recent lastSynced
                const existing = subMap.get(key);
                if (sub.lastSynced > existing.lastSynced) {
                    subMap.set(key, sub);
                }
            }
        }

        return {
            items: mergedItems,
            subscriptions: Array.from(subMap.values())
        };
    }

    /**
     * Extract timestamp from ID (IDs are typically Date.now() based)
     */
    private _extractTimestamp(id: string | number): number {
        if (typeof id === 'number') return id;
        // Try to extract numeric prefix (Date.now() format)
        const match = String(id).match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * Attempt to resolve a merge/rebase conflict using JSON-level merging.
     * Returns true if successfully resolved, false otherwise.
     */
    private async _resolveConflictWithJsonMerge(): Promise<boolean> {
        const storagePath = this._context.globalStorageUri.fsPath;
        const dataPath = path.join(storagePath, 'data.json');

        try {
            // Read the conflicted file
            const conflictedContent = fs.readFileSync(dataPath, 'utf8');

            // Check if it has conflict markers
            if (!conflictedContent.includes('<<<<<<<') &&
                !conflictedContent.includes('=======') &&
                !conflictedContent.includes('>>>>>>>')) {
                return false; // No conflict markers, not a merge conflict
            }

            // Parse out the two versions from conflict markers
            // Format: <<<<<<< HEAD\n{local}\n=======\n{remote}\n>>>>>>> {commit}
            const headMatch = conflictedContent.match(/<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======/);
            const theirsMatch = conflictedContent.match(/=======\r?\n([\s\S]*?)\r?\n>>>>>>>/);

            if (!headMatch || !theirsMatch) {
                console.log('Could not parse conflict markers');
                return false;
            }

            let localData: any;
            let remoteData: any;

            try {
                localData = JSON.parse(headMatch[1]);
            } catch (e) {
                console.log('Failed to parse local JSON from conflict');
                return false;
            }

            try {
                remoteData = JSON.parse(theirsMatch[1]);
            } catch (e) {
                console.log('Failed to parse remote JSON from conflict');
                return false;
            }

            // Merge the two versions
            const merged = this._mergeJsonData(localData, remoteData);

            // Write the merged result
            fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2));

            // Mark as resolved and continue rebase
            await this._execGit(['add', 'data.json']);

            // Check if we're in a rebase
            if (fs.existsSync(path.join(storagePath, '.git', 'rebase-merge')) ||
                fs.existsSync(path.join(storagePath, '.git', 'rebase-apply'))) {
                await this._execGit(['rebase', '--continue']);
            } else if (fs.existsSync(path.join(storagePath, '.git', 'MERGE_HEAD'))) {
                await this._execGit(['commit', '-m', '"Merge: Auto-resolved with JSON merge"']);
            }

            vscode.window.showInformationMessage('🔀 Conflict auto-resolved by merging both versions!');
            return true;
        } catch (err: any) {
            console.error('JSON merge resolution failed:', err);
            return false;
        }
    }

    /**
     * Pre-fetch and merge before saving to minimize conflicts
     */
    private async _prefetchAndMerge(): Promise<void> {
        const storagePath = this._context.globalStorageUri.fsPath;

        // Only if git is configured
        if (!fs.existsSync(path.join(storagePath, '.git'))) {
            return;
        }

        try {
            // Fetch latest from remote
            await this._execGit(['fetch', 'origin', 'main']);

            // Get remote data.json content
            const remoteContent = await this._execGit(['show', 'origin/main:data.json']).catch(() => null);
            if (!remoteContent) return;

            const localData = this._getRawData();
            let remoteData: any;

            try {
                remoteData = JSON.parse(remoteContent);
            } catch (e) {
                return; // Remote has invalid JSON, skip merge
            }

            // Merge local and remote
            const merged = this._mergeJsonData(localData, remoteData);

            // Save merged data locally (without triggering another sync)
            const dataPath = path.join(storagePath, 'data.json');
            fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2));
        } catch (err) {
            // Silently fail - this is just optimization
            console.log('Pre-fetch merge skipped:', err);
        }
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
