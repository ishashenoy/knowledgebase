"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ingestFile, ingestGithub, ingestNote } from "@/lib/api";
import { FileIcon, GithubIcon, PencilIcon } from "@/components/icons";

type Tab = "github" | "file" | "note";

const tabs: Array<{ id: Tab; label: string; hint: string }> = [
  { id: "github", label: "GitHub", hint: "Repo URL" },
  { id: "file", label: "File", hint: "Drop text" },
  { id: "note", label: "Note", hint: "Write raw text" },
];

export default function IngestPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;
  const [activeTab, setActiveTab] = useState<Tab>("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [noteName, setNoteName] = useState("");
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      setSubmitting(true);

      if (activeTab === "github") {
        if (!repoUrl.trim()) {
          return;
        }
        const response = await ingestGithub(projectId, repoUrl.trim());
        setMessage(response.message);
        setRepoUrl("");
      }

      if (activeTab === "file") {
        if (!file) {
          return;
        }
        const response = await ingestFile(projectId, file);
        setMessage(response.message);
        setFile(null);
      }

      if (activeTab === "note") {
        if (!note.trim()) {
          return;
        }
        const response = await ingestNote(projectId, noteName.trim() || "note", note.trim());
        setMessage(response.message);
        setNote("");
        setNoteName("");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    (activeTab === "github" && repoUrl.trim()) ||
    (activeTab === "file" && file) ||
    (activeTab === "note" && note.trim());

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8 lg:px-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            Project {projectId}
          </Link>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
            Add content
          </h1>
        </div>
        <Link
          href={`/projects/${projectId}`}
          className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          Done
        </Link>
      </header>

      <section className="glass-card overflow-hidden rounded-[2rem]">
        <div className="grid border-b border-white/10 p-2 sm:grid-cols-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setMessage("");
                setError("");
              }}
              className={`flex items-center gap-3 rounded-[1.4rem] p-4 text-left transition ${
                activeTab === tab.id ? "bg-white text-zinc-950" : "text-zinc-400 hover:bg-white/[0.06]"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  activeTab === tab.id ? "bg-zinc-950 text-white" : "bg-white/[0.06] text-zinc-300"
                }`}
              >
                {tab.id === "github" ? <GithubIcon /> : null}
                {tab.id === "file" ? <FileIcon /> : null}
                {tab.id === "note" ? <PencilIcon /> : null}
              </span>
              <span>
                <span className="block font-medium">{tab.label}</span>
                <span
                  className={`block text-xs ${
                    activeTab === tab.id ? "text-zinc-600" : "text-zinc-600"
                  }`}
                >
                  {tab.hint}
                </span>
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-8">
          {activeTab === "github" ? (
            <div className="grid gap-4">
              <label className="text-sm text-zinc-400" htmlFor="repo-url">
                GitHub repository
              </label>
              <input
                id="repo-url"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/owner/repo"
                className="rounded-3xl border border-white/10 bg-black/30 px-5 py-5 text-lg text-white outline-none transition placeholder:text-zinc-700 focus:border-indigo-400"
              />
            </div>
          ) : null}

          {activeTab === "file" ? (
            <div className="grid gap-4">
              <label className="text-sm text-zinc-400">Upload file</label>
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  setFile(event.dataTransfer.files.item(0));
                }}
                className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-[2rem] border border-dashed p-8 text-center transition ${
                  dragging
                    ? "border-indigo-300 bg-indigo-400/10"
                    : "border-white/15 bg-black/25 hover:bg-white/[0.04]"
                }`}
              >
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.item(0) ?? null)}
                />
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.06] text-zinc-300">
                  <FileIcon className="h-7 w-7" />
                </div>
                <p className="text-lg font-medium text-white">
                  {file ? file.name : "Drop a text file here"}
                </p>
                <p className="mt-2 text-sm text-zinc-500">or click to browse</p>
              </label>
            </div>
          ) : null}

          {activeTab === "note" ? (
            <div className="grid gap-4">
              <label className="text-sm text-zinc-400" htmlFor="note-name">
                Note
              </label>
              <input
                id="note-name"
                value={noteName}
                onChange={(event) => setNoteName(event.target.value)}
                placeholder="Note title"
                className="rounded-3xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition placeholder:text-zinc-700 focus:border-indigo-400"
              />
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Paste or write anything worth searching later..."
                rows={12}
                className="resize-none rounded-3xl border border-white/10 bg-black/30 px-5 py-5 text-white outline-none transition placeholder:text-zinc-700 focus:border-indigo-400"
              />
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
            </div>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="rounded-2xl bg-white px-6 py-3 font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Ingesting" : "Ingest"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
