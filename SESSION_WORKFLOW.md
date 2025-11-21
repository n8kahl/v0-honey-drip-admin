# 🔄 Session Workflow Guide

Quick reference for maintaining code quality between Claude Code sessions.

## End of Session Checklist

### Run the Automated Check

```bash
pnpm run session-check
```

This single command will:

- ✅ Run all 115 tests
- ✅ Check TypeScript errors
- ✅ Verify build works
- ✅ Show uncommitted changes
- ✅ Display recent commits
- ✅ Update documentation stats
- ✅ Give you a clear status report

### Understanding the Output

**🚀 Status: READY FOR NEXT SESSION**

- Everything is committed
- All tests passing
- Build successful
- Good to go!

**⚠️ Status: NEEDS ATTENTION**

- Some uncommitted changes OR
- A few tests failing
- Review and fix before next session

**❌ Status: BLOCKED**

- Tests failing OR
- Build broken
- Must fix before proceeding

## Manual Commands (If Needed)

### Quick Checks

```bash
# Run tests only
pnpm test

# Run tests in watch mode (great during development)
pnpm test:watch

# Check what changed
git status

# See test coverage
pnpm test:coverage
```

### Before Deploying

```bash
# Full quality check
pnpm run session-check

# Type check
pnpm run typecheck

# Lint code
pnpm run lint

# Format code
pnpm run format
```

### Common Git Operations

```bash
# See recent commits
git log --oneline -5

# Check current branch
git branch

# View uncommitted changes
git diff

# Commit all changes
git add -A
git commit -m "Your message here"
git push
```

## Best Practices

### Start of Session

1. Pull latest changes: `git pull`
2. Check test status: `pnpm test`
3. Review CLAUDE_CONTEXT.md for any updates

### During Session

1. Run tests frequently: `pnpm test:watch`
2. Commit logical chunks of work
3. Write clear commit messages

### End of Session

1. **Run session check**: `pnpm run session-check`
2. Commit any remaining changes
3. Push to remote
4. Review the status summary

## Troubleshooting

### "Tests are failing"

```bash
# Run tests with full output
pnpm test

# Run specific test file
pnpm test path/to/test.test.ts

# Run tests in watch mode to debug
pnpm test:watch
```

### "Build is broken"

```bash
# Try rebuilding
pnpm run build

# Check for TypeScript errors
pnpm run typecheck

# Check for syntax errors
pnpm run lint
```

### "Uncommitted changes"

```bash
# See what changed
git status
git diff

# Commit if intentional
git add -A
git commit -m "Description of changes"

# Discard if unintentional
git checkout -- filename
```

## Quick Reference Card

| Task              | Command                  |
| ----------------- | ------------------------ |
| End of session    | `pnpm run session-check` |
| Run tests         | `pnpm test`              |
| Run tests (watch) | `pnpm test:watch`        |
| Check types       | `pnpm run typecheck`     |
| Lint code         | `pnpm run lint`          |
| Format code       | `pnpm run format`        |
| Build             | `pnpm run build`         |
| Git status        | `git status`             |
| Recent commits    | `git log --oneline -5`   |

## Integration with CI/CD

The session check mirrors what GitHub Actions will do:

- Same tests run in CI/CD
- Same type checking rules
- Same build process
- Same linting rules

If `pnpm run session-check` passes, your PR will likely pass CI/CD! ✅

---

**Pro Tip**: Add `pnpm run session-check` to your terminal history for quick access. Press ↑ to recall recent commands!
