"""Validated CMS documents and transactional local SQLite storage."""
import copy
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'src' / 'cms'
DEFAULT = json.loads((ROOT / 'defaults.json').read_text())
STARTER = json.loads((ROOT / 'starter.json').read_text())
IMAGE_SECTION = json.loads((ROOT / 'image.json').read_text())
EXTRA_SECTIONS = json.loads((ROOT / 'blocks.json').read_text())
TEMPLATES = {s['type']: s for s in STARTER['sections'] + DEFAULT['sections'] + [IMAGE_SECTION] + EXTRA_SECTIONS}
PROJECT = copy.deepcopy(STARTER['projects'][0])
PROJECT['note'] = ''
ARRAY_TEMPLATES = {'links': {'label': '', 'href': '/'}, 'buttons': {'label': '', 'href': '/'},
                   'projects': PROJECT, 'sections': DEFAULT['sections'][0]}


def validate(document):
    if not isinstance(document, dict):
        raise ValueError('Site content must be an object')
    if len(json.dumps(document)) > 400000:
        raise ValueError('Content exceeds 400 KB')

    def check(value, template, key='', depth=0):
        if depth > 12:
            raise ValueError('Content is too deeply nested')
        if isinstance(template, bool):
            if type(value) is not bool: raise ValueError(f'{key} must be true or false')
        elif isinstance(template, (int, float)):
            ranges = {'version': (1, 1), 'contentWidth': (320, 1600), 'padding': (0, 240), 'fontSize': (12, 48)}
            lo, hi = ranges.get(key, (0, 10000))
            if type(value) not in (int, float) or not lo <= value <= hi: raise ValueError(f'{key} must be between {lo} and {hi}')
        elif isinstance(template, str):
            if not isinstance(value, str) or len(value) > 12000: raise ValueError(f'{key} must be text of at most 12000 characters')
            if key == 'image' and value and not re.fullmatch(r'/content/media/[a-f0-9]{32}\.(png|jpg|webp)', value): raise ValueError('Images must use an uploaded CMS image URL')
            if key == 'imageSide' and value not in ('left', 'right'): raise ValueError('Image side must be left or right')
            if key == 'href' and not re.match(r'^(https?://|mailto:|/(?!/)|#)', value, re.I): raise ValueError('Links must use https://, http://, mailto:, / or #')
            if key in ('id', 'slug') and not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', value): raise ValueError(f'{key} must use lowercase letters, numbers and hyphens')
            if key in ('background', 'accent', 'muted', 'panel') or (key == 'text' and template.startswith('#')):
                if value and not re.fullmatch(r'#[0-9a-fA-F]{6}', value): raise ValueError(f'{key} must be a six-digit hex colour')
            if key == 'font' and value not in ('sans', 'serif', 'mono'): raise ValueError('Unknown font')
            if key == 'align' and value not in ('left', 'center', 'right'): raise ValueError('Unknown alignment')
        elif isinstance(template, list):
            if not isinstance(value, list) or len(value) > 100: raise ValueError(f'{key} must be a list of at most 100 items')
            item_template = template[0] if template else ARRAY_TEMPLATES.get(key, '')
            for item in value:
                if key == 'sections':
                    if not isinstance(item, dict) or item.get('type') not in TEMPLATES: raise ValueError('Unknown section type')
                    check(item, TEMPLATES[item['type']], key, depth+1)
                else: check(item, item_template, key, depth+1)
        elif isinstance(template, dict):
            if not isinstance(value, dict):
                raise ValueError(f'{key or "site"} must be an object')
            extras = set(value) - set(template)
            if key in ('sections', 'projects'):
                extras.discard('image')
                if 'image' in value:
                    media = value['image']
                    if not isinstance(media, str) or (media and not re.fullmatch(r'/content/media/[a-f0-9]{32}\.(png|jpg|webp)', media)):
                        raise ValueError('Images must use an uploaded CMS image URL')
            if extras:
                raise ValueError(f'Unknown fields in {key or "site"}')
            for field, example in template.items():
                if field == 'note' and key == 'projects' and field not in value: continue
                if field not in value: raise ValueError(f'Missing {field}')
                # Style text can be empty for inheritance, unlike the global text colour.
                if key == 'style' and field == 'text':
                    if not isinstance(value[field], str) or value[field] and not re.fullmatch(r'#[0-9a-fA-F]{6}', value[field]): raise ValueError('Invalid text colour')
                else: check(value[field], example, field, depth+1)
    check(document, DEFAULT)
    for key in ('sections', 'projects'):
        ids = [item['id' if key == 'sections' else 'slug'] for item in document[key]]
        if len(ids) != len(set(ids)): raise ValueError(f'Duplicate identifiers in {key}')
    return document


class ContentStore:
    def __init__(self, path): self.path = Path(path)

    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=10)
        db.execute('CREATE TABLE IF NOT EXISTS site (id INTEGER PRIMARY KEY CHECK(id=1), draft TEXT NOT NULL, published TEXT NOT NULL, revision INTEGER NOT NULL, published_revision INTEGER NOT NULL)')
        seed = json.dumps(DEFAULT)
        db.execute('INSERT OR IGNORE INTO site VALUES (1, ?, ?, 0, 0)', (seed, seed))
        db.commit()
        return db

    def read(self):
        db = self.connect()
        try:
            draft, published, revision, published_revision = db.execute('SELECT draft,published,revision,published_revision FROM site WHERE id=1').fetchone()
            return dict(draft=json.loads(draft), published=json.loads(published), revision=revision, publishedRevision=published_revision)
        finally: db.close()

    def save(self, document, revision):
        validate(document)
        db = self.connect()
        try:
            result = db.execute('UPDATE site SET draft=?, revision=revision+1 WHERE id=1 AND revision=?', (json.dumps(document), revision))
            if result.rowcount != 1: raise RuntimeError('Content changed in another tab. Reload before saving.')
            db.commit()
        finally: db.close()
        return self.read()

    def publish(self, revision):
        db = self.connect()
        try:
            result = db.execute('UPDATE site SET published=draft, published_revision=revision WHERE id=1 AND revision=?', (revision,))
            if result.rowcount != 1: raise RuntimeError('Draft changed. Reload before publishing.')
            db.commit()
        finally: db.close()
        return self.read()
