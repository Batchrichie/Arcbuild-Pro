/**
 * ARCBUILD PRO — Invoice Form Component
 * Module 2.1: The Invoice Engine
 * 
 * React component for creating and editing invoices.
 * Features:
 *   • Client and project selection
 *   • Multi-currency support with live FX rates
 *   • Line item management with dynamic computation
 *   • Real-time tax breakdown display
 *   • Approval threshold detection
 *   • Draft/Submit workflow
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TAX_RATES, Currency } from '../lib/tax-constants';
import { recordRetentionWithheld } from '../services/retentionService';

export default function InvoiceForm({ onSave, initialData = null }) {
  // ===== State Management =====
  const [formData, setFormData] = useState({
    client_id: initialData?.client_id || '',
    project_id: initialData?.project_id || '',
    contract_id: initialData?.contract_id || null,
    retention_rate: initialData?.retention_rate || 0,
    division_id: initialData?.division_id || '',
    division_name: initialData?.division_name || '', // Display name for UI
    currency: initialData?.currency || Currency.GHS,
    fx_rate_to_ghs: initialData?.fx_rate_to_ghs || 1.0,
    fx_rate_override: false,
    notes: initialData?.notes || '',
  });

  const [lineItems, setLineItems] = useState(
    initialData?.lineItems || [{ id: null, description: '', quantity: 1, unit_price: 0 }]
  );

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clientTaxProfile, setClientTaxProfile] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [taxes, setTaxes] = useState({
    subtotal: 0,
    vat: 0,
    nhil: 0,
    getfund: 0,
    gross_total: 0,
    wht: 0,
    expected_receipt: 0,
    gross_total_ghs: 0,
    expected_receipt_ghs: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [approvalThreshold, setApprovalThreshold] = useState(100000);
  const [requiresApproval, setRequiresApproval] = useState(false);

  // ===== Effects =====

  // Fetch system config on mount
  useEffect(() => {
    const fetchSystemConfig = async () => {
      try {
        const { data, error: err } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'invoice_approval_threshold_ghs')
          .single();

        if (err) throw err;
        setApprovalThreshold(parseFloat(data.value));
      } catch (err) {
        console.error('Error fetching system config:', err);
      }
    };

    fetchSystemConfig();
  }, []);

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data, error: err } = await supabase
          .from('clients')
          .select('*')
          .order('name');

        if (err) throw err;
        setClients(data);
      } catch (err) {
        setError('Failed to load clients');
        console.error(err);
      }
    };

    fetchClients();
  }, []);

  // Fetch projects when client changes
  useEffect(() => {
    const fetchProjects = async () => {
      if (!formData.client_id) {
        setProjects([]);
        setFormData((prev) => ({ ...prev, project_id: '', contract_id: null, retention_rate: 0, division_id: '', division_name: '' }));
        return;
      }

      try {
        const { data, error: err } = await supabase
          .from('projects')
          .select(`
            *,
            divisions(id, name)
          `)
          .eq('client_id', formData.client_id)
          .eq('status', 'active')
          .order('name');

        if (err) throw err;
        setProjects(data);
      } catch (err) {
        setError('Failed to load projects');
        console.error(err);
      }
    };

    fetchProjects();
  }, [formData.client_id]);

  // Set default retention rate when project changes
  useEffect(() => {
    const fetchContractRetention = async () => {
      if (!formData.project_id) {
        return;
      }

      try {
        const { data, error: contractError } = await supabase
          .from('contracts')
          .select('id, retention_percentage')
          .eq('project_id', formData.project_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (contractError && contractError.code !== 'PGRST116') throw contractError;

        if (data && !initialData) {
          setFormData((prev) => ({
            ...prev,
            contract_id: data.id,
            retention_rate: prev.retention_rate || data.retention_percentage || 0,
          }));
        }
      } catch (err) {
        console.error('Error fetching contract retention rate:', err);
      }
    };

    fetchContractRetention();
  }, [formData.project_id, initialData]);

  // Fetch client tax profile when client changes
  useEffect(() => {
    const fetchClientTaxProfile = async () => {
      if (!formData.client_id) {
        setClientTaxProfile(null);
        return;
      }

      try {
        const { data, error: err } = await supabase
          .from('clients')
          .select(`
            client_type,
            applies_vat,
            applies_nhil,
            applies_getfund,
            applies_wht,
            wht_rate
          `)
          .eq('id', formData.client_id)
          .single();

        if (err) throw err;
        setClientTaxProfile(data);
      } catch (err) {
        console.error('Error fetching client tax profile:', err);
      }
    };

    fetchClientTaxProfile();
  }, [formData.client_id]);

  // Set division when project changes
  useEffect(() => {
    if (formData.project_id && projects.length > 0) {
      const project = projects.find((p) => p.id === formData.project_id);
      if (project && project.divisions) {
        setFormData((prev) => ({
          ...prev,
          division_id: project.divisions.id,
          division_name: project.divisions.name,
        }));
      }
    }
  }, [formData.project_id, projects]);

  // Fetch exchange rate when currency changes
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (formData.currency === Currency.GHS) {
        setFormData((prev) => ({ ...prev, fx_rate_to_ghs: 1.0 }));
        setExchangeRate(null);
        return;
      }

      try {
        // Call get_fx_rate() RPC function for automatic fallback to recent rates
        const { data, error: err } = await supabase.rpc('get_fx_rate', {
          currency_code_param: formData.currency,
          rate_date_param: new Date().toISOString().split('T')[0],
        });

        if (err) throw err;

        if (data) {
          setExchangeRate({ rate_to_ghs: data, currency_code: formData.currency });
          if (!formData.fx_rate_override) {
            setFormData((prev) => ({
              ...prev,
              fx_rate_to_ghs: data,
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching exchange rate:', err);
        // Fallback: try to fetch from exchange_rates table directly
        try {
          const { data: fallbackData } = await supabase
            .from('exchange_rates')
            .select('*')
            .eq('currency_code', formData.currency)
            .order('rate_date', { ascending: false })
            .limit(1)
            .single();

          if (fallbackData && !formData.fx_rate_override) {
            setExchangeRate(fallbackData);
            setFormData((prev) => ({
              ...prev,
              fx_rate_to_ghs: fallbackData.rate_to_ghs,
            }));
          }
        } catch (fallbackErr) {
          console.error('Fallback rate fetch also failed:', fallbackErr);
        }
      }
    };

    fetchExchangeRate();
  }, [formData.currency]);

  // Compute taxes when line items, retention or exchange rate changes
  useEffect(() => {
    computeTaxes();
  }, [lineItems, formData.fx_rate_to_ghs, formData.retention_rate, clientTaxProfile]);

  // ===== Functions =====

  const computeTaxes = useCallback(() => {
    if (!clientTaxProfile) return;

    // Calculate subtotal in invoice currency
    const subtotal = lineItems.reduce(
      (sum, item) => sum + (item.quantity * item.unit_price || 0),
      0
    );

    // Compute taxes
    const vat = clientTaxProfile.applies_vat ? subtotal * TAX_RATES.VAT : 0;
    const nhil = clientTaxProfile.applies_nhil ? subtotal * TAX_RATES.NHIL : 0;
    const getfund = clientTaxProfile.applies_getfund ? subtotal * TAX_RATES.GETFUND : 0;
    const gross_total = subtotal + vat + nhil + getfund;
    const retentionWithheld = gross_total * (Number(formData.retention_rate || 0) / 100);
    const wht = clientTaxProfile.applies_wht
      ? subtotal * clientTaxProfile.wht_rate
      : 0;
    const expected_receipt = gross_total - wht;

    // Convert to GHS equivalent
    const fx = formData.fx_rate_to_ghs || 1.0;
    const gross_total_ghs = gross_total * fx;
    const expected_receipt_ghs = expected_receipt * fx;

    setTaxes({
      subtotal,
      vat,
      nhil,
      getfund,
      gross_total,
      retention_withheld: retentionWithheld,
      wht,
      expected_receipt,
      gross_total_ghs,
      expected_receipt_ghs,
    });

    // Check if approval is required
    setRequiresApproval(gross_total_ghs >= approvalThreshold);
  }, [clientTaxProfile, lineItems, formData.fx_rate_to_ghs, approvalThreshold]);

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLineItemChange = (index, field, value) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: null, description: '', quantity: 1, unit_price: 0 },
    ]);
  };

  const removeLineItem = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOverrideFxRate = (e) => {
    const newRate = parseFloat(e.target.value);
    setFormData((prev) => ({
      ...prev,
      fx_rate_to_ghs: newRate,
    }));
  };

  const handleSaveAsDraft = async () => {
    await saveInvoice('draft');
  };

  const handleSubmitForApproval = async () => {
    if (!formData.client_id) {
      setError('Please select a client');
      return;
    }

    if (lineItems.length === 0 || !lineItems.some((item) => item.unit_price > 0)) {
      setError('Please add at least one line item');
      return;
    }

    await saveInvoice(requiresApproval ? 'pending_approval' : 'approved');
  };

  const saveInvoice = async (status) => {
    setLoading(true);
    setError(null);

    try {
      const user = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Prepare invoice data for the base invoice record.
      const retentionWithheld = taxes.gross_total * (Number(formData.retention_rate || 0) / 100);
      const netPayable = taxes.gross_total - retentionWithheld;

      const invoiceData = {
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        retention_rate: formData.retention_rate,
        retention_withheld: retentionWithheld,
        net_payable: netPayable,
        division_id: formData.division_id,
        currency: formData.currency,
        fx_rate_to_ghs: formData.fx_rate_to_ghs,
        fx_rate_date: new Date().toISOString().split('T')[0],
        subtotal: taxes.subtotal,
        vat_amount: taxes.vat,
        nhil_amount: taxes.nhil,
        getfund_amount: taxes.getfund,
        gross_total: taxes.gross_total,
        wht_amount: taxes.wht,
        expected_receipt: taxes.expected_receipt,
        subtotal_ghs: taxes.subtotal * formData.fx_rate_to_ghs,
        vat_amount_ghs: taxes.vat * formData.fx_rate_to_ghs,
        nhil_amount_ghs: taxes.nhil * formData.fx_rate_to_ghs,
        getfund_amount_ghs: taxes.getfund * formData.fx_rate_to_ghs,
        gross_total_ghs: taxes.gross_total_ghs,
        wht_amount_ghs: taxes.wht * formData.fx_rate_to_ghs,
        expected_receipt_ghs: taxes.expected_receipt_ghs,
        status: 'draft',
        requires_approval: requiresApproval,
        approval_threshold_at_creation: approvalThreshold,
        created_by: user.data.user.id,
        notes: formData.notes,
      };

      // Insert or update invoice as a draft first.
      let invoiceId = initialData?.id;
      if (!invoiceId) {
        const { data: invoice, error: err } = await supabase
          .from('invoices')
          .insert([invoiceData])
          .select('id')
          .single();

        if (err) throw err;
        invoiceId = invoice.id;
      } else {
        const { error: err } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', invoiceId);

        if (err) throw err;
      }

      // Delete existing line items and insert the current set.
      await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
      const lineItemsData = lineItems
        .filter((item) => item.unit_price > 0)
        .map((item) => ({
          invoice_id: invoiceId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }));

      if (lineItemsData.length > 0) {
        const { error: err } = await supabase
          .from('invoice_line_items')
          .insert(lineItemsData);

        if (err) throw err;
      }

      // Call compute_invoice_taxes function and then apply the desired status transition.
      const { error: computeError } = await supabase.rpc('compute_invoice_taxes', {
        invoice_uuid: invoiceId,
      });

      if (computeError) throw computeError;

      let finalStatus = 'draft';
      if (status !== 'draft') {
        const { data: refreshedInvoice, error: refreshError } = await supabase
          .from('invoices')
          .select('requires_approval')
          .eq('id', invoiceId)
          .single();

        if (refreshError) throw refreshError;

        const transitionStatus = refreshedInvoice.requires_approval ? status : 'approved';
        const { data: transitionData, error: transitionError } = await supabase.rpc('transition_invoice_status', {
          invoice_uuid: invoiceId,
          new_status: transitionStatus,
          acting_user_id: user.data.user.id,
          rejection_reason: null,
        });

        if (transitionError) throw transitionError;
        if (!transitionData?.success) {
          throw new Error(transitionData.error || 'Status transition failed');
        }

        finalStatus = transitionStatus;
      }

      if (finalStatus === 'approved' && Number(formData.retention_rate || 0) > 0) {
        let contractId = formData.contract_id
        if (!contractId && formData.project_id) {
          const { data: contractData, error: contractError } = await supabase
            .from('contracts')
            .select('id')
            .eq('project_id', formData.project_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (contractError && contractError.code !== 'PGRST116') {
            throw contractError
          }
          contractId = contractData?.id ?? null
        }

        await recordRetentionWithheld({
          invoiceId,
          projectId: formData.project_id,
          contractId,
          retentionRate: formData.retention_rate,
          grossAmount: taxes.gross_total,
          postedBy: user.data.user.id,
        })
      }

      if (onSave) {
        onSave(invoiceId, finalStatus);
      } else {
        setError(null);
        alert(`Invoice saved as ${finalStatus}`);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error saving invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  // ===== Render =====

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: formData.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatGHS = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/30">
          <div className="bg-slate-900/80 px-6 py-5 border-b border-white/10">
            <h1 className="text-3xl font-semibold text-white">Create invoice</h1>
            <p className="mt-2 text-sm text-slate-400">
              Build an invoice with client, project, line items, and tax calculation in one flow.
            </p>
          </div>

          {error && (
            <div className="mx-6 mt-4 rounded-3xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {requiresApproval && (
            <div className="mx-6 mt-4 rounded-3xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-medium">
                ⚠️ This invoice exceeds {formatGHS(approvalThreshold)} and will require director approval before dispatch.
              </p>
            </div>
          )}

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Client</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => handleFormChange('client_id', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  >
                    <option value="">Select a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.client_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Project</label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => handleFormChange('project_id', e.target.value)}
                    disabled={!formData.client_id}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    <option value="">Select a project...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Division</label>
                  <input
                    type="text"
                    value={formData.division_name}
                    readOnly
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => handleFormChange('currency', e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    >
                      {Object.values(Currency).map((curr) => (
                        <option key={curr} value={curr}>
                          {curr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Retention Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.retention_rate}
                      onChange={(e) => handleFormChange('retention_rate', Number(e.target.value))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">FX Rate to GHS</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.fx_rate_to_ghs}
                        onChange={handleOverrideFxRate}
                        disabled={formData.currency === Currency.GHS}
                        className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-800"
                      />
                      <button
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            fx_rate_override: !prev.fx_rate_override,
                          }))
                        }
                        disabled={formData.currency === Currency.GHS}
                        className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        {formData.fx_rate_override ? 'Using Override' : 'Using Current'}
                      </button>
                    </div>
                    {exchangeRate && !formData.fx_rate_override && (
                      <p className="mt-1 text-xs text-slate-500">Current rate: {exchangeRate.rate_to_ghs}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-4">
                  <div className="flex justify-between text-sm text-slate-400 mb-3">
                    <span>Retention withheld</span>
                    <span>{formatCurrency(taxes.gross_total * (Number(formData.retention_rate || 0) / 100))}</span>
                  </div>
                  <div className="flex justify-between text-sm text-white font-semibold">
                    <span>Net Payable</span>
                    <span>{formatCurrency(taxes.gross_total - taxes.gross_total * (Number(formData.retention_rate || 0) / 100))}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-slate-300">Line Items</label>
                    <button
                      onClick={addLineItem}
                      className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
                    >
                      + Add Line Item
                    </button>
                  </div>

                  <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                    {lineItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) =>
                            handleLineItemChange(index, 'description', e.target.value)
                          }
                          className="col-span-5 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineItemChange(index, 'quantity', parseFloat(e.target.value))
                          }
                          className="col-span-2 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Unit Price"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleLineItemChange(index, 'unit_price', parseFloat(e.target.value))
                          }
                          className="col-span-2 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        />
                        <input
                          type="text"
                          readOnly
                          value={formatCurrency(item.quantity * item.unit_price)}
                          className="col-span-2 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-300"
                        />
                        <button
                          onClick={() => removeLineItem(index)}
                          className="col-span-1 rounded-full text-sm font-semibold text-rose-300 transition hover:text-rose-100"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    rows="3"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-6 rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-lg shadow-black/20">
                  <h3 className="text-lg font-semibold text-white mb-4">Tax Breakdown</h3>

                  <div className="space-y-3 text-sm text-slate-200">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium text-white">
                        {formData.currency === Currency.GHS
                          ? formatCurrency(taxes.subtotal)
                          : formatGHS(taxes.subtotal * formData.fx_rate_to_ghs)}
                      </span>
                    </div>

                    {clientTaxProfile?.applies_vat && (
                      <div className="flex justify-between">
                        <span>VAT (15%):</span>
                        <span className="font-medium text-white">
                          {formData.currency === Currency.GHS
                            ? formatCurrency(taxes.vat)
                            : formatGHS(taxes.vat * formData.fx_rate_to_ghs)}
                        </span>
                      </div>
                    )}

                    {clientTaxProfile?.applies_nhil && (
                      <div className="flex justify-between">
                        <span>NHIL (2.5%):</span>
                        <span className="font-medium text-white">
                          {formData.currency === Currency.GHS
                            ? formatCurrency(taxes.nhil)
                            : formatGHS(taxes.nhil * formData.fx_rate_to_ghs)}
                        </span>
                      </div>
                    )}

                    {clientTaxProfile?.applies_getfund && (
                      <div className="flex justify-between">
                        <span>GetFUND (2.5%):</span>
                        <span className="font-medium text-white">
                          {formData.currency === Currency.GHS
                            ? formatCurrency(taxes.getfund)
                            : formatGHS(taxes.getfund * formData.fx_rate_to_ghs)}
                        </span>
                      </div>
                    )}

                    <div className="border-t border-white/10 my-2"></div>

                    <div className="flex justify-between font-bold text-base text-white">
                      <span>Gross Total:</span>
                      <span>
                        {formData.currency === Currency.GHS
                          ? formatCurrency(taxes.gross_total)
                          : formatGHS(taxes.gross_total_ghs)}
                      </span>
                    </div>

                    {clientTaxProfile?.applies_wht && (
                      <div className="flex justify-between text-orange-300 font-medium">
                        <span>WHT Deduction ({(clientTaxProfile.wht_rate * 100).toFixed(1)}%):</span>
                        <span>
                          - {formData.currency === Currency.GHS
                            ? formatCurrency(taxes.wht)
                            : formatGHS(taxes.wht * formData.fx_rate_to_ghs)}
                        </span>
                      </div>
                    )}

                    <div className="border-t border-white/10 my-2"></div>

                    <div className="flex justify-between font-bold text-base text-emerald-300">
                      <span>Expected Receipt:</span>
                      <span>
                        {formData.currency === Currency.GHS
                          ? formatCurrency(taxes.expected_receipt)
                          : formatGHS(taxes.expected_receipt_ghs)}
                      </span>
                    </div>

                    {formData.currency !== Currency.GHS && (
                      <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-400">
                        <div className="flex justify-between mb-2">
                          <span>Gross (GHS):</span>
                          <span className="font-medium text-white">{formatGHS(taxes.gross_total_ghs)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expected (GHS):</span>
                          <span className="font-medium text-white">{formatGHS(taxes.expected_receipt_ghs)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 justify-end border-t border-white/10 pt-6 sm:flex-row">
              <button
                onClick={handleSaveAsDraft}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={handleSubmitForApproval}
                disabled={loading}
                className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
