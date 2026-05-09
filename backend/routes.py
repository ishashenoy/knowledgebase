from backend import *

from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

'''
# Project Management
- POST   /projects          → create a new project
- GET    /projects          → list all projects
- DELETE /projects/{id}     → delete a project
'''

@app.post('/projects')
def create_project_route(project_name: str, project_description: str):
    try:
        project_id = create_project(project_name, project_description)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {exc}")
    return {
        "project_id": project_id
    }

@app.get('/projects')
def get_projects_route():
    try:
        projects = get_projects()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get projects: {exc}")
    return {
        "projects": projects
    }

@app.delete('/projects/{id}')
def delete_project_route(id):
    try:
        delete_project(id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {exc}")
    return {
        "message": "Project deleted successfully"
    }


'''
# Ingestion
- POST   /ingest/github     --> takes: repo URL, ingests it
- POST   /ingest/file       --> takes: uploaded file, ingests it
- POST   /ingest/note       --> takes: raw text, ingests it
'''

#github repo
@app.post('/ingest/github')
def ingest_github_route(repo_url: str, project_id: int = 0):
    owner, repo = repo_url.split("/")[-2:]
    content = fetch_github_content(owner, repo)
    store_document(content, f"{owner}/{repo}", "codebase", "github", repo_url, project_id)
    return {"message": "Repository ingested successfully"}

# just txt files for now
@app.post("/ingest/file")
async def ingest_file_route(file: UploadFile = File(...), project_id: int = 0):
    content = (await file.read()).decode("utf-8")
    file_name = file.filename
    store_document(content, file_name, "text/plain", "user uploaded file", None, project_id)
    return {"message": "File ingested successfully"}

# direct text input
@app.post("/ingest/note")
async def ingest_note_route(note: str, note_name: str = "note", project_id: int = 0):
    store_document(note, note_name, "text/plain", "text input", None, project_id)
    return {"message": "Note ingested successfully"}

'''
# Querying
- POST   /query/project     --> takes: question + project_id, returns: answer + source chunks
'''

class QueryProjectRequest(BaseModel):
    question: str
    project_id: int

@app.post('/query/project')
def query_project_route(payload: QueryProjectRequest):
    question = payload.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    try:
        response = answer_question(question, payload.project_id)
        answer = response["answer"]
        relevant_chunks = response["relevant_chunks"]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {exc}")

    return {
        "project_id": payload.project_id,
        "question": question,
        "answer": answer,
        "relevant_chunks": relevant_chunks
    }

'''
# Documents
- GET    /projects/{id}/documents   --> list all documents in a project
- DELETE /documents/{id}            --> delete a document and its chunks
'''

@app.get('/projects/{id}/documents')
def get_documents_route(id):
    try:
        documents = get_documents(id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {exc}")
    return {
        "documents": documents
    }

@app.delete('/documents/{id}')
def delete_document_route(id):
    try:
        delete_document(id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {exc}")
    return {
        "message": "Document deleted successfully"
    }