import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const commandsDir = path.join(rootDir, 'src/commands');

async function getAllFiles(directory, fileList = []) {
  try {
    const files = await fs.readdir(directory, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(directory, file.name);
      if (file.isDirectory()) {
        if (file.name === 'modules') continue;
        await getAllFiles(filePath, fileList);
      } else if (file.name.endsWith('.js')) {
        fileList.push(filePath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${directory}:`, err.message);
  }
  return fileList;
}

async function runCheck() {
  console.log('🔍 Starting diagnostic check on all command files...\n');
  const files = await getAllFiles(commandsDir);
  console.log(`Found ${files.length} command files to evaluate.\n`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    try {
      const module = await import(`file://${filePath}`);
      const command = module.default || module;

      if (!command) {
        throw new Error('Module exported null or undefined');
      }

      if (!command.data) {
        throw new Error('Missing required "data" property (SlashCommandBuilder)');
      }

      if (!command.execute || typeof command.execute !== 'function') {
        throw new Error('Missing or invalid "execute" function');
      }

      const name = command.data.name;
      if (!name) {
        throw new Error('Command data is missing a name');
      }

      console.log(`✅ [PASS] ${relativePath} - Command: /${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ [FAIL] ${relativePath}`);
      console.log(`    └─ Error: ${error.message}`);
      failures.push({ file: relativePath, error: error.message });
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`📊 Diagnostic Report:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total evaluated: ${files.length}`);
  console.log('========================================\n');

  if (failures.length > 0) {
    console.log('⚠️  The following files failed diagnostic checks:');
    failures.forEach((f, idx) => {
      console.log(`${idx + 1}. ${f.file} -> ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 All command files loaded successfully without syntax or structural errors!');
    process.exit(0);
  }
}

runCheck();
