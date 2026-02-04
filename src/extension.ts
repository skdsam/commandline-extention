import * as vscode from 'vscode';
import { CommandTrackerProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new CommandTrackerProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'command-tracker-view',
            provider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('command-tracker.addEntry', () => {
            // Logic to add current selection or open add dialog
            provider.triggerAddEntry();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('command-tracker.sync', () => {
            provider.syncWithGit();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('command-tracker.resetGit', () => {
            provider.resetGitConfig();
        })
    );
}

export function deactivate() { }
