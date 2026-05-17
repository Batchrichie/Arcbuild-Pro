import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ProjectCostLedger({ userRole, userId, projectId = null }) {
  const [projects, setProjects] = useState([]);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [filters, setFilters] = useState({
    costType: '',
    dateFrom: '',
    dateTo: '',
  });

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Load costs when project or filters change
  useEffect(() => {
    if (selectedProjectId) {
      loadCosts();
    }
  }, [selectedProjectId, filters]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('projects')
        .select('id, name, status, divisions(name)')
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

      // Auto-select first project if projectId not provided
      if (!projectId && data && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      setError('Failed to load projects: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCosts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('project_costs')
        .select(
          `
          id,
          cost_type,
          description,
          amount,
          currency,
          amount_ghs,
          date_incurred,
          account_code,
          created_at,
          posted_by,
          profiles!posted_by(full_name),
          journal_entry_id,
          subcontractor_id,
          subcontractors(name),
          receipt_url
        `
        )
        .eq('project_id', selectedProjectId)
        .order('date_incurred', { ascending: false });

      // Apply filters
      if (filters.costType) {
        query = query.eq('cost_type', filters.costType);
      }
      if (filters.dateFrom) {
        query = query.gte('date_incurred', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('date_incurred', filters.dateTo);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setCosts(data || []);
    } catch (err) {
      setError('Failed to load costs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Calculate totals
  const totals = {
    materials: costs
      .filter((c) => c.cost_type === 'Materials')
      .reduce((sum, c) => sum + (c.amount_ghs || 0), 0),
    labour: costs
      .filter((c) => c.cost_type === 'Labour')
      .reduce((sum, c) => sum + (c.amount_ghs || 0), 0),
    subcontractors: costs
      .filter((c) => c.cost_type === 'Subcontractors')
      .reduce((sum, c) => sum + (c.amount_ghs || 0), 0),
    equipment: costs
      .filter((c) => c.cost_type === 'Equipment Hire')
      .reduce((sum, c) => sum + (c.amount_ghs || 0), 0),
    other: costs.filter((c) => c.cost_type === 'Other').reduce((sum, c) => sum + (c.amount_ghs || 0), 0),
  };

  const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

  const getCostTypeColor = (costType) => {
    const colors = {
      Materials: 'bg-blue-100 text-blue-800',
      Labour: 'bg-green-100 text-green-800',
      Subcontractors: 'bg-purple-100 text-purple-800',
      'Equipment Hire': 'bg-orange-100 text-orange-800',
      Other: 'bg-gray-100 text-gray-800',
    };
    return colors[costType] || 'bg-gray-100 text-gray-800';
  };

  const getAccountCodeLabel = (code) => {
    const labels = {
      '5101': 'Materials Expense',
      '5102': 'Subcontractor Expense',
      '5103': 'Labour Expense',
      '5104': 'Equipment Hire Expense',
      '6203': 'Other Expenses',
    };
    return labels[code] || code;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Cost Ledger</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Project Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          >
            <option value="">Choose a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.divisions?.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters */}
      {selectedProjectId && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cost Type</label>
              <select
                name="costType"
                value={filters.costType}
                onChange={handleFilterChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="Materials">Materials</option>
                <option value="Labour">Labour</option>
                <option value="Subcontractors">Subcontractors</option>
                <option value="Equipment Hire">Equipment Hire</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                name="dateFrom"
                value={filters.dateFrom}
                onChange={handleFilterChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                name="dateTo"
                value={filters.dateTo}
                onChange={handleFilterChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {selectedProjectId && !loading && costs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { label: 'Materials', value: totals.materials, color: 'bg-blue-50' },
            { label: 'Labour', value: totals.labour, color: 'bg-green-50' },
            { label: 'Subcontractors', value: totals.subcontractors, color: 'bg-purple-50' },
            { label: 'Equipment', value: totals.equipment, color: 'bg-orange-50' },
            { label: 'Other', value: totals.other, color: 'bg-gray-50' },
            { label: 'Total', value: grandTotal, color: 'bg-teal-50 col-span-2 md:col-span-1' },
          ].map((item) => (
            <div key={item.label} className={`${item.color} rounded-lg p-4 border border-gray-200`}>
              <p className="text-xs font-semibold text-gray-600 uppercase">{item.label}</p>
              <p className="text-lg font-bold text-gray-900">
                GHS {item.value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Costs Table */}
      {selectedProjectId && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Reference</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Amount (Orig.)</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Amount (GHS)</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Posted By</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                      Loading costs...
                    </td>
                  </tr>
                ) : costs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                      No costs found for this project
                    </td>
                  </tr>
                ) : (
                  costs.map((cost) => (
                    <tr key={cost.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {new Date(cost.date_incurred).toLocaleDateString('en-GH')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getCostTypeColor(cost.cost_type)}`}>
                          {cost.cost_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{cost.description}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="text-xs">
                          <p className="font-mono">{getAccountCodeLabel(cost.account_code)}</p>
                          <p className="text-gray-500">JE: {cost.journal_entry_id.substring(0, 8)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">
                        {cost.currency} {cost.amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                        GHS{' '}
                        {cost.amount_ghs.toLocaleString('en-GH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{cost.profiles?.full_name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm">
                        {cost.receipt_url ? (
                          <a href={cost.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                            Receipt
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Grand Total */}
          {costs.length > 0 && (
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex justify-end items-center space-x-8">
                <div>
                  <p className="text-sm text-gray-600">Grand Total (GHS)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {grandTotal.toLocaleString('en-GH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
