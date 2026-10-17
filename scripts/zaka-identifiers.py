import sys
sys.dont_write_bytecode=True
import importlib.util
import json
from pathlib import Path
source=Path(__file__).parent/'vendor'/'zaka-obfuscator'/'obfuscator.py'
spec=importlib.util.spec_from_file_location('nyx_zaka',source)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
                                                                              
                                                                                
print(json.dumps([module.generate_valid_js_identifier() for _ in range(256)]))
