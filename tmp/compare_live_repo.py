import pathlib
import re

root = pathlib.Path('c:/Users/Richmond/Downloads/Arcbuild-Pro/Arcbuild-Pro')
repo = root / 'supabase' / 'migrations'
live = root / 'arcbuild_live_schema_raw_dump.md'
live_text = live.read_text(encoding='utf-8')

functions = [
    ('transition_invoice_status', '006_invoice_approval_workflow.sql'),
    ('process_employee_payroll', '017_payroll_engine.sql'),
    ('post_payroll_journal', '017_payroll_engine.sql'),
    ('compute_asset_depreciation', '019_asset_depreciation.sql'),
    ('post_depreciation_journal', '019_asset_depreciation.sql'),
    ('dispose_asset', '019_asset_depreciation.sql'),
    ('compute_vat_return', '023_tax_centre.sql'),
    ('populate_tax_calendar', '023_tax_centre.sql'),
    ('mark_tax_filed', '023_tax_centre.sql'),
    ('post_manual_journal', '024_manual_journal_functions.sql'),
    ('reverse_journal_entry', '024_manual_journal_functions.sql'),
    ('post_retention_withheld_journal', '030_phase_b_retention_functions.sql'),
    ('post_retention_released_journal', '030_phase_b_retention_functions.sql'),
    ('post_subcontractor_retention_journal', '030_phase_b_retention_functions.sql'),
    ('post_revenue_recognition_journal', '033_phase_c_revenue_functions.sql'),
    ('calculate_lease_schedule', '040_ifrs16_leases.sql'),
    ('post_lease_journal_entry', '040_ifrs16_leases.sql'),
]

func_regex = re.compile(r'CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?{name}\b', re.I)

def extract_function(text, name):
    pattern = re.compile(r'CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?%s\b.*?(\$[A-Za-z0-9_]*\$)' % re.escape(name), re.I | re.S)
    match = pattern.search(text)
    if not match:
        return None
    start = match.start()
    delim = match.group(1)
    end_pattern = re.compile(re.escape(delim) + r'.*?' + re.escape(delim) + r'\s*;?', re.S)
    end_match = end_pattern.search(text, match.end())
    if not end_match:
        return None
    return text[start:end_match.end()]


def normalize_sql(sql):
    sql = re.sub(r'\s+', ' ', sql).strip().lower()
    sql = re.sub(r'--.*?(?=\n|$)', '', sql)
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.S)
    return sql.strip()

for fname, migration in functions:
    repo_file = repo / migration
    if not repo_file.exists():
        print(f'MISSING FILE: {fname} in {migration}')
        continue
    repo_text = repo_file.read_text(encoding='utf-8')
    repo_body = extract_function(repo_text, fname)
    live_body = extract_function(live_text, fname)
    status = []
    status.append('repo found' if repo_body else 'repo missing')
    status.append('live found' if live_body else 'live missing')
    if repo_body and live_body:
        same = normalize_sql(repo_body) == normalize_sql(live_body)
        status.append('same' if same else 'diff')
    print(fname, migration, '|', ', '.join(status))
    if repo_body and live_body and not same:
        print('  repo first 120:', repr(repo_body[:120]))
        print('  live first 120:', repr(live_body[:120]))
        print('  repo delim:', re.search(r'(\$[A-Za-z0-9_]*\$)', repo_body).group(1))
        print('  live delim:', re.search(r'(\$[A-Za-z0-9_]*\$)', live_body).group(1))
        print('')

journal_lines = re.search(r'CREATE\s+TABLE\s+(?:public\.)?journal_lines\b', live_text, re.I)
print('\njournal_lines table in live dump:', 'yes' if journal_lines else 'no')
matched = list(re.finditer(r'\bjournal_lines\b', live_text, re.I))
print('journal_lines occurrences in live dump:', len(matched))
for i, m in enumerate(matched[:20], start=1):
    snippet = live_text[max(0,m.start()-40):m.end()+40].replace('\n',' ')
    print(f' {i}:', snippet)
