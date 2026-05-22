import { useState, useEffect } from 'react';
import Modal from './ui/Modal'
import { supabase } from '../lib/supabase';

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  invoiced: 'bg-blue-100 text-blue-800',
};

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Awaiting Invoice',
  invoiced: 'Invoiced',
};

export default function MilestoneManager({
  userRole,
  userId,
  projectId = null,
  readOnly = false,
  hideProjectSelector = false,
  inProgressOnly = false,
}) {
  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(null);

  const [addFormData, setAddFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    percentageComplete: '',
    billingAmountOverride: '',
  });

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Load milestones when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadMilestones();
    }
  }, [selectedProjectId]);

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

      if (!projectId && data && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      setError('Failed to load projects: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMilestones = async () => {
    try {
      setLoading(true);
      const { data: milestonesData, error: milestonesErr } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', selectedProjectId)
        .order('due_date', { ascending: true });

      if (milestonesErr) throw milestonesErr;
      setMilestones(milestonesData || []);

      const { data: contractData, error: contractErr } = await supabase
        .from('contracts')
        .select('retention_percentage')
        .eq('project_id', selectedProjectId)
        .single();

      if (!contractErr) {
        setContract(contractData);
      }
    } catch (err) {
      setError('Failed to load milestones: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    try {
      if (!addFormData.title || !addFormData.dueDate || addFormData.percentageComplete === '') {
        setError('Please fill in all required fields');
        return;
      }

      const { error: err } = await supabase.from('milestones').insert([
        {
          project_id: selectedProjectId,
          title: addFormData.title,
          description: addFormData.description,
          due_date: addFormData.dueDate,
          percentage_complete: parseFloat(addFormData.percentageComplete),
          billing_amount: addFormData.billingAmountOverride
            ? parseFloat(addFormData.billingAmountOverride)
            : null,
          status: 'pending',
        },
      ]);

      if (err) throw err;

      setAddFormData({
        title: '',
        description: '',
        dueDate: '',
        percentageComplete: '',
        billingAmountOverride: '',
      });
      setShowAddForm(false);
      await loadMilestones();
    } catch (err) {
      setError('Failed to add milestone: ' + err.message);
    }
  };

  const handleStatusChange = async (milestonId, newStatus) => {
    try {
      const { error: err } = await supabase
        .from('milestones')
        .update({ status: newStatus })
        .eq('id', milestonId);

      if (err) throw err;
      await loadMilestones();
    } catch (err) {
      setError('Failed to update milestone: ' + err.message);
    }
  };

  const handleCompleteMilestone = async (milestone) => {
    try {
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

      // Call complete_milestone function
      const { data, error: err } = await supabase.rpc('complete_milestone', {
        milestone_id_param: milestone.id,
        completed_by_param: profile.id,
        completion_notes: null,
      });

      if (err) throw err;
      if (!data.success) throw new Error(data.error);

      setShowConfirmModal(null);
      await loadMilestones();
    } catch (err) {
      setError('Failed to complete milestone: ' + err.message);
    }
  };

  const visibleMilestones = inProgressOnly
    ? milestones.filter((m) => m.status === 'in_progress')
    : milestones;

  return (
    <div className="space-y-6">
      {/* Header & Project Selector */}
      <div className="rounded-4xl border border-border-soft bg-slate-950 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Milestone Manager</h2>
            <p className="text-sm text-slate-400 mt-1">Track project milestones and trigger billing</p>
          </div>
          {!readOnly && (userRole === 'project_manager' || userRole === 'accountant') && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="min-touch rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              {showAddForm ? 'Cancel' : '+ Add Milestone'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-100">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {!hideProjectSelector && (
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loading}
              className="w-full rounded-2xl border border-border-soft bg-slate-900 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-slate-800"
            >
              <option value="">Choose a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.divisions?.name})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Add Milestone Form */}
      {!readOnly && !inProgressOnly && (
        <Modal open={showAddForm} onClose={() => setShowAddForm(false)} title="Add New Milestone" size="md">
          <form onSubmit={handleAddMilestone} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={addFormData.title}
                  onChange={(e) =>
                    setAddFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="e.g., Foundation Complete"
                  className="w-full rounded-2xl border border-border-soft bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Due Date *</label>
                <input
                  type="date"
                  value={addFormData.dueDate}
                  onChange={(e) =>
                    setAddFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-border-soft bg-slate-900 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <textarea
                value={addFormData.description}
                onChange={(e) =>
                  setAddFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Milestone description..."
                rows="2"
                className="w-full rounded-2xl border border-border-soft bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Percentage Complete (%) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={addFormData.percentageComplete}
                  onChange={(e) =>
                    setAddFormData((prev) => ({ ...prev, percentageComplete: e.target.value }))
                  }
                  placeholder="0-100"
                  className="w-full rounded-2xl border border-border-soft bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Billing Amount Override (GHS) (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addFormData.billingAmountOverride}
                  onChange={(e) =>
                    setAddFormData((prev) => ({
                      ...prev,
                      billingAmountOverride: e.target.value,
                    }))
                  }
                  placeholder="Leave blank to auto-calculate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="min-touch rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Add Milestone
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="min-touch rounded-2xl border border-border-soft bg-slate-900 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-slate-900/80"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Milestones Timeline */}
      {selectedProjectId && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading milestones...</div>
          ) : visibleMilestones.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No milestones for this project</div>
          ) : (
            visibleMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className="rounded-4xl border border-border-soft bg-slate-950 p-6 shadow-sm transition-shadow hover:border-cyan-400/30"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left: Title & Description */}
                  <div className="md:col-span-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">{milestone.title}</h3>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          STATUS_COLORS[milestone.status]
                        }`}
                      >
                        {STATUS_LABELS[milestone.status]}
                      </span>
                    </div>
                    {milestone.description && (
                      <p className="text-sm text-slate-300 mb-3">{milestone.description}</p>
                    )}
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>
                        <span className="font-semibold">Due:</span>{' '}
                        {new Date(milestone.due_date).toLocaleDateString('en-GH')}
                      </p>
                      {milestone.completed_date && (
                        <p>
                          <span className="font-semibold">Completed:</span>{' '}
                          {new Date(milestone.completed_date).toLocaleDateString('en-GH')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Center: Completion & Billing */}
                  <div className="md:col-span-1">
                    <div className="space-y-4">
                      {/* Completion Percentage */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-sm font-medium text-slate-400">Completion</label>
                          <span className="text-sm font-semibold text-white">
                            {milestone.percentage_complete}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                          <div
                            className="bg-cyan-500 h-2 rounded-full transition-all"
                            style={{ width: `${milestone.percentage_complete}%` }}
                          />
                        </div>
                      </div>

                      {/* Billing Amounts */}
                      {milestone.billing_amount && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Billing Amount:</span>
                            <span className="font-semibold text-gray-900">
                              GHS {milestone.billing_amount.toLocaleString('en-GH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          {milestone.status === 'completed' || milestone.status === 'invoiced' ? (
                            <>
                              <div className="flex justify-between text-amber-700">
                                <span>Retention Held:</span>
                                <span className="font-semibold">
                                  GHS {(milestone.billing_amount * (contract?.retention_percentage || 0) / 100).toLocaleString('en-GH', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-gray-200 pt-2 text-green-700">
                                <span className="font-semibold">Net Billing:</span>
                                <span className="font-bold">
                                  GHS {(milestone.billing_amount * (1 - (contract?.retention_percentage || 0) / 100)).toLocaleString('en-GH', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="md:col-span-1 flex flex-col justify-between">
                    <div></div>
                    <div className="space-y-2">
                      {!readOnly && milestone.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(milestone.id, 'in_progress')}
                          className="w-full bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                        >
                          Mark In Progress
                        </button>
                      )}

                      {!readOnly && milestone.status === 'in_progress' && (
                        <button
                          onClick={() => setShowConfirmModal(milestone)}
                          className="w-full bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          Mark Complete
                        </button>
                      )}

                      {milestone.status === 'invoiced' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                          <p className="text-xs font-semibold text-blue-700">
                            Invoice: {milestone.invoice_id.substring(0, 8)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Complete Milestone?</h3>

            <div className="space-y-3 mb-6 text-sm">
              <div>
                <p className="text-gray-600">Milestone</p>
                <p className="font-semibold text-gray-900">{showConfirmModal.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-gray-600 text-xs">Billing Amount</p>
                  <p className="font-bold text-lg text-gray-900">
                    GHS{' '}
                    {showConfirmModal.billing_amount.toLocaleString('en-GH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-xs">Retention ({contract?.retention_percentage || 0}%)</p>
                  <p className="font-bold text-lg text-amber-600">
                    GHS{' '}
                    {(showConfirmModal.billing_amount * (contract?.retention_percentage || 0) / 100).toLocaleString('en-GH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-700">Net Billing (for Invoice)</p>
                <p className="font-bold text-xl text-green-700">
                  GHS{' '}
                  {(showConfirmModal.billing_amount * (1 - (contract?.retention_percentage || 0) / 100)).toLocaleString('en-GH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleCompleteMilestone(showConfirmModal)}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Confirm Complete
              </button>
              <button
                onClick={() => setShowConfirmModal(null)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
