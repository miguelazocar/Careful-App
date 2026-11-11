"""
Parse a CCA (Cámara del Comercio Automotor) "Autos" price list PDF into
brand -> model -> version -> years-with-price.

Layout: each page has a header row with the year columns ("0 Km", then 14 used years).
Rows: BRAND (regular font, no prices, extra gap above), MODEL (bold font), VERSION (regular
font, prices under the years it was sold). We only keep *which years have a price*.

usage: python cca_parse.py <pdf> <out.json>
"""
import json
import re
import sys
from collections import Counter

from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams, LTChar, LTTextContainer, LTTextLine

MONTHS = 'enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre'.split()
PRICE = re.compile(r'^\d[\d.,]*$')


def words_of(line):
    out, cur, x0, font = [], '', None, None
    for ch in line:
        t = ch.get_text() if isinstance(ch, LTChar) else ' '
        if t == ' ' or not isinstance(ch, LTChar):
            if cur:
                out.append((cur, x0, font))
                cur = ''
            continue
        if not cur:
            # style = font family + rounded size (old lists mark models with a bigger size)
            x0, font = ch.x0, f"{ch.fontname.split('+')[-1]}@{round(ch.size)}"
        cur += t
    if cur:
        out.append((cur, x0, font))
    return out


def page_words(page):
    ws = []
    for el in page:
        if isinstance(el, LTTextContainer):
            for line in el:
                if isinstance(line, LTTextLine):
                    yc = (line.y0 + line.y1) / 2
                    for w, x0, font in words_of(line):
                        ws.append((yc, x0, w, font))
    return ws


def cluster_rows(ws, tol=3.5):
    ws = sorted(ws, key=lambda w: -w[0])
    rows = []
    for w in ws:
        if rows and abs(rows[-1]['y'] - w[0]) <= tol:
            rows[-1]['w'].append(w)
        else:
            rows.append({'y': w[0], 'w': [w]})
    for r in rows:
        r['w'].sort(key=lambda w: w[1])
    return rows


