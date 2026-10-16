import importlib.util
import json
from pathlib import Path
import tarfile
import tempfile
import unittest


class ReleasePackageTests(unittest.TestCase):
    def packager(self):
        path = Path(__file__).with_name('package_release.py')
        self.assertTrue(path.is_file(), 'The allowlist release packager must exist')
        spec = importlib.util.spec_from_file_location('v2a_package_release', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def fixture(self, root):
        files = {
            'backend/main.py': 'print("example")\n',
            'backend/requirements.txt': 'fastapi\n',
            'frontend/dist/index.html': '<script src="/assets/main.js"></script>',
            'frontend/dist/assets/main.js': 'fetch("/api/history")',
            'compose.ubuntu.yml': 'name: v2a\n',
            'deploy/ubuntu/install.sh': '#!/bin/bash\r\nset -e\r\n',
            '.dockerignore': '**/*.db\n',
            'README-DEPLOY.md': 'Deployment guide',
            'backend/app.db': 'PRIVATE_DATABASE',
            'backend/database.db': 'PRIVATE_DATABASE',
            'backend/.env': 'PRIVATE_KEY',
            'backend/.env.production': 'PRIVATE_KEY',
            'backend/cookies.json': 'PRIVATE_COOKIE',
            'backend/tasks_output.txt': 'PRIVATE_LOG',
            'backend/snapshots/task/frame.jpg': 'PRIVATE_IMAGE',
            'backend/.venv/site-packages/example.py': 'PRIVATE_DEPENDENCY',
            'frontend/node_modules/example.js': 'DEPENDENCY',
            'frontend/.env.local': 'PRIVATE_KEY',
            '.git/config': 'PRIVATE_REMOTE',
        }
        for name, content in files.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content.encode())

    def test_package_excludes_private_data_and_has_verified_lf_manifest(self):
        packager = self.packager()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'project'
            root.mkdir()
            self.fixture(root)
            target = Path(tmp) / 'release.tar.gz'
            report = packager.build_release(root, target)
            self.assertTrue(report['empty_library'])
            self.assertNotIn(b'\r', target.with_name(target.name + '.sha256').read_bytes())
            with tarfile.open(target) as archive:
                names = archive.getnames()
                self.assertIn('frontend/dist/index.html', names)
                self.assertIn('backend/main.py', names)
                self.assertNotIn('backend/app.db', names)
                self.assertFalse(any('snapshots' in name or '.env' in name or 'node_modules' in name for name in names))
                self.assertFalse(any('.venv' in name or '.git/' in name or 'tasks_output' in name for name in names))
                self.assertNotIn(b'\r', archive.extractfile('deploy/ubuntu/install.sh').read())
                self.assertEqual(archive.getmember('deploy/ubuntu/install.sh').mode, 0o755)
                manifest = json.load(archive.extractfile('release-manifest.json'))
                self.assertEqual(len(manifest['files']), len(names) - 1)
                self.assertFalse(any(b'PRIVATE_' in archive.extractfile(name).read() for name in names))
            packager.verify_release(target)

    def test_missing_frontend_build_does_not_create_partial_release(self):
        packager = self.packager()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'project'
            root.mkdir()
            self.fixture(root)
            (root / 'frontend/dist/index.html').unlink()
            target = Path(tmp) / 'release.tar.gz'
            with self.assertRaises(ValueError):
                packager.build_release(root, target)
            self.assertFalse(target.exists())

    def test_selected_source_symlink_is_not_packaged(self):
        packager = self.packager()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'project'
            root.mkdir()
            self.fixture(root)
            outside = Path(tmp) / 'private.py'
            outside.write_text('PRIVATE_KEY')
            try:
                (root / 'backend/services').mkdir()
                (root / 'backend/services/link.py').symlink_to(outside)
            except OSError:
                self.skipTest('This Windows account cannot create filesystem symlinks')
            with self.assertRaises(ValueError):
                packager.build_release(root, Path(tmp) / 'release.tar.gz')


if __name__ == '__main__':
    unittest.main()
