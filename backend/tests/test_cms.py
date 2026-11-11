"""CMS persistence, publication, concurrency and authorization boundaries."""
import copy
import os
import tempfile
import unittest
from unittest.mock import patch
from backend.tests import test_app as auth_tests
from backend.cms import ContentStore, DEFAULT, STARTER, EXTRA_SECTIONS, IMAGE_SECTION, validate


class ContentValidationTest(unittest.TestCase):
    def test_both_starters_validate(self):
        validate(DEFAULT)
        validate(STARTER)

    def test_visual_builder_block_types_validate_and_persist(self):
        site = copy.deepcopy(STARTER)
        for index, template in enumerate([IMAGE_SECTION, *EXTRA_SECTIONS]):
            block = copy.deepcopy(template)
            block['id'] = 'visual-block-' + str(index)
            site['sections'].append(block)
        validate(site)
        with tempfile.TemporaryDirectory() as directory:
            store = ContentStore(directory + '/cms.sqlite3')
            result = store.save(site, 0)
            self.assertEqual(result['draft']['sections'][-1]['type'], 'divider')
            self.assertEqual(store.publish(1)['published'], site)

    def test_visual_media_url_validation_applies_to_nested_gallery_images(self):
        site = copy.deepcopy(DEFAULT)
        gallery = copy.deepcopy(next(s for s in EXTRA_SECTIONS if s['type']=='gallery'))
        site['sections'].append(gallery)
        gallery['items'][0]['image'] = 'javascript:alert(1)'
        with self.assertRaises(ValueError):
            validate(site)
        gallery['items'][0]['image'] = '/content/media/' + 'a'*32 + '.png'
        validate(site)
        layout = copy.deepcopy(next(s for s in EXTRA_SECTIONS if s['type']=='image_text'))
        layout['imageSide']='javascript:alert(1)'
        site['sections'].append(layout)
        with self.assertRaises(ValueError):
            validate(site)

    def test_rejects_unsafe_links_styles_and_duplicate_ids(self):
        for mutate in (
            lambda d: d['header']['links'].append({'label': 'bad', 'href': 'javascript:alert(1)'}),
            lambda d: d['theme'].update(background='url(https://evil.invalid)'),
            lambda d: d['sections'].append(copy.deepcopy(d['sections'][0])),
            lambda d: d['sections'][0]['style'].update(padding=-1),
            lambda d: d['sections'][0].update(html='<script>bad</script>'),
        ):
            data = copy.deepcopy(DEFAULT)
            mutate(data)
            with self.assertRaises(ValueError): validate(data)

    def test_draft_publish_restart_and_conflict(self):
        with tempfile.TemporaryDirectory() as directory:
            path = directory + '/cms.sqlite3'
            store = ContentStore(path)
            draft = copy.deepcopy(DEFAULT)
            draft['sections'][0]['body'] = 'Private draft'
            saved = store.save(draft, 0)
            self.assertEqual(saved['revision'], 1)
            self.assertNotEqual(saved['published'], draft)
            self.assertEqual(ContentStore(path).read()['draft'], draft)
            with self.assertRaises(RuntimeError): store.save(DEFAULT, 0)
            with self.assertRaises(RuntimeError): store.publish(0)
            self.assertEqual(store.publish(1)['published'], draft)


class CmsAuthorizationTest(auth_tests.DashboardAuthTest):
    def setUp(self):
        super().setUp()
        self.db_env = patch.dict(os.environ, {'CMS_DATABASE': self.temp.name + '/cms.sqlite3'})
        self.db_env.start()
        self.addCleanup(self.db_env.stop)
        from backend.app import create_app
        self.app = create_app()
        self.app.testing = True
        self.app.config['TRUSTED_HOSTS'] = ['localhost']
        self.client = self.app.test_client()

    def test_anonymous_cannot_read_or_write_drafts(self):
        for method, path in [('get', '/admin/api/cms'), ('put', '/admin/api/cms'), ('post', '/admin/api/cms/publish')]:
            self.assertEqual(getattr(self.client, method)(path).status_code, 401)
        self.assertEqual(self.client.get('/admin/cms').status_code, 302)
        self.assertEqual(self.client.get('/content/site.json').json, DEFAULT)

    def test_mutations_require_csrf_and_exact_origin(self):
        self.mock_callback()
        token = self.client.get('/admin/api/session').json['csrf']
        data = {'document': DEFAULT, 'revision': 0}
        for headers in ({}, {'X-CSRF-Token': token}, {'X-CSRF-Token': token, 'Origin': 'https://evil.invalid'}):
            self.assertEqual(self.client.put('/admin/api/cms', json=data, headers=headers).status_code, 403)
        headers = {'X-CSRF-Token': token, 'Origin': 'https://ryanfitter.co.uk'}
        draft = copy.deepcopy(DEFAULT)
        draft['title'] = 'Saved draft'
        result = self.client.put('/admin/api/cms', json={'document': draft, 'revision': 0}, headers=headers)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.client.get('/content/site.json').json['title'], DEFAULT['title'])
        self.assertEqual(self.client.put('/admin/api/cms', json=data, headers=headers).status_code, 409)
        self.assertEqual(self.client.post('/admin/api/cms/publish', json={'revision': 1}, headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/content/site.json').json['title'], 'Saved draft')
        self.assertEqual(self.client.get('/admin/api/cms').headers['Cache-Control'], 'no-store')
        self.client.post('/admin/logout', data={'csrf': token}, headers={'Origin': 'https://ryanfitter.co.uk'})
        self.assertEqual(self.client.get('/admin/api/cms').status_code, 401)
