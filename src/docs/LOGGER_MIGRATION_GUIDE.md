# Logger Migration Guide

## Overview

The new structured logger (`src/lib/utils/logger.ts`) provides:
- Environment-based log filtering
- Consistent formatting with timestamps
- Type-safe log levels (debug, info, warn, error)
- Structured data logging

## Usage

### Basic Usage

```typescript
import { createLogger } from '../lib/utils/logger';

const logger = createLogger('ComponentName');

// Replace console.log with:
logger.info('User logged in', { userId: user.id });

// Replace console.warn with:
logger.warn('API slow response', { duration: 2500 });

// Replace console.error with:
logger.error('Failed to save', { error: err.message });

// Replace console.debug with:
logger.debug('State updated', { newState });
```

### Migration Pattern

**Before:**
```typescript
console.log('[v0] marketDataStore: Subscribing to', symbols.length, 'symbols');
console.error('[v0] Failed to fetch data:', error);
```

**After:**
```typescript
import { createLogger } from '../lib/utils/logger';
const logger = createLogger('marketDataStore');

logger.info('Subscribing to symbols', { count: symbols.length });
logger.error('Failed to fetch data', { error: error.message });
```

## Environment Configuration

Set log level in `.env`:

```bash
# Development (all logs)
VITE_LOG_LEVEL=debug

# Production (warnings and errors only)
VITE_LOG_LEVEL=warn
```

Default behavior:
- **Production**: `warn` level (only warnings and errors)
- **Development**: `debug` level (all logs)

## Migration Priority

High priority files to migrate:
1. `src/stores/marketDataStore.ts` - Core data store
2. `src/services/autoPositionService.ts` - Trading logic
3. `src/hooks/useCompositeSignals.ts` - Signal processing
4. `src/lib/massive/*.ts` - API integration
5. Component files as needed

## Performance Logging

For performance-sensitive operations:

```typescript
import { logPerformance } from '../lib/utils/logger';

const endTimer = logPerformance('marketDataStore', 'recomputeSymbol');
// ... do work ...
endTimer(); // Logs: "[timestamp] DEBUG [marketDataStore] recomputeSymbol completed {"durationMs":"15.42"}"
```

## Benefits

1. **Production Performance**: Debug logs are filtered out automatically
2. **Searchability**: Consistent format makes log searching easier
3. **Structured Data**: JSON data attached to logs for better debugging
4. **Context**: Always know which component logged the message
5. **Type Safety**: TypeScript ensures correct log level usage
