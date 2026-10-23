"use client";

import React from "react";
import { Database, Fingerprint, LockKeyhole, ShieldAlert, UserRoundCheck } from "lucide-react";

const capabilities = [
  { title: "Prompt injection defense", description: "Catch malicious instructions before they can change an agent’s behavior.", Icon: ShieldAlert, color: "rose" },
  { title: "Role-based permissions", description: "Give each agent only the tools and access its role allows.", Icon: UserRoundCheck, color: "lime" },
  { title: "Sensitive data protection", description: "Find secrets and block unsafe data sharing before a tool runs.", Icon: Fingerprint, color: "violet" },
  { title: "Human approval & audit", description: "Pause high-risk actions for review and keep a trace of every decision.", Icon: Database, color: "amber" },
];

export function CapabilitiesSection({ onTryInteractiveDemo }: { onTryInteractiveDemo: () => void }) {
  return (
    <section id="capabilities" className="py-20 sm:py-24" style={{ background: "linear-gradient(180deg, #f5f0ff 0%, #fef3e9 50%, #ecfdf5 100%)" }}>
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-9 flex flex-col gap-5 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Key capabilities</p>
            <h2 className="text-3xl font-semibold tracking-[-0.045em] text-neutral-950 sm:text-4xl">Security that’s easy to see.</h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">The safeguards your team needs, shown in plain language.</p>
          </div>
          <button type="button" onClick={onTryInteractiveDemo} className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-900 transition hover:border-neutral-500 hover:bg-neutral-50">
            Try a scenario <LockKeyhole className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {capabilities.map(({ title, description, Icon, color }) => (
            <article key={title} className={`aegis-capability aegis-capability-${color} flex gap-4 rounded-3xl border border-neutral-200 p-5 sm:gap-5 sm:p-7`}>
              <span className="aegis-capability-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"><Icon className="h-5 w-5" strokeWidth={1.7} /></span>
              <div><h3 className="text-base font-semibold text-neutral-950 sm:text-lg">{title}</h3><p className="mt-1.5 max-w-lg text-sm leading-relaxed text-neutral-600">{description}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
