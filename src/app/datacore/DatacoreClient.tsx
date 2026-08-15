'use client';
import { Plus, Search, SlidersHorizontal, Trash2, X, FileText, BookOpen, CircuitBoard, Plug } from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SectionTitle } from '@/components/ui/Primitives';
import { HardwareLibrary } from '@/components/datacore/HardwareLibrary';
import { BeastConsole } from '@/components/datacore/beast-console/BeastConsole';
import { EXPECTED_CABLES } from '@/components/datacore/beast-console/bench-data';
import { isHangarBayId } from '@/data/hangar';
import { INSIGHT_CONFIDENCE_LEVELS, isInsightConfidence, type InsightConfidence } from '@/data/types';
import { insightConfidenceMeta } from '@/lib/format';
import type { HangarReadSource } from '@/lib/hangar-read-status';
import { useHangar, LOCAL_INSIGHT_PREFIX } from '@/lib/store';
import {
  briefingById,
  briefingMatchesQuery,
  briefingsInPack,
  packMatchesQuery,
  type DatacoreBriefingRow,
  type DatacorePack,
} from '@/lib/datacore-model';
import clsx from 'clsx';

type ConfidenceFilter = 'all' | InsightConfidence;
type DatacoreTab = 'knowledge' | 'library' | 'console';

export type DatacoreClientProps = {
  briefings: DatacoreBriefingRow[];
  briefingsSource: HangarReadSource;
  packs: DatacorePack[];
  packsSource: HangarReadSource;
};

