import React, { useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PaymentCertificatePdf from './pdf/PaymentCertificatePdf';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR'];

function formatGhs(value) {
  return Number(value || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PaymentCertificateForm({ userRole, userId }) {
  const { user } = useAuth();
  const [subcontractors, setSubcontractors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [fxRate, setFxRate] = useState(1);

  const [formData, setFormData] = useState({
    subcontractorId: '',
    projectId: '',
    description: '',
    grossAmount: '',
    currency: 'GHS',
    paymentDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadSubcontractors();
    loadProjects();
  }, []);

  useEffect(() => {
    fetchFxRate();
  }, [formData.currency, formData.paymentDate]);

  const loadSubcontractors = async () => {
    try {
      const { data, error: err } = await supabase
        .from('subcontractors')
        .select('id, name, applies_wht, wht_rate')
        .order('name');

      if (err) throw err;
      setSubcontractors(data || []);
    } catch (err) {
      setError('Failed to load subcontractors: ' + err.message);
    }
  };

  const loadProjects = async () => {
    if (hideProjectSelector) return;
    try {
      setLoading(true);
      let query = supabase
        .from('projects')
        .select('id, name, status, division_id, divisions(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (userRole === 'project_manager') {
        query = query.in(
          'id',
          supabase
            .from('project_assignments')
            .select('project_id')
            .eq('profile_id', userId)
        );
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setProjects(data || []);
    } catch (err) {
      setError('Failed to load projects: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFxRate = async () => {
    if (formData.currency === 'GHS') {
      setFxRate(1);
      return;
    }

    try {
      const { data, error: err } = await supabase.rpc('get_fx_rate', {
        currency_code_param: formData.currency,
        rate_date_param: formData.paymentDate,
      });

      if (err) throw err;
      setFxRate(Number(data) || 1);
    } catch (err) {
      try {
        const { data: fallback } = await supabase
          .from('exchange_rates')
          .select('rate_to_ghs')
          .eq('currency_code', formData.currency)
          .order('rate_date', { ascending: false })
          .limit(1);

        setFxRate(fallback?.[0]?.rate_to_ghs ? Number(fallback[0].rate_to_ghs) : 1);
      } catch {
        setFxRate(1);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const selectedSub = subcontractors.find((s) => s.id === formData.subcontractorId);
  const grossNum = parseFloat(formData.grossAmount) || 0;
  const grossGhs = grossNum * fxRate;
  const whtRate = selectedSub?.applies_wht ? Number(selectedSub.wht_rate || 0.05) : 0;
  const whtAmount = selectedSub?.applies_wht ? Math.round(grossGhs * whtRate * 100) / 100 : 0;
  const netPayable = grossGhs - whtAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formData.subcontractorId || !formData.projectId || !formData.description || !formData.grossAmount) {
        throw new Error('Please fill in all required fields');
      }

      if (!user?.id) throw new Error('Not authenticated');

      const { data, error: err } = await supabase.rpc('issue_payment_certificate', {
        subcontractor_id_param: formData.subcontractorId,
        project_id_param: formData.projectId,
        description_param: formData.description,
        gross_amount_param: parseFloat(formData.grossAmount),
        currency_param: formData.currency,
        payment_date_param: formData.paymentDate,
        actor_uuid: user.id,
      });

      if (err) throw err;
      if (!data.success) throw new Error(data.error);

      const selectedSubcontractor = subcontractors.find((sub) => sub.id === formData.subcontractorId)
      const selectedProject = projects.find((project) => project.id === formData.projectId)

      setSuccess({
        certificateNumber: data.certificate_number,
        netPayable: data.net_payable,
        whtDeducted: data.wht_deducted,
        grossGhs: data.gross_amount_ghs,
        subcontractorName: selectedSubcontractor?.name,
        subcontractorTin: selectedSubcontractor?.tin || selectedSubcontractor?.tax_id,
        projectName: selectedProject?.name,
        description: formData.description,
        paymentDate: formData.paymentDate,
      });

      setFormData({
        subcontractorId: '',
        projectId: '',
        description: '',
        grossAmount: '',
        currency: 'GHS',
        paymentDate: new Date().toISOString().split('T')[0],
      });

      await loadSubcontractors();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300">
          <p className="font-semibold">Payment certificate issued</p>
          <p className="text-sm mt-1">
            Certificate: <span className="font-mono text-white">{success.certificateNumber}</span>
          </p>
          <p className="text-sm">
            Net payable: GHS {formatGhs(success.netPayable)}
            {success.whtDeducted > 0 && (
              <span className="text-slate-400"> (WHT deducted: GHS {formatGhs(success.whtDeducted)})</span>
            )}
          </p>
          <div className="mt-3">
            <PDFDownloadLink
              document={<PaymentCertificatePdf certificate={success} />}
              fileName={`payment-certificate-${success.certificateNumber || 'certificate'}.pdf`}
              className="inline-flex rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {({ loading: pdfLoading }) => (pdfLoading ? 'Preparing PDF…' : 'Download Certificate')}
            </PDFDownloadLink>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Subcontractor <span className="text-red-400">*</span>
          </label>
          <select
            name="subcontractorId"
            value={formData.subcontractorId}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Select subcontractor</option>
            {subcontractors.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
                {sub.applies_wht ? ` (WHT ${Math.round(Number(sub.wht_rate) * 100)}%)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Project <span className="text-red-400">*</span>
          </label>
          <select
            name="projectId"
            value={formData.projectId}
            onChange={handleChange}
            required
            disabled={loading}
            className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.divisions?.name ? ` (${p.divisions.name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            rows={3}
            placeholder="Work completed under this certificate"
            className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Gross amount <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              name="grossAmount"
              value={formData.grossAmount}
              onChange={handleChange}
              required
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Currency</label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-teal-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formData.currency !== 'GHS' && grossNum > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p>
              FX rate ({formData.currency} → GHS): <span className="text-white font-medium">{fxRate}</span>
            </p>
            <p className="mt-1">
              GHS equivalent: <span className="text-teal-300 font-semibold">GHS {formatGhs(grossGhs)}</span>
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Payment date</label>
          <input
            type="date"
            name="paymentDate"
            value={formData.paymentDate}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {selectedSub?.applies_wht && grossNum > 0 && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 font-mono text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Gross Amount:</span>
              <span className="text-white">GHS {formatGhs(grossGhs)}</span>
            </div>
            <div className="flex justify-between text-red-300 mt-2">
              <span>WHT ({Math.round(whtRate * 100)}%):</span>
              <span>(GHS {formatGhs(whtAmount)})</span>
            </div>
            <hr className="my-3 border-white/10" />
            <div className="flex justify-between text-white font-semibold">
              <span>Net Payable:</span>
              <span>GHS {formatGhs(netPayable)}</span>
            </div>
            <div className="flex justify-between text-amber-300 mt-2">
              <span>WHT to Remit to GRA:</span>
              <span>GHS {formatGhs(whtAmount)}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || loading}
          className="w-full rounded-full bg-teal-500 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {submitting ? 'Issuing certificate…' : 'Issue Payment Certificate'}
        </button>
      </form>
    </div>
  );
}
