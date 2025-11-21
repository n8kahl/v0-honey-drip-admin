# Scripts

Utility scripts for maintaining code quality and project health.

## session-end-check.sh

**Purpose**: Automated end-of-session health check

**Usage**:

```bash
pnpm run session-check
# or
./scripts/session-end-check.sh
```

**What it does**:

1. ✅ Runs full test suite
2. ✅ Checks TypeScript errors
3. ✅ Verifies build success
4. ✅ Shows git status
5. ✅ Displays recent commits
6. ✅ Updates CLAUDE_CONTEXT.md stats
7. ✅ Provides status summary

**When to run**:

- After every Claude Code session
- Before creating a PR
- Before deploying to production
- When resuming work after a break

**Exit codes**:

- `0` - All checks passed or minor warnings
- `1` - Critical issues found (tests failing, build broken)

## Future Scripts

Ideas for additional automation:

- `pre-deploy-check.sh` - Production readiness verification
- `dependency-audit.sh` - Security and update checks
- `performance-check.sh` - Bundle size and load time analysis
