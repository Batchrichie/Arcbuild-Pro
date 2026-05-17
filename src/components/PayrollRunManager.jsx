import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PayrollRunManager({ userRole, userId, readOnly = false }) {
  const [activeRun, setActiveRun] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [payrollLines, setPayrollLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [variableInputs, setVariableInputs] = useState({});

  const getPeriodMetrics = () => {
    if (!periodStart || !periodEnd) return null;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const months = days / 30.44;
    return { days, months: months.toFixed(2) };
  };

  const initializeRun = async () => {
    try {
      if (!periodStart || !periodEnd) {
        setError('Period start and end dates required');
        return;
      }
      if (new Date(periodEnd) <= new Date(periodStart)) {
        setError('Period end must be after period start');
        return;
      }

      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);

      const { data, error: err } = await supabase
        .from('payroll_runs')
        .insert([
          {
            period_start: periodStart,
            period_end: periodEnd,
            pay_period_month: endDate.getMonth() + 1,
            pay_period_year: endDate.getFullYear(),
            status: 'draft',
            processed_by: userId,
          },
        ])
        .select()
        .single();

      if (err) throw err;
      setActiveRun(data);

      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('id, employee_number, profile_id, job_title, department, basic_salary, monthly_allowances, is_ssnit_exempt, is_paye_exempt')
        .eq('is_active', true)
        .order('employee_number');

      if (empErr) throw empErr;
      setEmployees(empData || []);
      setVariableInputs({});
      setPayrollLines([]);
      setError(null);
    } catch (err) {
      setError('Failed to initialize payroll run: ' + err.message);
    }
  };

  const updateVariableInput = (employeeId, field, value) => {
    setVariableInputs((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value,
      },
    }));
  };

  const computeOvertimeAmount = (employeeId) => {
    const inp = variableInputs[employeeId] || {};
    const hours = parseFloat(inp.overtime_hours) || 0;
    const rate = parseFloat(inp.overtime_rate) || 0;
    return (hours * rate).toFixed(2);
  };

  const processAllEmployees = async () => {
    try {
      if (!activeRun) {
        setError('No active payroll run');
        return;
      }

      setLoading(true);
      const results = [];

      for (const emp of employees) {
        const inp = variableInputs[emp.id] || {};
        const { data, error: err } = await supabase.rpc('process_employee_payroll', {
          payroll_run_id_param: activeRun.id,
          employee_id_param: emp.id,
          overtime_hours_param: parseFloat(inp.overtime_hours) || 0,
          overtime_rate_param: parseFloat(inp.overtime_rate) || 0,
          bonus_amount_param: parseFloat(inp.bonus_amount) || 0,
          other_deductions_param: parseFloat(inp.other_deductions) || 0,
          deduction_notes_param: inp.deduction_notes || null,
        });

        if (err) {
          setError(`Failed to process ${emp.employee_number}: ${err.message}`);
          return;
        }

        if (data.success) {
          results.push(data);
        } else {
          setError(`Failed to process ${emp.employee_number}: ${data.error}`);
          return;
        }
      }

      const { data: lines, error: linesErr } = await supabase
        .from('payroll_lines')
        .select('*')
        .eq('payroll_run_id', activeRun.id)
        .order('created_at');

      if (linesErr) throw linesErr;
      setPayrollLines(lines || []);
      setError(null);
    } catch (err) {
      setError('Failed to process payroll: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const postToLedger = async () => {
    try {
      if (!activeRun) return;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error: err } = await supabase.rpc('post_payroll_journal', {
        payroll_run_id_param: activeRun.id,
        actor_uuid: userData.user.id,
      });

      if (err) throw err;
      if (!data.success) throw new Error(data.error);

      setActiveRun((prev) => ({ ...prev, status: 'posted', journal_entry_id: data.journal_entry_id }));
      setError(null);
    } catch (err) {
      setError('Failed to post payroll: ' + err.message);
    }
  };

  const getTotalsByEmployee = () => {
    return employees.map((emp) => {
      const line = payrollLines.find((l) => l.employee_id === emp.id);
      return { emp, line };
    });
  };

  const getRunTotals = () => {
    return {
      gross: payrollLines.reduce((sum, l) => sum + (l.gross_pay || 0), 0),
      paye: payrollLines.reduce((sum, l) => sum + (l.paye || 0), 0),
      ssnit_emp: payrollLines.reduce((sum, l) => sum + (l.ssnit_employee || 0), 0),
      ssnit_er: payrollLines.reduce((sum, l) => sum + (l.ssnit_employer || 0), 0),
      loans: payrollLines.reduce((sum, l) => sum + (l.loan_deduction || 0), 0),
      net: payrollLines.reduce((sum, l) => sum + (l.net_pay || 0), 0),
    };
  };

  const exportPayeSchedule = () => {
    if (!payrollLines.length) return;
    const csv = [
      ['Employee Name', 'TIN', 'Gross Pay', 'Taxable Income', 'PAYE'].join(','),
      ...payrollLines.map((line) => {
        const emp = employees.find((e) => e.id === line.employee_id);
        return [
          emp?.profile_id || 'N/A',
          emp?.profile_id || 'N/A',
          line.gross_pay || 0,
          line.taxable_income || 0,
          line.paye || 0,
        ].join(',');
      }),
    ].join('\n');
    downloadCSV(csv, `PAYE-Schedule-${activeRun?.period_end}.csv`);
  };

  const exportSsnitSchedule = () => {
    if (!payrollLines.length) return;
    const csv = [
      ['Employee Name', 'SSNIT Number', 'Basic Salary', 'Employee Contribution', 'Employer Contribution'].join(','),
      ...payrollLines.map((line) => {
        const emp = employees.find((e) => e.id === line.employee_id);
        return [
          emp?.employee_number || 'N/A',
          emp?.profile_id || 'N/A',
          line.basic_salary || 0,
          line.ssnit_employee || 0,
          line.ssnit_employer || 0,
        ].join(',');
      }),
    ].join('\n');
    downloadCSV(csv, `SSNIT-Schedule-${activeRun?.period_end}.csv`);
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const metrics = getPeriodMetrics();

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Section 1: Create Payroll Run */}
      <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6">
        <h2 className="text-xl font-bold text-white mb-4">Create Payroll Run</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Period Start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              disabled={!!activeRun || readOnly}
              className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-white/10 disabled:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Period End</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              disabled={!!activeRun || readOnly}
              className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-white/10 disabled:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Period Metrics</label>
            <div className="p-2 bg-white/5 rounded border border-white/10 text-sm text-slate-300">
              {metrics ? (
                <>
                  <p>Days: {metrics.days}</p>
                  <p>Months: {metrics.months}</p>
                </>
              ) : (
                <p className="text-slate-500">Select dates</p>
              )}
            </div>
          </div>
        </div>
        {!activeRun && !readOnly && (
          <button
            onClick={initializeRun}
            disabled={!periodStart || !periodEnd}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            Initialize Run
          </button>
        )}
        {activeRun && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-300">
            <p>
              <strong>Run ID:</strong> {activeRun.id.substring(0, 8)}...
            </p>
            <p>
              <strong>Status:</strong> {activeRun.status}
            </p>
          </div>
        )}
      </div>

      {/* Section 2: Variable Pay Input */}
      {activeRun && !payrollLines.length && (
        <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6">
          <h2 className="text-xl font-bold text-white mb-4">Variable Pay Input</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-400">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-400">Emp #</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">Basic</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">Allow.</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">OT Hrs</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">OT Rate</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">OT Amt</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">Bonus</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-400">Other Ded.</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-400">Notes</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const inp = variableInputs[emp.id] || {};
                  return (
                    <tr key={emp.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-3 py-3 text-sm text-white">{emp.employee_number}</td>
                      <td className="px-3 py-3 text-sm text-slate-300">{emp.job_title}</td>
                      <td className="px-3 py-3 text-right text-sm text-slate-300">
                        {(emp.basic_salary || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-slate-300">
                        {(emp.monthly_allowances || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={inp.overtime_hours || ''}
                          onChange={(e) => updateVariableInput(emp.id, 'overtime_hours', e.target.value)}
                          className="w-16 px-2 py-1 border border-white/20 rounded bg-white/5 text-white text-sm focus:ring-2 focus:ring-blue-500"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={inp.overtime_rate || ''}
                          onChange={(e) => updateVariableInput(emp.id, 'overtime_rate', e.target.value)}
                          className="w-16 px-2 py-1 border border-white/20 rounded bg-white/5 text-white text-sm focus:ring-2 focus:ring-blue-500"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-slate-300">
                        {computeOvertimeAmount(emp.id)}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={inp.bonus_amount || ''}
                          onChange={(e) => updateVariableInput(emp.id, 'bonus_amount', e.target.value)}
                          className="w-16 px-2 py-1 border border-white/20 rounded bg-white/5 text-white text-sm focus:ring-2 focus:ring-blue-500"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={inp.other_deductions || ''}
                          onChange={(e) => updateVariableInput(emp.id, 'other_deductions', e.target.value)}
                          className="w-16 px-2 py-1 border border-white/20 rounded bg-white/5 text-white text-sm focus:ring-2 focus:ring-blue-500"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={inp.deduction_notes || ''}
                          onChange={(e) => updateVariableInput(emp.id, 'deduction_notes', e.target.value)}
                          className="w-24 px-2 py-1 border border-white/20 rounded bg-white/5 text-white text-sm focus:ring-2 focus:ring-blue-500"
                          disabled={readOnly}
                          placeholder="Notes"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <button
              onClick={processAllEmployees}
              disabled={loading}
              className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing...' : 'Process All'}
            </button>
          )}
        </div>
      )}

      {/* Section 3: Payroll Summary */}
      {payrollLines.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Payroll Summary</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">Employee</th>
                  <th className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">Gross Pay</th>
                  <th className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">SSNIT (Emp)</th>
                  <th className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">PAYE</th>
                  <th className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">Loan Ded.</th>
                  <th className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">Other Ded.</th>
                  <th className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {getTotalsByEmployee().map(({ emp, line }) =>
                  line ? (
                    <tr key={emp.id}>
                      <td className="border border-gray-300 px-3 py-2 text-sm">{emp.employee_number}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                        {(line.gross_pay || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                        {(line.ssnit_employee || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                      </td>
                      <td
                        className="border border-gray-300 px-3 py-2 text-right text-sm cursor-help"
                        title={`Taxable: ${(line.taxable_income || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`}
                      >
                        {(line.paye || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                        {(line.loan_deduction || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                        {(line.other_deductions || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold text-green-700">
                        {(line.net_pay || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ) : null
                )}
                <tr className="bg-gray-50 font-bold">
                  <td className="border border-gray-300 px-3 py-2 text-sm">TOTAL</td>
                  {(() => {
                    const totals = getRunTotals();
                    return (
                      <>
                        <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                          {totals.gross.toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                          {totals.ssnit_emp.toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                          {totals.paye.toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                          {totals.loans.toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-sm">0.00</td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-sm text-green-700">
                          {totals.net.toLocaleString('en-GH', { maximumFractionDigits: 2 })}
                        </td>
                      </>
                    );
                  })()}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {activeRun?.status !== 'posted' && !readOnly && (
              <button
                onClick={postToLedger}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Post to Ledger
              </button>
            )}
            {activeRun?.status === 'posted' && (
              <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-green-700">
                ✓ Posted to Ledger
              </div>
            )}
            <button
              onClick={exportPayeSchedule}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Download PAYE Schedule
            </button>
            <button
              onClick={exportSsnitSchedule}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Download SSNIT Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
