/**
 * Composite Trade Setup System
 * Phase 3: Opportunity Detectors
 * Phase 5: Composite Scanner Engine
 *
 * This module provides the core framework for detecting trade opportunities
 * using weighted confluence scoring, and the main scanner engine for
 * generating trade signals.
 */

// Core framework (Phase 3)
export * from './OpportunityDetector.js';

// All detectors (Phase 3)
export * from './detectors/index.js';

// Scanner engine (Phase 5)
export * from './CompositeScanner.js';
export * from './CompositeSignal.js';
export * from './ScannerConfig.js';
export * from './SignalDeduplication.js';
