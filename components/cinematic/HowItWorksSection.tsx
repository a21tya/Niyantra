"use client";

import { useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";

const agents = [
  { name: "Cut", job: "Access", image: "/niyantra-agents/cut.png", width: 432, tone: "agent-coral", description: "Checks who is making a request and whether the agent has permission to use the tool." },
  { name: "Hue", job: "Instructions", image: "/niyantra-agents/hue.png", width: 420, tone: "agent-green", description: "Spots prompt injection and unsafe instructions before they change an agent’s behavior." },
  { name: "Nova", job: "Sensitive data", image: "/niyantra-agents/nova.png", width: 415, tone: "agent-violet", description: "Finds private or regulated information before it can leak into an action." },
  { name: "Echo", job: "Destinations", image: "/niyantra-agents/echo.png", width: 425, tone: "agent-rose", description: "Checks where data is going and blocks untrusted recipients or destinations." },
  { name: "Flow", job: "Human review", image: "/niyantra-agents/flow.png", width: 432, tone: "agent-amber", description: "Routes high-impact actions to a person for approval before they run." },
];

export function HowItWorksSection() {
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const chooseAgent = (index: number) => {
    setSelected(index);
    setPaused(true);
  };

  return (
    <section id="how-it-works" className="aegis-how-section px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="aegis-agent-panel relative overflow-hidden rounded-[32px] px-5 py-9 text-center sm:px-10 sm:py-12">
          <p className="relative z-10 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-800">Five agents. Five checks.</p>
          <h2 className="relative z-10 mt-3 text-3xl font-semibold tracking-[-0.04em] text-neutral-950 sm:text-4xl">Meet the Niyantra crew</h2>
          <p className="relative z-10 mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-700 sm:text-base">A little security crew on the move. Click any agent to see what they protect.</p>

          <div className={`aegis-agent-line ${paused ? "is-paused" : ""}`}>
            {agents.map((agent, index) => (
              <button key={agent.name} type="button" className={`aegis-line-agent ${agent.tone} ${selected === index ? "is-selected" : ""}`} onClick={() => chooseAgent(index)} aria-label={`Meet ${agent.name}, the ${agent.job} agent`} aria-pressed={selected === index}>
                <span className="aegis-line-agent-art"><Image src={agent.image} alt="" draggable={false} width={agent.width} height={724} /></span>
                <span className="aegis-line-agent-label"><strong>{agent.name}</strong><small>{agent.job}</small></span>
              </button>
            ))}
          </div>

          <div className="relative z-10 mt-3 flex min-h-10 items-center justify-center gap-3">
            <p className="text-xs font-medium text-neutral-700">{paused ? "The team is paused." : "Always on — from the first prompt to the final decision."}</p>
            <button type="button" className="aegis-train-toggle" onClick={() => { setPaused((value) => !value); if (paused) setSelected(null); }} aria-label={paused ? "Resume the agent line" : "Pause the agent line"}>
              {paused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3 fill-current" />}{paused ? "Resume" : "Pause"}
            </button>
          </div>

          {selected !== null && (
            <div className="aegis-line-detail" aria-live="polite">
              <span className={`aegis-agent-detail-dot ${agents[selected].tone}`} />
              <p><strong>{agents[selected].name} · {agents[selected].job}:</strong> {agents[selected].description}</p>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close agent description">×</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