def main(pdf, out):
    list_year = None
    columns = None  # [(x0, year)]
    regular_font = None
    data = {}  # brand -> model -> version -> set(years)
    brand = model = None
    font_counter = Counter()
    all_rows = []

    for page in extract_pages(pdf, laparams=LAParams(char_margin=1.0, word_margin=0.15)):
        ws = page_words(page)
        rows = cluster_rows(ws)
        # list year from the title ("Noviembre 2026", "Noviembre de 2011")
        if list_year is None:
            text = ' '.join(w[2] for w in ws).lower()
            m = re.search(r'(' + '|'.join(MONTHS) + r')\s+(?:de\s+)?(\d{4})', text)
            if m:
                list_year = int(m.group(2))
        # header columns: year tokens (and "0 Km") on the upper part of the page
        cand = [w for w in ws if re.fullmatch(r'(19|20)\d\d', w[2]) and w[1] > 250 and w[0] > page.height * 0.6 and (not list_year or list_year - 16 <= int(w[2]) < list_year)]
        # keep only the header line (the y shared by most year tokens)
        if cand:
            ys = Counter(round(w[0]) for w in cand)
            hy = ys.most_common(1)[0][0]
            cand = [w for w in cand if abs(w[0] - hy) < 4 or (len(ys) > 1 and abs(w[0] - hy) < 16)]
        hdr = [(w[1], int(w[2])) for w in cand]
        zero = [w for w in ws if w[2] == '0' and w[1] > 250 and w[0] > page.height * 0.6]
        page_cols = sorted(hdr)
        if zero and list_year:
            page_cols = sorted([(zero[0][1], list_year)] + [c for c in page_cols if c[1] != list_year])
        if len(page_cols) >= 8:
            columns = page_cols
        if not columns:
            continue
        first_x = columns[0][0]
        header_y = max(w[0] for w in cand) if hdr else page.height
        for r in rows:
            if r['y'] >= header_y - 2:
                continue  # title / header area
            # prices are right-aligned: the 0 Km ones can start a bit left of their header
            is_price = lambda w: PRICE.match(w[2]) and w[1] >= first_x - 45
            name_words = [w for w in r['w'] if w[1] < first_x - 12 and not is_price(w)]
            prices = [w for w in r['w'] if is_price(w)]
            if not name_words:
                continue
            toks = [w[2] for w in name_words]
            # some lists fake bold by printing the text twice ("TOYOTA TOYOTA")
            h = len(toks) // 2
            if len(toks) % 2 == 0 and h and toks[:h] == toks[h:]:
                toks = toks[:h]
            name = ' '.join(toks).strip()
            font = name_words[0][3]
            font_counter[font] += 1
            years = set()
            for w in prices:
                x = w[1]
                year = min(columns, key=lambda c: abs(c[0] - x))[1]
                years.add(year)
            all_rows.append({'y': r['y'], 'name': name, 'font': font, 'years': sorted(years)})

    regular_font = font_counter.most_common(1)[0][0]
    import os, unicodedata
    def norm(t):
        return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower())
    known = set()
    kb = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ml_brands.json')
    if os.path.exists(kb):
        known |= {norm(b) for b in json.load(open(kb, encoding='utf-8'))}
    k2 = os.path.join(os.path.dirname(os.path.abspath(pdf)), 'parsed_2026.json')
    if os.path.exists(k2):
        known |= {norm(b['name']) for b in json.load(open(k2, encoding='utf-8'))['brands']}
    known |= {norm(x) for x in ['MERCEDES BENZ', 'DS AUTOMOBILES', 'MINI COOPER', 'GREAT WALL', 'LAND ROVER', 'ALFA ROMEO', 'ALEKO', 'DAEWOO', 'DAIHATSU', 'SEAT', 'ROVER', 'LADA', 'MAZDA', 'SAAB', 'IVECO', 'MAHINDRA', 'TATA', 'HAFEI', 'CHANA', 'ZOTYE', 'SSANGYONG', 'KIA', 'CHRYSLER', 'DODGE', 'JEEP']}
    # second pass: classify rows (needs the regular font and look-ahead)
    out_brands = []
    unknown = []
    for i, r in enumerate(all_rows):
        bold = r['font'] != regular_font and 'Helvetica' not in r['font']
        nxt = all_rows[i + 1] if i + 1 < len(all_rows) else None
        next_bold = nxt is not None and nxt['font'] != regular_font and 'Helvetica' not in nxt['font']
        gap = (all_rows[i - 1]['y'] - r['y']) if i > 0 else 99
        if bold and not r['years'] and next_bold and (gap > 18 or gap < 0 or norm(r['name']) in known) and norm(r['name']) in known:
            brand = {'name': r['name'], 'models': []}
            out_brands.append(brand)
            model = None
        elif bold:
            model = {'name': r['name'], 'versions': []}
            if brand is None:
                unknown.append(('model-without-brand', r['name']))
                continue
            brand['models'].append(model)
        elif not r['years'] and next_bold and (gap > 18 or gap < 0) and not re.search(r'\d,\d|\bAT\b|\bMT\b|4X4|\bCV\b', r['name']):
            brand = {'name': r['name'], 'models': []}
            out_brands.append(brand)
            model = None
        else:
            if model is None:
                unknown.append(('version-without-model', r['name']))
                continue
            model['versions'].append({'name': r['name'], 'years': r['years']})

    # merge repeated brand blocks and drop empty ones
    merged = {}
    for b in out_brands:
        merged.setdefault(b['name'], {'name': b['name'], 'models': []})['models'].extend(b['models'])
    out_brands = [b for b in merged.values() if b['models']]
    json.dump({'source': pdf, 'listYear': list_year, 'brands': out_brands, 'unknown': unknown[:50]}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    nv = sum(len(m['versions']) for b in out_brands for m in b['models'])
    nm = sum(len(b['models']) for b in out_brands)
    print(f'{pdf}: list {list_year}, {len(out_brands)} brands, {nm} models, {nv} versions, regular font {regular_font}, unknown {len(unknown)}')
    print('brands:', ', '.join(b['name'] for b in out_brands))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
