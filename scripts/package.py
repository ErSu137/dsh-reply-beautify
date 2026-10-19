"""Package only explicit public files. Stable metadata; no local profiles/assets."""
from pathlib import Path
import gzip, hashlib, io, json, tarfile, zipfile
root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
manifest = json.loads((root / 'release-files.json').read_text(encoding='utf-8'))
dist = root / 'dist'
dist.mkdir(exist_ok=True)
def files(group):
    names = manifest[group]
    if len(names) != len(set(names)):
        raise ValueError('duplicate manifest entry')
    result = []
    for name in names:
        file = root / name
        if not name or Path(name).is_absolute() or '..' in Path(name).parts or '\\' in name or ':' in name:
            raise ValueError('unsafe path: ' + name)
        if not file.is_file() or file.is_symlink() or not file.resolve().is_relative_to(root.resolve()):
            raise ValueError('missing or escaped file: ' + name)
        result.append((name, file.read_bytes()))
    return sorted(result)
runtime, source = files('runtime'), files('source')
if not set(manifest['runtime']).issubset(manifest['source']):
    raise ValueError('source must include every runtime file')
with (dist / f'dsh-reply-beautify-{version}.tgz').open('wb') as output:
    with gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode='w') as archive:
            for name, content in runtime:
                item = tarfile.TarInfo('package/' + name)
                item.size, item.mode, item.mtime = len(content), 0o644, 0
                archive.addfile(item, io.BytesIO(content))
with zipfile.ZipFile(dist / f'dsh-reply-beautify-{version}.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, content in source:
        info = zipfile.ZipInfo('dsh-reply-beautify/' + name, (2026,10,19,0,0,0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, content)
archives = [dist / f'dsh-reply-beautify-{version}.{suffix}' for suffix in ('tgz','zip')]
(dist / f'SHA256SUMS-{version}.txt').write_text(''.join(hashlib.sha256(file.read_bytes()).hexdigest() + '  ' + file.name + '\n' for file in archives), encoding='utf-8')
for file in archives:
    print(f'{file.name}: {file.stat().st_size} bytes')
