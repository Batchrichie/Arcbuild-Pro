import pathlib
import re

root = pathlib.Path('c:/Users/Richmond/Downloads/Arcbuild-Pro/Arcbuild-Pro')
repo = root / 'supabase' / 'migrations'
live = root / 'arcbuild_live_schema_raw_dump.md'
live_text = live.read_text(encoding='utf-8')

functions = [
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


def normalize(sql):
    sql = re.sub(r'--.*?\n', '', sql)
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.S)
    sql = re.sub(r'\s+', ' ', sql).strip().lower()
    return sql


def extract_function(text, name):
    # match create or replace function and capture delim from the same statement
    pattern = re.compile(r'(CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?%s\b.*?(\$[A-Za-z0-9_]*\$))' % re.escape(name), re.I | re.S)
    match = pattern.search(text)
    if not match:
        return None
    start = match.start(1)
    delim = match.group(2)
    end_pattern = re.compile(re.escape(delim) + r'.*?' + re.escape(delim) + r'\s*;', re.S)
    end_match = end_pattern.search(text, match.end(2))
    if not end_match:
        return None
    return text[start:end_match.end()]


def find_file_for_function(name):
    # use all migration files if not in map or not found
    for path in sorted((repo).glob('*.sql')):
        text = path.read_text(encoding='utf-8')
        if re.search(r'CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?%s\b' % re.escape(name), text, re.I):
            return path.name
    return None

for name in functions:
    path = repo / migration_map[name]
    status = []
    repo_body = None
    if path.exists():
        repo_text = path.read_text(encoding='utf-8')
        repo_body = extract_function(repo_text, name)
        status.append('repo file found')
        status.append('repo def found' if repo_body else 'repo def missing')
    else:
        status.append('repo file missing')
        alt = find_file_for_function(name)
        if alt:
            status.append(f'found in {alt}')
    live_body = extract_function(live_text, name)
    status.append('live def found' if live_body else 'live def missing')
    if repo_body and live_body:
        status.append('same' if normalize(repo_body) == normalize(live_body) else 'diff')
    print(name, '|', ', '.join(status))
    if repo_body and live_body and normalize(repo_body) != normalize(live_body):
        print('  repo len', len(repo_body), 'live len', len(live_body))

journal_lines = bool(re.search(r'CREATE\s+TABLE\s+(?:public\.)?journal_lines\b', live_text, re.I))
print('journal_lines table exists in live dump:', journal_lines)
