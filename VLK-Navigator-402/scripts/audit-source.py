"""Compare whitespace-normalized fragments with a saved official HTML document."""
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.hidden += 1
        if tag in ('p', 'br', 'td', 'th', 'div', 'li'):
            self.parts.append(' ')
    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden = max(0, self.hidden - 1)
        if tag in ('p', 'td', 'th', 'div', 'li'):
            self.parts.append(' ')
    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)

def normalize(text):
    return re.sub(r'\s+', ' ', text.replace('\u200b', '').replace('\ufeff', '')).strip()

raw = Path(sys.argv[1]).read_bytes()
parser = VisibleText()
parser.feed(raw.decode('utf-8'))
source = normalize(''.join(parser.parts))
fragments = json.load(sys.stdin)
unmatched = [item for item in fragments if not item['text'].strip() or normalize(item['text']) not in source]
print(json.dumps({
    'method': 'Normalized literal substring presence; does not verify placement, table geometry, completeness of live text, or clinical/legal application',
    'sha256': hashlib.sha256(raw).hexdigest(),
    'fragments': len(fragments), 'matched': len(fragments) - len(unmatched), 'unmatched': unmatched,
}, ensure_ascii=False, indent=2))
sys.exit(1 if unmatched else 0)
