"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldOff,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
  X,
  Lock,
} from "lucide-react";
import { ExecutionStatus, SecurityDecision, SeverityLevel } from "@/types";
import { redactSensitiveValue } from "@/lib/security/client-metadata";

export function VerdictBadge({
  decision,
  size = "sm",
  onClick,
  interactive = false,
}: {
  decision: SecurityDecision | "ERROR";
  size?: "xs" | "sm" | "md" | "lg";
  onClick?: () => void;
  interactive?: boolean;
}) {
  const sizeClasses =
    size === "xs"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : size === "sm"
      ? "px-2.5 py-0.5 text-[11px] gap-1.5"
      : size === "md"
      ? "px-3 py-1 text-xs gap-1.5"
      : "px-3.5 py-1.5 text-sm gap-2";

  const iconSize =
    size === "xs"
      ? "w-2.5 h-2.5"
      : size === "sm"
      ? "w-3 h-3"
      : size === "md"
      ? "w-3.5 h-3.5"
      : "w-4 h-4";

  const baseStyles =
    decision === "ALLOW"
      ? "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0] hover:bg-[#d1fae5]"
      : decision === "BLOCK"
      ? "bg-[#fef2f2] text-[#991b1b] border-[#fecaca] hover:bg-[#fee2e2]"
      : decision === "REQUIRE_APPROVAL"
      ? "bg-[#fffbeb] text-[#92400e] border-[#fde68a] hover:bg-[#fef3c7]"
      : "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]";

  const label =
    decision === "ALLOW"
      ? "ALLOWED"
      : decision === "BLOCK"
      ? "BLOCKED"
      : decision === "REQUIRE_APPROVAL"
      ? "NEEDS APPROVAL"
      : decision;

  const Component = onClick ? "button" : "span";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center font-mono font-semibold tracking-wide rounded-full border transition-colors ${sizeClasses} ${baseStyles} ${
        onClick || interactive ? "cursor-pointer hover:shadow-sm" : ""
      }`}
      title={onClick ? `Click to inspect ${decision} decision details` : undefined}
    >
      {decision === "ALLOW" && <CheckCircle2 className={`${iconSize} text-[#059669] shrink-0`} />}
      {decision === "BLOCK" && <XCircle className={`${iconSize} text-[#dc2626] shrink-0`} />}
      {decision === "REQUIRE_APPROVAL" && <Clock className={`${iconSize} text-[#d97706] shrink-0`} />}
      {decision === "ERROR" && <AlertTriangle className={`${iconSize} text-[#dc2626] shrink-0`} />}
      <span>{label}</span>
    </Component>
  );
}

export function ExecutionStatusBadge({
  status,
  size = "sm",
  prominentNotExecuted = false,
}: {
  status: ExecutionStatus | "ERROR";
  size?: "xs" | "sm" | "md";
  prominentNotExecuted?: boolean;
}) {
  const sizeClasses =
    size === "xs"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : size === "sm"
      ? "px-2.5 py-0.5 text-[11px] gap-1.5"
      : "px-3 py-1 text-xs gap-1.5";

  const iconSize = size === "xs" ? "w-2.5 h-2.5" : size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  if (status === "NOT_EXECUTED") {
    return (
      <span
        className={`inline-flex items-center font-mono font-semibold tracking-wide rounded-full border ${sizeClasses} ${
          prominentNotExecuted
            ? "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]"
            : "bg-[#f9fafb] text-[#4b5563] border-[#e5e7eb]"
        }`}
      >
        <ShieldOff
          className={`${iconSize} text-[#dc2626] shrink-0`}
        />
        <span>NOT EXECUTED</span>
      </span>
    );
  }

  if (status === "EXECUTED_SUCCESS") {
    return (
      <span
        className={`inline-flex items-center font-mono font-semibold tracking-wide rounded-full border bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0] ${sizeClasses}`}
      >
        <CheckCircle2 className={`${iconSize} text-[#059669] shrink-0`} />
        <span>EXECUTED</span>
      </span>
    );
  }

  if (status === "PENDING_APPROVAL") {
    return (
      <span
        className={`inline-flex items-center font-mono font-semibold tracking-wide rounded-full border bg-[#fffbeb] text-[#92400e] border-[#fde68a] ${sizeClasses}`}
      >
        <Clock className={`${iconSize} text-[#d97706] shrink-0`} />
        <span>PENDING APPROVAL</span>
      </span>
    );
  }

  if (status === "REJECTED_BY_HUMAN") {
    return (
      <span
        className={`inline-flex items-center font-mono font-semibold tracking-wide rounded-full border bg-[#fef2f2] text-[#991b1b] border-[#fecaca] ${sizeClasses}`}
      >
        <XCircle className={`${iconSize} text-[#dc2626] shrink-0`} />
        <span>REJECTED</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-mono font-semibold tracking-wide rounded-full border bg-[#fef2f2] text-[#991b1b] border-[#fecaca] ${sizeClasses}`}
    >
      <AlertTriangle className={`${iconSize} text-[#dc2626] shrink-0`} />
      <span>{status}</span>
    </span>
  );
}

export function SeverityPill({ severity }: { severity: SeverityLevel }) {
  const styles =
    severity === "CRITICAL"
      ? "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]"
      : severity === "HIGH"
      ? "bg-[#fff1f2] text-[#be123c] border-[#fecdd3]"
      : severity === "MEDIUM"
      ? "bg-[#fffbeb] text-[#92400e] border-[#fde68a]"
      : "bg-[#f3f4f6] text-[#374151] border-[#e5e7eb]";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase border ${styles}`}
    >
      {severity}
    </span>
  );
}

export function CopyButton({
  value,
  label,
  className = "",
  size = "xs",
}: {
  value: string;
  label?: string;
  className?: string;
  size?: "xs" | "sm";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 font-mono rounded-md border border-[#e5e8e2] bg-white hover:bg-[#f7f8f5] text-[#4d5a52] transition-colors ${
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      } ${className}`}
      title={`Copy ${label || "value"}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-[#059669] shrink-0" />
          <span className="text-[#065f46]">COPIED</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 text-[#79877e] shrink-0" />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
}

export function Kbd({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[#5c6760] bg-[#f1f3ee] border border-[#dce1d8] rounded ${className}`}
    >
      {children}
    </kbd>
  );
}

