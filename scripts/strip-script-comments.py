import ast
import io
import json
import pathlib
import re
import subprocess
import sys
import tokenize

root = pathlib.Path(sys.argv[1]).resolve()
files = subprocess.check_output(['git', 'ls-files', '-z', '*.py'], cwd=root).decode().split('\0')
changed = []
for name in filter(None, files):
    path = root / name
    with tokenize.open(path) as stream:
        source, encoding = stream.read(), stream.encoding
    original = ast.dump(ast.parse(source), include_attributes=False)
    lines = source.splitlines(keepends=True)
    count = 0
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type != tokenize.COMMENT or re.search(r'^#!|coding[:=]|copyright|license|SPDX|noqa|type:|pylint|fmt:|isort:', token.string, re.I):
            continue
        row, start = token.start
        end = token.end[1]
        lines[row-1] = lines[row-1][:start] + ' ' * (end-start) + lines[row-1][end:]
        count += 1
    updated = ''.join(lines)
    if ast.dump(ast.parse(updated), include_attributes=False) != original:
        raise RuntimeError('Syntax tree changed: ' + name)
    if count:
        path.write_text(updated, encoding=encoding, newline='')
        changed.append({'file': name, 'comments': count})
print(json.dumps(changed))
