from pathlib import Path
for f in sorted(Path('.').iterdir()):
    print(repr(str(f.name)))
