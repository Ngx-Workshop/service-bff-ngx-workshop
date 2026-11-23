import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtures = [];
const cleanEnv = { ...process.env };
delete cleanEnv.CI;
delete cleanEnv.HUSKY;
delete cleanEnv.NODE_ENV;
delete cleanEnv.npm_config_omit;
delete cleanEnv.NPM_CONFIG_OMIT;

function run(cwd, command, args, env = cleanEnv, expectedSuccess = true) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(result.error);
  if (expectedSuccess) {
    assert.equal(
      result.status,
      0,
      `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`
    );
  } else {
    assert.notEqual(result.status, 0, 'Expected command to reject the fixture');
  }
  return result.stdout;
}

function git(cwd, ...args) {
  return run(cwd, 'git', ['--no-pager', ...args]);
}

function fixture(name, withGit) {
  const cwd = mkdtempSync(join(tmpdir(), `bff-maintenance-${name}-`));
  fixtures.push(cwd);
  for (const file of ['package.json', 'package-lock.json']) {
    cpSync(join(root, file), join(cwd, file));
  }
  if (withGit) {
    git(cwd, 'init', '--quiet');
    git(cwd, 'config', 'user.name', 'Maintenance Fixture');
    git(cwd, 'config', 'user.email', 'fixture@example.invalid');
    git(cwd, 'config', 'commit.gpgsign', 'false');
  }
  return cwd;
}

try {
  const dev = fixture('developer', true);
  for (const path of [
    '.gitignore',
    '.prettierrc',
    '.prettierignore',
    'eslint.config.mjs',
    '.husky/pre-commit',
    '.github/workflows',
    'src',
    'test',
    'scripts/test-maintenance.mjs',
  ]) {
    mkdirSync(dirname(join(dev, path)), { recursive: true });
    cpSync(join(root, path), join(dev, path), { recursive: true });
  }
  run(dev, 'npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund']);
  assert.equal(
    git(dev, 'config', '--get', 'core.hooksPath').trim(),
    '.husky/_'
  );
  assert(existsSync(join(dev, '.husky/_/pre-commit')));
  git(dev, 'add', '.');
  run(dev, 'git', ['commit', '--quiet', '-m', 'fixture baseline'], {
    ...cleanEnv,
    HUSKY: '0',
  });

  const partial = join(dev, 'src/partial.ts');
  const stable = [
    '',
    'export function stable() {',
    "  const values = ['one', 'two', 'three'];",
    '  return values.map((value) => value.toUpperCase()).join();',
    '}',
    '',
  ].join('\n');
  const base = `export const staged = 'base';\n${stable}\nexport const unstaged = 'base';\n`;
  writeFileSync(partial, base);
  git(dev, 'add', 'src/partial.ts');
  git(dev, 'commit', '--quiet', '-m', 'partial fixture');
  writeFileSync(partial, base.replace("'base'", '"staged-change"'));
  git(dev, 'add', 'src/partial.ts');
  writeFileSync(
    partial,
    readFileSync(partial, 'utf8').replace(
      "unstaged = 'base'",
      'unstaged = "private-unstaged-change"'
    )
  );
  const unrelated = join(dev, 'src/unrelated.ts');
  writeFileSync(unrelated, 'export const unrelated="untouched"\n');
  const untouched = readFileSync(unrelated, 'utf8');
  git(dev, 'commit', '--quiet', '-m', 'partial staging verification');
  const committed = git(dev, 'show', 'HEAD:src/partial.ts');
  assert(committed.includes("staged = 'staged-change'"));
  assert(committed.includes("unstaged = 'base'"));
  assert(!committed.includes('private-unstaged-change'));
  assert.equal(
    readFileSync(partial, 'utf8'),
    base
      .replace("'base'", "'staged-change'")
      .replace("unstaged = 'base'", 'unstaged = "private-unstaged-change"')
  );
  assert.equal(readFileSync(unrelated, 'utf8'), untouched);

  const bad = join(dev, 'src/bad.ts');
  writeFileSync(bad, 'export const = ;\n');
  git(dev, 'add', 'src/bad.ts');
  const before = git(dev, 'rev-parse', 'HEAD');
  run(
    dev,
    'git',
    ['commit', '--quiet', '-m', 'must not commit'],
    cleanEnv,
    false
  );
  assert.equal(git(dev, 'rev-parse', 'HEAD'), before);
  assert.equal(readFileSync(bad, 'utf8'), 'export const = ;\n');
  assert(git(dev, 'diff', '--cached', '--name-only').includes('src/bad.ts'));
  assert.equal(readFileSync(unrelated, 'utf8'), untouched);
  console.log(
    'PASS developer npm ci, staged formatting, partial/unstaged preservation, hook failure rollback'
  );

  // Remove only these named fixture files; never change the real worktree index.
  rmSync(bad);
  rmSync(partial);
  rmSync(unrelated);
  git(dev, 'add', '--update');
  run(dev, 'git', ['commit', '--quiet', '-m', 'fixture cleanup'], {
    ...cleanEnv,
    HUSKY: '0',
  });
  run(dev, 'npm', ['run', 'format:check']);
  writeFileSync(bad, 'export const bad="format violation"\n');
  const violation = readFileSync(bad, 'utf8');
  run(dev, 'npm', ['run', 'format:check'], cleanEnv, false);
  assert.equal(readFileSync(bad, 'utf8'), violation);
  const generated = join(dev, 'src/generated/ignored.ts');
  mkdirSync(dirname(generated), { recursive: true });
  writeFileSync(generated, 'export const = ;');
  rmSync(bad);
  run(dev, 'npm', ['run', 'format:check']);
  git(dev, 'add', 'src/generated/ignored.ts');
  run(dev, 'npm', ['run', 'staged:format']);
  assert.equal(readFileSync(generated, 'utf8'), 'export const = ;');
  console.log(
    'PASS non-mutating formatting rejection and generated exclusions'
  );

  const ci = fixture('ci', true);
  run(ci, 'npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], {
    ...cleanEnv,
    CI: 'true',
  });
  assert(!existsSync(join(ci, '.husky')));

  const docker = fixture('package-only', false);
  run(docker, 'npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund']);
  assert(!existsSync(join(docker, '.husky')));

  const production = fixture('production', true);
  run(production, 'npm', [
    'ci',
    '--omit=dev',
    '--prefer-offline',
    '--no-audit',
    '--no-fund',
  ]);
  assert(!existsSync(join(production, 'node_modules/husky')));
  assert(!existsSync(join(production, '.husky')));

  const disabled = fixture('disabled', true);
  run(disabled, 'npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], {
    ...cleanEnv,
    HUSKY: '0',
  });
  assert(!existsSync(join(disabled, '.husky')));
  console.log(
    'PASS clean CI, package-only/no-Git, production --omit=dev and HUSKY=0 npm ci'
  );
} finally {
  for (const cwd of fixtures) {
    rmSync(cwd, { recursive: true, force: true });
  }
}
