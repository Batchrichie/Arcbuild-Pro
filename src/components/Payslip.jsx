import React, { useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PayslipPdf from './pdf/PayslipPdf';
import { supabase } from '../lib/supabase';

export default function Payslip({ payrollLineId, employeeId, payrollRunId }) {
  const [line, setLine] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPayslipData();
  }, [payrollLineId, employeeId, payrollRunId]);

  const loadPayslipData = async () => {
    try {
      setLoading(true);

      let query = supabase.from('payroll_lines').select('*');
      if (payrollLineId) {
        query = query.eq('id', payrollLineId).single();
      } else if (employeeId && payrollRunId) {
        query = query.eq('employee_id', employeeId).eq('payroll_run_id', payrollRunId).single();
      }

      const { data: lineData, error: lineErr } = await query;
      if (lineErr) throw lineErr;
      setLine(lineData);

      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .eq('id', lineData.employee_id)
        .single();
      if (empErr) throw empErr;
      setEmployee(empData);

      const { data: runData, error: runErr } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', lineData.payroll_run_id)
        .single();
      if (runErr) throw runErr;
      setRun(runData);
    } catch (err) {
      setError('Failed to load payslip: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading payslip...</div>;
  if (error) return <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">{error}</div>;
  if (!line || !employee || !run) return <div className="p-8 text-center text-gray-500">Payslip not found</div>;

  const formatCurrency = (amount) =>
    (amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden print:shadow-none">
      {/* Print Button */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center print:hidden">
        <h1 className="text-xl font-bold text-gray-900">Payslip</h1>
        <PDFDownloadLink
          document={<PayslipPdf line={line} employee={employee} run={run} />}
          fileName={`payslip-${employee.employee_number || line.id}.pdf`}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {({ loading: pdfLoading }) => (pdfLoading ? 'Preparing PDF…' : 'Download Payslip')}
        </PDFDownloadLink>
      </div>
      {/* Payslip Content */}
      <div className="p-8 print:p-0">
        {/* Header */}
        <div className="text-center mb-8 pb-8 border-b-2 border-gray-300">
          <h2 className="text-3xl font-bold text-gray-900">ARCBUILD PRO</h2>
          <p className="text-gray-600 mt-1">Monthly Payslip</p>
          <p className="text-sm text-gray-500 mt-4">
            Period: {new Date(run.period_start).toLocaleDateString('en-GH')} to{' '}
            {new Date(run.period_end).toLocaleDateString('en-GH')}
          </p>
        </div>

        {/* Employee Information */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-sm text-gray-600">Employee Name</p>
            <p className="text-lg font-semibold text-gray-900">{employee.profile_id || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Employee Number</p>
            <p className="text-lg font-semibold text-gray-900">{employee.employee_number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Job Title</p>
            <p className="text-lg font-semibold text-gray-900">{employee.job_title || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Department</p>
            <p className="text-lg font-semibold text-gray-900">{employee.department || 'N/A'}</p>
          </div>
        </div>

        {/* Earnings Section */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-300">Earnings</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Basic Salary</span>
              <span className="font-semibold">GHS {formatCurrency(line.basic_salary)}</span>
            </div>
            {line.allowances > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-700">Allowances</span>
                <span className="font-semibold">GHS {formatCurrency(line.allowances)}</span>
              </div>
            )}
            {line.overtime_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-700">Overtime ({line.overtime_hours}h @ GHS {formatCurrency(line.overtime_rate)}/h)</span>
                <span className="font-semibold">GHS {formatCurrency(line.overtime_amount)}</span>
              </div>
            )}
            {line.bonus_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-700">Bonus</span>
                <span className="font-semibold">GHS {formatCurrency(line.bonus_amount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-lg">
              <span>Gross Pay</span>
              <span className="text-green-700">GHS {formatCurrency(line.gross_pay)}</span>
            </div>
          </div>
        </div>

        {/* Deductions Section */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-300">Deductions</h3>
          <div className="space-y-2 text-sm">
            {!employee.is_ssnit_exempt && line.ssnit_employee > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-700">SSNIT Contribution (5.5%)</span>
                <span className="font-semibold">GHS {formatCurrency(line.ssnit_employee)}</span>
              </div>
            )}
            {!employee.is_paye_exempt && line.paye > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-700">PAYE Tax</span>
                <span className="font-semibold">GHS {formatCurrency(line.paye)}</span>
              </div>
            )}
            {line.loan_deduction > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-700">Loan Repayment</span>
                <span className="font-semibold">GHS {formatCurrency(line.loan_deduction)}</span>
              </div>
            )}
            {line.other_deductions > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-700">Other Deductions</span>
                <span className="font-semibold">GHS {formatCurrency(line.other_deductions)}</span>
              </div>
            )}
            {line.deduction_notes && (
              <div className="flex justify-between text-xs text-gray-500 italic">
                <span>Notes: {line.deduction_notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Net Pay */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-gray-900">NET PAY</span>
            <span className="text-3xl font-bold text-green-700">GHS {formatCurrency(line.net_pay)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 border-t border-gray-300 pt-6">
          <p>This is a computer-generated payslip.</p>
          <p>For enquiries, please contact HR.</p>
          <p className="mt-4 text-gray-400">Generated: {new Date().toLocaleString('en-GH')}</p>
        </div>
      </div>
    </div>
  );
}
