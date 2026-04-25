const fs = require('fs');
const path = require('path');

const SOURCE_ROOTS = ['App.js', 'src'];
const ALLOWED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json']);
const MOJIBAKE_PATTERNS = [
  /\u00C3[\u0080-\u00BF\u2018-\u203A]/,
  /\u00C2[\u0080-\u00BF\u2018-\u203A]/,
  /\u00E2[\u0080-\u00BF\u2018-\u203A\u20AC]/,
  /\u00E3[\u0080-\u00BF\u2018-\u203A]/,
  /\u00F0\u0178/,
  /\uFFFD/,
];

function collectFiles(targetPath, files = []) {
  const stats = fs.statSync(targetPath);
  if (stats.isFile()) {
    if (ALLOWED_EXTENSIONS.has(path.extname(targetPath)) || path.basename(targetPath) === 'App.js') {
      files.push(targetPath);
    }
    return files;
  }

  for (const child of fs.readdirSync(targetPath)) {
    collectFiles(path.join(targetPath, child), files);
  }

  return files;
}

describe('source encoding guard', () => {
  it('does not contain common mojibake byte-sequence artifacts', () => {
    const rootDir = path.resolve(__dirname, '..', '..');
    const files = SOURCE_ROOTS.flatMap((entry) => collectFiles(path.join(rootDir, entry)));
    const offenders = [];

    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);

      lines.forEach((line, index) => {
        if (MOJIBAKE_PATTERNS.some((pattern) => pattern.test(line))) {
          offenders.push(`${path.relative(rootDir, file)}:${index + 1}:${line.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
