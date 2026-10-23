"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Menu,
  X,
  ChevronDown,
  Bell,
  Wrench,
  Settings,
  MessageSquare,
  FileText,
  Clock,
  CheckSquare,
  Search,
  ArrowRight,
  ChevronLeft,
  RotateCcw,
  Globe,
  UploadCloud,
  History,
  ShieldAlert,
  BarChart3,
  Layers,
} from "lucide-react";
import {
  ApprovalRequest,
  AuditEvent,
  EvaluationSuiteResult,
  PolicyConfig,
  ScenarioType,
  SecurityDecision,
  SecurityPolicy,
  UserRole,
} from "@/types";
import { ScanJob, Finding } from "@/types/scanner";
import { SYNTHETIC_DEMO_SAMPLES } from "@/lib/scanner/synthetic-samples";
import { scanApiClient } from "@/lib/api/scan-client";
import { ScanWorkspace } from "@/components/scanner/ScanWorkspace";
import { ScanResultsView } from "@/components/scanner/ScanResultsView";
import { FindingsExplorer } from "@/components/scanner/FindingsExplorer";
import { ScanHistoryView } from "@/components/scanner/ScanHistoryView";
import { ArtifactSecurityDashboard } from "@/components/scanner/ArtifactSecurityDashboard";
import { ACTIVE_POLICIES } from "@/lib/data/mock-data";
import { DEMO_SCENARIOS } from "@/lib/security/client-metadata";
import { Kbd } from "@/components/ui/Primitives";
import { AppScreenId, CommandPalette } from "@/components/CommandPalette";
import {
  DecisionInspectorDrawer,
  InspectorTarget,
} from "@/components/DecisionInspectorDrawer";
import {
  SecurityOverview,
  SystemMetaInfo,
} from "@/components/views/SecurityOverview";
import {
  AgentPlayground,
  AgentRunApiResponse,
} from "@/components/views/AgentPlayground";
import { PolicyControlCenter } from "@/components/views/PolicyControlCenter";
import { AuditExplorer } from "@/components/views/AuditExplorer";
import { ApprovalQueue } from "@/components/views/ApprovalQueue";
import { SecurityEvaluationView } from "@/components/views/SecurityEvaluationView";
import { ToolsCatalog } from "@/components/views/ToolsCatalog";
import { SettingsView } from "@/components/views/SettingsView";

// Cinematic Axonix-inspired Website Sections
import { CinematicNavbar } from "@/components/cinematic/CinematicNavbar";
import { HeroSection } from "@/components/cinematic/HeroSection";
import { HowItWorksSection } from "@/components/cinematic/HowItWorksSection";
import { CapabilitiesSection } from "@/components/cinematic/CapabilitiesSection";
import { InteractiveDemoSection } from "@/components/cinematic/InteractiveDemoSection";
import { ProofSection } from "@/components/cinematic/ProofSection";
import { ClosingSection } from "@/components/cinematic/ClosingSection";
import { ArtifactAnalysisSection } from "@/components/cinematic/ArtifactAnalysisSection";

const DEMO_PERSONAS = [
  {
    id: "user-admin",
    role: "admin" as UserRole,
    name: "Sarah Chen",
    title: "Security Administrator",
    empId: "EMP-9021",
  },
  {
    id: "user-analyst",
    role: "analyst" as UserRole,
    name: "Marcus Vance",
    title: "Threat Analyst",
    empId: "EMP-0441",
  },
  {
    id: "user-agent",
    role: "support_agent" as UserRole,
    name: "Elena Rostova",
    title: "Support Specialist",
    empId: "EMP-5512",
  },
  {
    id: "user-guest",
    role: "guest" as UserRole,
    name: "Guest Visitor",
    title: "Public Unauthenticated",
    empId: "None",
  },
];

