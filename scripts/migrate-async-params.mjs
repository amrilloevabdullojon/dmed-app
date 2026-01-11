import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

// Миграция для Next.js 16 - async params
async function migrateFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // Pattern 1: { params }: { params: { ... } }
  let updated = content.replace(
    /\basync function (GET|POST|PUT|PATCH|DELETE)\s*\(\s*request:\s*NextRequest,\s*\{\s*params\s*\}:\s*\{\s*params:\s*\{([^}]+)\}\s*\}\s*\)/g,
    'async function $1(request: NextRequest, { params }: { params: Promise<{$2}> })'
  );

  // Pattern 2: Добавить await params в начале функции
  updated = updated.replace(
    /(async function (?:GET|POST|PUT|PATCH|DELETE)\s*\([^)]+\)\s*\{)\s*/g,
    '$1\n  const resolvedParams = await params;\n  '
  );

  // Pattern 3: Заменить все использования params.xxx на resolvedParams.xxx
  updated = updated.replace(/\bparams\.(\w+)/g, 'resolvedParams.$1');

  if (updated !== content) {
    writeFileSync(filePath, updated, 'utf-8');
    console.log(`✅ Migrated: ${filePath}`);
    return true;
  }

  return false;
}

// Найти все route файлы
const files = await glob('src/app/api/**/*.ts', { ignore: 'node_modules/**' });

console.log(`Found ${files.length} route files to check...\n`);

let migratedCount = 0;
for (const file of files) {
  if (await migrateFile(file)) {
    migratedCount++;
  }
}

console.log(`\n✅ Migrated ${migratedCount} files to Next.js 16 async params format`);
