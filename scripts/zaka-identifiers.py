import sys
sys.dont_write_bytecode=True
import importlib.util
import json
from pathlib import Path
source=Path(__file__).parent/'vendor'/'zaka-obfuscator'/'obfuscator.py'
spec=importlib.util.spec_from_file_location('nyx_zaka',source)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
names=[]
seen=set()
while len(names)<65000:
    value=module.generate_valid_js_identifier()
    if value not in seen:
        seen.add(value)
        names.append(value)
print(json.dumps(names))
