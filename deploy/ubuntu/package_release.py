"""Allowlist-based, verified deployment archive without local data or keys."""
import argparse
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path, PurePosixPath
import tarfile

ROOT_FILES = {'README.md', 'README-DEPLOY.md', 'compose.ubuntu.yml', '.dockerignore', '.gitattributes'}
PRIVATE = {'.git', '.agents', '.superpowers', '.deploy', 'snapshots', 'node_modules', '__pycache__'}


def selected(path):
    parts, name = path.parts, path.name
    if any(part in PRIVATE or part.startswith('.venv') for part in parts):
        return False
    if name.startswith('.env') or path.suffix in {'.db', '.sqlite', '.sqlite3'} or '.db-' in name:
        return False
    if len(parts) == 1:
        return name in ROOT_FILES
    if parts[0] == 'backend':
        return path.suffix in {'.py', '.html', '.css', '.js'} or name == 'requirements.txt'
    if parts[:2] == ('frontend', 'dist'):
        return True
    if parts[:2] == ('deploy', 'ubuntu'):
        return path.suffix in {'.py', '.sh', '.conf', '.example', '.txt'} or name.startswith('Dockerfile.')
    if parts[:2] == ('docs', 'deployment'):
        return path.suffix == '.md'
    return path.as_posix() == 'docs/superpowers/plans/2026-10-16-ubuntu-deployment.md'


def source_files(source):
    for current, dirs, files in os.walk(source, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in PRIVATE and not d.startswith('.venv'))
        if Path(current) == source:
            dirs[:] = [d for d in dirs if d in {'backend', 'frontend', 'deploy', 'docs'}]
        if Path(current) == source / 'frontend':
            dirs[:] = [d for d in dirs if d == 'dist']
        for name in sorted(files):
            path = Path(current) / name
            if selected(path.relative_to(source)):
                yield path


def build_release(source, output):
    source, output = Path(source).resolve(), Path(output).absolute()
    if output.exists():
        raise FileExistsError('Release already exists; choose a new filename')
    required = ('backend/main.py', 'frontend/dist/index.html', 'compose.ubuntu.yml', 'deploy/ubuntu/install.sh')
    if any(not (source / name).is_file() for name in required):
        raise ValueError('Source or frontend build is incomplete')
    entries = []
    for path in source_files(source):
        relative = path.relative_to(source)
        if path.is_symlink() or not path.resolve().is_relative_to(source):
            raise ValueError('Selected source symlinks are not allowed')
        content = path.read_bytes()
        if relative.parts[:2] == ('deploy', 'ubuntu') or relative.name in {'compose.ubuntu.yml', '.dockerignore'}:
            content = content.replace(b'\r\n', b'\n')
        if relative.parts[:2] == ('frontend', 'dist') and relative.suffix == '.js' and b'http://localhost:8000' in content:
            raise ValueError('Frontend points to localhost:8000; rebuild with VITE_API_BASE_URL empty')
        entries.append((relative.as_posix(), content, 0o755 if relative.suffix == '.sh' else 0o644))
    manifest = {'format_version': 1, 'project': 'v2a', 'empty_library': True,
                'listen': '127.0.0.1:8890', 'public_entry_enabled': False,
                'files': [{'path': n, 'size': len(c), 'sha256': sha256(c).hexdigest(), 'mode': m} for n, c, m in entries]}
    entries.append(('release-manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2).encode(), 0o644))
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + '.partial')
    if temporary.exists():
        raise FileExistsError('Partial release exists; inspect before retrying')
    try:
        with tarfile.open(temporary, 'w:gz') as archive:
            for name, content, mode in entries:
                info = tarfile.TarInfo(name)
                info.size, info.mode, info.mtime = len(content), mode, 0
                archive.addfile(info, BytesIO(content))
        verify_release(temporary)
        temporary.rename(output)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
    digest = sha256(output.read_bytes()).hexdigest()
    output.with_name(output.name + '.sha256').write_bytes(f'{digest}  {output.name}\n'.encode('ascii'))
    return {'archive': str(output), 'sha256': digest, 'files': len(entries), 'empty_library': True}


def verify_release(archive_path):
    with tarfile.open(archive_path) as archive:
        members = archive.getmembers()
        names = [item.name for item in members]
        if len(names) != len(set(names)):
            raise ValueError('Duplicate archive member')
        for item in members:
            path = PurePosixPath(item.name)
            if not item.isfile() or path.is_absolute() or '..' in path.parts or '\\' in item.name or ':' in item.name:
                raise ValueError('Unsafe archive member')
        manifest = json.load(archive.extractfile('release-manifest.json'))
        expected = {item['path']: item for item in manifest['files']}
        if set(names) != set(expected) | {'release-manifest.json'}:
            raise ValueError('Manifest does not match archive members')
        for name, entry in expected.items():
            content = archive.extractfile(name).read()
            if len(content) != entry['size'] or sha256(content).hexdigest() != entry['sha256']:
                raise ValueError('Archive integrity check failed')
            if archive.getmember(name).mode != entry['mode']:
                raise ValueError('Archive permission check failed')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    result = verify_release(args.output) if args.verify else build_release(args.source, args.output)
    print(json.dumps(result, ensure_ascii=False, indent=2))
