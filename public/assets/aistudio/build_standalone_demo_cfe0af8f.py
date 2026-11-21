"""Generate a self-contained offline demo from real project source (no web requests)."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
html=(root/'public/index.html').read_text(encoding='utf-8')
css=(root/'public/styles.css').read_text(encoding='utf-8')
logic=(root/'src/logic.mjs').read_text(encoding='utf-8')
app=(root/'public/app.js').read_text(encoding='utf-8')
logic=re.sub(r'(?m)^export ', '',logic)
app=re.sub(r'^import\s+\{[^;]+;\s*', '',app, count=1)
assert not app.startswith('import')
html=html.replace('  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />','')
html=html.replace('  <link rel="stylesheet" href="/styles.css" />',f'  <style>\n{css}\n  </style>')
html=html.replace('  <script type="module" src="/app.js"></script>',f'  <script>\nwindow.__SMOGSAFE_STANDALONE__=true;\n{logic}\n{app}\n  </script>')
(root/'docs/SmogSafe_AI_Standalone_Demo.html').write_text(html,encoding='utf-8')
Path('/mnt/data/SmogSafe_AI_Preview.html').write_text(html,encoding='utf-8')
print('Generated standalone demo:',len(html),'characters')
