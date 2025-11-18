# Store Tests

This folder contains unit tests for Zustand stores using Vitest.

- `marketStore.test.ts` covers watchlist add/remove behavior:
  - Normalization (trim + uppercase)
  - Duplicate guarding
  - Using DB-returned IDs for state
  - Mapping DB symbols on load
  - Toasts on success/error

Run tests:

```
pnpm vitest run
```

Note: Database and toast modules are mocked; these tests exercise only store logic.