export default function AegisApp() {
  // Main view mode: "website" (cinematic public site) or "console" (SOC operational console)
  const [viewMode, setViewMode] = useState<"website" | "console">("website");
  const [activeTab, setActiveTab] = useState<AppScreenId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(null);

  // Server-synced state
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [allApprovals, setAllApprovals] = useState<ApprovalRequest[]>([]);
  const [stats, setStats] = useState({
    totalInspected: 18,
    allowed: 10,
    blocked: 6,
    pendingApprovals: 2,
  });

  const [policyConfig, setPolicyConfig] = useState<PolicyConfig | null>(null);
  const [activePoliciesList, setActivePoliciesList] =
    useState<SecurityPolicy[]>(ACTIVE_POLICIES);
  const [systemMeta, setSystemMeta] = useState<SystemMetaInfo | null>(null);
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);

  // Identity & Persona state (M7 Identity Hardening)
  const [demoUserId, setDemoUserId] = useState<string>("user-admin");
  const [selectedRole, setSelectedRole] = useState<UserRole>("admin");
  const [latestRunResult, setLatestRunResult] =
    useState<AgentRunApiResponse | null>(null);
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState<string>("");
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioType | null>(null);
  const [scenarioRunHistory, setScenarioRunHistory] = useState<
    Partial<Record<ScenarioType, AgentRunApiResponse>>
  >({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [activeAnimStage, setActiveAnimStage] = useState<number>(-1);

  // Evaluation benchmark state
  const [evaluationResults, setEvaluationResults] =
    useState<EvaluationSuiteResult | null>(null);
  const [isRunningEvaluation, setIsRunningEvaluation] = useState(false);

  // Notification status
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Milestone 10: Artifact Security Scanner State
  const [scansList, setScansList] = useState<ScanJob[]>(() =>
    SYNTHETIC_DEMO_SAMPLES.map((s) => s.job)
  );
  const [currentScanJob, setCurrentScanJob] = useState<ScanJob | null>(() =>
    SYNTHETIC_DEMO_SAMPLES[1].job
  );
  const [isScanningArtifact, setIsScanningArtifact] = useState(false);

  const fetchScansList = useCallback(async () => {
    try {
      const res = await scanApiClient.listScans();
      if (res.success && res.data && res.data.length > 0) {
        setScansList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch scans list", err);
    }
  }, []);

  useEffect(() => {
    fetchScansList();
  }, [fetchScansList]);

  // Global Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchAuditData = useCallback(
    async (overrideUser?: string) => {
      const activeUser = overrideUser || demoUserId;
      try {
        const res = await fetch("/api/audit", {
          headers: { "x-aegis-demo-user": activeUser },
        });
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
          setPendingApprovals(data.pendingApprovals || []);
          setAllApprovals(data.allApprovals || data.pendingApprovals || []);
          if (data.stats) {
            setStats((prev) => ({ ...prev, ...data.stats }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch audit data", err);
      }
    },
    [demoUserId]
  );

  const fetchPolicyData = useCallback(
    async (overrideUser?: string) => {
      const activeUser = overrideUser || demoUserId;
      try {
        const res = await fetch("/api/policies", {
          headers: { "x-aegis-demo-user": activeUser },
        });
        if (res.ok) {
          const data = await res.json();
          setPolicyConfig(data.config);
          if (data.activePolicies) setActivePoliciesList(data.activePolicies);
          if (data.systemMeta) setSystemMeta(data.systemMeta);
        }
      } catch (err) {
        console.error("Failed to fetch policy data", err);
      }
    },
    [demoUserId]
  );

  useEffect(() => {
    fetchAuditData();
    fetchPolicyData();
  }, [fetchAuditData, fetchPolicyData]);

  const triggerPipelineAnimation = useCallback(async () => {
    for (let s = 0; s <= 3; s++) {
      setActiveAnimStage(s);
      await new Promise((r) => setTimeout(r, 55));
    }
  }, []);

  const handleRoleSelect = useCallback(
    (role: UserRole) => {
      setSelectedRole(role);
      const match = DEMO_PERSONAS.find((p) => p.role === role);
      if (match) {
        setDemoUserId(match.id);
        fetchAuditData(match.id);
        fetchPolicyData(match.id);
      }
    },
    [DEMO_PERSONAS, fetchAuditData, fetchPolicyData]
  );

  const executeAgentRun = useCallback(
    async (params: {
      scenario?: ScenarioType;
      prompt?: string;
      roleOverride?: UserRole;
    }) => {
      setIsProcessing(true);
      setNotification(null);

      const roleToUse = params.roleOverride || selectedRole;
      const scenarioMeta = DEMO_SCENARIOS.find((s) => s.id === params.scenario);
      const promptText =
        params.prompt ||
        scenarioMeta?.prompt ||
        "What is the company return warranty policy?";

      setLastSubmittedPrompt(promptText);
      setActiveScenarioId(params.scenario || null);

      const animPromise = triggerPipelineAnimation();

      try {
        const res = await fetch("/api/agent/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-aegis-demo-user": demoUserId,
          },
          body: JSON.stringify({
            prompt: promptText,
            scenario: params.scenario,
            userRole: roleToUse,
            userId: demoUserId,
          }),
        });

        await animPromise;
        const data = await res.json();

        if (!res.ok) {
          setNotification({
            type: "error",
            message: data.message || data.error || "Agent execution pipeline error.",
          });
        } else {
          setLatestRunResult(data);
          if (params.scenario) {
            const scnId = params.scenario;
            setScenarioRunHistory((prev) => ({ ...prev, [scnId]: data }));
          }

          if (data.decision === "ALLOW") {
            setNotification({
              type: "success",
              message: `ALLOW [${data.agentProposal.toolName}] → ${data.executionStatus}`,
            });
          } else if (data.decision === "BLOCK") {
            setNotification({
              type: "error",
              message: `BLOCK [${data.agentProposal.toolName}] → NOT_EXECUTED: ${data.securityEvaluation.reason}`,
            });
          } else {
            setNotification({
              type: "info",
              message: `REQUIRE_APPROVAL [${data.agentProposal.toolName}] → Suspended with SHA-256 token`,
            });
          }
        }
      } catch (err: any) {
        setNotification({
          type: "error",
          message: `Gateway request error: ${err.message}`,
        });
      } finally {
        setActiveAnimStage(-1);
        setIsProcessing(false);
        await fetchAuditData();
      }
    },
    [selectedRole, triggerPipelineAnimation, fetchAuditData, demoUserId]
  );

  const handleRunAllScenarios = useCallback(async () => {
    setIsBatchRunning(true);
    try {
      for (const scn of DEMO_SCENARIOS) {
        await executeAgentRun({
          scenario: scn.id,
          prompt: scn.prompt,
          roleOverride: scn.recommendedRole,
        });
        await new Promise((r) => setTimeout(r, 180));
      }
      setNotification({
        type: "success",
        message: "Completed all 5 canonical security scenarios.",
      });
    } finally {
      setIsBatchRunning(false);
    }
  }, [executeAgentRun]);

  const handleUpdatePolicy = useCallback(
    async (updates: Partial<PolicyConfig>) => {
      setIsUpdatingPolicy(true);
      setNotification(null);
      try {
        const res = await fetch("/api/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...updates,
            modifiedBy: "Security Admin (SOC Console)",
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setNotification({
            type: "error",
            message: data.error || "Policy update rejected.",
          });
        } else {
          setPolicyConfig(data.config);
          setNotification({
            type: "success",
            message: `${data.message} Pending approvals re-evaluated.`,
          });
          await fetchAuditData();
        }
      } catch (err: any) {
        setNotification({
          type: "error",
          message: `Policy update error: ${err.message}`,
        });
      } finally {
        setIsUpdatingPolicy(false);
      }
    },
    [fetchAuditData]
  );

  const handleResetPolicies = useCallback(async () => {
    setIsUpdatingPolicy(true);
    setNotification(null);
    try {
      const res = await fetch("/api/policies/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modifiedBy: "Security Admin (Safe Baseline Reset)",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPolicyConfig(data.config);
        setNotification({ type: "success", message: data.message });
        await fetchAuditData();
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to reset policy configuration.",
        });
      }
    } catch (err: any) {
      setNotification({ type: "error", message: `Reset error: ${err.message}` });
    } finally {
      setIsUpdatingPolicy(false);
    }
  }, [fetchAuditData]);

  const handleApprovalResolution = useCallback(
    async (
      requestId: string,
      decision: "APPROVED" | "REJECTED",
      revalidationToken: string,
      reviewer = "Security Supervisor (SOC-01)",
      note?: string
    ) => {
      try {
        const res = await fetch("/api/approval/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            decision,
            reviewer,
            note:
              note ||
              (decision === "APPROVED"
                ? "Verified transaction legitimacy."
                : "Rejected during human review."),
            revalidationToken,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setLatestRunResult((prev) =>
            prev && prev.approvalRequestId === requestId
              ? {
                  ...prev,
                  executionStatus: data.executionStatus,
                  executionResult: data.executionResult,
                }
              : prev
          );

          setNotification({
            type: decision === "APPROVED" ? "success" : "info",
            message: `Approval resolution: ${data.executionStatus}`,
          });
        } else {
          setNotification({
            type: "error",
            message: data.message || "Approval resolution failed.",
          });
        }
      } catch (err: any) {
        setNotification({
          type: "error",
          message: `Approval resolution error: ${err.message}`,
        });
      } finally {
        await fetchAuditData();
      }
    },
    [fetchAuditData]
  );

  const runEvaluationBenchmark = useCallback(async () => {
    setIsRunningEvaluation(true);
    setNotification(null);
    try {
      const res = await fetch("/api/evaluation/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setEvaluationResults(data);
        setNotification({
          type: "success",
          message: `Evaluation Complete: ${data.passed}/${data.totalTests} security tests passed (100% accuracy, 0 leaked executions).`,
        });
        await fetchAuditData();
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to run evaluation suite.",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: `Evaluation error: ${err.message}`,
      });
    } finally {
      setIsRunningEvaluation(false);
    }
  }, [fetchAuditData]);

  const latestPipelineTelemetry = useMemo(() => {
    if (!latestRunResult) return null;
    return {
      prompt: lastSubmittedPrompt,
      userRole: latestRunResult.agentProposal.userRole || selectedRole,
      proposalSource: latestRunResult.providerMeta?.source,
      toolName: latestRunResult.agentProposal.toolName,
      argumentsObj: latestRunResult.agentProposal.arguments,
      decision: latestRunResult.decision,
      executionStatus: latestRunResult.executionStatus,
      reason: latestRunResult.securityEvaluation.reason,
      riskScore: latestRunResult.securityEvaluation.riskScore,
      violations: latestRunResult.securityEvaluation.violations,
      auditEventId: latestRunResult.auditEventId,
      policyVersion:
        latestRunResult.securityEvaluation.policyVersion ??
        policyConfig?.version ??
        1,
    };
  }, [latestRunResult, lastSubmittedPrompt, selectedRole, policyConfig]);

  const navItems: Array<{
    id: AppScreenId;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }> = [
    { id: "overview", label: "Overview", icon: <Activity className="w-4 h-4" /> },
    { id: "scan-workspace", label: "Scan Workspace", icon: <UploadCloud className="w-4 h-4" /> },
    { id: "scan-results", label: "Scan Findings", icon: <ShieldAlert className="w-4 h-4" />, badge: currentScanJob?.findings.length ? currentScanJob.findings.length : undefined },
    { id: "scan-history", label: "Scan History", icon: <History className="w-4 h-4" />, badge: scansList.length },
    { id: "scan-dashboard", label: "Artifact Intelligence", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "playground", label: "Agent Playground", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "policies", label: "Policies", icon: <Shield className="w-4 h-4" /> },
    { id: "evaluation", label: "Evaluations", icon: <CheckSquare className="w-4 h-4" /> },
    { id: "audit", label: "Audit Log", icon: <FileText className="w-4 h-4" /> },
    { id: "approvals", label: "Approvals", icon: <Clock className="w-4 h-4" />, badge: pendingApprovals.length },
    { id: "tools", label: "Tools", icon: <Wrench className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  // ==========================================
  // VIEW 1: CINEMATIC WEBSITE (Inspired by Axonix)
  // ==========================================
  if (viewMode === "website") {
    return (
      <div className="aegis-marketing min-h-screen bg-[#fdfcfb] text-neutral-900 flex flex-col font-sans antialiased selection:bg-violet-100 selection:text-violet-900">
        {/* Navigation */}
        <CinematicNavbar
          onLaunchConsole={() => { setActiveTab("scan-workspace"); setViewMode("console"); }}
          onNavigateToDemo={() => {
            const el = document.getElementById("interactive-demo");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* Global Notification Banner */}
        {notification && (
          <div
            role="status"
            className={`fixed top-20 right-6 z-50 max-w-md p-3.5 rounded-xl text-xs font-mono flex items-center justify-between gap-3 shadow-elevated border backdrop-blur-md ${
              notification.type === "success"
                ? "bg-[#0b1c13]/90 border-emerald-500/40 text-emerald-200"
                : notification.type === "error"
                ? "bg-[#1f0d11]/90 border-rose-500/40 text-rose-200"
                : "bg-[#1c160a]/90 border-amber-500/40 text-amber-200"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {notification.type === "success" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {notification.type === "error" && (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              {notification.type === "info" && (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="truncate">{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-[10px] uppercase font-bold text-slate-400 hover:text-white shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Section 1: Hero */}
        <HeroSection
          onExplore={() => { setActiveTab("scan-workspace"); setViewMode("console"); }}
          onSeeHowItWorks={() => {
            const el = document.getElementById("how-it-works");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* Artifact analysis follows the hero. */}
        <ArtifactAnalysisSection onUpload={() => { setActiveTab("scan-workspace"); setViewMode("console"); }} />

        {/* Section 2: Meet the AEGIS team */}
        <HowItWorksSection />

        {/* Section 4: Security Capabilities */}
        <CapabilitiesSection
          onTryInteractiveDemo={() => {
            const el = document.getElementById("interactive-demo");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* Section 5: Interactive Security Demonstration */}
        <InteractiveDemoSection
          onRunScenario={executeAgentRun}
          isProcessing={isProcessing}
          latestResult={latestRunResult}
          selectedRole={selectedRole}
          onSelectRole={handleRoleSelect}
          onOpenConsole={() => setViewMode("console")}
        />

        {/* Section 6: Proof and Evaluation */}
        <ProofSection
          evaluationResults={evaluationResults}
          isRunningEvaluation={isRunningEvaluation}
          onRunEvaluation={runEvaluationBenchmark}
          onOpenConsole={() => {
            setViewMode("console");
            setActiveTab("evaluation");
          }}
        />

        {/* Section 7: Closing Statement & Footer */}
        <ClosingSection
          onLaunchConsole={() => { setActiveTab("scan-workspace"); setViewMode("console"); }}
          onNavigateToDemo={() => {
            const el = document.getElementById("interactive-demo");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* Command Palette available via ⌘ K */}
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigate={(screen) => {
            setViewMode("console");
            setActiveTab(screen);
          }}
          onRunScenario={(scnId) => {
            executeAgentRun({ scenario: scnId });
            const el = document.getElementById("interactive-demo");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
          onRunAllScenarios={handleRunAllScenarios}
          onSelectRole={handleRoleSelect}
          onInspectRule={(policyId) =>
            setInspectorTarget({ type: "policy", policyId })
          }
          onInspectEvent={(evt) => setInspectorTarget({ type: "event", event: evt })}
          onFilterAuditVerdict={() => {
            setViewMode("console");
            setActiveTab("audit");
          }}
          onResetPolicies={handleResetPolicies}
          events={events}
          pendingApprovalCount={pendingApprovals.length}
        />

        {/* Global Decision Inspector Drawer */}
        <DecisionInspectorDrawer
          target={inspectorTarget}
          onClose={() => setInspectorTarget(null)}
          onSelectPolicy={(policyId) =>
            setInspectorTarget({ type: "policy", policyId })
          }
          onSelectEvent={(evt) => setInspectorTarget({ type: "event", event: evt })}
          onNavigateToPolicies={() => {
            setViewMode("console");
            setActiveTab("policies");
          }}
          policyConfig={policyConfig}
          events={events}
          allApprovals={allApprovals}
        />
      </div>
    );
  }

  // ==========================================
  // VIEW 2: OPERATIONS CONSOLE (SOC Dashboard)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#f7f8f5] text-[#111613] flex font-sans antialiased">
      {/* Left Navigation Rail */}
      {activeTab !== "scan-results" && <aside className="hidden lg:flex w-60 shrink-0 bg-[#f7f8f5] border-r border-[#e5e8e2] flex-col justify-between p-4 sticky top-0 h-screen select-none">
        <div className="space-y-6">
          {/* Brand Mark with Back to Website shortcut */}
          <div className="flex items-center justify-between pb-2 border-b border-[#e5e8e2]">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className="flex items-center gap-3 text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0e291c] flex items-center justify-center text-white shadow-soft group-hover:bg-[#153d2c] transition-colors">
                <Shield className="w-4 h-4 text-[#10b981]" />
              </div>
              <div>
                <div className="font-display font-bold text-sm tracking-tight text-[#111613]">
                  AEGIS
                </div>
                <div className="text-[9px] font-mono tracking-widest uppercase text-[#79877e]">
                  SECURITY CONSOLE
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("website")}
              className="p-1 rounded-md text-[#79877e] hover:text-[#111613] hover:bg-[#ebede8] transition-colors"
              title="Return to Public Website"
            >
              <Globe className="w-4 h-4 text-[#10b981]" />
            </button>
          </div>

          {/* Quick Return to Website Banner */}
          <button
            type="button"
            onClick={() => setViewMode("website")}
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#e5e8e2] hover:border-[#10b981]/50 text-left flex items-center justify-between text-xs font-mono text-[#0e291c] shadow-soft group transition-colors"
          >
            <span className="flex items-center gap-2">
              <ChevronLeft className="w-3.5 h-3.5 text-[#10b981] group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Website</span>
            </span>
            <span className="text-[10px] text-slate-400">ESC</span>
          </button>

          {/* Navigation Items */}
          <nav className="space-y-1" aria-label="Console Navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    if (
                      item.id === "evaluation" &&
                      !evaluationResults &&
                      !isRunningEvaluation
                    ) {
                      runEvaluationBenchmark();
                    }
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[#ebede8] text-[#111613] font-semibold"
                      : "text-[#5c6760] hover:bg-[#f0f2ed] hover:text-[#111613]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? "text-[#0e291c]" : "text-[#79877e]"}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {isActive && item.id === "overview" ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                  ) : item.badge !== undefined ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold bg-[#fde68a]/50 text-[#92400e] border border-[#fde68a]">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Card */}
        <div className="relative rounded-2xl bg-[#091a12] p-4 text-white overflow-hidden shadow-soft">
          <div className="relative z-10 space-y-3">
            <div className="text-xs font-display font-medium leading-relaxed text-[#e5f5ec]">
              Your agents can think.
              <br />
              <strong className="text-white font-bold">AEGIS decides</strong> what they can do.
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-[#a5cbb7]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                <span>v1.0.0</span>
              </div>
              <span>CY-03</span>
            </div>
          </div>
        </div>
      </aside>}

      {/* Main Console Surface */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Bar */}
        {activeTab !== "scan-results" && <header className="sticky top-0 z-30 h-14 bg-[#f7f8f5]/90 backdrop-blur-md border-b border-[#e5e8e2] px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="p-1.5 rounded-md hover:bg-[#ebede8] text-[#5c6760]"
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-display font-bold text-sm text-[#111613]">
              AEGIS CONSOLE
            </span>
          </div>

          <div className="flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 rounded-lg bg-white/80 hover:bg-white border border-[#e5e8e2] text-xs text-[#79877e] transition-colors shadow-soft"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-[#5c6760] shrink-0" />
                <span className="truncate">Search policies, tools, events...</span>
              </span>
              <span className="flex items-center gap-0.5 shrink-0">
                <Kbd>⌘ K</Kbd>
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("website")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-[#ebede8] border border-[#e5e8e2] text-xs font-mono text-[#0e291c] transition-colors shadow-soft"
            >
              <Globe className="w-3.5 h-3.5 text-[#10b981]" />
              <span>Public Website</span>
            </button>

            <div
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-medium text-emerald-800 shadow-soft"
              title="Local Fictional Demo Environment: Uses server-verified synthetic principals for hackathon evaluation."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>DEMO MODE: LOCAL FICTIONAL IDENTITY</span>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={demoUserId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setDemoUserId(newId);
                  const match = DEMO_PERSONAS.find((p) => p.id === newId);
                  if (match) {
                    setSelectedRole(match.role);
                    setNotification({
                      type: "info",
                      message: `Switched demo identity to: ${match.name} (${match.title}, Role: ${match.role}). Server authorization context updated.`,
                    });
                  }
                  fetchAuditData(newId);
                  fetchPolicyData(newId);
                }}
                className="text-xs font-mono font-semibold bg-white border border-[#e5e8e2] rounded-lg px-2.5 py-1.5 text-[#111613] shadow-soft focus:outline-none focus:ring-1 focus:ring-[#0e291c] cursor-pointer"
                title="Simulated Demo Identity (Local Sandbox). Does not represent production authentication."
                aria-label="Active Demo Persona"
              >
                {DEMO_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.role.toUpperCase()} ({p.empId})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className="p-2 rounded-full bg-white hover:bg-[#f1f3ee] border border-[#e5e8e2] text-[#5c6760] hover:text-[#111613] shadow-soft transition-colors"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-[#111613] text-white font-bold text-xs flex items-center justify-center">
                A
              </div>
              <ChevronDown className="w-3 h-3 text-[#79877e]" />
            </div>
          </div>
        </header>}

        {/* Global Notification Banner */}
        {notification && activeTab !== "scan-results" && (
          <div
            role="status"
            className={`px-6 py-2.5 text-xs font-mono flex items-center justify-between gap-3 border-b ${
              notification.type === "success"
                ? "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"
                : notification.type === "error"
                ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]"
                : "bg-[#fffbeb] border-[#fde68a] text-[#92400e]"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {notification.type === "success" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0" />
              )}
              {notification.type === "error" && (
                <XCircle className="w-3.5 h-3.5 text-[#dc2626] shrink-0" />
              )}
              {notification.type === "info" && (
                <AlertTriangle className="w-3.5 h-3.5 text-[#d97706] shrink-0" />
              )}
              <span className="truncate">{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-[10px] uppercase font-bold tracking-wider underline hover:opacity-80 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Viewport */}
        <main className={`flex-1 overflow-y-auto ${activeTab === "scan-results" ? "p-5 sm:p-8 lg:px-12" : "p-6 lg:p-8"}`}>
          {activeTab === "overview" && (
            <SecurityOverview
              events={events}
              pendingApprovals={pendingApprovals}
              stats={stats}
              policyConfig={policyConfig}
              systemMeta={systemMeta}
              selectedRole={selectedRole}
              latestPipelineTelemetry={latestPipelineTelemetry}
              isProcessing={isProcessing}
              activeAnimStage={activeAnimStage}
              onRunScenario={(scnId) => {
                setActiveTab("playground");
                executeAgentRun({ scenario: scnId });
              }}
              onNavigate={(tab) => {
                setActiveTab(tab);
                if (tab === "evaluation" && !evaluationResults && !isRunningEvaluation) {
                  runEvaluationBenchmark();
                }
              }}
              onInspectEvent={(evt) => setInspectorTarget({ type: "event", event: evt })}
              onInspectPolicy={(policyId) =>
                setInspectorTarget({ type: "policy", policyId })
              }
              onRunEvaluation={runEvaluationBenchmark}
            />
          )}

          {activeTab === "scan-workspace" && (
            <ScanWorkspace
              isScanning={isScanningArtifact}
              setIsScanning={setIsScanningArtifact}
              onScanCompleted={(job, batchCount) => {
                setCurrentScanJob(job);
                fetchScansList();
                setActiveTab("scan-results");
                setNotification({
                  type: "success",
                  message: batchCount && batchCount > 1
                    ? `${batchCount} artifacts scanned. Latest report: ${job.artifact.name}, risk ${job.assessment?.score ?? 0}/100.`
                    : `Artifact scan completed for ${job.artifact.name}. Risk Score: ${job.assessment?.score ?? 0}/100.`,
                });
              }}
              onViewSample={(sample) => {
                setCurrentScanJob(sample.job);
                setActiveTab("scan-results");
              }}
            />
          )}

          {activeTab === "scan-results" && (
            <div className="mx-auto w-full max-w-6xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e5e8e2] bg-white px-5 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldAlert className="h-5 w-5" /></div>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">AEGIS artifact report</p><p className="text-sm text-slate-600">A clear summary of this file’s security review</p></div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setActiveTab("scan-workspace")} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Scan another file</button>
                  <button type="button" onClick={() => setViewMode("website")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">Back to website</button>
                </div>
              </div>
              {currentScanJob ? (
                <>
                  <ScanResultsView
                    scanJob={currentScanJob}
                    onSelectFinding={() => {}}
                    onNavigateToFindings={() => {
                      const el = document.getElementById("findings-section");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                  />
                  <div id="findings-section" className="pt-2">
                    <FindingsExplorer
                      findings={currentScanJob.findings}
                      artifactName={currentScanJob.artifact.name}
                    />
                  </div>
                </>
              ) : (
                <div className="p-12 text-center rounded-2xl border border-dashed border-[#d8ded5] bg-white space-y-3">
                  <div className="font-display font-semibold text-sm text-[#111613]">
                    No artifact scan selected
                  </div>
                  <div className="text-xs text-[#79877e]">
                    Please upload an artifact in the Workspace or load a demonstration sample.
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("scan-workspace")}
                    className="px-4 py-2 rounded-lg bg-[#0e291c] text-white text-xs font-mono font-semibold"
                  >
                    Go to Workspace
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "scan-history" && (
            <ScanHistoryView
              scans={scansList}
              onRefreshScans={fetchScansList}
              onSelectScan={(scan) => {
                setCurrentScanJob(scan);
                setActiveTab("scan-results");
              }}
            />
          )}

          {activeTab === "scan-dashboard" && (
            <ArtifactSecurityDashboard
              scans={scansList}
              onNavigateToWorkspace={() => setActiveTab("scan-workspace")}
              onNavigateToHistory={() => setActiveTab("scan-history")}
              onSelectScan={(scan) => {
                setCurrentScanJob(scan);
                setActiveTab("scan-results");
              }}
            />
          )}

          {activeTab === "playground" && (
            <AgentPlayground
              selectedRole={selectedRole}
              onSelectRole={handleRoleSelect}
              policyConfig={policyConfig}
              latestRunResult={latestRunResult}
              lastSubmittedPrompt={lastSubmittedPrompt}
              activeScenarioId={activeScenarioId}
              isProcessing={isProcessing}
              activeAnimStage={activeAnimStage}
              scenarioRunHistory={scenarioRunHistory}
              isBatchRunning={isBatchRunning}
              onExecuteRun={executeAgentRun}
              onRunAllScenarios={handleRunAllScenarios}
              onClearPlayground={() => {
                setLatestRunResult(null);
                setActiveScenarioId(null);
                setLastSubmittedPrompt("");
              }}
              onResolveApproval={handleApprovalResolution}
              onInspectPolicy={(policyId) =>
                setInspectorTarget({ type: "policy", policyId })
              }
              onInspectEventById={(eventId) => {
                const found = events.find((e) => e.id === eventId);
                if (found) setInspectorTarget({ type: "event", event: found });
              }}
              onNavigateToApprovals={() => setActiveTab("approvals")}
            />
          )}

          {activeTab === "policies" && (
            <PolicyControlCenter
              policyConfig={policyConfig}
              activePolicies={activePoliciesList}
              isUpdatingPolicy={isUpdatingPolicy}
              selectedRole={selectedRole}
              onSelectRole={handleRoleSelect}
              onUpdatePolicy={handleUpdatePolicy}
              onResetPolicies={handleResetPolicies}
              onRefreshPolicies={fetchPolicyData}
              onInspectPolicy={(policyId) =>
                setInspectorTarget({ type: "policy", policyId })
              }
              onSimulateInPlayground={(role, toolName) => {
                setSelectedRole(role);
                setActiveTab("playground");
                executeAgentRun({
                  roleOverride: role,
                  prompt: `Execute tool ${toolName}`,
                });
              }}
            />
          )}

          {activeTab === "evaluation" && (
            <SecurityEvaluationView
              evaluationResults={evaluationResults}
              isRunningEvaluation={isRunningEvaluation}
              policyConfig={policyConfig}
              onRunEvaluation={runEvaluationBenchmark}
              onInspectPolicy={(policyId) =>
                setInspectorTarget({ type: "policy", policyId })
              }
            />
          )}

          {activeTab === "audit" && (
            <AuditExplorer
              events={events}
              allApprovals={allApprovals}
              policyConfig={policyConfig}
              onRefresh={fetchAuditData}
              onInspectPolicy={(policyId) =>
                setInspectorTarget({ type: "policy", policyId })
              }
              onOpenGlobalInspector={(evt) =>
                setInspectorTarget({ type: "event", event: evt })
              }
            />
          )}

          {activeTab === "approvals" && (
            <ApprovalQueue
              pendingApprovals={pendingApprovals}
              allApprovals={allApprovals}
              policyConfig={policyConfig}
              onResolveApproval={handleApprovalResolution}
              onTriggerRefundScenario={() => {
                setActiveTab("playground");
                executeAgentRun({ scenario: "HUMAN_APPROVAL_SENSITIVE" });
              }}
              onInspectPolicy={(policyId) =>
                setInspectorTarget({ type: "policy", policyId })
              }
            />
          )}

          {activeTab === "tools" && (
            <ToolsCatalog
              policyConfig={policyConfig}
              selectedRole={selectedRole}
              onSelectRole={handleRoleSelect}
              onSimulateTool={(role, toolName) => {
                setSelectedRole(role);
                setActiveTab("playground");
                executeAgentRun({
                  roleOverride: role,
                  prompt: `Invoke ${toolName}`,
                });
              }}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView
              systemMeta={systemMeta}
              isUpdatingPolicy={isUpdatingPolicy}
              onResetPolicies={handleResetPolicies}
            />
          )}
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="w-72 h-full bg-[#f7f8f5] border-r border-[#e5e8e2] p-5 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#e5e8e2]">
                <div className="font-display font-bold text-sm text-[#111613]">
                  AEGIS CONSOLE
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1 text-[#5c6760]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                      if (
                        item.id === "evaluation" &&
                        !evaluationResults &&
                        !isRunningEvaluation
                      ) {
                        runEvaluationBenchmark();
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between text-xs font-medium ${
                      activeTab === item.id
                        ? "bg-[#ebede8] text-[#111613] font-bold"
                        : "text-[#5c6760]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#fde68a]/50 text-[#92400e]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setViewMode("website");
                }}
                className="w-full py-2 px-3 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono text-[#0e291c] font-bold"
              >
                ← Back to Public Website
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(screen) => setActiveTab(screen)}
        onRunScenario={(scnId) => {
          setActiveTab("playground");
          executeAgentRun({ scenario: scnId });
        }}
        onRunAllScenarios={handleRunAllScenarios}
        onSelectRole={handleRoleSelect}
        onInspectRule={(policyId) =>
          setInspectorTarget({ type: "policy", policyId })
        }
        onInspectEvent={(evt) => setInspectorTarget({ type: "event", event: evt })}
        onFilterAuditVerdict={() => setActiveTab("audit")}
        onResetPolicies={handleResetPolicies}
        events={events}
        pendingApprovalCount={pendingApprovals.length}
      />

      {/* Decision Inspector Drawer */}
      <DecisionInspectorDrawer
        target={inspectorTarget}
        onClose={() => setInspectorTarget(null)}
        onSelectPolicy={(policyId) =>
          setInspectorTarget({ type: "policy", policyId })
        }
        onSelectEvent={(evt) => setInspectorTarget({ type: "event", event: evt })}
        onNavigateToPolicies={() => setActiveTab("policies")}
        policyConfig={policyConfig}
        events={events}
        allApprovals={allApprovals}
      />
    </div>
  );
}
