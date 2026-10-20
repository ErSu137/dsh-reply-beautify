"""Verify checksums, archive boundaries and a build/test from the extracted source."""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import subprocess
import tarfile
import zipfile
import uuid
import shutil
import os

root = Path(__file__).resolve().parent.parent
args_parser = argparse.ArgumentParser()
args_parser.add_argument('--node', default='node')
args = args_parser.parse_args()
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
dist = root / 'dist'
report = {'version': version, 'checks': []}
manifest = json.loads((root / 'release-files.json').read_text(encoding='utf-8'))
public_images = {'dsh-reply-beautify/docs/demo/04-artifact.png', 'dsh-reply-beautify/docs/demo/01-reading.png', 'dsh-reply-beautify/docs/demo/02-chart.png', 'dsh-reply-beautify/docs/demo/05-dsh-chart.png', 'dsh-reply-beautify/docs/demo/03-table.png', 'dsh-reply-beautify/docs/demo/preview.png', 'dsh-reply-beautify/docs/demo/06-dsh-curve.png'}
public_images.update('dsh-reply-beautify/assets/welcome/' + n + '.png' for n in ('deepseek','gpt','claude'))

def check(name, success):
    if not success:
        raise AssertionError(name)
    report['checks'].append(name)
def safe(name):
    p = PurePosixPath(name)
    return not p.is_absolute() and '..' not in p.parts and ':' not in name and '\\' not in name
for line in (dist / f'SHA256SUMS-{version}.txt').read_text(encoding='utf-8').splitlines():
    digest, name = line.split('  ', 1)
    check('sha256:' + name, safe(name) and hashlib.sha256((dist / name).read_bytes()).hexdigest() == digest)
with tarfile.open(dist / f'dsh-reply-beautify-{version}.tgz', 'r:gz') as archive:
    names = archive.getnames()
    check('runtime archive safe paths/files', all(safe(n) for n in names) and all(m.isfile() for m in archive.getmembers()))
    check('runtime has installer support and fifth/sixth stage docs', all(n in names for n in ['package/tools/install-support.ps1','package/docs/第五阶段-作品格式.md','package/docs/第六阶段-验收指南.md']))
    check('runtime matches explicit public inventory', set(names) == {'package/' + n for n in manifest['runtime']})
with zipfile.ZipFile(dist / f'dsh-reply-beautify-{version}.zip') as archive:
    names = archive.namelist()
    check('source archive safe paths', all(safe(n) and n.startswith('dsh-reply-beautify/') for n in names))
    check('source excludes private work and unapproved images', all(not any(p in {'work','backups','.git','.codex','evidence','node_modules'} for p in PurePosixPath(n).parts) and (Path(n).suffix.lower() not in {'.png','.jpg','.log'} or n in public_images) for n in names))
    check('source matches explicit public inventory', set(names) == {'dsh-reply-beautify/' + n for n in manifest['source']})
    stage = root / 'work' / 'qa-stage6' / ('archive-' + uuid.uuid4().hex)
    stage.mkdir(parents=True)
    for name in names:
        destination = stage.joinpath(*PurePosixPath(name).parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(archive.read(name))
project = stage / 'dsh-reply-beautify'
before = {p.name:p.read_bytes() for p in (project / 'lib').iterdir() if p.is_file()}
subprocess.run([args.node, 'scripts/build.mjs'], cwd=project, check=True, capture_output=True, text=True)
check('clean extracted source builds identically', {p.name:p.read_bytes() for p in (project / 'lib').iterdir() if p.is_file()} == before)
tests = sorted([*project.glob('tests/*.test.cjs'), *project.glob('tests/*.test.mjs')])
result = subprocess.run([args.node, '--test', *[str(p.relative_to(project)) for p in tests]], cwd=project, capture_output=True, text=True, encoding='utf-8')
(stage / 'node-tests.txt').write_text(result.stdout + result.stderr, encoding='utf-8')
check('clean extracted source tests pass', result.returncode == 0)
report['nodeTestSummary'] = result.stdout.splitlines()[-9:]
# Verify the actual extracted installation entry and required files, without
# invoking the official CLI against the user's real desktop profile.
check('extracted installer paths exist', all((project / n).is_file() for n in ['install.ps1','package.json','lib/client.js','lib/index.js','tools/desktop-cli.mjs','tools/install-support.ps1']))
shell = shutil.which('pwsh')
if shell:
    installed = subprocess.run([shell, '-NoProfile', '-File', 'tests/installer.test.ps1'], cwd=project, capture_output=True, text=True, encoding='utf-8')
    (stage / 'installer-tests.txt').write_text(installed.stdout + installed.stderr, encoding='utf-8')
    check('extracted installer isolated tests pass', installed.returncode == 0)
    windows_shell = shutil.which('powershell.exe')
    if windows_shell:
        legacy_env = dict(os.environ)
        # Python bypasses pwsh's native-command cleanup of its PSModulePath.
        # Let Windows PowerShell initialize its own Windows module locations.
        for key in list(legacy_env):
            if key.upper() == 'PSMODULEPATH':
                del legacy_env[key]
        legacy = subprocess.run([windows_shell, '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'tests/installer.test.ps1'], cwd=project, capture_output=True, env=legacy_env)
        (stage / 'windows-powershell-tests.txt').write_bytes(legacy.stdout + legacy.stderr)
        check('extracted Windows PowerShell installer tests pass', legacy.returncode == 0)
else:
    raise RuntimeError('pwsh is required for extracted installer checks')
original_demo = {n:(project / 'docs/demo' / n).read_bytes() for n in ['index.html','interactive.html']}
subprocess.run([args.node, 'scripts/build-demo.mjs'], cwd=project, check=True, capture_output=True)
check('clean extracted demo builds identically', {n:(project / 'docs/demo' / n).read_bytes() for n in original_demo} == original_demo)
subprocess.run([shutil.which('python') or 'python', 'scripts/package.py'], cwd=project, check=True, capture_output=True)
check('extracted source packages independently and identically', all((project / 'dist' / n).read_bytes() == (dist / n).read_bytes() for n in [f'dsh-reply-beautify-{version}.zip', f'dsh-reply-beautify-{version}.tgz']))
report['extractedProject'] = str(project)
(root / 'work/qa-stage6/release-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True,indent=2))
