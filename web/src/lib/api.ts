const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

type Row = unknown[] | Record<string, unknown>;

export type Project = {
  id: number;
  name: string;
  description: string;
  createdAt: string | null;
  documentCount?: number;
};

export type DocumentSource = {
  id: number;
  name: string;
  createdAt: string | null;
  documentType: string;
  sourceName: string;
  sourceUrl: string | null;
  projectId: number;
  rawContent?: string;
};

export type QueryResult = {
  projectId: number;
  question: string;
  answer: string;
  relevantChunks: string[];
};

export type ApiError = {
  message: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : {
            "Content-Type": "application/json",
            ...init?.headers,
          },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail ?? detail;
    } catch {
      // Keep the HTTP status text when the backend does not return JSON.
    }

    throw new Error(detail || "Request failed");
  }

  return response.json() as Promise<T>;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeProject(row: Row): Project {
  if (Array.isArray(row)) {
    return {
      id: numberValue(row[0]),
      name: text(row[1], "Untitled project"),
      description: text(row[2]),
      createdAt: text(row[3]) || null,
    };
  }

  return {
    id: numberValue(row.id),
    name: text(row.name, "Untitled project"),
    description: text(row.description),
    createdAt: text(row.created_at ?? row.createdAt) || null,
    documentCount: optionalNumber(row.document_count ?? row.documentCount),
  };
}

function normalizeDocument(row: Row): DocumentSource {
  if (Array.isArray(row)) {
    return {
      id: numberValue(row[0]),
      name: text(row[1], "Untitled source"),
      createdAt: text(row[2]) || null,
      documentType: text(row[3]),
      sourceName: text(row[4], "source"),
      sourceUrl: text(row[5]) || null,
      projectId: numberValue(row[6]),
      rawContent: text(row[7]),
    };
  }

  return {
    id: numberValue(row.id),
    name: text(row.name, "Untitled source"),
    createdAt: text(row.created_at ?? row.createdAt) || null,
    documentType: text(row.document_type ?? row.documentType),
    sourceName: text(row.source_name ?? row.sourceName, "source"),
    sourceUrl: text(row.source_url ?? row.sourceUrl) || null,
    projectId: numberValue(row.project_id ?? row.projectId),
    rawContent: text(row.raw_content ?? row.rawContent),
  };
}

function normalizeChunks(chunks: unknown): string[] {
  if (!Array.isArray(chunks)) {
    return [];
  }

  return chunks.map((chunk) => {
    if (Array.isArray(chunk)) {
      return text(chunk[0]);
    }

    return text(chunk);
  });
}

export async function getProjects() {
  const body = await request<{ projects: Row[] }>("/projects", {
    cache: "no-store",
  });

  return body.projects.map(normalizeProject);
}

export async function createProject(projectName: string, projectDescription: string) {
  const params = new URLSearchParams({
    project_name: projectName,
    project_description: projectDescription,
  });

  return request<{ project_id: number }>(`/projects?${params.toString()}`, {
    method: "POST",
  });
}

export async function getDocuments(projectId: string | number) {
  const body = await request<{ documents: Row[] }>(`/projects/${projectId}/documents`, {
    cache: "no-store",
  });

  return body.documents.map(normalizeDocument);
}

export async function ingestGithub(projectId: string | number, repoUrl: string) {
  const params = new URLSearchParams({
    repo_url: repoUrl,
    project_id: String(projectId),
  });

  return request<{ message: string }>(`/ingest/github?${params.toString()}`, {
    method: "POST",
  });
}

export async function ingestFile(projectId: string | number, file: File) {
  const params = new URLSearchParams({
    project_id: String(projectId),
  });
  const formData = new FormData();
  formData.append("file", file);

  return request<{ message: string }>(`/ingest/file?${params.toString()}`, {
    method: "POST",
    body: formData,
  });
}

export async function ingestNote(
  projectId: string | number,
  noteName: string,
  note: string,
) {
  const params = new URLSearchParams({
    project_id: String(projectId),
    note_name: noteName,
    note,
  });

  return request<{ message: string }>(`/ingest/note?${params.toString()}`, {
    method: "POST",
  });
}

export async function queryProject(projectId: string | number, question: string) {
  const body = await request<{
    project_id: number;
    question: string;
    answer: string;
    relevant_chunks: unknown[];
  }>("/query/project", {
    method: "POST",
    body: JSON.stringify({
      project_id: Number(projectId),
      question,
    }),
  });

  return {
    projectId: body.project_id,
    question: body.question,
    answer: body.answer,
    relevantChunks: normalizeChunks(body.relevant_chunks),
  } satisfies QueryResult;
}
