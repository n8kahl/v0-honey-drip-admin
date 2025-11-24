/**
 * Confluence Optimizer (DEPRECATED - Stub for Railway build compatibility)
 *
 * This file exists only to prevent build errors on Railway.
 * The actual confluence optimization logic has been integrated into the main scanner.
 *
 * TODO: Remove this file once Railway cache is cleared and service is reconfigured.
 */

export class ConfluenceOptimizer {
  // Stub class to satisfy TypeScript compilation
  static backtestAll() {
    console.warn("[ConfluenceOptimizer] This is a deprecated stub. Use CompositeScanner instead.");
    return [];
  }
}

// Export an empty main function to prevent runtime errors
if (require.main === module) {
  console.log(
    "[ConfluenceOptimizer] DEPRECATED: This worker is no longer used. Use compositeScanner.ts instead."
  );
  process.exit(0);
}
