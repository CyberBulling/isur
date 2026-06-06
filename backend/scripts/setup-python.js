const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const llmDir = path.resolve(__dirname, "..", "..", "llm");
const venvDir = path.join(llmDir, ".venv");
const venvPythonPosix = path.join(venvDir, "bin", "python");
const requirements = path.join(llmDir, "requirements.txt");

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts,
  });
}

function findSystemPython() {
  const candidates = [];
  if (process.env.PYTHON_BIN) candidates.push(process.env.PYTHON_BIN);
  candidates.push("python3.13", "python3.12");

  for (const cmd of candidates) {
    const check = spawnSync(cmd, ["--version"], { stdio: "pipe", shell: false });
    if (check.status === 0) return cmd;
  }
  return null;
}

function detectPythonMinor(cmd) {
  const check = spawnSync(cmd, ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"], {
    stdio: "pipe",
    shell: false,
  });
  if (check.status !== 0) return null;
  const value = String(check.stdout || "").trim();
  const [major, minor] = value.split(".").map((x) => Number(x));
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return { major, minor };
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`[setup-python] Не найден ${label}: ${filePath}`);
    process.exit(1);
  }
}

ensureFile(requirements, "requirements.txt");

const systemPython = findSystemPython();
if (!systemPython) {
  console.error("[setup-python] Нужен Python 3.12 или 3.13 (Python 3.14 не поддерживается текущим стеком LLM).");
  process.exit(1);
}

const hasVenvPython = fs.existsSync(venvPythonPosix);
const currentVenvVersion = hasVenvPython ? detectPythonMinor(venvPythonPosix) : null;
const needRecreateForVersion =
  !currentVenvVersion || currentVenvVersion.major !== 3 || currentVenvVersion.minor >= 14;

if (!hasVenvPython || needRecreateForVersion) {
  console.log("[setup-python] Создаю (или пересоздаю) виртуальное окружение llm/.venv ...");
  const createVenv = run(systemPython, ["-m", "venv", "--clear", venvDir], { cwd: llmDir });
  if (createVenv.error || createVenv.status !== 0) {
    console.error("[setup-python] Не удалось создать venv. Проверьте установленный Python 3.12/3.13.");
    process.exit(createVenv.status ?? 1);
  }
}

const venvPython = venvPythonPosix;

console.log("[setup-python] Обновляю pip ...");
const pipUpgrade = run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], {
  cwd: llmDir,
});
if (pipUpgrade.error || pipUpgrade.status !== 0) {
  process.exit(pipUpgrade.status ?? 1);
}

console.log("[setup-python] Устанавливаю зависимости llm/requirements.txt ...");
const installReqs = run(venvPython, ["-m", "pip", "install", "-r", requirements], {
  cwd: llmDir,
});
if (installReqs.error || installReqs.status !== 0) {
  process.exit(installReqs.status ?? 1);
}

console.log("[setup-python] Готово.");
