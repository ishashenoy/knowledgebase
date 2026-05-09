"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DocumentSource, getDocuments, QueryResult, queryProject } from "@/lib/api";
import { formatDate, shortText } from "@/lib/format";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { SourceIcon } from "@/components/source-icon";

function sourceMatchesChunks(source: DocumentSource, chunks: string[]) {
  const haystack = `${source.name} ${source.sourceName} ${source.sourceUrl ?? ""} ${
    source.rawContent ?? ""
  }`.toLowerCase();

  return chunks.some((chunk) => {
    const sample = chunk.toLowerCase().slice(0, 80).trim();
    return sample.length > 16 && haystack.includes(sample);
  });
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [question, setQuestion] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadDocuments() {
      try {
        setLoading(true);
        setError("");
        const loaded = await getDocuments(projectId);
        if (!ignore) {
          setDocuments(loaded);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load documents");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      ignore = true;
    };
  }, [projectId]);

  const activeChunks = useMemo(
    () => results.flatMap((result) => result.relevantChunks),
    [results],
  );

  async function handleQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) {
      return;
    }

    try {
      setQuerying(true);
      setError("");
      const result = await queryProject(projectId, question.trim());
      setResults((current) => [result, ...current]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setQuerying(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[380px_1fr] lg:px-10">
      <aside className="glass-card flex max-h-[calc(100vh-3rem)] flex-col rounded-[2rem] p-5">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-zinc-500 transition hover:text-white">
              Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
              Sources
            </h1>
          </div>
          <Link
            href={`/projects/${projectId}/ingest`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-zinc-950 transition hover:bg-zinc-200"
            aria-label="Add source"
          >
            <PlusIcon className="h-5 w-5" />
          </Link>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-400">
            <div className="text-2xl font-semibold text-white">{documents.length}</div>
            ingested
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-400">
            <div className="text-2xl font-semibold text-white">{results.length}</div>
            queries
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />
            ))
          ) : documents.length > 0 ? (
            documents.map((source) => {
              const active = sourceMatchesChunks(source, activeChunks);

              return (
                <article
                  key={source.id}
                  className={`rounded-2xl border p-4 transition ${
                    active
                      ? "border-indigo-300/70 bg-indigo-400/15 shadow-[0_0_40px_rgba(129,140,248,0.18)]"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        active ? "bg-indigo-300 text-zinc-950" : "bg-white/[0.06] text-zinc-300"
                      }`}
                    >
                      <SourceIcon
                        sourceName={source.sourceName}
                        documentType={source.documentType}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-medium text-white">{source.name}</h2>
                      <p className="mt-1 truncate text-xs text-zinc-500">{source.sourceName}</p>
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span>{formatDate(source.createdAt)}</span>
                        {active ? <span className="text-indigo-200">relevant</span> : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-zinc-500">
              No sources yet.
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-h-[calc(100vh-3rem)] flex-col rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.22em] text-zinc-500">
              Project {projectId}
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Ask once. Read the evidence.
            </h2>
          </div>
        </div>

        <form onSubmit={handleQuery} className="glass-card mb-5 rounded-[1.5rem] p-3">
          <div className="flex items-center gap-3">
            <SearchIcon className="h-5 w-5 shrink-0 text-zinc-500" />
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Search this project"
              className="min-w-0 flex-1 bg-transparent py-3 text-lg text-white outline-none placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={querying || !question.trim()}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {querying ? "Searching" : "Query"}
            </button>
          </div>
        </form>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid flex-1 content-start gap-4 overflow-y-auto">
          {results.map((result, index) => (
            <article key={`${result.question}-${index}`} className="glass-card rounded-[1.75rem] p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-950">
                  Answer
                </span>
                <span className="text-sm text-zinc-500">{result.question}</span>
              </div>
              <p className="leading-7 text-zinc-100">{result.answer}</p>
              {result.relevantChunks.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {result.relevantChunks.map((chunk, chunkIndex) => (
                    <div
                      key={`${chunk}-${chunkIndex}`}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-5 text-zinc-400"
                    >
                      {shortText(chunk, 180)}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}

          {!loading && results.length === 0 ? (
            <div className="glass-card rounded-[1.75rem] p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/[0.06] text-zinc-400">
                <SearchIcon />
              </div>
              <p className="text-lg font-medium text-white">No chat thread. Just one sharp query.</p>
              <p className="mt-2 text-sm text-zinc-500">
                Ask at the top and results will appear here with source snippets.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
