import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import {
  testEndpointConnectivity,
  type ConnectionTestResult,
} from "../../features/connectivity/api";
import type { AsyncOperation } from "../../store/asyncOperation";

interface EndpointConnectionTestProps {
  /** Endpoint root under test (e.g. the parsed `--BaseURL`). */
  endpointUrl: string;
  /** Sent as a Bearer header so preflight behavior matches real calls. */
  apiKey?: string | null;
  /**
   * Probe path appended to the endpoint root. Defaults to `/models`
   * (LLM endpoints); image backends pass their own lightweight path.
   */
  probePath?: string;
}

type ConnectionTestOperation = AsyncOperation<{ endpointUrl: string }, ConnectionTestResult>;

const resultTextClass: Record<ConnectionTestResult["kind"], string> = {
  ok: "text-green-600 dark:text-green-400",
  "http-error": "text-amber-600 dark:text-amber-400",
  "cors-likely": "text-red-500",
  unreachable: "text-red-500",
  timeout: "text-red-500",
  "mixed-content": "text-red-500",
  "invalid-url": "text-red-500",
};

/**
 * Generic endpoint-reachability test (LLM `--BaseURL`, A1111, ComfyUI,
 * NIM, ...). Local `AsyncOperation` state only — no store slice, no
 * Zustand `set`. CORS failures are reported as a likelihood, never as
 * a definitive verdict (browsers hide the reason from script).
 */
const EndpointConnectionTest: React.FC<EndpointConnectionTestProps> = ({
  endpointUrl,
  apiKey,
  probePath,
}) => {
  const { t } = useTranslation();
  const [operation, setOperation] = useState<ConnectionTestOperation>({ phase: "idle" });
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
    const payload = { endpointUrl };
    setOperation({ phase: "running", payload, startedAt: new Date().toISOString() });
    try {
      const result = await testEndpointConnectivity({
        endpointUrl,
        probePath,
        apiKey,
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
        error: error instanceof Error ? error : new Error("Connection test failed"),
      });
    }
  };

  const isRunning = operation.phase === "running";
  const completed = operation.phase === "done" ? operation.result : null;
  const failed = operation.phase === "failed" ? operation.error : null;

  return (
    <div className="mt-3 space-y-2">
      <Button
        type="button"
        intent="secondary"
        size="medium"
        onClick={() => void handleTest()}
        disabled={isRunning || endpointUrl.trim().length === 0}
        isWorking={isRunning}
        className="w-full"
      >
        {t("connectionTestButton")}
      </Button>
      <p className="support-text-color text-xs">
        {t("connectionTestTargetLabel")}: <span className="font-mono">{endpointUrl}</span>
      </p>
      {completed && (
        <p role="status" className={`text-xs font-semibold ${resultTextClass[completed.kind]}`}>
          {formatResult(t, completed)}
          {completed.kind === "http-error" && completed.detail && (
            <span className="font-mono"> — {completed.detail}</span>
          )}
          {completed.kind === "unreachable" && completed.detail && (
            <span className="font-mono"> ({completed.detail})</span>
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

function formatResult(t: Translate, result: ConnectionTestResult): string {
  switch (result.kind) {
    case "ok":
      return t("connectionTestOk", { ms: result.latencyMs });
    case "http-error":
      return t("connectionTestHttpError", { status: result.status, ms: result.latencyMs });
    case "cors-likely":
      return t("connectionTestCorsLikely");
    case "unreachable":
      return t("connectionTestUnreachable");
    case "timeout":
      return t("connectionTestTimeout", { ms: result.latencyMs });
    case "mixed-content":
      return t("connectionTestMixedContent");
    case "invalid-url":
      return t("connectionTestInvalidUrl");
  }
}

export default EndpointConnectionTest;
