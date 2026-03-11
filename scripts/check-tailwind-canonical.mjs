import { promises as fs } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOTS = ['apps', 'packages'];
const FILE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', 'test-results']);
const TARGET_CALLS = new Set(['cn', 'cva']);
const violations = [];

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.storybook') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }

      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function getCallName(node) {
  if (ts.isIdentifier(node)) {
    return node.text;
  }

  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }

  return null;
}

function toCanonicalToken(token) {
  let next = token.replace(/(^|:)!([^:]+)/g, '$1$2!');
  next = next.replace(/(^|:)text-\[#fff\](?=$|:)/g, '$1text-white');
  next = next.replace(/(^|:)break-words(?=$|:)/g, '$1wrap-break-word');
  next = next.replace(/(^|:)min-w-\[(\d+)px\](?=$|:)/g, (_, prefix, px) => {
    const value = Number(px);
    if (!Number.isFinite(value) || value % 4 !== 0) {
      return `${prefix}min-w-[${px}px]`;
    }
    return `${prefix}min-w-${value / 4}`;
  });
  return next;
}

function reportViolation(sourceFile, node, token, suggested) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  violations.push(`${sourceFile.fileName}:${line + 1}:${character + 1} ${token} -> ${suggested}`);
}

function checkClassText(text, sourceFile, node) {
  const tokens = text.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const suggested = toCanonicalToken(token);

    if (suggested !== token) {
      reportViolation(sourceFile, node, token, suggested);
    }
  }
}

function inspectExpression(node, sourceFile) {
  if (!node) {
    return;
  }

  if (ts.isStringLiteralLike(node)) {
    checkClassText(node.text, sourceFile, node);
    return;
  }

  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    checkClassText(node.text, sourceFile, node);
    return;
  }

  if (ts.isTemplateExpression(node)) {
    checkClassText(node.head.text, sourceFile, node.head);

    for (const span of node.templateSpans) {
      checkClassText(span.literal.text, sourceFile, span.literal);
      inspectExpression(span.expression, sourceFile);
    }

    return;
  }

  ts.forEachChild(node, (child) => inspectExpression(child, sourceFile));
}

function visitNode(node, sourceFile) {
  if (ts.isJsxAttribute(node) && (node.name.text === 'className' || node.name.text === 'class')) {
    if (node.initializer && ts.isStringLiteral(node.initializer)) {
      checkClassText(node.initializer.text, sourceFile, node.initializer);
    } else if (node.initializer && ts.isJsxExpression(node.initializer)) {
      inspectExpression(node.initializer.expression, sourceFile);
    }
  }

  if (ts.isCallExpression(node)) {
    const callName = getCallName(node.expression);

    if (callName && TARGET_CALLS.has(callName)) {
      for (const argument of node.arguments) {
        inspectExpression(argument, sourceFile);
      }
    }
  }

  ts.forEachChild(node, (child) => visitNode(child, sourceFile));
}

const files = (await Promise.all(ROOTS.map((root) => collectFiles(root)))).flat();

for (const filePath of files) {
  const source = await fs.readFile(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  visitNode(sourceFile, sourceFile);
}

if (violations.length > 0) {
  console.error('发现非 canonical 的 Tailwind 类写法，请改为建议写法：');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}
