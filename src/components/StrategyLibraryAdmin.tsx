import { useState, useEffect } from 'react';
import { HDCard } from './hd/HDCard';
import { HDButton } from './hd/HDButton';
import { HDDialogEditStrategy } from './hd/HDDialogEditStrategy';
import { HDDialogCreateStrategy } from './hd/HDDialogCreateStrategy';
import { useAppToast } from '../hooks/useAppToast';
import { RefreshCw, Database, TrendingUp } from 'lucide-react';
import { seedCoreStrategies } from '../lib/strategy/seedStrategies';
import {
  listAllStrategies,
  toggleStrategyEnabled,
  getStrategyStats,
  createStrategy,
  updateStrategy,
  deleteStrategy
} from '../lib/strategy/admin';
import type { StrategyDefinition } from '../types/strategy';

/**
 * Admin panel for managing strategy library.
 * Displays all strategies with toggle switches, seed button, and stats.
 */
export function StrategyLibraryAdmin() {
  const toast = useAppToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStrategy, setEditStrategy] = useState<StrategyDefinition | null>(null);
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('[v0] 📊 Loading strategies from database...');
      const [allStrategies, strategyStats] = await Promise.all([
        listAllStrategies(),
        getStrategyStats()
      ]);
      console.log('[v0] ✅ Loaded strategies:', allStrategies.length, 'strategies');
      console.log('[v0] 📈 Stats:', strategyStats);
      setStrategies(allStrategies);
      setStats(strategyStats);
    } catch (error: any) {
      console.error('[v0] ❌ Error loading strategies:', error);
      console.error('[v0] Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      
      // Check if table doesn't exist
      if (error?.message?.includes('relation "public.strategy_definitions" does not exist') || 
          error?.code === '42P01') {
        toast.error('Strategy table not found. Please run the database migration: scripts/003_add_strategy_library.sql');
      } else {
        toast.error('Failed to load strategies: ' + (error?.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-load strategies on mount
  useEffect(() => {
    loadData();
  }, []);

  const handleSeed = async () => {
    if (!confirm('This will seed 11 core strategies into the database. Continue?')) {
      return;
    }
    
    setSeeding(true);
    console.log('[v0] 🌱 Starting seed process...');
    try {
      await seedCoreStrategies();
      console.log('[v0] ✅ Seed function completed successfully');
      toast.success('Successfully seeded core strategies!');
      
      // Wait a moment for DB to settle, then reload
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('[v0] 📊 Reloading strategies from database...');
      await loadData();
      console.log('[v0] 🎉 Strategies reloaded');
    } catch (error: any) {
      console.error('[v0] ❌ Error seeding strategies:', error);
      toast.error('Failed to seed strategies: ' + error.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleToggle = async (strategyId: string, currentEnabled: boolean) => {
    try {
      await toggleStrategyEnabled(strategyId, !currentEnabled);
      toast.success(`Strategy ${!currentEnabled ? 'enabled' : 'disabled'}`);
      await loadData(); // Reload to show updated state
    } catch (error: any) {
      console.error('[v0] Error toggling strategy:', error);
      toast.error('Failed to toggle strategy: ' + error.message);
    }
  };

  const handleCheckDatabase = async () => {
    try {
      const count = await loadData();
      console.log('[v0] 📊 Database check complete. Found strategies:', strategies);
      toast.info(`Found ${strategies.length} strategies in database`);
    } catch (error: any) {
      console.error('[v0] ❌ Database check failed:', error);
      toast.error('Database check failed: ' + error.message);
    }
  };

  // Save handler for edit modal
  const handleEditSave = async (updated: Partial<StrategyDefinition>) => {
    if (!updated.id) return;
    try {
      await updateStrategy(updated.id, updated);
      toast.success('Strategy updated!');
      await loadData();
    } catch (e: any) {
      toast.error('Failed to update: ' + (e?.message || 'Unknown error'));
    }
  };

  // Create handler for create modal
  const handleCreateStrategy = async (newStrategy: Partial<StrategyDefinition>) => {
    try {
      // Fill required fields for creation
      const owner = 'admin'; // TODO: Replace with actual user id
      const slug = newStrategy.name?.toLowerCase().replace(/\s+/g, '-') || '';
      const base: any = {
        ...newStrategy,
        slug,
        owner,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        underlyingScope: 'ANY',
        timeWindow: null,
        barTimeframe: '1m',
        conditions: { type: 'AND', children: [] },
        cooldownMinutes: 5,
        oncePerSession: false,
      };
      await createStrategy(base);
      toast.success('Strategy created!');
      await loadData();
    } catch (e: any) {
      toast.error('Failed to create: ' + (e?.message || 'Unknown error'));
    }
  };

  // Delete handler
  const handleDelete = async (strategyId: string) => {
    if (!confirm('Are you sure you want to delete this strategy? This cannot be undone.')) return;
    try {
      await deleteStrategy(strategyId);
      toast.success('Strategy deleted!');
      await loadData();
    } catch (e: any) {
      toast.error('Failed to delete: ' + (e?.message || 'Unknown error'));
    }
  };

  return (
    <>
      <HDDialogEditStrategy
        open={editOpen}
        onOpenChange={setEditOpen}
        strategy={editStrategy}
        onSave={handleEditSave}
      />
      <HDDialogCreateStrategy
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreateStrategy}
      />
      <HDCard>
      <div className="space-y-4">
        {/* Header */}
        <div className="border-b border-[var(--border-hairline)] pb-3">
          <h3 className="text-lg font-medium text-[var(--text-high)] flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Strategy Library Admin
          </h3>
          <p className="text-sm text-[var(--text-mid)] mt-1">
            Manage trading strategies, seed core library, and view statistics
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <HDButton 
            variant="primary"
            onClick={() => setCreateOpen(true)}
            disabled={loading || seeding}
          >
            + New Strategy
          </HDButton>
          <HDButton 
            variant="secondary"
            onClick={handleSeed} 
            disabled={seeding || loading}
          >
            <Database className="w-4 h-4 mr-2" />
            {seeding ? 'Seeding...' : 'Seed Core Strategies'}
          </HDButton>
          <HDButton 
            variant="ghost"
            onClick={loadData}
            disabled={loading || seeding}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </HDButton>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
            <div>
              <div className="text-xs text-[var(--text-mid)]">Total</div>
              <div className="text-2xl font-bold text-[var(--text-high)] mt-1">{stats.total}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-mid)]">Enabled</div>
              <div className="text-2xl font-bold text-[var(--trade-long)] mt-1">{stats.enabled}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-mid)]">Disabled</div>
              <div className="text-2xl font-bold text-[var(--text-muted)] mt-1">{stats.disabled}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-mid)]">Core Library</div>
              <div className="text-2xl font-bold text-[var(--text-high)] mt-1">{stats.coreLibrary}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-mid)]">User Defined</div>
              <div className="text-2xl font-bold text-[var(--text-high)] mt-1">{stats.userDefined}</div>
            </div>
          </div>
        )}

          {/* Strategy List */}
          {loading ? (
            <div className="text-center py-12 text-[var(--text-mid)]">
              <span className="inline-block animate-spin mr-2">⏳</span> Loading strategies...
            </div>
          ) : strategies.length > 0 && (
            <div className="border border-[var(--border-hairline)] rounded-[var(--radius)]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--surface-1)]">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-[var(--text-mid)]">Name</th>
                      <th className="text-left p-3 text-xs font-medium text-[var(--text-mid)]">Category</th>
                      <th className="text-left p-3 text-xs font-medium text-[var(--text-mid)]">Type</th>
                      <th className="text-center p-3 text-xs font-medium text-[var(--text-mid)]">Core Library</th>
                      <th className="text-center p-3 text-xs font-medium text-[var(--text-mid)]">Enabled</th>
                      <th className="text-center p-3 text-xs font-medium text-[var(--text-mid)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map((strategy) => (
                      <tr key={strategy.id} className="border-t border-[var(--border-hairline)] hover:bg-[var(--surface-1)]">
                        <td className="p-3 font-medium text-[var(--text-high)]">{strategy.name}</td>
                        <td className="p-3 text-sm text-[var(--text-mid)]">
                          {strategy.category}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                            strategy.entrySide === 'LONG' 
                              ? 'bg-[var(--trade-long)]/10 text-[var(--trade-long)]' 
                              : strategy.entrySide === 'SHORT'
                              ? 'bg-[var(--trade-short)]/10 text-[var(--trade-short)]'
                              : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          }`}>
                            {strategy.entrySide}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {strategy.isCoreLibrary ? (
                            <span className="text-[var(--brand-primary)] font-medium">✓</span>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={strategy.enabled}
                              onChange={() => handleToggle(strategy.id, strategy.enabled)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-[var(--surface-2)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--brand-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-hairline)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                          </label>
                        </td>
                        <td className="p-3 text-center">
                          <HDButton 
                            variant="ghost"
                            onClick={() => {
                              setEditStrategy(strategy);
                              setEditOpen(true);
                            }}
                          >
                            Edit
                          </HDButton>
                          {!strategy.isCoreLibrary && (
                            <HDButton 
                              variant="secondary"
                              onClick={() => handleDelete(strategy.id)}
                              className="ml-2"
                            >
                              Delete
                            </HDButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {strategies.length === 0 && !loading && (
            <div className="text-center py-12 text-[var(--text-mid)]">
              No strategies found. Click "Load Strategies" or "Seed Core Strategies" to get started.
            </div>
          )}
        </div>
      </HDCard>
    </>
  );
}
