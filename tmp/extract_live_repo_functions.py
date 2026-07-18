import pathlib
import re
import difflib

root = pathlib.Path('c:/Users/Richmond/Downloads/Arcbuild-Pro/Arcbuild-Pro')
repo_dir = root / 'supabase' / 'migrations'
live_path = root / 'arcbuild_live_schema_raw_dump.md'

function_list = [
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

live_text = live_path.read_text(encoding='utf-8')


def find_function_body(text, fname):
    pattern = re.compile(
        r'CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?%s\b' % re.escape(fname),
        re.I | re.S,
    )
    match = pattern.search(text)
    if not match:
        return None
    start = match.start()
    # find AS <delim>
    as_pattern = re.compile(r'AS\s+(\$[A-Za-z0-9_]*\$)', re.I)
    as_match = as_pattern.search(text, match.end())
    if not as_match:
        return None
    delim = as_match.group(1)
    end_pattern = re.compile(re.escape(delim) + r'.*?' + re.escape(delim) + r'\s*;', re.S)
    end_match = end_pattern.search(text, as_match.end())
    if not end_match:
        return None
    return text[start:end_match.end()]


def normalize(sql):
    sql = sql.replace('\r\n', '\n')
    sql = re.sub(r'--.*?(?=\n|$)', '', sql)
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.S)
    sql = re.sub(r'\s+', ' ', sql).strip().lower()
    return sql

for fname, migration_filename in function_list:
    repo_file = repo_dir / migration_filename
    repo_body = None
    if repo_file.exists():
        repo_body = find_function_body(repo_file.read_text(encoding='utf-8'), fname)
    live_body = find_function_body(live_text, fname)
    print('FUNCTION', fname)
    print('  repo file:', migration_filename, 'exists' if repo_file.exists() else 'missing')
    print('  repo body:', 'found' if repo_body else 'missing')
    print('  live body:', 'found' if live_body else 'missing')
    if repo_body and live_body:
        same = normalize(repo_body) == normalize(live_body)
        print('  normalized same:', same)
        if not same:
            repo_lines = repo_body.splitlines()
            live_lines = live_body.splitlines()
            diff = difflib.unified_diff(repo_lines, live_lines, fromfile='repo', tofile='live', lineterm='')
            print('\n'.join(diff))
    print('')

# journal_lines existence
journal_lines_table = re.search(r'CREATE\s+TABLE\s+(?:public\.)?journal_lines\b', live_text, re.I)
print('journal_lines table exists in live dump:', bool(journal_lines_table))
occurrences = len(re.findall(r'\bjournal_lines\b', live_text, re.I))
print('journal_lines occurrences in live dump:', occurrences)
