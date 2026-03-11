"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Demo RFP content that triggers self-correction loop
const DEMO_RFP = `We are a B2B SaaS company looking for a partner to modernize our platform.

Must include:
- Explicit mention of ISO 27001 and SOC 2 alignment
- SSO via SAML 2.0 or OIDC
- SLA: 99.9% uptime
- A delivery timeline with phases (Discovery, Build, Security review, Launch)
- References to relevant past SaaS projects
`;

// TypeScript interfaces
type LogItem = { agent: string; msg: string };
type TabType = "final" | "checklist" | "evidence" | "strategy" | "draft1" | "critic1" | "draft2" | "critic2";

interface ApiResponse {
  trace_id: string;
  project_id: string;
  log: LogItem[];
  artifacts: {
    checklist: any;
    evidence: any[];
    strategy: string;
    draft_v1: string;
    critic_v1: string;
    draft_v2: string | null;
    critic_v2: string | null;
  };
  final_markdown: string;
  cost_estimate_usd: number;
  elapsed_seconds: number;
}

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  
  // State management
  const [rfp, setRfp] = useState(DEMO_RFP);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogItem[]>([]);
  const [animatedLog, setAnimatedLog] = useState<LogItem[]>([]);
  const [finalMd, setFinalMd] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [artifacts, setArtifacts] = useState<any>(null);
  const [tab, setTab] = useState<TabType>("final");
  const [error, setError] = useState<string | null>(null);

  // Animate log entries with 450ms delay
  useEffect(() => {
    setAnimatedLog([]);
    if (log.length === 0) return;
    
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setAnimatedLog(log.slice(0, i));
      if (i >= log.length) clearInterval(timer);
    }, 450);
    
    return () => clearInterval(timer);
  }, [log]);

  // Handle Generate button click
  async function handleGenerate() {
    setRunning(true);
    setLog([]);
    setFinalMd("");
    setArtifacts(null);
    setCost(null);
    setError(null);
    
    try {
      const response = await fetch(`${apiBase}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          project_id: "demo-001", 
          rfp_text: rfp 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      
      setLog(data.log || []);
      setFinalMd(data.final_markdown || "");
      setCost(data.cost_estimate_usd ?? null);
      setArtifacts(data.artifacts || null);
      setTab("final");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Pipeline execution failed:", err);
    } finally {
      setRunning(false);
    }
  }

  // Handle Load Demo RFP button click
  function handleLoadDemo() {
    setRfp(DEMO_RFP);
  }

  // Get content for selected tab
  const tabContent = useMemo(() => {
    if (!artifacts) return "";
    
    switch (tab) {
      case "checklist":
        return JSON.stringify(artifacts.checklist, null, 2);
      case "evidence":
        return JSON.stringify(artifacts.evidence, null, 2);
      case "strategy":
        return artifacts.strategy || "";
      case "draft1":
        return artifacts.draft_v1 || "";
      case "critic1":
        return artifacts.critic_v1 || "";
      case "draft2":
        return artifacts.draft_v2 || "(No revision)";
      case "critic2":
        return artifacts.critic_v2 || "(No revision)";
      default:
        return "";
    }
  }, [tab, artifacts]);

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">BidFlow</h1>
          <p className="text-slate-600">Agentic AI RFP Proposal Generator</p>
        </div>

        {/* 3-Column Grid Layout */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* Left Column: Input Panel */}
          <div className="col-span-4 bg-white rounded-xl shadow p-4">
            <h2 className="font-bold text-lg mb-3">RFP Input (SaaS)</h2>
            
            <textarea
              className="w-full h-[520px] p-3 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              value={rfp}
              onChange={(e) => setRfp(e.target.value)}
              placeholder="Paste your RFP text here..."
            />
            
            <div className="flex gap-2 mt-3">
              <button
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
                onClick={handleLoadDemo}
                disabled={running}
              >
                Load Demo RFP
              </button>
              
              <button
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                onClick={handleGenerate}
                disabled={running || !rfp.trim()}
              >
                {running ? "Running..." : "Generate"}
              </button>
            </div>
            
            {/* Cost and Time Badges */}
            <div className="mt-3 text-sm flex flex-wrap gap-2">
              <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                {cost !== null ? `Estimated cost: $${cost.toFixed(2)}` : "Estimated cost: —"}
              </span>
              <span className="inline-block px-2 py-1 bg-violet-100 text-violet-700 rounded">
                Time saved: ~6 hours → ~40 seconds
              </span>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>

          {/* Middle Column: Agent Timeline */}
          <div className="col-span-4 bg-white rounded-xl shadow p-4">
            <h2 className="font-bold text-lg mb-3">Agent Timeline</h2>
            
            <div className="space-y-2 text-sm h-[600px] overflow-y-auto">
              {animatedLog.length > 0 ? (
                animatedLog.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-2 border border-slate-200 rounded bg-slate-50 animate-fade-in"
                  >
                    <span className="font-semibold text-blue-600">[{entry.agent}]</span>{" "}
                    <span className="text-slate-700">{entry.msg}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-center mt-8">
                  Run to see agent steps…
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Output Panel */}
          <div className="col-span-4 bg-white rounded-xl shadow p-4">
            <h2 className="font-bold text-lg mb-3">Output</h2>
            
            {/* Tab Navigation */}
            <div className="flex gap-2 flex-wrap mb-3">
              {(["final", "checklist", "evidence", "strategy", "draft1", "critic1", "draft2", "critic2"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-2 py-1 rounded border text-sm transition-colors ${
                    tab === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="h-[520px] overflow-auto border border-slate-200 rounded p-3 bg-slate-50">
              {tab === "final" ? (
                finalMd ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {finalMd}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-slate-500 text-center mt-8">
                    No output yet. Click Generate to start.
                  </div>
                )
              ) : (
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {tabContent || "No data yet."}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
