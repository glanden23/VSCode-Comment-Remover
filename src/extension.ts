import * as vscode from 'vscode';
import TextmateLanguageService from 'vscode-textmate-languageservice';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    'comment-remover.removeAllComments',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active text editor.');
        return;
      }
      const document = editor.document;

      const textmateService = new TextmateLanguageService(document.languageId, context);
      const textmateTokenService = await textmateService.initTokenService();

      const tokens = await textmateTokenService.fetch(document);

      const linesToDelete = new Set<number>();

      for (const token of tokens) {
        if (token.scopes.some((scope: string) => scope.startsWith('comment.'))) {
          linesToDelete.add(token.line);
        }
      }

      if (linesToDelete.size === 0) {
        vscode.window.showInformationMessage('No comments found.');
        return;
      }

      const sortedLines = Array.from(linesToDelete).sort((a, b) => b - a);

      editor.edit(editBuilder => {
        for (const lineNumber of sortedLines) {
          const line = document.lineAt(lineNumber);
          editBuilder.delete(line.rangeIncludingLineBreak);
        }
      }).then(success => {
        if (success) {
          vscode.window.showInformationMessage(`Successfully removed ${linesToDelete.size} lines containing comments.`);
        } else {
          vscode.window.showErrorMessage('Failed to remove comments.');
        }
      });
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}