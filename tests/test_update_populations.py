"""Checks tools/live/update-populations.py without network access.
Run with: python3 -m unittest discover -s tests -p 'test_*.py'"""
import importlib.util, json, os, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('update_populations', os.path.join(HERE, '..', 'tools', 'live', 'update-populations.py'))
up = importlib.util.module_from_spec(spec); spec.loader.exec_module(up)

def unit(code, population, **extra):
    return {'type': 'Feature', 'geometry': None, 'properties': {'nom': code, 'code': code, 'population': population, 'populationYear': 2023, **extra}}

class Fixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); root = self.tmp.name
        self.dist, self.live = os.path.join(root, 'dist'), os.path.join(root, 'live')
        files = {'wd/BR--17_-2.json': [unit('WD-BR-1', 100, estimated=True), unit('WD-BR-2', 200)],
                 'wd/CA-1_2.json': [unit('WD-CA-9', 50)],
                 'eu/AT1.json': [unit('EU-AT_1', 10)], 'eu/AT2.json': [unit('EU-AT_2', 20)]}
        for path, feats in files.items():
            os.makedirs(os.path.dirname(os.path.join(self.dist, path)), exist_ok=True)
            json.dump({'type': 'FeatureCollection', 'features': feats}, open(os.path.join(self.dist, path), 'w'))
        json.dump([['Wien', 'EU-AT_1', 10, 16.4, 48.2, 'AT']], open(os.path.join(self.dist, 'eu', 'places.json'), 'w'))
        json.dump([], open(os.path.join(self.dist, 'wd', 'index.json'), 'w'))
        os.makedirs(self.live)
        json.dump({'toll': {'date': '2026-09-30'}}, open(os.path.join(self.live, 'manifest.json'), 'w'))
        up.setup(self.dist, self.live)
    def tearDown(self): self.tmp.cleanup()
    def read(self, path): return json.load(open(os.path.join(self.live, path)))

class Apply(Fixture):
    def test_country_files_are_listed_and_only_those_change(self):
        up.apply('wd', {'WD-BR-1': 150, 'WD-CA-9': 999}, 2027, 'br', 'https://ibge', only=lambda n: n.startswith('BR-'))
        props = [f['properties'] for f in self.read('wd/BR--17_-2.json')['features']]
        self.assertEqual(props[0], {'nom': 'WD-BR-1', 'code': 'WD-BR-1', 'population': 150, 'populationYear': 2027})
        self.assertEqual(props[1]['population'], 200)
        self.assertFalse(os.path.exists(os.path.join(self.live, 'wd', 'CA-1_2.json')))
        self.assertFalse(os.path.exists(os.path.join(self.live, 'wd', 'index.json')))
        self.assertEqual(up.datasets['wd']['files'], ['BR--17_-2.json'])
        self.assertEqual(up.datasets['_years']['br'], 2027)

    def test_a_whole_folder_is_copied_but_never_its_search_file(self):
        up.apply('eu', {'EU-AT_1': 11}, 2025, 'eu', 'https://gisco')
        self.assertEqual(self.read('eu/AT1.json')['features'][0]['properties']['population'], 11)
        self.assertEqual(self.read('eu/AT2.json')['features'][0]['properties']['population'], 20)
        self.assertFalse(os.path.exists(os.path.join(self.live, 'eu', 'places.json')))
        self.assertNotIn('files', up.datasets['eu'])
        self.assertEqual(up.datasets['eu']['year'], 2025)

    def test_a_second_update_starts_from_the_published_copy(self):
        up.apply('wd', {'WD-BR-1': 150}, 2027, 'br', 's', only=lambda n: n.startswith('BR-'))
        up.apply('wd', {'WD-BR-2': 250}, 2028, 'br', 's', only=lambda n: n.startswith('BR-'))
        pops = [f['properties']['population'] for f in self.read('wd/BR--17_-2.json')['features']]
        self.assertEqual(pops, [150, 250])

class Main(Fixture):
    def test_a_failing_source_saves_the_others_and_reports_failure(self):
        def good(): up.apply('wd', {'WD-CA-9': 60}, 2026, 'ca', 's', only=lambda n: n.startswith('CA-'))
        def broken(): raise ValueError('layout changed')
        code = up.main(self.dist, self.live, steps=(broken, good))
        self.assertEqual(code, 1)
        manifest = self.read('manifest.json')
        self.assertEqual(manifest['datasets']['_years']['ca'], 2026)
        self.assertEqual(manifest['toll'], {'date': '2026-09-30'})

    def test_nothing_new_is_a_success(self):
        self.assertEqual(up.main(self.dist, self.live, steps=(lambda: None,)), 0)

if __name__ == '__main__': unittest.main()
