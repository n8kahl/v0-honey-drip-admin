/**
 * Cockpit Components V2 - Trading Cockpit Grid Layout
 *
 * A fixed, no-scroll layout that displays all critical trading information
 * simultaneously across all trade states.
 *
 * V2 Updates:
 * - Unified header with Greeks
 * - Horizontal confluence bar
 * - Position health with P&L progress bar and R-dial
 * - Alert modal overlay
 */

export {
  CockpitLayout,
  CockpitLayoutMobile,
  type CockpitViewState,
  type CockpitLayoutProps,
} from "./CockpitLayout";
export { CockpitHeader } from "./CockpitHeader";
export { CockpitConfluencePanel } from "./CockpitConfluencePanel";
export { CockpitPlanPanel } from "./CockpitPlanPanel";
export { CockpitContractPanel } from "./CockpitContractPanel";
export { CockpitRightPanel, type CockpitRightPanelProps } from "./CockpitRightPanel";
export { CockpitActionsBar } from "./CockpitActionsBar";
export { ContractPicker, ContractPickerTrigger } from "./ContractPicker";
export { AlertModal, type AlertModalProps } from "./AlertModal";
