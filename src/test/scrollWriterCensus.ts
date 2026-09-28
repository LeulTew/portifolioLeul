import ts from 'typescript';

/**
 * Finds scroll writes a source file makes outside `ownScroll`, by syntax rather
 * than by text: assignments of any kind and updates to `scrollTop` or
 * `scrollLeft` (dotted or with a literal key), and calls to `scrollTo`,
 * `scrollBy`, `scrollIntoView` or `scroll`. A write counts as owned only when it
 * sits inside the callback passed to an `ownScroll(...)` call (round 26,
 * TECH-074: a text scan missed compound, update and bracketed writes, and took
 * a nearby unrelated call or a comment for the enclosure).
 *
 * Its limits are real: a write through an alias (`const set = el.scrollTo`) or
 * a helper outside this codebase is not seen.
 */
export interface ScrollWriter {
  line: number;
  text: string;
}

const POSITIONS = new Set(['scrollTop', 'scrollLeft']);
const WRITE_CALLS = new Set(['scrollTo', 'scrollBy', 'scrollIntoView', 'scroll']);

function memberName(node: ts.Node): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    return node.argumentExpression.text;
  }
  return null;
}

function isAssignment(kind: ts.SyntaxKind): boolean {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

function isWriter(node: ts.Node): boolean {
  if (ts.isBinaryExpression(node) && isAssignment(node.operatorToken.kind)) {
    return POSITIONS.has(memberName(node.left) ?? '');
  }
  if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)) {
    return POSITIONS.has(memberName(node.operand) ?? '');
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    const name = ts.isIdentifier(callee) ? callee.text : memberName(callee);
    return name !== null && WRITE_CALLS.has(name);
  }
  return false;
}

function insideOwnScroll(node: ts.Node): boolean {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (!ts.isArrowFunction(current) && !ts.isFunctionExpression(current)) continue;
    const call: ts.Node = current.parent;
    if (ts.isCallExpression(call) && call.arguments[0] === current &&
        ts.isIdentifier(call.expression) && call.expression.text === 'ownScroll') return true;
  }
  return false;
}

function scriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

export function findUnownedScrollWriters(source: string, fileName = 'source.ts'): ScrollWriter[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  const found: ScrollWriter[] = [];
  const visit = (node: ts.Node) => {
    if (isWriter(node) && !insideOwnScroll(node)) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      found.push({ line: line + 1, text: node.getText(file) });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** Sources the census covers: application code in any script dialect, never tests. */
export const CENSUS_SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
export const CENSUS_EXCLUDED = /\.test\.[cm]?[jt]sx?$|\.d\.ts$/;
