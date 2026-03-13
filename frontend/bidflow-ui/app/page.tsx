"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  DollarSign,
  Download,
  FileText,
  Gauge,
  Loader2,
  PenTool,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Target,
  Upload,
  WandSparkles,
  Zap,
} from "lucide-react";

const DEMO_RFP = `We are a B2B SaaS company looking for a partner to modernize our platform.

Must include:
- Explicit mention of ISO 27001 and SOC 2 alignment
- SSO via SAML 2.0 or OIDC
- SLA: 99.9% uptime
- A delivery timeline with phases (Discovery, Build, Security review, Launch)
- References to relevant past SaaS projects
`;

type LogItem = { agent: string; msg: string };
type TabType = "final" | "checklist" | "evidence" | "strategy" | "draft1" | "critic1" | "draft2" | "critic2";
type RunStatus = "pending" | "processing" | "completed" | "failed";

interface AsyncStartResponse {
  run_id: string;
}

interface RunStatusResponse {
  status: RunStatus;
  checklist?: unknown;
  evidence?: unknown[];
  strategy?: string;
  draft_v1?: string;
  critic_v1?: string;
  draft_v2?: string | null;
  critic_v2?: string | null;
  final_markdown?: string;
  cost_estimate_usd?: number;
  elapsed_seconds?: number;
  log?: LogItem[];
  error?: string;
}

type ArtifactState = {
  checklist?: unknown;
  evidence?: unknown[];
  strategy?: string;
  draft_v1?: string;
  critic_v1?: string;
  draft_v2?: string | null;
  critic_v2?: string | null;
};

const PIPELINE_AGENTS = [
  { name: "Extractor", icon: ClipboardCheck, blurb: "Parse the RFP into a compliance-ready requirements map." },
  { name: "Researcher", icon: Search, blurb: "Pull evidence, credentials, and prior delivery proof points." },
  { name: "Strategist", icon: Target, blurb: "Shape win themes and response posture." },
  { name: "Writer", icon: PenTool, blurb: "Draft the proposal with structure, tone, and proof." },
  { name: "Critic", icon: Shield, blurb: "Audit coverage gaps before final delivery." },
] as const;

const TAB_CONFIG: Array<{ key: TabType; label: string }> = [
  { key: "final", label: "Final Proposal" },
  { key: "strategy", label: "Strategy" },
  { key: "draft1", label: "Draft v1" },
  { key: "critic1", label: "Critic v1" },
  { key: "draft2", label: "Draft v2" },
  { key: "critic2", label: "Critic v2" },
  { key: "checklist", label: "Checklist" },
  { key: "evidence", label: "Evidence" },
];

const HERO_KPIS = [
  { label: "Response Time", value: "< 3 min", icon: Gauge },
  { label: "Control Checks", value: "7 required", icon: Shield },
  { label: "Review Surface", value: "8 live tabs", icon: FileText },
];

const HERO_RIBBON = [
  "Shorter response cycles without weaker governance",
  "Executive-ready proposals grounded in delivery reality",
  "A cleaner handoff from bid strategy to project execution",
  "Auditability, evidence, and narrative quality in one system",
];

const SELLING_STORIES = [
  {
    audience: "For Revenue Teams",
    title: "Protect deal momentum",
    summary: "Move from scattered requirements to a leadership-ready proposal before internal alignment or buyer confidence starts to slip.",
    tone: "bg-amber-300",
  },
  {
    audience: "For Bid And Compliance",
    title: "Control risk as you write",
    summary: "Keep obligations, evidence, and review checkpoints visible while the response is still being shaped, not after it is sent around for damage control.",
    tone: "bg-emerald-400",
  },
  {
    audience: "For Delivery Leaders",
    title: "Stand behind the final promise",
    summary: "Produce proposals that reflect what the team can genuinely deliver, so the handoff from pursuit to execution starts from a position of trust.",
    tone: "bg-sky-300",
  },
] as const;

