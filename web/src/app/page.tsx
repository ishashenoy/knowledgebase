"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createProject, getDocuments, getProjects, Project, queryProject } from "@/lib/api";
import { formatDate, shortText } from "@/lib/format";
import { PlusIcon, SearchIcon } from "@/components/icons";

type ProjectWithMeta = Project & {
  documentCount: number;
};

type QuickAnswer = {
  projectId: number;
  answer: string;
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [queries, setQueries] = useState<Record<number, string>>({});
  const [quickAnswers, setQuickAnswers] = useState<Record<number, QuickAnswer>>({});
  const [queryingId, setQueryingId] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadProjects() {
      try {
        setLoading(true);
        setError("");
        const loadedProjects = await getProjects();
        const withCounts = await Promise.all(
          loadedProjects.map(async (project) => {
            try {
              const documents = await getDocuments(project.id);
              return {
                ...project,
                documentCount: documents.length,
              };
            } catch {
              return {
                ...project,
                documentCount: project.documentCount ?? 0,
              };
            }
          }),
        );

        if (!ignore) {
          setProjects(withCounts);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load projects");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      ignore = true;
    };
  }, []);

  const totalDocuments = useMemo(
    () => projects.reduce((total, project) => total + project.documentCount, 0),
    [projects],
  );

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) {
      return;
    }

    try {
      setCreating(true);
      setError("");
      const created = await createProject(newName.trim(), newDescription.trim());
      setProjects((current) => [
        {
          id: created.project_id,
          name: newName.trim(),
          description: newDescription.trim(),
          createdAt: new Date().toISOString(),
          documentCount: 0,
        },
        ...current,
      ]);
      setNewName("");
      setNewDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleQuickQuery(projectId: number) {
    const question = queries[projectId]?.trim();
    if (!question) {
      return;
    }

    try {
      setQueryingId(projectId);
      const result = await queryProject(projectId, question);
      setQuickAnswers((current) => ({
        ...current,
        [projectId]: {
          projectId,
          answer: result.answer,
        },
      }));
    } catch (err) {
      setQuickAnswers((current) => ({
        ...current,
        [projectId]: {
          projectId,
          answer: err instanceof Error ? err.message : "Query failed",
        },
      }));
    } finally {
      setQueryingId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
      <header className="mb-8 flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs uppercase tracking-[0.24em] text-zinc-400">
              Knowledgebase
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
              Projects, sources, answers.
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-zinc-400">
            <div className="glass-card rounded-2xl p-4">
              <div className="text-2xl font-semibold text-white">{projects.length}</div>
              projects
            </div>
            <div className="glass-card rounded-2xl p-4">
              <div className="text-2xl font-semibold text-white">{totalDocuments}</div>
              documents
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateProject} className="grid gap-3 lg:grid-cols-[1fr_1.2fr_auto]">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="New project"
            className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-indigo-400"
          />
          <input
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="Optional description"
            className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Create
          </button>
        </form>
      </header>

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="glass-card h-64 animate-pulse rounded-[1.75rem]" />
          ))}
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="glass-card group flex min-h-64 flex-col rounded-[1.75rem] p-5 transition hover:-translate-y-1 hover:border-white/20"
            >
              <Link href={`/projects/${project.id}`} className="flex-1">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-lg font-semibold text-zinc-950">
                    {project.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                    {formatDate(project.createdAt)}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                  {project.name}
                </h2>
                <p className="mt-2 min-h-10 text-sm leading-6 text-zinc-400">
                  {project.description || "No description yet."}
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm text-zinc-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  {project.documentCount} documents
                </div>
              </Link>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-2">
                <div className="flex items-center gap-2">
                  <SearchIcon className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input
                    value={queries[project.id] ?? ""}
                    onChange={(event) =>
                      setQueries((current) => ({
                        ...current,
                        [project.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleQuickQuery(project.id);
                      }
                    }}
                    placeholder="Ask this project"
                    className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </div>
                {quickAnswers[project.id] ? (
                  <p className="px-6 pb-2 text-xs leading-5 text-zinc-400">
                    {shortText(quickAnswers[project.id].answer, 120)}
                  </p>
                ) : null}
                {queryingId === project.id ? (
                  <p className="px-6 pb-2 text-xs text-indigo-200">Searching...</p>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}

      {!loading && projects.length === 0 ? (
        <div className="glass-card rounded-[1.75rem] p-10 text-center text-zinc-400">
          Create your first project to start adding sources.
        </div>
      ) : null}
    </main>
  );
}
