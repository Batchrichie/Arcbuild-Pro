import pathlib
import re
import difflib

root = pathlib.Path('c:/Users/Richmond/Downloads/Arcbuild-Pro/Arcbuild-Pro')
repo_dir = root / 'supabase' / 'migrations'
live_path = root / 'arcbuild_live_schema_raw_dump.md'

functions_to_check = [
    'transition_invoice_status',
    'process_employee_payroll',
    'post_payroll_journal',
    'compute_asset_depreciation',
    'post_depreciation_journal',
    'dispose_asset',
    'compute_vat_return',
    'populate_tax_calendar',
    'mark_tax_filed',
    'post_manual_journal',
    'reverse_journal_entry',
    'post_retention_withheld_journal',
    'post_retention_released_journal',
    'post_subcontractor_retention_journal',
    'post_revenue_recognition_journal',
    'calculate_lease_schedule',
    'post_lease_journal_entry',
]

migration_map = {
    'transition_invoice_status': '006_invoice_approval_workflow.sql',
    'process_employee_payroll': '017_payroll_engine.sql',
    'post_payroll_journal': '017_payroll_engine.sql',
    'compute_asset_depreciation': '019_asset_depreciation.sql',
    'post_depreciation_journal': '019_asset_depreciation.sql',
    'dispose_asset': '019_asset_depreciation.sql',
    'compute_vat_return': '023_tax_centre.sql',
    'populate_tax_calendar': '023_tax_centre.sql',
    'mark_tax_filed': '023_tax_centre.sql',
    'post_manual_journal': '024_manual_journal_functions.sql',
    'reverse_journal_entry': '024_manual_journal_functions.sql',
    'post_retention_withheld_journal': '030_phase_b_retention_functions.sql',
    'post_retention_released_journal': '030_phase_b_retention_functions.sql',
    'post_subcontractor_retention_journal': '030_phase_b_retention_functions.sql',
    'post_revenue_recognition_journal': '033_phase_c_revenue_functions.sql',
    'calculate_lease_schedule': '040_ifrs16_leases.sql',
    'post_lease_journal_entry': '040_ifrs16_leases.sql',
}

live_text = live_path.read_text(encoding='utf-8')


def find_function(text, name):
    # locate the function start
    start_pat = re.compile(r'CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?%s\b' % re.escape(name), re.I)
    match = start_pat.search(text)
    if not match:
        return None
    start = match.start()
    # find AS delimiter
    as_pat = re.compile(r'AS\s+(\$[A-Za-z0-9_]*\$)', re.I)
    as_match = as_pat.search(text, match.end())
    if not as_match:
        return None
    delim = as_match.group(1)
    end_pat = re.compile(re.escape(delim) + r'.*?' + re.escape(delim) + r'\s*;', re.S)
    end_match = end_pat.search(text, as_match.end())
    if not end_match:
        return None
    return text[start:end_match.end()]


def normalize(sql):
    sql = sql.replace('\r\n', '\n')
    sql = re.sub(r'--.*?(?=\n|$)', '', sql)
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.S)
    sql = re.sub(r'\s+', ' ', sql).strip().lower()
    return sql

for name in functions_to_check:
    repo_file = repo_dir / migration_map[name]
    repo_text = repo_file.read_text(encoding='utf-8') if repo_file.exists() else None
    repo_body = find_function(repo_text, name) if repo_text else None
    live_body = find_function(live_text, name)
    print(f'=== {name} ===')
    print('repo file', migration_map.get(name), 'exists' if repo_file.exists() else 'missing')
    print('repo body', 'found' if repo_body else 'missing')
    print('live body', 'found' if live_body else 'missing')
    if repo_body and live_body:
        same = normalize(repo_body) == normalize(live_body)
        print('same?', same)
        if not same:
            diff = difflib.unified_diff(
                repo_body.splitlines(), live_body.splitlines(),
                fromfile='repo', tofile='live', lineterm='', n=3
            )
            print('\n'.join(diff))
    print()

journal_table = re.search(r'CREATE\s+TABLE\s+(?:public\.)?journal_lines\b', live_text, re.I)
print('journal_lines table exists in live dump:', bool(journal_table))
print('journal_lines refs:', len(re.findall(r'\bjournal_lines\b', live_text, re.I)))
