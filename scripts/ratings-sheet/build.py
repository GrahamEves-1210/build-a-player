import sys, json, hashlib
sys.path.insert(0, sys.argv[1] + '/pylib')
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
d = json.load(open(sys.argv[1] + '/pools.json', encoding='utf-8'))
G = d['grades']
DERIVED_SIZE = {'OL', 'DL', 'LB', 'DB'}          # Size comes from height and weight there: not a rating to edit
POS_ORDER = {'OL': ['LT', 'LG', 'C', 'RG', 'RT'], 'DL': ['EDGE', 'DT'], 'DB': ['CB', 'S'], 'Guards': ['PG', 'SG', 'SF', 'PF', 'C'], 'Bigs': ['PG', 'SG', 'SF', 'PF', 'C']}
HAS_POS = {('OL', 'cur'), ('OL', 'leg'), ('DL', 'cur'), ('DL', 'leg'), ('DB', 'cur'), ('DB', 'leg'), ('Guards', 'cur'), ('Bigs', 'cur')}
wb = Workbook(); wb.remove(wb.active)
head_fill = PatternFill('solid', start_color='1F2937'); band = PatternFill('solid', start_color='F3F4F6')
thin = Side(style='thin', color='9CA3AF')
total = 0
def tab(pool, kind):
    global total
    label = pool['label']; name = label if kind == 'cur' else label + ' All-Time'
    types = [t for t in (pool['types'] if kind == 'cur' else pool['ltypes']) if not (t == 'size' and label in DERIVED_SIZE)]
    has_pos = (label, kind) in HAS_POS
    order = POS_ORDER.get(label, [])
    rows = []
    for i, p in enumerate(pool[kind]):
        pos = (p['pos'] or '').upper()
        rows.append((p['team'], order.index(pos) if pos in order else 99, i, pos, p))
    rows.sort(key=lambda r: (r[0], r[1], r[2]))
    ws = wb.create_sheet(name)
    heads = ['Team'] + (['Pos'] if has_pos else []) + ['Player'] + [pool['labels'][t] for t in types]
    ws.append(heads)
    lead = 3 if has_pos else 2
    for c in range(1, len(heads) + 1):
        cell = ws.cell(1, c); cell.font = Font(bold=True, color='FFFFFF', size=10); cell.fill = head_fill
        cell.alignment = Alignment(horizontal='left' if c <= lead else 'center', vertical='center')
    ws.row_dimensions[1].height = 22
    prev = None; shade = False
    for r, (team, _, _, pos, p) in enumerate(rows, start=2):
        new_team = team != prev
        if new_team: shade = not shade; prev = team
        vals = [team] + ([pos] if has_pos else []) + [p['name']] + [G[p['attrs'][t]] for t in types]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(r, c, v)
            cell.font = Font(size=10, bold=(c == 1), color='374151' if c < lead else '111827')
            cell.alignment = Alignment(horizontal='left' if c <= lead else 'center', vertical='center')
            if shade: cell.fill = band
            if new_team: cell.border = Border(top=thin)
    n = len(rows); total += n
    ws.freeze_panes = ws.cell(2, lead + 1)
    ws.auto_filter.ref = 'A1:%s%d' % (get_column_letter(len(heads)), n + 1)
    dv = DataValidation(type='list', formula1='"' + ','.join(G) + '"', allow_blank=False, showErrorMessage=True, errorTitle='Grade', error='Pick a grade: ' + ' '.join(G))
    dv.add('%s2:%s%d' % (get_column_letter(lead + 1), get_column_letter(len(heads)), n + 1)); ws.add_data_validation(dv)
    ws.column_dimensions['A'].width = 8
    if has_pos: ws.column_dimensions['B'].width = 7
    ws.column_dimensions[get_column_letter(lead)].width = 27
    for k, t in enumerate(types): ws.column_dimensions[get_column_letter(lead + 1 + k)].width = max(9, len(pool['labels'][t]) + 3)
    ws.sheet_properties.tabColor = ('166534' if pool['sport'] == 'nfl' else 'C2410C') if kind == 'cur' else ('86EFAC' if pool['sport'] == 'nfl' else 'FDBA74')
    print('%-16s %4d rows  %s' % (name, n, ' | '.join(heads)))
for kind in ('cur', 'leg'):
    for pool in d['pools']: tab(pool, kind)
out = sys.argv[1] + '/Build-A-Player Ratings.xlsx'
wb.save(out)
b = open(out, 'rb').read()
print('total rows', total, '| bytes', len(b), '| sha256', hashlib.sha256(b).hexdigest())
