import {
  SemanticTokensLegend,
  SemanticTokens,
  SemanticTokensBuilder,
} from "vscode";

import type {
  DocumentSemanticTokensProvider,
  TextDocument,
  ProviderResult,
} from "vscode";

const tokenTypes = [
  "decolator",
  "comment",
  "type",
  "function",
  "keyword",
  "operator",
  "string",
];
const legend = new SemanticTokensLegend(tokenTypes);

const provider: DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens(
    document: TextDocument
  ): ProviderResult<SemanticTokens> {
    const tokensBuilder = new SemanticTokensBuilder(legend);
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      if (line.text.startsWith("##")) {
        tokensBuilder.push(line.range, "decolator");
      } else if (line.text.startsWith("#")) {
        tokensBuilder.push(line.range, "comment");
      } else if (line.text.includes(" - ")) {
        const [cond, op] = line.text.split(" - ").map((s) => s.split(","));
        let idx = 0;
        // Cond
        for (let j = 0; j < cond.length; j++) {
          tokensBuilder.push(i, idx, cond[j].length, 6);
          idx += cond[j].length + 1;
          // Comma
          tokensBuilder.push(i, idx - 1, 1, 5);
        }
        // Hyphen
        tokensBuilder.push(i, idx - 1, 3, 5);
        idx += 2;
        // Next State
        tokensBuilder.push(
          i,
          idx,
          op[0].length,
          op[0] === "accept" || op[0] === "reject" ? 4 : 3
        );
        idx += op[0].length + 1;
        tokensBuilder.push(i, idx - 1, 1, 5);
        // Write
        for (let j = 1; j <= (op.length - 1) / 2; j++) {
          tokensBuilder.push(i, idx, op[j].length, 6);
          idx += op[j].length + 1;
          // Comma
          tokensBuilder.push(i, idx - 1, 1, 5);
        }
        // Move
        for (let j = (op.length - 1) / 2 + 1; j < op.length; j++) {
          tokensBuilder.push(i, idx, op[j].length, 3, 4);
          idx += op[j].length + 1;
          // Comma
          tokensBuilder.push(i, idx - 1, 1, 5);
        }
      } else {
        tokensBuilder.push(line.range, "type");
      }
    }
    return tokensBuilder.build();
  },
};

export { provider, legend };
