from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
destination = root / 'docs' / 'downloads' / 'dsh-web-research-plugin.zip'
destination.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for file in sorted((root / 'plugin').rglob('*')):
        if not file.is_file() or 'node_modules' in file.parts or file.name.startswith('.'):
            continue
        archive.write(file, Path('dsh-web-research-plugin') / file.relative_to(root / 'plugin'))
    archive.write(root / 'LICENSE', 'dsh-web-research-plugin/LICENSE')
    archive.write(root / 'THIRD_PARTY_NOTICES.md', 'dsh-web-research-plugin/THIRD_PARTY_NOTICES.md')
    for file in sorted((root / 'licenses').glob('*')):
        archive.write(file, Path('dsh-web-research-plugin/licenses') / file.name)
print(destination)