export function DatacoreClient({ briefings, briefingsSource, packs, packsSource }: DatacoreClientProps) {
  const { data, insights, documents, unit, mission, addLocalInsight, removeLocalInsight } = useHangar();
  const [tab, setTab] = useState<DatacoreTab>('knowledge');
  const [q, setQ] = useState('');
  const [bay, setBay] = useState<'all' | string>('all');
  const [conf, setConf] = useState<ConfidenceFilter>('all');
  const briefingsOffline = briefingsSource === 'unavailable';
  const packsOffline = packsSource === 'unavailable';
  const offline = briefingsOffline && packsOffline;
  const hasFixtureCorpus = packs.length > 0 || briefings.length > 0;

  // Content intake — a lightweight, reversible local-notes capture (no backend).
  const [showCapture, setShowCapture] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftBay, setDraftBay] = useState<'' | string>('');
  const [draftTags, setDraftTags] = useState('');

  const onConfidenceChange = (value: string) => {
    setConf(value === 'all' || isInsightConfidence(value) ? value : 'all');
  };

  const setSearch = (term: string) => {
    setQ(term);
    setTab('knowledge');
  };

  const submitDraft = () => {
    addLocalInsight({
      title: draftTitle,
      body: draftBody,
      bay: isHangarBayId(draftBay) ? draftBay : undefined,
      tags: draftTags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setDraftTitle('');
    setDraftBody('');
    setDraftBay('');
    setDraftTags('');
    setShowCapture(false);
  };

  const needle = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    return insights.filter((ins) => {
      if (bay !== 'all' && ins.bay !== bay) return false;
      if (conf !== 'all' && ins.confidence !== conf) return false;
      if (!needle) return true;
      const hay = `${ins.id} ${ins.title} ${ins.body} ${ins.tags.join(' ')} ${ins.source ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [insights, needle, bay, conf]);

  const packHits = useMemo(
    () => packs.filter((p) => packMatchesQuery(p, needle, briefings)),
    [needle, packs, briefings],
  );

  const looseBriefingHits = useMemo(() => {
    const packedInHit = new Set(
      packHits.flatMap((p) => briefingsInPack(briefings, p.id).map((b) => b.id)),
    );
    return briefings.filter((b) => {
      if (packedInHit.has(b.id)) return false;
      return briefingMatchesQuery(b, needle);
    });
  }, [needle, packHits, briefings]);

  return (
    <div className="space-y-6">
      {(briefingsOffline || packsOffline) && (
        <div
          role="status"
          className="flex items-center gap-3 border border-amber/50 bg-amber/10 px-4 py-2.5 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_10px,rgba(255,176,32,0.06)_10px,rgba(255,176,32,0.06)_20px)]"
        >
          <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
            DATACORE {offline ? 'OFFLINE' : 'DEGRADED'}
          </span>
          <span className="min-w-0 truncate font-mono text-[11px] text-ink-dim">
            {offline
              ? hasFixtureCorpus
                ? 'Hangar Postgres unavailable — serving static research fixture.'
                : 'Hangar Postgres briefings unavailable — no research fixture loaded.'
              : packsOffline
                ? 'Research packs lane static — briefings still load from Postgres.'
                : 'Briefings lane static — research packs still load from Postgres.'}
          </span>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan/70">Knowledge Core</div>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink">Datacore</h1>
          <p className="mt-1 font-mono text-xs text-ink-dim">
            Research briefs, field notes, and speculative intel — searchable, linked to units and missions.
          </p>
        </div>
        {tab === 'knowledge' && (
          <button
            type="button"
            onClick={() => setShowCapture((v) => !v)}
            className="btn btn-ghost text-[10px]"
          >
            {showCapture ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showCapture ? 'Cancel' : 'Capture Note'}
          </button>
        )}
      </header>

      {/* section tabs */}
      <div className="flex flex-wrap gap-1.5">
        {([
          {
            id: 'knowledge',
            label: 'Knowledge Core',
            code: 'CORE',
            icon: BookOpen,
            count: briefings.length + insights.length,
          },
          { id: 'library', label: 'Hardware Library', code: 'HW', icon: CircuitBoard, count: documents.length },
          { id: 'console', label: 'BEAST Console', code: 'PLUG', icon: Plug, count: EXPECTED_CABLES.filter((c) => !c.era && c.build !== 'pi5').length },
        ] as const).map((t) => {
          const TabIcon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx('btn text-[10px]', tab === t.id ? 'btn-active' : 'btn-ghost')}
            >
              <TabIcon className="h-3 w-3" />
              {t.label}
              <span className="ml-1 font-mono text-[9px] text-ink-dim">{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === 'knowledge' && showCapture && (
        <div className="panel space-y-2 p-3">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Insight title"
            className="w-full rounded-md border border-rim bg-panel-2/40 px-3 py-2 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring"
          />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="What did you learn? (body)"
            rows={3}
            className="w-full rounded-md border border-rim bg-panel-2/40 px-3 py-2 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={draftBay}
              onChange={(e) => setDraftBay(e.target.value)}
              className="rounded-md border border-rim bg-panel-2/40 px-2.5 py-2 font-mono text-xs text-ink outline-none"
            >
              <option value="">No bay</option>
              {data.bays.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <input
              value={draftTags}
              onChange={(e) => setDraftTags(e.target.value)}
              placeholder="tags, comma, separated"
              className="rounded-md border border-rim bg-panel-2/40 px-3 py-2 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitDraft}
              disabled={!draftTitle.trim() || !draftBody.trim()}
              className="btn btn-active text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3 w-3" /> Save Note
            </button>
          </div>
        </div>
      )}

      {tab !== 'console' && (
      <div className="panel p-3">
        <div className={clsx('grid gap-2', tab === 'knowledge' && 'md:grid-cols-[1.6fr_0.8fr_0.8fr]')}>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === 'knowledge'
                  ? 'Search: splat, arducam, livox, gaussian, rejected, tags…'
                  : 'Search CAD, schematics, datasheets, firmware...'
              }
              className="w-full rounded-md border border-rim bg-panel-2/40 py-2 pl-9 pr-3 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring"
            />
          </label>

          {tab === 'knowledge' && (
            <>
              <label className="flex items-center gap-2 rounded-md border border-rim bg-panel-2/40 px-2.5">
                <SlidersHorizontal className="h-4 w-4 text-cyan" />
                <select value={bay} onChange={(e) => setBay(e.target.value)} className="w-full bg-transparent py-2 font-mono text-xs text-ink outline-none">
                  <option value="all">All bays</option>
                  {data.bays.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-md border border-rim bg-panel-2/40 px-2.5">
                <SlidersHorizontal className="h-4 w-4 text-amber" />
                <select value={conf} onChange={(e) => onConfidenceChange(e.target.value)} className="w-full bg-transparent py-2 font-mono text-xs text-ink outline-none">
                  <option value="all">All confidence</option>
                  {INSIGHT_CONFIDENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {insightConfidenceMeta(level).label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      </div>
      )}

      {tab === 'library' && <HardwareLibrary query={q} />}

      {tab === 'console' && <BeastConsole />}

      {tab === 'knowledge' && (
        <>
          {offline && !hasFixtureCorpus && (
            <div
              role="status"
              className="panel space-y-2 border-amber/40 p-4 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_10px,rgba(255,176,32,0.06)_10px,rgba(255,176,32,0.06)_20px)]"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber">
                Research packs &amp; briefs unavailable
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-ink-dim">
                Datacore is offline for Postgres-backed research content and no static fixture is loaded. Field insights below still load from the Hangar spine.
              </p>
            </div>
          )}

          {packHits.length > 0 && (
            <>
              <SectionTitle code="PACK">
                {packHits.length} research pack{packHits.length === 1 ? '' : 's'}
              </SectionTitle>
              <div className="space-y-3">
                {packHits.map((pack) => {
                  const hub = briefingById(briefings, pack.hubBriefingId);
                  const members = briefingsInPack(briefings, pack.id);
                  const narrowed = needle
                    ? members.filter((b) => briefingMatchesQuery(b, needle))
                    : members;
                  const shown = narrowed.length > 0 ? narrowed : members;
                  return (
                    <section
                      key={pack.id}
                      className="panel space-y-3 p-4"
                      style={{ borderColor: 'color-mix(in oklab, var(--color-amber) 35%, var(--color-rim))' }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
                            {pack.code} · non-definitive research
                          </div>
                          <h2 className="mt-1 font-display text-base uppercase tracking-[0.08em] text-ink">
                            {pack.title}
                          </h2>
                          <p className="mt-1.5 max-w-3xl font-mono text-[11px] leading-relaxed text-ink-dim">
                            {pack.summary}
                          </p>
                        </div>
                        {hub && (
                          <Link href={hub.href} className="btn btn-ghost shrink-0 text-[10px]">
                            <FileText className="h-3 w-3" />
                            Open index
                          </Link>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {pack.topics.map((topic) => (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => setSearch(topic)}
                            className="chip border-amber/35 bg-amber/5 text-amber hover:border-amber/60"
                          >
                            {topic}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {shown.map((brief) => (
                          <Link
                            key={brief.id}
                            href={brief.href}
                            className="panel-inset group block p-3 transition-all hover:border-cyan/40"
                          >
                            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/70">
                              {brief.id === pack.hubBriefingId ? 'index' : brief.kind} · {brief.capturedAt}
                            </div>
                            <h3 className="mt-1 font-display text-xs uppercase tracking-[0.08em] text-ink group-hover:text-cyan">
                              {brief.title}
                            </h3>
                            <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-dim line-clamp-2">
                              {brief.summary}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}

          {looseBriefingHits.length > 0 && (
            <>
              <SectionTitle code="BRIEF">
                {packHits.length > 0
                  ? `${looseBriefingHits.length} other brief${looseBriefingHits.length === 1 ? '' : 's'}`
                  : `${looseBriefingHits.length} research brief${looseBriefingHits.length === 1 ? '' : 's'}`}
              </SectionTitle>
              <div className="grid gap-3 md:grid-cols-2">
                {looseBriefingHits.map((brief) => (
                  <Link
                    key={brief.id}
                    href={brief.href}
                    className="panel group block p-4 transition-all hover:border-cyan/40 hover:shadow-hud-cyan"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-cyan/30 bg-cyan/5 text-cyan">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/70">
                          {brief.kind} · {brief.capturedAt}
                        </div>
                        <h2 className="mt-1 font-display text-sm uppercase tracking-[0.08em] text-ink group-hover:text-cyan">
                          {brief.title}
                        </h2>
                        <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-dim">{brief.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {brief.tags.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSearch(t);
                              }}
                              className="chip border-cyan/30 bg-cyan/5 text-cyan hover:border-cyan/60"
                            >
                              #{t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

      <SectionTitle code="CORE">{filtered.length} insight{filtered.length === 1 ? '' : 's'}</SectionTitle>
      <div className="space-y-3">
        {filtered.map((ins) => {
          const isLocal = ins.id.startsWith(LOCAL_INSIGHT_PREFIX);
          const confidenceMeta = insightConfidenceMeta(ins.confidence);
          return (
          <article key={ins.id} className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm uppercase tracking-[0.08em] text-ink">{ins.title}</h2>
              <span className={clsx('chip', confidenceMeta.cls)}>
                {ins.confidence}
              </span>
              {ins.bay && (
                <span className="chip border-rim bg-panel-2/40 text-ink-dim">{ins.bay}</span>
              )}
              {isLocal && (
                <>
                  <span className="chip border-cyan/30 bg-cyan/5 text-cyan">LOCAL</span>
                  <button
                    type="button"
                    aria-label={`Delete note ${ins.title}`}
                    onClick={() => removeLocalInsight(ins.id)}
                    className="ml-auto grid h-6 w-6 place-items-center rounded border border-rim/60 text-ink-dim hover:border-signal-crit/50 hover:text-signal-crit cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>

            <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-dim">{ins.body}</p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {ins.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSearch(t)}
                  className="chip border-cyan/30 bg-cyan/5 text-cyan hover:border-cyan/60"
                >
                  #{t}
                </button>
              ))}
            </div>

            {((ins.units?.length ?? 0) > 0 || (ins.missions?.length ?? 0) > 0) && (
              <div className="mt-3 border-t border-rim/50 pt-2 font-mono text-[10px] text-ink-dim">
                {ins.units?.map((uid) => {
                  const u = unit(uid);
                  return u ? (
                    <Link key={uid} href={`/unit/${uid}`} className="mr-2 inline-flex text-cyan hover:underline">unit:{u.name}</Link>
                  ) : null;
                })}
                {ins.missions?.map((mid) => {
                  const m = mission(mid);
                  return m ? (
                    <Link key={mid} href={`/mission/${mid}`} className="mr-2 inline-flex text-amber hover:underline">mission:{m.code}</Link>
                  ) : null;
                })}
              </div>
            )}
          </article>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}
