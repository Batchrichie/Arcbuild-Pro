import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function MilestoneInvoiceQueue({ userRole, userId }) {
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [invoiceFormData, setInvoiceFormData] = useState({
    clientId: '',
    projectId: '',
    currency: 'GHS',
    lineItems: [],
    notes: '',
  });

  // Load queue on mount
  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('milestone_invoice_queue')
        .select('*')
        .order('completed_date', { ascending: true });

      if (err) throw err;
      setQueueItems(data || []);
    } catch (err) {
      setError('Failed to load queue: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = (item) => {
    setSelectedMilestone(item);
    setInvoiceFormData({
      clientId: item.client_id,
      projectId: item.project_id,
      divisionId: item.division_id,
      currency: 'GHS',
      lineItems: [
        {
          description: item.milestone_title,
          quantity: 1,
          unitPrice: item.net_billing,
        },
      ],
      notes: `Retention of GHS ${item.retention_amount?.toLocaleString('en-GH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} held per contract (${(item.retention_percentage || 0)}%)`,
    });
  };

  const handleSubmitInvoice = async () => {
    try {
      setCreatingInvoice(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user profile
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileErr) throw profileErr;

      // Create invoice
      const { data: invoiceData, error: invoiceErr } = await supabase
        .from('invoices')
        .insert([
          {
            client_id: invoiceFormData.clientId,
            project_id: invoiceFormData.projectId,
            division: invoiceFormData.divisionId,
            currency: invoiceFormData.currency,
            status: 'draft',
            created_by: profile.id,
            notes: invoiceFormData.notes,
          },
        ])
        .select()
        .single();

      if (invoiceErr) throw invoiceErr;

      // Add line items
      const lineItemsToInsert = invoiceFormData.lineItems.map((item) => ({
        invoice_id: invoiceData.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { error: lineErr } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsToInsert);

      if (lineErr) throw lineErr;

      // Link milestone to invoice
      const { data: linkResult, error: linkErr } = await supabase.rpc(
        'link_milestone_invoice',
        {
          milestone_id_param: selectedMilestone.milestone_id,
          invoice_id_param: invoiceData.id,
          actor_uuid: user.id,
        }
      );

      if (linkErr) throw linkErr;
      if (!linkResult.success) throw new Error(linkResult.error);

      setSuccess(
        `Invoice ${invoiceData.invoice_number} created and linked to milestone successfully!`
      );
      setSelectedMilestone(null);
      setInvoiceFormData({
        clientId: '',
        projectId: '',
        currency: 'GHS',
        lineItems: [],
        notes: '',
      });

      // Reload queue
      setTimeout(() => loadQueue(), 500);
    } catch (err) {
      setError('Failed to create invoice: ' + err.message);
    } finally {
      setCreatingInvoice(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Milestone Invoice Queue</h2>
        <p className="text-sm text-gray-600">
          Create invoices from completed milestones. Billing amounts show net of retention.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
          <p className="font-semibold">Success</p>
          <p>{success}</p>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading queue...</div>
        ) : queueItems.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-5xl mb-2">✓</div>
            <p className="text-gray-600 font-semibold">No milestones awaiting invoicing</p>
            <p className="text-sm text-gray-500">All completed milestones have been invoiced</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Division
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Milestone
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                    Billing Amount
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                    Retention
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                    Net Billing
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {queueItems.map((item) => (
                  <tr key={item.milestone_id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700 font-semibold">
                      {item.project_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.client_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.division_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                      {item.milestone_title}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(item.completed_date).toLocaleDateString('en-GH')}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                      GHS{' '}
                      {item.billing_amount.toLocaleString('en-GH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-amber-700 font-semibold">
                      GHS{' '}
                      {item.retention_amount.toLocaleString('en-GH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-green-700 font-bold">
                      GHS{' '}
                      {item.net_billing.toLocaleString('en-GH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleCreateInvoice(item)}
                        className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Create Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Preview Modal */}
      {selectedMilestone && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Create Invoice from Milestone</h3>

            <div className="space-y-6">
              {/* Milestone Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700 font-semibold mb-2">Milestone Details</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Milestone</p>
                    <p className="font-semibold text-gray-900">{selectedMilestone.milestone_title}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Project</p>
                    <p className="font-semibold text-gray-900">{selectedMilestone.project_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Client</p>
                    <p className="font-semibold text-gray-900">{selectedMilestone.client_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Completed</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(selectedMilestone.completed_date).toLocaleDateString('en-GH')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Billing Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-600 font-semibold uppercase">Billing Amount</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    GHS{' '}
                    {selectedMilestone.billing_amount.toLocaleString('en-GH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs text-amber-700 font-semibold uppercase">Retention Held</p>
                  <p className="text-2xl font-bold text-amber-700 mt-2">
                    GHS{' '}
                    {selectedMilestone.retention_amount.toLocaleString('en-GH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs text-green-700 font-semibold uppercase">Net Billing</p>
                  <p className="text-2xl font-bold text-green-700 mt-2">
                    GHS{' '}
                    {selectedMilestone.net_billing.toLocaleString('en-GH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              {/* Invoice Line Item */}
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">Invoice Line Item</p>
                <div className="bg-gray-50 p-3 rounded text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Description:</span>
                    <span className="font-semibold text-gray-900">
                      {selectedMilestone.milestone_title}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-semibold text-gray-900">1</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-semibold text-gray-900">Unit Price:</span>
                    <span className="font-bold text-gray-900">
                      GHS{' '}
                      {selectedMilestone.net_billing.toLocaleString('en-GH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Invoice Notes */}
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Invoice Notes</p>
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 italic">
                  {invoiceFormData.notes}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSubmitInvoice}
                  disabled={creatingInvoice}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                  {creatingInvoice ? 'Creating Invoice...' : 'Create & Link Invoice'}
                </button>
                <button
                  onClick={() => setSelectedMilestone(null)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
