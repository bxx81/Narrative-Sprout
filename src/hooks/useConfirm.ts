import { createContext, useContext } from "react";
import type { IconName } from "../components/ui/Icon";

export interface ConfirmationOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Optional third choice (e.g. redo Keep/Discard); resolves `"neutral"`. */
  neutralLabel?: string;
  isDestructive?: boolean;
  icon?: IconName;
  /** When true, only the cancel button is rendered (informational dialog). */
  onlyInfo?: boolean;
}

export type ConfirmationResult = boolean | "neutral" | null;

export interface ConfirmationContextType {
  confirm: (options: ConfirmationOptions) => Promise<ConfirmationResult>;
}

export const ConfirmationContext = createContext<ConfirmationContextType>({
  confirm: async () => null,
});

export function useConfirm() {
  return useContext(ConfirmationContext).confirm;
}
