#!/bin/bash

# Session End Check Script
# Run this after every Claude Code session to ensure everything is in sync

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Emoji support
CHECK="✅"
WARN="⚠️ "
ERROR="❌"
INFO="📝"
ROCKET="🚀"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}                    📊 SESSION END REPORT${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. Run tests
echo -e "${BLUE}${BOLD}1. Running Test Suite...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if TEST_OUTPUT=$(pnpm test 2>&1); then
    # Extract test results
    PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= passed)' | tail -1 || echo "0")
    TOTAL=$(echo "$TEST_OUTPUT" | grep -oP 'Tests.*\d+ passed' | grep -oP '\d+' | head -1 || echo "$PASSED")

    if [ "$PASSED" = "$TOTAL" ] && [ "$PASSED" != "0" ]; then
        echo -e "${GREEN}${CHECK} Tests: ${PASSED}/${TOTAL} passing (100%)${NC}"
        TEST_STATUS="passing"
    else
        echo -e "${YELLOW}${WARN}Tests: ${PASSED}/${TOTAL} passing${NC}"
        TEST_STATUS="warning"
    fi
else
    FAILED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= failed)' | tail -1 || echo "?")
    PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= passed)' | tail -1 || echo "?")
    echo -e "${RED}${ERROR} Tests: ${FAILED} failed, ${PASSED} passed${NC}"
    TEST_STATUS="failing"
fi

echo ""

# 2. Check TypeScript
echo -e "${BLUE}${BOLD}2. Checking TypeScript...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TS_OUTPUT=$(pnpm exec tsc --noEmit 2>&1 || true)
TS_ERRORS=$(echo "$TS_OUTPUT" | grep -oP '\d+(?= errors?)' | tail -1 || echo "0")

if [ "$TS_ERRORS" = "0" ]; then
    echo -e "${GREEN}${CHECK} TypeScript: No errors${NC}"
    TS_STATUS="clean"
else
    echo -e "${YELLOW}${WARN}TypeScript: ${TS_ERRORS} errors (non-blocking)${NC}"
    TS_STATUS="errors"
fi

echo ""

# 3. Check Build
echo -e "${BLUE}${BOLD}3. Verifying Build...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if pnpm run build > /dev/null 2>&1; then
    echo -e "${GREEN}${CHECK} Build: Success${NC}"
    BUILD_STATUS="success"
else
    echo -e "${RED}${ERROR} Build: Failed${NC}"
    BUILD_STATUS="failed"
fi

echo ""

# 4. Check Git Status
echo -e "${BLUE}${BOLD}4. Checking Git Status...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

GIT_STATUS=$(git status --short)
if [ -z "$GIT_STATUS" ]; then
    echo -e "${GREEN}${CHECK} Git: All changes committed${NC}"
    GIT_CLEAN="yes"
else
    echo -e "${YELLOW}${WARN}Git: Uncommitted changes${NC}"
    echo "$GIT_STATUS" | head -10
    GIT_CLEAN="no"
fi

echo ""

# 5. Recent Commits
echo -e "${BLUE}${BOLD}5. Recent Commits...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git log --oneline --decorate -5
echo ""

# 6. Update CLAUDE_CONTEXT.md with latest stats
echo -e "${BLUE}${BOLD}6. Updating CLAUDE_CONTEXT.md...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CONTEXT_FILE="CLAUDE_CONTEXT.md"
if [ -f "$CONTEXT_FILE" ]; then
    # Update test stats
    sed -i "s/Tests: [0-9]\+\/[0-9]\+ passing.*/Tests: ${PASSED}\/${TOTAL} passing/" "$CONTEXT_FILE" 2>/dev/null || true
    sed -i "s/TypeScript Errors: [0-9]\+.*/TypeScript Errors: ${TS_ERRORS}/" "$CONTEXT_FILE" 2>/dev/null || true

    echo -e "${GREEN}${CHECK} Updated CLAUDE_CONTEXT.md${NC}"
else
    echo -e "${YELLOW}${WARN}CLAUDE_CONTEXT.md not found${NC}"
fi

echo ""

# 7. Summary
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}                           SUMMARY${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Determine overall status
OVERALL_STATUS="ready"
if [ "$TEST_STATUS" = "failing" ] || [ "$BUILD_STATUS" = "failed" ]; then
    OVERALL_STATUS="blocked"
elif [ "$TEST_STATUS" = "warning" ] || [ "$GIT_CLEAN" = "no" ]; then
    OVERALL_STATUS="attention"
fi

case $OVERALL_STATUS in
    "ready")
        echo -e "${GREEN}${BOLD}${ROCKET} Status: READY FOR NEXT SESSION${NC}"
        echo ""
        echo -e "  ${GREEN}${CHECK} All tests passing${NC}"
        echo -e "  ${GREEN}${CHECK} Build successful${NC}"
        if [ "$GIT_CLEAN" = "yes" ]; then
            echo -e "  ${GREEN}${CHECK} All changes committed${NC}"
        fi
        ;;
    "attention")
        echo -e "${YELLOW}${BOLD}${WARN}Status: NEEDS ATTENTION${NC}"
        echo ""
        if [ "$TEST_STATUS" = "warning" ]; then
            echo -e "  ${YELLOW}${WARN}Some tests failing${NC}"
        fi
        if [ "$GIT_CLEAN" = "no" ]; then
            echo -e "  ${YELLOW}${WARN}Uncommitted changes${NC}"
        fi
        ;;
    "blocked")
        echo -e "${RED}${BOLD}${ERROR} Status: BLOCKED${NC}"
        echo ""
        if [ "$TEST_STATUS" = "failing" ]; then
            echo -e "  ${RED}${ERROR} Tests failing${NC}"
        fi
        if [ "$BUILD_STATUS" = "failed" ]; then
            echo -e "  ${RED}${ERROR} Build broken${NC}"
        fi
        ;;
esac

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Exit with appropriate code
if [ "$OVERALL_STATUS" = "blocked" ]; then
    exit 1
else
    exit 0
fi