function stripMarkdown(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTabContent(tab: TabType, artifacts: ArtifactState | null) {
  if (!artifacts) {
    return "";
  }

  switch (tab) {
    case "checklist":
      return JSON.stringify(artifacts.checklist ?? {}, null, 2);
    case "evidence":
      return JSON.stringify(artifacts.evidence ?? [], null, 2);
    case "strategy":
      return artifacts.strategy ?? "";
    case "draft1":
      return artifacts.draft_v1 ?? "";
    case "critic1":
      return artifacts.critic_v1 ?? "";
    case "draft2":
      return artifacts.draft_v2 ?? "(No revision required)";
    case "critic2":
      return artifacts.critic_v2 ?? "(No revision required)";
    default:
      return "";
  }
}

export default function Home() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [rfp, setRfp] = useState(DEMO_RFP);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [animatedLog, setAnimatedLog] = useState<LogItem[]>([]);
  const [finalMd, setFinalMd] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactState | null>(null);
  const [tab, setTab] = useState<TabType>("final");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (log.length === 0) {
      setAnimatedLog([]);
      return;
    }

    if (animatedLog.length >= log.length) {
      return;
    }

    let index = animatedLog.length;
    const timer = setInterval(() => {
      index += 1;
      setAnimatedLog(log.slice(0, index));
      if (index >= log.length) {
        clearInterval(timer);
      }
    }, 240);

    return () => clearInterval(timer);
  }, [animatedLog.length, log]);

  useEffect(() => {
    if (runStatus === "processing" || runStatus === "pending") {
      setProcessingStep(0);
      const timer = setInterval(() => {
        setProcessingStep((previous) => Math.min(previous + 1, PIPELINE_AGENTS.length - 1));
      }, 5500);

      return () => clearInterval(timer);
    }

    if (runStatus === "completed") {
      setProcessingStep(PIPELINE_AGENTS.length - 1);
    }
  }, [runStatus]);

  const selectTab = useCallback((nextTab: TabType) => {
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    setTab(nextTab);
  }, []);

  const pollRunStatus = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`${apiBase}/runs/${runId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: RunStatusResponse = await response.json();
      setRunStatus(data.status);

      if (data.log?.length) {
        setLog(data.log);
      }

      if (data.status === "completed") {
        stopPolling();
        setRunning(false);
        setFinalMd(data.final_markdown || "");
        setCost(data.cost_estimate_usd ?? null);
        setElapsed(data.elapsed_seconds ?? null);
        setArtifacts({
          checklist: data.checklist,
          evidence: data.evidence,
          strategy: data.strategy,
          draft_v1: data.draft_v1,
          critic_v1: data.critic_v1,
          draft_v2: data.draft_v2,
          critic_v2: data.critic_v2,
        });
        return;
      }

      if (data.status === "failed") {
        stopPolling();
        setRunning(false);
        setError(data.error || "Pipeline execution failed");
      }
    } catch (fetchError) {
      console.error("Failed to poll run status", fetchError);
    }
  }, [apiBase, stopPolling]);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadedFileName(file.name);

    try {
      setRfp(await file.text());
    } catch {
      setError("Failed to read file contents.");
    }
  }

  async function handleGenerate() {
    stopPolling();
    setRunning(true);
    setRunStatus("pending");
    setError(null);
    setLog([]);
    setAnimatedLog([]);
    setFinalMd("");
    setArtifacts(null);
    setCost(null);
    setElapsed(null);
    setProcessingStep(0);
    selectTab("final");

    try {
      const response = await fetch(`${apiBase}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "demo-001", rfp_text: rfp }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `HTTP ${response.status}`);
      }

      const data: AsyncStartResponse = await response.json();
      setRunStatus("processing");

      pollIntervalRef.current = setInterval(() => {
        void pollRunStatus(data.run_id);
      }, 3000);

      await pollRunStatus(data.run_id);
    } catch (requestError) {
      stopPolling();
      setRunning(false);
      setRunStatus(null);
      setError(requestError instanceof Error ? requestError.message : "Unknown error occurred.");
    }
  }

  function handleLoadSample() {
    setRfp(DEMO_RFP);
    setUploadedFileName(null);
  }

  function handleCopy() {
    if (!exportContent) {
      return;
    }

    void navigator.clipboard.writeText(exportText || exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function saveBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportTxt() {
    if (!exportText) {
      return;
    }

    saveBlob(new Blob([exportText], { type: "text/plain;charset=utf-8" }), `bidflow-${tab}.txt`);
  }

  function exportDoc() {
    if (!exportText) {
      return;
    }

    const paragraphs = exportText
      .split(/\n\n+/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
      .join("");

    const documentHtml = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>BidFlow Export</title>
          <style>
            body { font-family: Calibri, Arial, sans-serif; margin: 36px; color: #111827; line-height: 1.6; }
            h1 { font-size: 20pt; margin-bottom: 20px; }
            p { margin: 0 0 12px; }
          </style>
        </head>
        <body>
          <h1>BidFlow ${tab === "final" ? "Proposal" : TAB_CONFIG.find((item) => item.key === tab)?.label ?? "Export"}</h1>
          ${paragraphs}
        </body>
      </html>`;

    saveBlob(new Blob([documentHtml], { type: "application/msword;charset=utf-8" }), `bidflow-${tab}.doc`);
  }

  function exportPdf() {
    if (!exportText) {
      return;
    }

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 52;
    const lines = pdf.splitTextToSize(exportText, pageWidth - margin * 2);

    let cursorY = margin;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(`BidFlow ${tab === "final" ? "Proposal" : TAB_CONFIG.find((item) => item.key === tab)?.label ?? "Export"}`, margin, cursorY);

    cursorY += 28;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    lines.forEach((line: string) => {
      if (cursorY > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }
      pdf.text(line, margin, cursorY);
      cursorY += 16;
    });

    pdf.save(`bidflow-${tab}.pdf`);
  }

  const tabContent = useMemo(() => formatTabContent(tab, artifacts), [artifacts, tab]);
  const exportContent = tab === "final" ? finalMd : tabContent;
  const exportText = stripMarkdown(exportContent);
  const isMarkdownTab = tab === "final" || tab === "strategy" || tab === "draft1" || tab === "draft2";

  const statusTone =
    runStatus === "completed"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : runStatus === "processing" || runStatus === "pending"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
        : runStatus === "failed"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-white/70 text-slate-600 ring-slate-200";

  function getAgentStatus(index: number): "pending" | "active" | "completed" {
    if (runStatus === "completed") {
      return "completed";
    }

    if (runStatus === "processing" || runStatus === "pending") {
      if (index < processingStep) {
        return "completed";
      }

      if (index === processingStep) {
        return "active";
      }
    }

    return "pending";
  }

  const pipelineSummary =
    runStatus === "completed"
      ? "All agents completed. The proposal is ready for review and export."
      : runStatus === "processing" || runStatus === "pending"
        ? "The orchestration rail stays live while extraction, research, strategy, writing, and audit run in sequence."
        : runStatus === "failed"
          ? "The run stopped before completion. Review the error and restart the workflow."
          : "One visible response flow for strategy, evidence, drafting, and review.";

  const completedAgents = runStatus === "completed" ? PIPELINE_AGENTS.length : Math.min(processingStep, PIPELINE_AGENTS.length - 1);
  const pipelineProgress = runStatus === "completed" ? 100 : runStatus === "processing" || runStatus === "pending" ? ((completedAgents + 0.45) / PIPELINE_AGENTS.length) * 100 : 0;

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900">
      <div className="page-atmosphere pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute right-0 top-12 h-96 w-96 rounded-full bg-sky-300/14 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute bottom-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/10 blur-3xl animate-float-slow" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(21,19,18,0.62)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1760px] items-center gap-4 px-6 py-4 xl:px-8">
          <div className="brand-mark relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-[22px] p-[1px] shadow-[0_22px_48px_-26px_rgba(0,0,0,0.52)]">
            <div className="relative flex h-full w-full items-center justify-center rounded-[21px] bg-[linear-gradient(160deg,#fffaf2_0%,#efe3cf_38%,#d9c2a0_100%)]">
              <svg aria-hidden="true" viewBox="0 0 52 52" className="h-9 w-9">
                <defs>
                  <linearGradient id="bidflow-stroke" x1="6" y1="6" x2="46" y2="46" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3f2f20" />
                    <stop offset="0.48" stopColor="#8b5e34" />
                    <stop offset="1" stopColor="#0f766e" />
                  </linearGradient>
                  <linearGradient id="bidflow-fill" x1="14" y1="12" x2="38" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#fffefb" />
                    <stop offset="1" stopColor="#f0dfc6" />
                  </linearGradient>
                </defs>
                <rect x="11" y="10" width="18" height="24" rx="6" fill="url(#bidflow-fill)" stroke="url(#bidflow-stroke)" strokeWidth="2" transform="rotate(-10 20 22)" />
                <rect x="23" y="16" width="18" height="24" rx="6" fill="url(#bidflow-fill)" stroke="url(#bidflow-stroke)" strokeWidth="2" transform="rotate(8 32 28)" />
                <path d="M18 23h8M18 28h7M27 23h8M27 28h6" stroke="url(#bidflow-stroke)" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M26 8l1.7 3.6L31 13.3l-3.3 1.5-1.7 3.6-1.6-3.6-3.4-1.5 3.4-1.7L26 8z" fill="#f59e0b" />
              </svg>
              <div className="absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-full border border-white/80 bg-emerald-500 shadow-[0_0_0_4px_rgba(255,250,242,0.72)]" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[1.8rem] font-semibold tracking-[-0.03em] text-stone-50">BidFlow</h1>
              <span className="rounded-full border border-amber-200/20 bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">AI</span>
            </div>
            <p className="text-sm text-stone-300/80">Multi-agent proposal workspace for enterprise RFP response teams.</p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1760px] px-6 pb-10 pt-7 xl:px-8 xl:pt-10">
        <section className="relative mb-7 overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,250,242,0.1),rgba(255,249,239,0.06))] px-6 py-7 shadow-[0_34px_90px_-52px_rgba(0,0,0,0.58)] backdrop-blur-xl xl:px-8 xl:py-8">
          <div className="hero-spotlight pointer-events-none absolute inset-0 opacity-90" />
          <div className="pointer-events-none absolute -left-16 top-10 h-44 w-44 rounded-full bg-amber-300/14 blur-3xl" />
          <div className="pointer-events-none absolute right-10 top-0 h-52 w-52 rounded-full bg-emerald-300/12 blur-3xl" />

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_440px] xl:items-end">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-200 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Proposal Intelligence Platform
              </div>
              <h2 className="mt-5 max-w-5xl font-display text-[3.1rem] font-semibold leading-[0.9] tracking-[-0.04em] text-stone-50 md:text-[4.5rem] xl:text-[5.4rem]">
                Turn raw RFP noise into a <span className="text-brand-gradient">visionary proposal</span> that buyers and delivery teams can trust in seconds.
              </h2>
              <p className="mt-5 max-w-3xl text-[1.02rem] leading-8 text-stone-300 md:text-[1.08rem]">
                BidFlow brings research, compliance, delivery strategy, critical review, and final drafting into a single response system so commercial teams can move from scattered requirements to a credible, decision-ready proposal with clarity, control, and narrative confidence.
              </p>

              <div className="mt-8 grid gap-3 xl:grid-cols-3">
                {SELLING_STORIES.map((story) => (
                  <div key={story.title} className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-300/80">
                      <span className={`h-2 w-2 rounded-full ${story.tone}`} />
                      {story.audience}
                    </div>
                    <h3 className="mt-3 font-display text-[1.5rem] font-semibold tracking-[-0.03em] text-stone-50">{story.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-stone-300/90">{story.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-night judge-noise mesh-border relative overflow-hidden rounded-[30px] p-5 text-white shadow-[0_34px_90px_-48px_rgba(0,0,0,0.74)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#d4a76a_0%,#f59e0b_42%,#0f766e_100%)]" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100/70">Decision Snapshot</p>
                  <h3 className="mt-2 font-display text-[1.85rem] font-semibold tracking-[-0.03em] text-white">Why customers stay confident</h3>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ring-1 ${
                  runStatus === "completed"
                    ? "bg-emerald-400/10 text-emerald-200 ring-emerald-300/20"
                    : runStatus === "processing" || runStatus === "pending"
                      ? "bg-indigo-400/10 text-indigo-100 ring-indigo-300/20"
                      : runStatus === "failed"
                        ? "bg-rose-400/10 text-rose-100 ring-rose-300/20"
                        : "bg-white/10 text-slate-100 ring-white/10"
                }`}>
                  <span className={`h-2 w-2 rounded-full ${running ? "bg-cyan-300 animate-pulse" : "bg-emerald-300"}`} />
                  {runStatus ?? "ready"}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {HERO_KPIS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-4 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-stone-300">
                        <Icon className="h-4 w-4 text-amber-300" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{item.label}</span>
                      </div>
                      <div className="mt-2 font-display text-[1.45rem] font-semibold tracking-[-0.04em] text-white">{item.value}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Commercial Value</p>
                    <p className="mt-1 text-sm leading-7 text-stone-200">The response does more than look polished. It gives commercial, compliance, and delivery stakeholders one aligned version of the deal they are prepared to win and fulfill.</p>
                  </div>
                  <Zap className="h-5 w-5 text-amber-300" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="font-display text-[1.45rem] font-semibold tracking-[-0.05em] text-white">01</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Ingest</div>
                  </div>
                  <div>
                    <div className="font-display text-[1.45rem] font-semibold tracking-[-0.05em] text-white">02</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Refine</div>
                  </div>
                  <div>
                    <div className="font-display text-[1.45rem] font-semibold tracking-[-0.05em] text-white">03</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Present</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="signal-ribbon relative mt-7 overflow-hidden rounded-[22px] border border-white/10 px-4 py-3 shadow-[0_18px_50px_-34px_rgba(0,0,0,0.45)]">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-[linear-gradient(90deg,rgba(22,19,17,0.94),transparent)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-[linear-gradient(270deg,rgba(22,19,17,0.94),transparent)]" />
            <div className="marquee-track flex min-w-max items-center gap-6 px-2">
              {[...HERO_RIBBON, ...HERO_RIBBON].map((item, index) => (
                <div key={`${item}-${index}`} className="inline-flex items-center gap-3 text-sm font-medium tracking-[0.02em] text-stone-200/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300/90" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="surface-glass panel-glow animate-rise-in mb-8 overflow-hidden rounded-[34px] border border-white/40">
          <div className="border-b border-slate-200/70 px-7 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,rgba(139,94,52,0.12),rgba(15,118,110,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-700 ring-1 ring-stone-200/80">
                  <Bot className="h-3.5 w-3.5" />
                  Agent Orchestration
                </div>
                <h2 className="mt-3 font-display text-[2.35rem] font-semibold tracking-[-0.03em] text-stone-900">One operating model for serious enterprise responses.</h2>
                <p className="mt-2 max-w-3xl text-[0.98rem] leading-7 text-stone-600">{pipelineSummary}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ${statusTone}`}>
                  {runStatus === "completed" ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {runStatus === "processing" || runStatus === "pending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {runStatus === "failed" ? <AlertCircle className="h-4 w-4" /> : null}
                  {runStatus === "pending"
                    ? "Starting"
                    : runStatus === "processing"
                      ? "Processing"
                      : runStatus === "completed"
                        ? "Completed"
                        : runStatus === "failed"
                          ? "Failed"
                          : "Ready"}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                  <Gauge className="h-4 w-4 text-indigo-500" />
                  5-agent orchestration
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-6 xl:px-7">
            <div className="relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.94))] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] xl:px-6 xl:py-6">
              <div className="pointer-events-none absolute inset-x-6 top-[4.65rem] hidden h-px bg-stone-300/70 xl:block" />
              <div className="pointer-events-none absolute left-6 top-[4.65rem] hidden h-px bg-[linear-gradient(90deg,#8b5e34_0%,#d4a76a_38%,#0f766e_100%)] transition-all duration-700 xl:block" style={{ width: `calc(${pipelineProgress}% - 2.4rem)` }} />

              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide xl:grid xl:grid-cols-5 xl:gap-4 xl:overflow-visible xl:pb-0">
                {PIPELINE_AGENTS.map((agent, index) => {
                  const Icon = agent.icon;
                  const agentLogs = animatedLog.filter((entry) => entry.agent === agent.name);
                  const latestLog = agentLogs[agentLogs.length - 1];
                  const status = getAgentStatus(index);

                  return (
                    <div key={agent.name} className="relative min-w-[220px] xl:min-w-0">
                      <div className={`relative h-full rounded-[26px] border px-4 py-4 transition duration-300 xl:px-5 xl:py-5 ${
                        status === "completed"
                          ? "border-emerald-200 bg-emerald-50/85 shadow-[0_20px_44px_-30px_rgba(16,185,129,0.65)]"
                          : status === "active"
                            ? "border-indigo-200 bg-[linear-gradient(180deg,rgba(238,242,255,0.98),rgba(255,255,255,0.94))] shadow-[0_24px_50px_-30px_rgba(79,70,229,0.55)]"
                            : "border-slate-200 bg-white/85 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]"
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-[18px] ring-1 transition ${
                            status === "completed"
                              ? "bg-emerald-100 text-emerald-600 ring-emerald-200"
                              : status === "active"
                                ? "bg-indigo-50 text-indigo-600 ring-indigo-200 shadow-[0_0_0_10px_rgba(99,102,241,0.08)]"
                                : "bg-slate-50 text-slate-400 ring-slate-200"
                          }`}>
                            {status === "completed" ? <Check className="h-4 w-4" /> : status === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                            status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : status === "active"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-slate-100 text-slate-500"
                          }`}>
                            {status === "completed" ? "Done" : status === "active" ? "Live" : "Queued"}
                          </span>
                        </div>
                        <div className="mt-4">
                          <h3 className="text-[1rem] font-semibold text-slate-950">{agent.name}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">{latestLog?.msg || agent.blurb}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[560px_minmax(0,1fr)] xl:items-start 2xl:grid-cols-[600px_minmax(0,1fr)] 2xl:gap-10">
          <section className="xl:sticky xl:top-24 xl:self-start">
            <div className="surface-night judge-noise mesh-border panel-glow relative overflow-hidden rounded-[32px] text-white animate-rise-in">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#38bdf8_0%,#6366f1_34%,#d946ef_68%,#f59e0b_100%)]" />
              <div className="border-b border-white/10 px-7 py-6">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-100">
                  <WandSparkles className="h-3.5 w-3.5" />
                  Command Deck
                </div>
                <h2 className="font-display text-[1.95rem] font-semibold leading-[0.98] tracking-[-0.05em]">Generate a boardroom-grade proposal in one pass.</h2>
                <p className="mt-3 max-w-xl text-[0.96rem] leading-7 text-slate-300">
                  Feed the RFP, let the agent swarm work through compliance, evidence, strategy, and final drafting, then review each artifact in a structured workspace.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 border-b border-white/10 px-7 py-5 text-sm">
                <div className="rounded-2xl bg-white/6 px-4 py-3 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Pipeline</div>
                  <div className="mt-1 font-semibold text-white">5 agents</div>
                </div>
                <div className="rounded-2xl bg-white/6 px-4 py-3 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Sections</div>
                  <div className="mt-1 font-semibold text-white">7 outputs</div>
                </div>
                <div className="rounded-2xl bg-white/6 px-4 py-3 backdrop-blur-sm">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Mode</div>
                  <div className="mt-1 font-semibold text-white">Enterprise</div>
                </div>
              </div>

              <div className="space-y-5 px-7 py-7">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-300" />
                    <h3 className="text-sm font-semibold text-white">RFP Input</h3>
                  </div>
                  <span className="text-xs text-slate-400">{rfp.trim().split(/\s+/).length} words</span>
                </div>

                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-sm font-medium text-slate-200 transition hover:border-cyan-300/70 hover:bg-white/10"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploadedFileName || "Upload RFP document"}
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.doc,.docx,.pdf" onChange={handleFileUpload} className="hidden" />

                <textarea
                  className="min-h-[280px] w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-100 placeholder:text-slate-500 outline-none ring-0 transition focus:border-fuchsia-300/60 focus:bg-slate-950/40"
                  value={rfp}
                  onChange={(event) => setRfp(event.target.value)}
                  placeholder="Paste your RFP text here..."
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    disabled={running}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Sample RFP
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={running || !rfp.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#312e81_0%,#4f46e5_32%,#d946ef_72%,#f59e0b_100%)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_26px_52px_-24px_rgba(99,102,241,0.88)] transition hover:translate-y-[-1px] hover:scale-[1.01] hover:shadow-[0_36px_68px_-26px_rgba(217,70,239,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {running ? "Generating..." : "Generate Proposal"}
                  </button>
                </div>

                {error ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}
              </div>
            </div>

          </section>

          <section className="surface-glass panel-glow animate-rise-in min-w-0 self-start overflow-hidden rounded-[36px] border border-white/80">
            <div className="border-b border-slate-200/70 px-7 py-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,rgba(79,70,229,0.09),rgba(217,70,239,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 ring-1 ring-indigo-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Output Workspace
                  </div>
                  <h2 className="font-display mt-3 text-[1.95rem] font-semibold tracking-[-0.05em] text-slate-950">Proposal Review Surface</h2>
                  <p className="mt-1 max-w-2xl text-[0.96rem] leading-7 text-slate-500">Review the final response, inspect intermediate artifacts, and export the finished draft without leaving the workspace.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  {runStatus ? (
                    <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ${statusTone}`}>
                      {runStatus === "completed" ? <CheckCircle2 className="h-4 w-4" /> : null}
                      {runStatus === "processing" || runStatus === "pending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {runStatus === "failed" ? <AlertCircle className="h-4 w-4" /> : null}
                      {runStatus === "pending"
                        ? "Starting"
                        : runStatus === "processing"
                          ? "Processing"
                          : runStatus === "completed"
                            ? "Completed"
                            : "Failed"}
                    </div>
                  ) : null}
                  {elapsed !== null ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {elapsed.toFixed(1)}s
                    </div>
                  ) : null}
                  {cost !== null ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                      <DollarSign className="h-4 w-4 text-slate-400" />
                      ${cost.toFixed(4)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="px-7 pb-7 pt-6">
              <div className="paper-tint overflow-hidden rounded-[32px] border border-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-6 py-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      Proposal Viewer
                    </div>
                    <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 xl:block">Boardroom Mode</div>
                  </div>
                  <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Proposal artifacts">
                      {TAB_CONFIG.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          role="tab"
                          aria-selected={tab === item.key}
                          onClick={() => selectTab(item.key)}
                          className={`tab-sheen rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                            tab === item.key
                              ? "bg-[linear-gradient(135deg,#312e81_0%,#4f46e5_30%,#d946ef_75%,#f59e0b_100%)] text-white shadow-[0_18px_32px_-18px_rgba(99,102,241,0.9)]"
                              : "bg-white/90 text-slate-500 ring-1 ring-slate-200 hover:-translate-y-0.5 hover:text-slate-800"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start 2xl:self-auto">
                      <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!exportContent}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={exportTxt}
                        disabled={!exportContent}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={exportDoc}
                        disabled={!exportContent}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                        Word
                      </button>
                      <button
                        type="button"
                        onClick={exportPdf}
                        disabled={!exportContent}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                        PDF
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-[calc(100vh-13rem)] min-h-[760px] overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.05),transparent_22%)] px-8 py-8 xl:px-12 xl:py-12">
                  {tab === "final" ? (
                    finalMd ? (
                      <article className="prose prose-slate max-w-none prose-headings:font-display prose-headings:scroll-mt-24 prose-headings:tracking-[-0.05em] prose-h1:mb-5 prose-h1:text-[2.55rem] prose-h1:font-semibold prose-h1:text-slate-950 prose-h2:mt-14 prose-h2:border-t prose-h2:border-slate-200 prose-h2:pt-10 prose-h2:text-[1.75rem] prose-h2:font-semibold prose-h3:mt-8 prose-h3:text-[1.18rem] prose-h3:font-semibold prose-p:text-[1.04rem] prose-p:leading-8 prose-p:text-slate-600 prose-li:text-[1rem] prose-li:leading-8 prose-strong:text-slate-900 prose-a:text-indigo-600 prose-blockquote:border-indigo-200 prose-blockquote:bg-[linear-gradient(135deg,rgba(79,70,229,0.06),rgba(217,70,239,0.05))] prose-blockquote:px-5 prose-blockquote:py-1 prose-blockquote:text-slate-700 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-hr:border-slate-200">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalMd}</ReactMarkdown>
                      </article>
                    ) : (
                      <div className="flex min-h-[620px] flex-col items-center justify-center text-center">
                        {running ? (
                          <div className="max-w-xl space-y-6">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.2),_rgba(99,102,241,0.06)),linear-gradient(180deg,#ffffff,#eef2ff)] ring-1 ring-indigo-100">
                              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                            </div>
                            <div>
                              <h3 className="font-display text-2xl font-semibold tracking-[-0.05em] text-slate-950">Generating your proposal</h3>
                              <p className="mt-2 text-base leading-7 text-slate-500">The pipeline is working through extraction, research, strategy, writing, and audit. Intermediate artifacts will be available as soon as the run completes.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-2xl space-y-8">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_rgba(99,102,241,0.04)),linear-gradient(180deg,#ffffff,#eef2ff)] ring-1 ring-indigo-100">
                              <Sparkles className="h-8 w-8 text-indigo-500" />
                            </div>
                            <div>
                              <h3 className="font-display text-2xl font-semibold tracking-[-0.05em] text-slate-950">Ready for the next response cycle</h3>
                              <p className="mt-2 text-base leading-7 text-slate-500">Paste an RFP, launch the agent run, and review every stage of the proposal pipeline from one workspace.</p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
                              {PIPELINE_AGENTS.map((agent, index) => (
                                <div key={agent.name} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">
                                  <span className="font-semibold text-slate-800">{agent.name}</span>
                                  {index < PIPELINE_AGENTS.length - 1 ? <ArrowRight className="h-4 w-4 text-slate-300" /> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  ) : tabContent ? (
                    isMarkdownTab ? (
                      <article className="prose prose-slate max-w-none prose-headings:font-display prose-headings:tracking-[-0.05em] prose-p:text-[1rem] prose-p:leading-8 prose-p:text-slate-600 prose-li:text-[1rem] prose-li:leading-8 prose-strong:text-slate-900 prose-a:text-indigo-600">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{tabContent}</ReactMarkdown>
                      </article>
                    ) : (
                      <pre className="overflow-x-auto rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#0f172a,#111827)] px-5 py-5 text-sm leading-7 text-slate-100 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.9)]">{tabContent}</pre>
                    )
                  ) : (
                    <div className="flex min-h-[620px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-base text-slate-400">
                      {running ? "Processing artifacts..." : "No artifact available yet for this tab."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
