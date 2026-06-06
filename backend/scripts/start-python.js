const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const llmDir = path.resolve(__dirname, "..", "..", "llm");
const venvPythonPosix = path.join(llmDir, ".venv", "bin", "python");

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts,
  });
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function findPython() {
  if (exists(venvPythonPosix)) return venvPythonPosix;
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const py313 = run("python3.13", ["--version"], { stdio: "pipe" });
  if ((py313.status ?? 1) === 0) return "python3.13";
  const py312 = run("python3.12", ["--version"], { stdio: "pipe" });
  if ((py312.status ?? 1) === 0) return "python3.12";
  return "python3";
}

const python = findPython();
const result = run(
  python,
  ["-m", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"],
  { cwd: llmDir }
);

if (result.error) {
  console.error(`[start-python] Не удалось запустить Python: ${result.error.message}`);
  console.error(
    "[start-python] Если виртуальное окружение не создано, выполните: npm run setup:python"
  );
  process.exit(1);
}

process.exit(result.status ?? 0);
