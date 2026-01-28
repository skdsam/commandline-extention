import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
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

        return new Promise((resolve, reject) => {
            exec(`git ${args.join(' ')}`, { cwd: storagePath }, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    reject(stderr || stdout || error.message);
                } else {
                    resolve(stdout);
                }
            });
        });
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
                        await this._execGit(['init']);
                        await this._execGit(['remote', 'add', 'origin', remote]);
                        vscode.window.showInformationMessage('Git initialized and remote added.');
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
                    progress.report({ message: "Adding changes..." });
                    await this._execGit(['add', 'data.json']);

                    progress.report({ message: "Committing..." });
                    try {
                        await this._execGit(['commit', '-m', `"Sync: ${new Date().toISOString()}"`]);
                    } catch (e) {
                        // Likely no changes to commit
                    }

                    progress.report({ message: "Pulling latest..." });
                    await this._execGit(['pull', 'origin', 'main', '--rebase']);

                    progress.report({ message: "Pushing..." });
                    await this._execGit(['push', 'origin', 'main']);

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

    private _saveData(data: any) {
        try {
            const storagePath = path.join(this._context.globalStorageUri.fsPath, 'data.json');
            if (!fs.existsSync(this._context.globalStorageUri.fsPath)) {
                fs.mkdirSync(this._context.globalStorageUri.fsPath, { recursive: true });
            }
            fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to save data: ${err.message}`);
        }
    }

    private _loadData() {
        try {
            const storagePath = path.join(this._context.globalStorageUri.fsPath, 'data.json');
            if (fs.existsSync(storagePath)) {
                const data = fs.readFileSync(storagePath, 'utf8');
                this._view?.webview.postMessage({ type: 'dataLoaded', value: JSON.parse(data) });
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to load data: ${err.message}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
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
                    </div>
                    
                    <div class="search-container">
                        <input type="text" id="search" placeholder="Search..." />
                        <button id="add-btn">+</button>
                    </div>

                    <div id="list-container" class="list-container">
                        <!-- Items will be injected here -->
                    </div>

                    <div class="sync-footer">
                        <button id="sync-btn">Sync with Git</button>
                    </div>
                </div>

                <div id="modal" class="modal hidden">
                    <div class="modal-content">
                        <h3 id="modal-title">Add Entry</h3>
                        <div class="modal-body">
                            <input type="text" id="entry-name" placeholder="Name" />
                            <textarea id="entry-content" placeholder="Content"></textarea>
                            
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
