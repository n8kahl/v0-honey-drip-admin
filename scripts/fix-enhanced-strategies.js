#!/usr/bin/env node
/**
 * Fix Enhanced Strategies - Phase 1
 *
 * Removes:
 * - pattern.market_regime checks (not yet implemented)
 * - pattern.vix_level checks (not yet implemented)
 *
 * Makes Optional:
 * - flow.* conditions → wrapped in OR with RVOL fallback
 *
 * Preserves:
 * - pattern.rsi_divergence_5m (now implemented)
 * - pattern.mtf_divergence_aligned (now implemented)
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'enhanced-strategy-seeds.json');
const outputFile = path.join(__dirname, 'enhanced-strategy-seeds-PHASE1-FIXED.json');

console.log('[Fix] Loading enhanced strategies from:', inputFile);
const strategies = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

console.log(`[Fix] Processing ${strategies.length} strategies...`);

function removeField(condition, fieldPattern) {
  if (!condition) return condition;

  if (condition.type === 'RULE') {
    // Check if this rule references the field we want to remove
    if (condition.rule && condition.rule.field && condition.rule.field.match(fieldPattern)) {
      return null; // Mark for removal
    }
    return condition;
  }

  if (condition.type === 'AND' || condition.type === 'OR' || condition.type === 'NOT') {
    condition.children = condition.children
      .map(child => removeField(child, fieldPattern))
      .filter(child => child !== null); // Remove nulls
    return condition;
  }

  return condition;
}

function makeFlowConditionsOptional(condition, rvolThreshold = 1.5) {
  if (!condition) return condition;

  if (condition.type === 'RULE') {
    // If this is a flow.* required condition, wrap it in OR with RVOL fallback
    if (condition.rule && condition.rule.field && condition.rule.field.startsWith('flow.')) {
      // Don't wrap if already in OR block (check parent)
      return {
        type: 'OR',
        children: [
          condition, // Keep original flow condition
          {
            type: 'RULE',
            rule: {
              field: 'volume.relativeToAvg',
              op: '>=',
              value: rvolThreshold
            }
          }
        ]
      };
    }
    return condition;
  }

  if (condition.type === 'AND') {
    // Process children and replace flow conditions with OR blocks
    const newChildren = [];
    for (const child of condition.children) {
      if (child.type === 'RULE' && child.rule.field && child.rule.field.startsWith('flow.')) {
        // Wrap flow condition in OR with RVOL fallback
        newChildren.push({
          type: 'OR',
          children: [
            child,
            {
              type: 'RULE',
              rule: {
                field: 'volume.relativeToAvg',
                op: '>=',
                value: rvolThreshold
              }
            }
          ]
        });
      } else if (child.type === 'OR') {
        // Already an OR block, check if it contains flow conditions
        // Keep as is, but recurse
        newChildren.push(makeFlowConditionsOptional(child, rvolThreshold));
      } else {
        newChildren.push(makeFlowConditionsOptional(child, rvolThreshold));
      }
    }
    condition.children = newChildren;
    return condition;
  }

  if (condition.type === 'OR' || condition.type === 'NOT') {
    condition.children = condition.children.map(child => makeFlowConditionsOptional(child, rvolThreshold));
    return condition;
  }

  return condition;
}

let fixedCount = 0;
let errorCount = 0;

for (const strategy of strategies) {
  try {
    console.log(`\n[Fix] Processing: ${strategy.slug}`);

    // Step 1: Remove market_regime checks
    console.log('  - Removing pattern.market_regime checks');
    strategy.conditions = removeField(strategy.conditions, /^pattern\.market_regime$/);

    // Step 2: Remove vix_level checks
    console.log('  - Removing pattern.vix_level checks');
    strategy.conditions = removeField(strategy.conditions, /^pattern\.vix_level$/);

    // Step 3: Make flow conditions optional
    console.log('  - Making flow.* conditions optional with RVOL fallback');
    strategy.conditions = makeFlowConditionsOptional(strategy.conditions, 1.5);

    // Step 4: Update description to note Phase 1 fix
    strategy.description = strategy.description + ' [Phase 1: Flow optional, awaiting market regime + VIX]';

    fixedCount++;
    console.log('  ✅ Fixed');
  } catch (error) {
    console.error(`  ❌ Error fixing ${strategy.slug}:`, error.message);
    errorCount++;
  }
}

console.log(`\n[Fix] Writing fixed strategies to: ${outputFile}`);
fs.writeFileSync(outputFile, JSON.stringify(strategies, null, 2));

console.log(`\n[Fix] Complete!`);
console.log(`  ✅ Fixed: ${fixedCount}`);
console.log(`  ❌ Errors: ${errorCount}`);
console.log(`\nNext steps:`);
console.log(`  1. Review the fixed file: ${outputFile}`);
console.log(`  2. Update seedStrategies.ts to import from enhanced-strategy-seeds-PHASE1-FIXED.json`);
console.log(`  3. Run: pnpm seed:strategies:enhanced`);
console.log(`  4. Test scanner generates signals`);
