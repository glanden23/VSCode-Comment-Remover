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

      const options = await vscode.window.showQuickPick(
        [
          {
            label: 'All Comments & Documentation',
            description: 'Remove everything: single-line, block, and docstrings',
            value: 'all'
          },
          {
            label: 'Comments Only (Preserve Docstrings)',
            description: 'Remove single-line and block comments but keep documentation',
            value: 'comments-only'
          },
          {
            label: 'Single-Line Comments Only',
            description: 'Remove only single-line comments (e.g., //, #)',
            value: 'single'
          },
          {
            label: 'Block Comments Only',
            description: 'Remove only block/multi-line comments (e.g., /* */)',
            value: 'block'
          },
          {
            label: 'Documentation/Docstrings Only',
            description: 'Remove only documentation strings (e.g., """, ///)',
            value: 'docstring'
          }
        ],
        {
          placeHolder: 'Select which comments to remove',
          ignoreFocusOut: false
        }
      );

      if (!options) {
        return;
      }

      const textmateService = new TextmateLanguageService(document.languageId, context);
      const textmateTokenService = await textmateService.initTokenService();

      const tokens = await textmateTokenService.fetch(document);

      const commentTokensByLine = new Map<number, any[]>();

      for (const token of tokens) {
        const hasComment = token.scopes.some((scope: string) => scope.startsWith('comment.'));
        const hasDocstring = token.scopes.some((scope: string) => 
          scope.includes('string.quoted.docstring') || 
          scope.includes('comment.block.documentation')
        );
        
        if (!hasComment && !hasDocstring) continue;

        const isSingleLine = token.scopes.some((scope: string) => scope.includes('comment.line'));
        const isBlock = token.scopes.some((scope: string) => 
          scope.includes('comment.block') && !scope.includes('comment.block.documentation')
        );
        const isDocstring = hasDocstring || token.scopes.some((scope: string) => 
          scope.includes('comment.block.documentation')
        );

        if (options.value === 'single' && !isSingleLine) continue;
        if (options.value === 'block' && !isBlock) continue;
        if (options.value === 'docstring' && !isDocstring) continue;
        if (options.value === 'comments-only' && isDocstring) continue;

        if (!commentTokensByLine.has(token.line)) {
          commentTokensByLine.set(token.line, []);
        }
        commentTokensByLine.get(token.line)!.push(token);
      }

      const linesToDelete = new Set<number>();

      for (const [lineNumber, commentTokens] of commentTokensByLine.entries()) {
        const line = document.lineAt(lineNumber);
        const lineText = line.text;
        
        const nonWhitespaceLength = lineText.replace(/\s/g, '').length;
        const commentNonWhitespaceLength = commentTokens.reduce((sum, token) => {
          const commentText = lineText.substring(token.startIndex, token.endIndex);
          return sum + commentText.replace(/\s/g, '').length;
        }, 0);
        
        if (commentNonWhitespaceLength >= nonWhitespaceLength) {
          linesToDelete.add(lineNumber);
        }
      }

      if (linesToDelete.size === 0) {
        return;
      }

      const sortedLines = Array.from(linesToDelete).sort((a, b) => b - a);

      editor.edit(editBuilder => {
        for (const lineNumber of sortedLines) {
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