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

      const commentTokensByLine = new Map<number, any[]>();

      for (const token of tokens) {
        if (token.scopes.some((scope: string) => scope.startsWith('comment.'))) {
          if (!commentTokensByLine.has(token.line)) {
            commentTokensByLine.set(token.line, []);
          }
          commentTokensByLine.get(token.line)!.push(token);
        }
      }

      const linesToDelete: number[] = [];

      for (const [lineNumber, commentTokens] of commentTokensByLine.entries()) {
        const line = document.lineAt(lineNumber);
        const lineText = line.text;
        
        let totalCommentLength = 0;
        for (const token of commentTokens) {
          totalCommentLength += (token.endIndex - token.startIndex);
        }
        
        const nonWhitespaceLength = lineText.replace(/\s/g, '').length;
        const commentNonWhitespaceLength = commentTokens.reduce((sum, token) => {
          const commentText = lineText.substring(token.startIndex, token.endIndex);
          return sum + commentText.replace(/\s/g, '').length;
        }, 0);
        
        if (commentNonWhitespaceLength >= nonWhitespaceLength) {
          linesToDelete.push(lineNumber);
        }
      }

      if (linesToDelete.length === 0) {
        return;
      }

      linesToDelete.sort((a, b) => b - a);

      editor.edit(editBuilder => {
        for (const lineNumber of linesToDelete) {
          const line = document.lineAt(lineNumber);
          editBuilder.delete(line.rangeIncludingLineBreak);
        }
      }).then(success => {
        if (!success) {
          vscode.window.showErrorMessage('Failed to remove comments.');
        }
      });
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
