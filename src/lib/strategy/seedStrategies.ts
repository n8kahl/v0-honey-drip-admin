import { createClient } from '../supabase/client';
import extractedStrategies from '../../../scripts/extracted-strategy-seeds.json';

/**
 * Ensure profile exists for the current user.
 * Creates profile if missing (required for strategy foreign key).
 */
async function ensureProfile(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // Profile doesn't exist, create it
    console.log('[v0] 👤 Creating profile for user:', userId);
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{ id: userId, display_name: '' }]);
    
    if (insertError) {
      throw new Error(`Failed to create profile: ${insertError.message}`);
    }
    console.log('[v0] ✅ Profile created successfully');
  } else if (error) {
    throw new Error(`Error checking profile: ${error.message}`);
  } else {
    console.log('[v0] ✅ Profile already exists');
  }
}

/**
 * Seed extracted day-trading strategies into Supabase `strategy_definitions` table.
 * 
 * Automatically uses the currently authenticated user as the owner.
 * 
 * Usage (in browser console after auth):
 *   import { seedCoreStrategies } from './lib/strategy/seedStrategies';
 *   await seedCoreStrategies();
 * 
 * Or create a one-time admin page component that calls this on button click.
 */
export async function seedCoreStrategies(): Promise<void> {
  const supabase = createClient();
  
  // Get the currently authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('You must be logged in to seed strategies. Auth error: ' + authError?.message);
  }
  
  const coreOwnerUUID = user.id;

  // Ensure profile exists (required for foreign key constraint)
  await ensureProfile(supabase, coreOwnerUUID);

  console.log(`[v0] 🌱 Seeding ${extractedStrategies.length} extracted strategies for owner ${coreOwnerUUID}...`);

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ slug: string; error: any }> = [];

  for (const seed of extractedStrategies) {
    // First check if strategy already exists
    const { data: existing } = await supabase
      .from('strategy_definitions')
      .select('id, slug')
      .eq('slug', seed.slug)
      .single();

    const insert = {
      owner: coreOwnerUUID,
      name: seed.name,
      slug: seed.slug,
      description: seed.description,
      category: seed.category,
      underlying_scope: seed.underlyingScope,
      time_window: seed.timeWindow,
      bar_timeframe: seed.barTimeframe,
      entry_side: seed.entrySide,
      options_play_type: seed.optionsPlayType,
      conditions: seed.conditions,
      alert_behavior: seed.alertBehavior,
      cooldown_minutes: seed.cooldownMinutes,
      once_per_session: seed.oncePerSession,
      is_core_library: seed.isCoreLibrary,
      enabled: seed.enabled,
    };

    if (existing) {
      // Update existing strategy
      const { data, error } = await supabase
        .from('strategy_definitions')
        .update(insert)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) {
        console.error(`[v0] ❌ Error updating strategy ${seed.slug}:`, error);
        errorCount++;
        errors.push({ slug: seed.slug, error });
      } else {
        console.log(`[v0] ✅ Updated strategy: ${seed.name} (id: ${data?.id})`);
        successCount++;
      }
    } else {
      // Insert new strategy
      const { data, error } = await supabase
        .from('strategy_definitions')
        .insert(insert)
        .select('*')
        .single();

      if (error) {
        console.error(`[v0] ❌ Error inserting strategy ${seed.slug}:`, error);
        errorCount++;
        errors.push({ slug: seed.slug, error });
      } else {
        console.log(`[v0] ✅ Inserted strategy: ${seed.name} (id: ${data?.id})`);
        successCount++;
      }
    }
  }

  console.log(`[v0] 🎉 Seeding complete! Success: ${successCount}, Errors: ${errorCount}`);
  
  if (errors.length > 0) {
    console.error('[v0] ⚠️ Errors encountered during seeding:', errors);
    throw new Error(`Failed to seed ${errorCount} strategies. Check console for details.`);
  }
}
