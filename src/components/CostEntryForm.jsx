import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const COST_TYPES = ['Materials', 'Labour', 'Subcontractors', 'Equipment Hire', 'Other'];
const CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR'];

export default function CostEntryForm({ userRole, userId }) {
  const [projects, setProjects] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [budgetWarning, setBudgetWarning] = useState(null);

  const [formData, setFormData] = useState({
    projectId: '',
    costType: '',
    description: '',
    amount: '',
    currency: 'GHS',
    dateIncurred: new Date().toISOString().split('T')[0],
    subcontractorId: '',
    receiptUrl: '',
  });

  // Load projects on mount
  useEffect(() => {
    loadProjects();
    loadSubcontractors();
  }, []);

  // Check budget variance when cost details change
  useEffect(() => {
    if (formData.projectId && formData.costType && formData.amount) {
      checkBudgetVariance();
    }
  }, [formData.projectId, formData.costType, formData.amount, formData.currency]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('projects')
        .select('id, name, status, division_id, divisions(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Project managers see only assigned projects
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

  const loadSubcontractors = async () => {
    try {
      const { data, error: err } = await supabase
        .from('subcontractors')
        .select('id, name, status')
        .eq('status', 'active')
        .order('name');

      if (err) throw err;
      setSubcontractors(data || []);
    } catch (err) {
      setError('Failed to load subcontractors: ' + err.message);
    }
  };

  const checkBudgetVariance = async () => {
    try {
      // Convert amount to GHS if foreign currency
      let amountGhs = parseFloat(formData.amount) || 0;

      if (formData.currency !== 'GHS') {
        // Get exchange rate
        const { data: rates, error: err } = await supabase
          .from('exchange_rates')
          .select('rate_to_ghs')
          .eq('currency_code', formData.currency)
          .order('rate_date', { ascending: false })
          .limit(1);

        if (err) throw err;
        if (rates && rates.length > 0) {
          amountGhs = parseFloat(formData.amount) * rates[0].rate_to_ghs;
        }
      }

      // Call check_budget_variance function
      const { data, error: err } = await supabase.rpc('check_budget_variance', {
        project_id_param: formData.projectId,
        cost_type_param: formData.costType,
        new_amount_ghs: amountGhs,
      });

      if (err) throw err;
      setBudgetWarning(data);
    } catch (err) {
      console.error('Budget variance check failed:', err);
      setBudgetWarning(null);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate form
      if (!formData.projectId || !formData.costType || !formData.description || !formData.amount) {
        throw new Error('Please fill in all required fields');
      }

      if (formData.costType === 'Subcontractors' && !formData.subcontractorId) {
        throw new Error('Subcontractor is required for Subcontractors cost type');
      }

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

      // Call post_project_cost function
      const { data, error: err } = await supabase.rpc('post_project_cost', {
        project_id_param: formData.projectId,
        cost_type_param: formData.costType,
        description_param: formData.description,
        amount_param: parseFloat(formData.amount),
        currency_param: formData.currency,
        date_incurred_param: formData.dateIncurred,
        posted_by_param: profile.id,
        subcontractor_id_param: formData.subcontractorId || null,
        receipt_url_param: formData.receiptUrl || null,
      });

      if (err) throw err;
      if (!data.success) throw new Error(data.error);

      setSuccess(
        `Cost posted successfully! Journal Entry ID: ${data.journal_entry_id}. Amount (GHS): ${data.amount_ghs.toLocaleString('en-GH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      );

      // Reset form
      setFormData({
        projectId: '',
        costType: '',
        description: '',
        amount: '',
        currency: 'GHS',
        dateIncurred: new Date().toISOString().split('T')[0],
        subcontractorId: '',
        receiptUrl: '',
      });
      setBudgetWarning(null);

      // Reload projects to refresh data
      setTimeout(() => loadProjects(), 500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === formData.projectId);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Post Project Cost</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
          <p className="font-semibold">Success</p>
          <p>{success}</p>
        </div>
      )}

      {budgetWarning && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            budgetWarning.status === 'over_budget'
              ? 'bg-red-50 border-l-4 border-red-500 text-red-700'
              : budgetWarning.status === 'at_risk'
              ? 'bg-amber-50 border-l-4 border-amber-500 text-amber-700'
              : 'bg-blue-50 border-l-4 border-blue-500 text-blue-700'
          }`}
        >
          <p className="font-semibold">Budget {budgetWarning.status.replace('_', ' ').toUpperCase()}</p>
          <p>{budgetWarning.message}</p>
          {budgetWarning.variance_pct && (
            <p className="text-sm mt-1">
              Budget: GHS {budgetWarning.budget_amount?.toLocaleString('en-GH')} | Projected: GHS{' '}
              {budgetWarning.projected_total?.toLocaleString('en-GH')} ({budgetWarning.variance_pct}%)
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project <span className="text-red-500">*</span>
          </label>
          <select
            name="projectId"
            value={formData.projectId}
            onChange={handleInputChange}
            required
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.divisions?.name})
              </option>
            ))}
          </select>
        </div>

        {/* Cost Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cost Type <span className="text-red-500">*</span>
          </label>
          <select
            name="costType"
            value={formData.costType}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select cost type</option>
            {COST_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Subcontractor (conditionally shown) */}
        {formData.costType === 'Subcontractors' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subcontractor <span className="text-red-500">*</span>
            </label>
            <select
              name="subcontractorId"
              value={formData.subcontractorId}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a subcontractor</option>
              {subcontractors.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            rows="3"
            placeholder="Enter cost description"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Amount & Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              required
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CURRENCIES.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Incurred */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Incurred</label>
          <input
            type="date"
            name="dateIncurred"
            value={formData.dateIncurred}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Receipt URL (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Receipt URL (Optional)</label>
          <input
            type="url"
            name="receiptUrl"
            value={formData.receiptUrl}
            onChange={handleInputChange}
            placeholder="https://example.com/receipt.pdf"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Project Info (display only) */}
        {selectedProject && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Division:</span> {selectedProject.divisions?.name}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || loading}
          className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {submitting ? 'Posting...' : 'Post Cost'}
        </button>
      </form>
    </div>
  );
}
