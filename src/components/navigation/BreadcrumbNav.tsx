import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { cn } from "../../lib/utils";
import { colorTransition } from "../../lib/animations";
import { focusRing } from "../../lib/a11y";

export interface BreadcrumbNavItem {
  /**
   * Display label for the breadcrumb
   */
  label: string;

  /**
   * Route path to navigate to
   */
  href?: string;

  /**
   * Whether this is the current page (last item)
   */
  isActive?: boolean;
}

export interface BreadcrumbNavProps {
  /**
   * Array of breadcrumb items
   */
  items: BreadcrumbNavItem[];

  /**
   * Custom className for wrapper
   */
  className?: string;
}

/**
 * BreadcrumbNav - Navigation breadcrumb component
 *
 * Shows the current location in the app hierarchy.
 * Each breadcrumb item can be clicked to navigate.
 *
 * Usage:
 *   <BreadcrumbNav
 *     items={[
 *       { label: 'Active Trades', href: '/trades/active' },
 *       { label: 'AAPL', href: '/trades/active?ticker=AAPL' },
 *       { label: '150 CALL', isActive: true }
 *     ]}
 *   />
 */
export function BreadcrumbNav({ items, className }: BreadcrumbNavProps) {
  const navigate = useNavigate();

  return (
    <nav
      className={cn(
        "px-4 py-3 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]",
        className
      )}
    >
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              {/* Separator between items */}
              {index > 0 && <BreadcrumbSeparator className="opacity-50" />}

              {/* Breadcrumb item */}
              <BreadcrumbItem>
                {item.isActive || !item.href ? (
                  <BreadcrumbPage className="text-[var(--text-muted)]">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    onClick={() => navigate(item.href!)}
                    className={cn(
                      "cursor-pointer text-[var(--text-high)] hover:text-[var(--brand-primary)] rounded px-1 py-0.5",
                      colorTransition,
                      focusRing
                    )}
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </nav>
  );
}
