"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  UploadCloud,
  FileCode,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Clock,
  Shield,
  FileCheck,
} from "lucide-react";
import { ScanJob } from "@/types/scanner";
import {
  SUPPORTED_FORMATS,
  validateArtifactFile,
  MAX_FILE_SIZE_BYTES,
  getFormatCapability,
} from "@/lib/scanner/supported-formats";
import { SYNTHETIC_DEMO_SAMPLES, SyntheticSample } from "@/lib/scanner/synthetic-samples";
import { scanApiClient } from "@/lib/api/scan-client";

interface ScanWorkspaceProps {
  onScanCompleted: (job: ScanJob, batchCount?: number) => void;
  onViewSample: (sample: SyntheticSample) => void;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
  openDemoPicker?: boolean;
  onDemoPickerClosed?: () => void;
}

export function ScanWorkspace({
  onScanCompleted,
  onViewSample,
  isScanning,
  setIsScanning,
  openDemoPicker = false,
  onDemoPickerClosed,
}: ScanWorkspaceProps) {
  const [selectedFiles, setSelectedFiles] = useState<
    Array<{
      file: File;
      content: string;
      validation: ReturnType<typeof validateArtifactFile>;
    }>
  >([]);
  const [dragActive, setDragActive] = useState(false);
  const [scanStage, setScanStage] = useState<string>("");
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFormatsModal, setShowFormatsModal] = useState(false);
  const [showDemoPicker, setShowDemoPicker] = useState(false);
  const [geminiReviewEnabled, setGeminiReviewEnabled] = useState(true);
  const [geminiStatus, setGeminiStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openDemoPicker) setShowDemoPicker(true);
  }, [openDemoPicker]);

  const closeDemoPicker = () => {
    setShowDemoPicker(false);
    onDemoPickerClosed?.();
  };

  useEffect(() => {
    let active = true;
    fetch("/api/scans/status")
      .then((response) => response.json())
      .then((data) => { if (active) setGeminiStatus({ configured: Boolean(data.geminiConfigured), model: String(data.model || "Gemini") }); })
      .catch(() => { if (active) setGeminiStatus({ configured: false, model: "Gemini" }); });
    return () => { active = false; };
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setErrorMessage(null);
    const newItems: Array<{
      file: File;
      content: string;
      validation: ReturnType<typeof validateArtifactFile>;
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateArtifactFile({ name: file.name, size: file.size });

      // Keep the original File object until submit. This avoids base64 expansion,
      // unnecessary browser memory copies, and JSON body limits for larger PDFs.
      newItems.push({ file, content: "", validation });
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartScan = async () => {
    if (selectedFiles.length === 0) return;
    const invalidItem = selectedFiles.find((item) => !item.validation.valid);
    if (invalidItem) {
      setErrorMessage(`${invalidItem.file.name}: ${invalidItem.validation.error || "Cannot scan invalid file."}`);
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    let latestJob: ScanJob | null = null;
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const target = selectedFiles[index];
        const batchProgress = Math.round((index / selectedFiles.length) * 100);
        setScanStage(`Scanning ${index + 1} of ${selectedFiles.length}: ${target.file.name}`);
        setScanProgress(batchProgress);
        const res = await scanApiClient.createScan({
          fileName: target.file.name,
          file: target.file,
          geminiReviewEnabled,
        });
        if (!res.success || !res.data) {
          throw new Error(res.error?.message || `Failed to scan ${target.file.name}.`);
        }
        latestJob = res.data;
      }
      setScanStage(`Risk assessment complete for ${selectedFiles.length} artifact${selectedFiles.length === 1 ? "" : "s"}.`);
      setScanProgress(100);
      await new Promise((r) => setTimeout(r, 150));
      if (latestJob) onScanCompleted(latestJob, selectedFiles.length);
      setSelectedFiles([]);
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during scanning.");
    } finally {
      setIsScanning(false);
      setScanStage("");
      setScanProgress(0);
    }
  };

  const handleLoadSyntheticSample = async (sampleId: string) => {
    const sample = SYNTHETIC_DEMO_SAMPLES.find((s) => s.id === sampleId);
    if (!sample) return;

    setIsScanning(true);
    setErrorMessage(null);
    setScanStage(`Loading synthetic sample: ${sample.name}...`);
    setScanProgress(50);

    try {
      const res = await scanApiClient.createScan({
        fileName: sample.name,
        fileContent: sample.rawContent,
        demoSampleId: sample.id,
        geminiReviewEnabled,
      });

      if (res.success && res.data) {
        onScanCompleted(res.data);
      } else {
        throw new Error(res.error?.message || "Failed to load demonstration sample.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load sample.");
    } finally {
      setIsScanning(false);
      setScanStage("");
      setScanProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e5e8e2]">
        <div>
          <h2 className="text-xl font-display font-bold text-[#111613] tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-[#10b981]" />
            <span>Artifact Scan Workspace</span>
          </h2>
          <p className="text-xs text-[#5c6760] mt-0.5">
            Upload source, scripts, configs, prompts, skills, MCP files, or PDFs for local checks and optional Gemini threat review.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowFormatsModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono text-[#5c6760] hover:text-[#111613] hover:border-[#10b981] transition-colors shadow-soft"
        >
          <Info className="w-3.5 h-3.5 text-[#10b981]" />
          <span>Supported Formats & Limits</span>
        </button>
      </div>

      <div className={`rounded-xl border p-4 ${geminiStatus?.configured && geminiReviewEnabled ? "border-violet-200 bg-violet-50" : "border-amber-200 bg-amber-50"}`}>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={geminiReviewEnabled} onChange={(event) => setGeminiReviewEnabled(event.target.checked)} className="mt-1 h-4 w-4 accent-violet-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[#161925]">Add Gemini AI threat review {geminiStatus?.configured ? `· ${geminiStatus.model}` : "· setup needed"}</span>
            <span className="mt-1 block text-xs leading-relaxed text-[#5e6270]">
              {!geminiStatus
                ? "Checking server-side Gemini setup…"
                : !geminiStatus.configured
                  ? "No Gemini API key is configured. Local checks still work. Add GEMINI_API_KEY to .env.local on the server and restart NIYANTRA to enable AI review."
                  : "When enabled, this sends the artifact (including original PDF bytes) to Google Gemini. On the free tier, Google may use submitted content to improve its products. Do not send confidential files unless your organization has approved that use. Uncheck for local-only scanning."}
            </span>
          </span>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${geminiStatus?.configured ? "bg-violet-100 text-violet-800" : "bg-amber-100 text-amber-900"}`}>{geminiStatus?.configured ? "AI review" : "Local checks"}</span>
        </label>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start justify-between gap-3 shadow-soft">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Validation / Scan Error</div>
              <div className="text-red-700 mt-0.5">{errorMessage}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-800 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? "border-[#10b981] bg-[#ecfdf5]/50 scale-[0.99]"
            : "border-[#d8ded5] hover:border-[#10b981]/70 bg-white shadow-soft"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORTED_FORMATS.map((format) => format.extension).join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
            }
          }}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0e291c] text-[#10b981] flex items-center justify-center mx-auto shadow-soft">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <div className="text-sm font-display font-semibold text-[#111613]">
              Drag & drop artifact files here, or <span className="text-[#10b981] underline">browse</span>
            </div>
            <div className="text-xs text-[#79877e] mt-1">
              {SUPPORTED_FORMATS.map((format) => format.extension).join(", ")} · up to 10 MB (format-specific limits apply)
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] font-mono text-[#5c6760]">
            <span className="inline-flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#10b981]" />
              <span>Static In-Memory Analysis</span>
            </span>
            <span>•</span>
            <span>Zero auto-execution</span>
            <span>•</span>
              <span>SHA-256 fingerprint</span>
          </div>
        </div>
      </div>

      <button type="button" onClick={() => setShowDemoPicker(true)} className="w-full rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-cyan-50 p-4 text-left transition hover:border-violet-300 hover:shadow-md">
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span><span className="block text-sm font-semibold text-[#202233]">Want to try it first? Scan a demo artifact</span><span className="mt-1 block text-xs text-[#707486]">Choose from five safe, synthetic examples and see their findings instantly.</span></span>
          <span className="rounded-xl bg-violet-700 px-4 py-2 text-xs font-semibold text-white">Choose demo files</span>
        </span>
      </button>

      {/* Queued Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-[#5c6760]">
            <span>QUEUED ARTIFACTS ({selectedFiles.length})</span>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              className="text-red-600 hover:underline"
            >
              Clear All
            </button>
          </div>

          <div className="divide-y divide-[#e5e8e2] rounded-xl border border-[#e5e8e2] bg-white overflow-hidden shadow-soft">
            {selectedFiles.map((item, idx) => {
              const isValid = item.validation.valid;
              const sizeKb = (item.file.size / 1024).toFixed(1);

              return (
                <div
                  key={`${item.file.name}-${idx}`}
                  className="p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isValid ? "bg-[#ecfdf5] text-[#059669]" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {isValid ? <FileCode className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="font-mono font-medium text-[#111613] truncate">
                        {item.file.name}
                      </div>
                      <div className="text-[11px] text-[#79877e] flex items-center gap-2">
                        <span>{sizeKb} KB</span>
                        <span>•</span>
                        <span>{item.validation.capability?.description || "Unrecognized Type"}</span>
                        {!isValid && (
                          <span className="text-red-600 font-semibold truncate">
                            — {item.validation.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                        isValid
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                    >
                      {isValid ? "VALID READY" : "INVALID"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      disabled={isScanning}
                      className="p-1 rounded-md text-[#79877e] hover:text-red-600 hover:bg-red-50"
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleStartScan}
              disabled={isScanning || selectedFiles.length === 0 || selectedFiles.some((item) => !item.validation.valid)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0e291c] hover:bg-[#153d2c] text-white text-xs font-mono font-semibold shadow-soft disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isScanning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Scanning {selectedFiles.length} artifact{selectedFiles.length === 1 ? "" : "s"}...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Scan {selectedFiles.length} Artifact{selectedFiles.length === 1 ? "" : "s"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Progress Card during active scan */}
      {isScanning && (
        <div className="p-4 rounded-xl bg-white border border-[#10b981]/40 shadow-soft space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#0e291c] font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
              <span>{scanStage}</span>
            </span>
            <span className="text-[#5c6760]">{scanProgress}%</span>
          </div>

          <div className="w-full h-1.5 bg-[#e5e8e2] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#10b981] transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Demo artifact chooser */}
      {showDemoPicker && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDemoPicker(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="demo-picker-title" className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/70 bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-700"><Sparkles className="h-3.5 w-3.5" /> Safe demo dataset</div><h3 id="demo-picker-title" className="text-2xl font-bold tracking-tight text-slate-950">Choose a file to scan</h3><p className="mt-1 text-sm text-slate-600">These synthetic files contain no real credentials. Select one to run it through the scanner and open its findings.</p></div>
          <button type="button" onClick={closeDemoPicker} aria-label="Close demo file chooser" className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SYNTHETIC_DEMO_SAMPLES.map((sample) => {
            const riskColor =
              sample.expectedRiskBand === "CRITICAL"
                ? "bg-red-50 text-red-800 border-red-200"
                : sample.expectedRiskBand === "HIGH"
                ? "bg-orange-50 text-orange-800 border-orange-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200";

            return (
              <article
                key={sample.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-xs shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-[#111613] truncate">
                      {sample.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${riskColor}`}
                    >
                      {sample.expectedRiskBand}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5c6760] mt-1 min-h-8 line-clamp-2">
                    {sample.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                  <div><span className="block text-[10px] font-mono text-[#79877e]">{sample.type.toUpperCase()}</span><span className="text-[10px] text-slate-500">Synthetic example</span></div>
                  <button
                    type="button"
                    onClick={() => { closeDemoPicker(); handleLoadSyntheticSample(sample.id); }}
                    disabled={isScanning}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" /><span>Scan file</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div><p className="text-sm font-semibold text-slate-800">Prefer downloadable fixtures?</p><p className="text-xs text-slate-500">These files are also available to inspect or save locally.</p></div><div className="flex flex-wrap gap-2">{["clean-sample.txt", "credential-demo.env", "unsafe-deploy.sh", "prompt-override.prompt", "agent-config.mcp.json"].map((name) => <a key={name} href={`/test-artifacts/${name}`} download className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-700 hover:border-violet-300 hover:text-violet-700">{name}</a>)}</div></div>
        </section>
      </div>
      )}

      {/* Supported Formats Modal */}
      {showFormatsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-[#e5e8e2] shadow-elevated overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[#e5e8e2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#10b981]" />
                <span className="font-display font-bold text-sm text-[#111613]">
                  Supported Formats & Detector Capabilities
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFormatsModal(false)}
                className="p-1 rounded-md text-[#79877e] hover:bg-[#ebede8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 text-xs">
              <div className="text-[11px] text-[#5c6760]">
                Maximum file size is 10 MB (some formats have smaller limits). Pattern-based scans run statically; uploaded content is sent to the NIYANTRA scan API and is never executed.
              </div>

              <div className="divide-y divide-[#e5e8e2] border border-[#e5e8e2] rounded-xl overflow-hidden">
                {SUPPORTED_FORMATS.map((fmt, i) => (
                  <div key={i} className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono font-bold text-[#111613]">
                        {fmt.extension} · {fmt.description}
                      </div>
                      <div className="text-[11px] text-[#79877e] mt-0.5">
                        Category: {fmt.category} | Pattern checks: {fmt.detectorsSupported.length ? fmt.detectorsSupported.join(", ") : "No reliable text extraction yet"}
                        {fmt.extension === ".lock" && <span className="block text-amber-700">Dependency advisory database is not connected; this file receives basic text-pattern checks only.</span>}
                        {fmt.extension === ".pdf" && <span className="block text-amber-700">Local text extraction may miss complex or scanned pages. When enabled, Gemini also reviews the original PDF bytes directly.</span>}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        fmt.status === "SUPPORTED"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {fmt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-[#f7f8f5] border-t border-[#e5e8e2] text-right">
              <button
                type="button"
                onClick={() => setShowFormatsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#0e291c] text-white text-xs font-mono font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