export function TechnicalTooltip({
  label,
  content,
  children,
}: {
  label?: string;
  content: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-white border border-[#e5e8e2] shadow-elevated text-[11px] font-sans text-[#111613] z-50 pointer-events-none"
        >
          {label && (
            <span className="block font-mono text-[10px] font-bold text-[#0e291c] uppercase mb-1">
              {label}
            </span>
          )}
          <span className="block leading-relaxed text-[#4d5a52]">{content}</span>
        </span>
      )}
    </span>
  );
}

export function RedactedJsonViewer({
  data,
  title = "ARGUMENTS PAYLOAD",
  defaultRedacted = true,
  defaultExpanded = true,
  compact = false,
}: {
  data: unknown;
  title?: string;
  defaultRedacted?: boolean;
  defaultExpanded?: boolean;
  compact?: boolean;
}) {
  const [redacted, setRedacted] = useState(defaultRedacted);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const displayedData = redacted ? redactSensitiveValue(data) : data;
  const formattedJson = JSON.stringify(displayedData, null, 2) || "{}";
  const rawJson = JSON.stringify(data, null, 2) || "{}";
  const hasRedactions = rawJson !== JSON.stringify(redactSensitiveValue(data), null, 2);

  return (
    <div className="rounded-lg border border-[#e5e8e2] bg-white overflow-hidden shadow-soft">
      <div className="px-3 py-2 bg-[#f7f8f5] border-b border-[#e5e8e2] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#374151] hover:text-[#111613]"
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#0e291c]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#0e291c]" />
          )}
          <span className="font-semibold">{title}</span>
          {hasRedactions && (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
              DLP SENSITIVE
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {hasRedactions && (
            <button
              type="button"
              onClick={() => setRedacted(!redacted)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[#e5e8e2] bg-white hover:bg-[#f7f8f5] text-[#374151]"
              title={
                redacted
                  ? "Sensitive values masked. Click to inspect raw forensic payload."
                  : "Showing raw payload. Click to mask sensitive values."
              }
            >
              {redacted ? (
                <>
                  <EyeOff className="w-3 h-3 text-[#0e291c]" />
                  <span>REDACTED</span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 text-[#d97706]" />
                  <span className="text-[#92400e]">RAW</span>
                </>
              )}
            </button>
          )}
          <CopyButton
            value={JSON.stringify(redactSensitiveValue(data), null, 2)}
            label="SAFE JSON"
          />
        </div>
      </div>

      {expanded && (
        <pre
          className={`p-3 font-mono text-[11px] leading-relaxed text-[#1f2937] bg-white overflow-x-auto ${
            compact ? "max-h-36" : "max-h-64"
          }`}
        >
          {formattedJson}
        </pre>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm Action",
  cancelLabel = "Cancel",
  variant = "warning",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "warning" | "danger" | "info";
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-[#e5e8e2] shadow-modal overflow-hidden">
        <div className="px-5 py-4 bg-[#fafbfa] border-b border-[#e5e8e2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-4 h-4 ${
                variant === "danger"
                  ? "text-[#dc2626]"
                  : variant === "warning"
                  ? "text-[#d97706]"
                  : "text-[#0e291c]"
              }`}
            />
            <h3
              id="confirm-dialog-title"
              className="text-xs font-mono font-bold uppercase tracking-wider text-[#111613]"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#79877e] hover:text-[#111613] p-1"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-[#4d5a52] leading-relaxed">{description}</p>
          <div className="p-3 rounded-lg bg-[#f7f8f5] border border-[#e5e8e2] text-[11px] font-mono text-[#5c6760] flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-[#0e291c] shrink-0" />
            <span>Action will be validated server-side and logged to AuditStore.</span>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-[#fafbfa] border-t border-[#e5e8e2] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#e5e8e2] bg-white hover:bg-[#f7f8f5] text-xs font-mono text-[#4d5a52]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
              variant === "danger"
                ? "bg-[#dc2626] hover:bg-[#b91c1c] text-white"
                : variant === "warning"
                ? "bg-[#d97706] hover:bg-[#b45309] text-white"
                : "bg-[#0e291c] hover:bg-[#143d2b] text-white"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="p-8 rounded-xl bg-white border border-dashed border-[#e5e8e2] text-center flex flex-col items-center justify-center">
      <div className="w-10 h-10 rounded-full bg-[#f1f3ee] border border-[#e5e8e2] flex items-center justify-center text-[#4d5a52] mb-3">
        {icon || <Info className="w-5 h-5 text-[#0e291c]" />}
      </div>
      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#111613]">
        {title}
      </h3>
      <p className="text-xs text-[#79877e] mt-1 max-w-md leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-lg bg-[#0e291c] hover:bg-[#143d2b] text-white font-mono text-xs font-bold transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
