import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import {
  fetchZeroGpuQuota,
  ZERO_GPU_QUOTA_URL,
  type ZeroGpuQuotaResult,
} from "../../features/connectivity/api";
import type { AsyncOperation } from "../../store/asyncOperation";

interface HuggingFaceZeroGpuQuotaTestProps {
  /** Debounced token currently typed in the panel (header-only, never stored here). */
  token: string | null;
  /** Panel-level lock while settings load. */
  disabled?: boolean;
}

type QuotaOperation = AsyncOperation<{ requestedAt: string }, ZeroGpuQuotaResult>;

const resultTextClass: Record<ZeroGpuQuotaResult["kind"], string> = {
  ok: "text-green-600 dark:text-green-400",
  "http-error": "text-amber-600 dark:text-amber-400",
  "invalid-response": "text-amber-600 dark:text-amber-400",
  unreachable: "text-red-500",
  timeout: "text-red-500",
};

/**
 * Hugging Face's counterpart of `EndpointConnectionTest`: the panel has a
 * fixed Space URL, so instead of probing reachability the button fetches
 * `GET /api/spaces/zero-gpu/quota` — proving the token is accepted and
 * showing the account's ZeroGPU quota. Local `AsyncOperation` state only —
 * no store slice, no Zustand `set`.
 */
const HuggingFaceZeroGpuQuotaTest: React.FC<HuggingFaceZeroGpuQuotaTestProps> = ({
  token,
  disabled = false,
}) => {
  const { t, i18n } = useTranslation();
  const [operation, setOperation] = useState<QuotaOperation>({ phase: "idle" });
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleTest = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const payload = { requestedAt: new Date().toISOString() };
    setOperation({ phase: "running", payload, startedAt: payload.requestedAt });
    try {
      const result = await fetchZeroGpuQuota({
        token: token ?? "",
        signal: controller.signal,
      });
      if (abortControllerRef.current !== controller) return;
      setOperation({ phase: "done", result });
    } catch (error) {
      if (abortControllerRef.current !== controller) return;
      if (error instanceof Error && error.name === "AbortError") {
        setOperation({ phase: "idle" });
        return;
      }
      setOperation({
        phase: "failed",
        payload,
        error: error instanceof Error ? error : new Error("ZeroGPU quota check failed"),
      });
    }
  };

  const isRunning = operation.phase === "running";
  const completed = operation.phase === "done" ? operation.result : null;
  const failed = operation.phase === "failed" ? operation.error : null;
  const hasToken = (token ?? "").trim().length > 0;

  return (
    <div className="mt-3 space-y-2">
      <Button
        type="button"
        intent="secondary"
        size="medium"
        onClick={() => void handleTest()}
        disabled={isRunning || disabled || !hasToken}
        isWorking={isRunning}
        className="w-full"
      >
        {t("connectionTestButton")}
      </Button>
      <p className="support-text-color text-xs">
        {t("connectionTestTargetLabel")}: <span className="font-mono">{ZERO_GPU_QUOTA_URL}</span>
      </p>
      {!hasToken && <p className="support-text-color text-xs">{t("zeroGpuTokenRequired")}</p>}
      {completed?.kind === "ok" && (
        <div role="status" className="space-y-1">
          <p className={`text-xs font-semibold ${resultTextClass.ok}`}>
            {t("zeroGpuRemaining", {
              current: formatGpuSeconds(completed.quota.current, i18n.language),
              base: formatGpuSeconds(completed.quota.base, i18n.language),
              percent: remainingPercent(completed.quota.current, completed.quota.base),
            })}
          </p>
          <p className="support-text-color text-xs">
            {completed.quota.resetsAt === null
              ? t("zeroGpuResetsNotUsed")
              : t("zeroGpuResetsAt", {
                  time: formatResetTime(completed.quota.resetsAt, i18n.language),
                })}
          </p>
          {completed.quota.runs && (
            <p className="support-text-color text-xs">
              {t("zeroGpuRunsRemaining", {
                remaining: completed.quota.runs.remaining,
                limit: completed.quota.runs.limit,
              })}
            </p>
          )}
          {(completed.quota.overquotaUsed ?? 0) > 0 && (
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {t("zeroGpuOverquota", {
                seconds: formatGpuSeconds(completed.quota.overquotaUsed ?? 0, i18n.language),
              })}
            </p>
          )}
          <p className="support-text-color text-xs">{t("zeroGpuStatusDisclaimer")}</p>
        </div>
      )}
      {completed && completed.kind !== "ok" && (
        <p role="status" className={`text-xs font-semibold ${resultTextClass[completed.kind]}`}>
          {formatFailure(t, completed)}
          {completed.kind === "http-error" &&
            completed.status !== 401 &&
            completed.status !== 403 && <span className="font-mono"> — {completed.detail}</span>}
          {completed.kind === "unreachable" && completed.detail && (
            <span className="font-mono"> ({completed.detail})</span>
          )}
          {completed.kind === "invalid-response" && completed.detail && (
            <span className="font-mono"> — {completed.detail}</span>
          )}
        </p>
      )}
      {failed && (
        <p role="status" className="text-xs font-semibold text-red-500">
          {failed.message}
        </p>
      )}
    </div>
  );
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

function formatFailure(t: Translate, result: Exclude<ZeroGpuQuotaResult, { kind: "ok" }>): string {
  switch (result.kind) {
    case "http-error":
      return result.status === 401 || result.status === 403
        ? t("zeroGpuAuthError", { status: result.status })
        : t("connectionTestHttpError", { status: result.status, ms: result.latencyMs });
    case "unreachable":
      return t("connectionTestUnreachable");
    case "timeout":
      return t("connectionTestTimeout", { ms: result.latencyMs });
    case "invalid-response":
      return t("zeroGpuInvalidResponse");
  }
}

function formatGpuSeconds(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
}

function remainingPercent(current: number, base: number): number {
  if (base <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / base) * 100)));
}

function formatResetTime(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

export default React.memo(HuggingFaceZeroGpuQuotaTest);
