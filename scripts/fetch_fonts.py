"""Download explicitly scoped, OFL-licensed font subsets for offline delivery."""
from pathlib import Path
import re
import urllib.parse
import urllib.request

root = Path(__file__).resolve().parents[1]
out = root / 'public' / 'fonts'
out.mkdir(parents=True, exist_ok=True)
text = ''.join((root / p).read_text(encoding='utf-8') for p in ['index.html', 'src/main.js'])
chinese = ''.join(sorted(set(re.findall(r'[\u3000-\u9fff]', text))))
fonts = [
    ('Cormorant Garamond', 'cormorant-regular', 'normal', '400', None),
    ('Cormorant Garamond:ital@1', 'cormorant-italic', 'italic', '400', None),
    ('Noto Serif TC', 'noto-serif-tc-subset', 'normal', '400', chinese),
]
css = []
for family, filename, style, weight, subset in fonts:
    url = 'https://fonts.googleapis.com/css2?family=' + urllib.parse.quote(family) + '&display=swap'
    if subset:
        url += '&text=' + urllib.parse.quote(subset)
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    data = urllib.request.urlopen(request, timeout=45).read().decode()
    urls = re.findall(r'url\((https://[^)]+)\)', data)
    if not urls:
        raise RuntimeError(f'No font URLs returned for {family}')
    for i, remote in enumerate(urls):
        # Unicode subset returned for Chinese; use all Latin font sections.
        path = out / f'{filename}-{i}.woff2'
        path.write_bytes(urllib.request.urlopen(remote, timeout=60).read())
        data = data.replace(remote, f'./fonts/{path.name}')
    css.append(data)
    print(f'{family}: {len(urls)} font file(s)')
(root / 'public' / 'fonts.css').write_text('\n'.join(css), encoding='utf-8')
for family, folder in [('CormorantGaramond', 'cormorantgaramond'), ('NotoSerifTC', 'notoseriftc')]:
    url = f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/OFL.txt'
    (out / f'{family}-OFL.txt').write_bytes(urllib.request.urlopen(url, timeout=45).read())
print('Fonts and OFL notices downloaded.')
