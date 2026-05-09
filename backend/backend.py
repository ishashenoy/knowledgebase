from dotenv import load_dotenv
import os
import requests
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from nltk.tokenize import sent_tokenize
import psycopg2
import base64

load_dotenv()
api_key = os.getenv('OPENROUTER_KEY')
github_token = os.getenv('GITHUB_TOKEN')
database_url = os.getenv('DATABASE_URL')

llm_endpoint = 'https://openrouter.ai/api/v1/chat/completions'

llm_name = "nvidia/nemotron-3-super-120b-a12b:free"
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

'''
text helper functions
'''
# returns a list of sentences of the og text
def read_text(text):
    sentences = sent_tokenize(text)
    return sentences

# returns a list of n sentence paragraphs of the og text
def chunk_text(sentences, n):
    chunks = []

    for i in range(0, len(sentences), n):
        chunk = " ".join(sentences[i:i + n])
        chunks.append(chunk)

    return chunks

# returns an embedding of the text (list of numbers)
def embed_text(text):
    embedding = embedding_model.encode(text).tolist()
    return embedding

#one function that chunks and embeds a text
def chunk_and_embed_text(text):
    sentences = read_text(text)
    chunks = chunk_text(sentences, 5)
    embeddings = [embedding_model.encode(chunk).tolist() for chunk in chunks]
    return chunks, embeddings

'''
querying
'''
#finds the most similar chunk of text based on the question
def find_relevant_chunks(question, project_id):

    embedded_question = embed_text(question)

    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.text FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE d.project_id = %s
        ORDER BY c.embedding <-> %s::vector LIMIT 3
    """, (project_id, embedded_question))

    results = cursor.fetchall()

    cursor.close()
    conn.close()

    return results

def answer_question(question, project_id):
    relevant_chunks = find_relevant_chunks(question, project_id)

    context = "\n\n".join([row[0] for row in relevant_chunks])

    response = requests.post(
        llm_endpoint,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            'model': llm_name,
            'messages': [
                {"role" : "system", "content": "You are a helpful assistant. Answer the user's question using only the context provided. If the answer is not in the context, say you don't know."},
                {"role" : "user", "content": "Context: " + context + "\n\nQuestion: " + question}
            ]
        }
    )

    return {"answer": response.json()["choices"][0]["message"]["content"], "relevant_chunks": relevant_chunks}

'''
Fetching from various sources
'''
def fetch_github_content(owner, repo):
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json"
    }
    
    all_text = ""

    # README
    readme_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/readme",
        headers=headers
    )
    if readme_response.status_code == 200:
        readme_text = base64.b64decode(
            readme_response.json()["content"].replace("\n", "")
        ).decode("utf-8")
        all_text += f"README:\n{readme_text}\n\n"

    # Issues
    issues_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/issues?state=all&per_page=50",
        headers=headers
    )
    if issues_response.status_code == 200:
        for issue in issues_response.json():
            title = issue.get("title", "")
            body = issue.get("body") or ""
            all_text += f"Issue: {title}\n{body}\n\n"

    # Commits
    commits_response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/commits?per_page=50",
        headers=headers
    )
    if commits_response.status_code == 200:
        for commit in commits_response.json():
            message = commit["commit"]["message"]
            all_text += f"Commit: {message}\n\n"

    return all_text

'''
Project CRUD
'''
def get_projects():
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM projects")
    projects = cursor.fetchall()
    cursor.close()
    conn.close()
    return projects

def create_project(project_name, project_description):
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    cursor.execute("INSERT INTO projects (name, description) VALUES (%s, %s) RETURNING id", (project_name, project_description))
    project_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return project_id

def get_project(project_id):
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
    project = cursor.fetchone()
    cursor.close()
    conn.close()
    return project

def delete_project(project_id):
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM projects WHERE id = %s", (project_id,))

    conn.commit()
    cursor.close()
    conn.close()

'''
Document CRUD
'''
def get_documents(project_id):
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM documents WHERE project_id = %s", (project_id,))
    documents = cursor.fetchall()
    cursor.close()
    conn.close()
    return documents

def delete_document(document_id):
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM documents WHERE id = %s", (document_id,))
    
    conn.commit()
    cursor.close()
    conn.close()

'''
Ingestion: chunks, embeddings, what document it belongs to
'''
def store_document(text, document_name, document_type, source_name, source_url, project_id):
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    chunks, embeddings = chunk_and_embed_text(text)

    cursor.execute(
        "INSERT INTO documents (name, document_type, source_name, source_url, project_id, raw_content) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (document_name, document_type, source_name, source_url, project_id, text)
    )
    document_id = cursor.fetchone()[0]

    index = 0
    for index, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        cursor.execute(
            "INSERT INTO chunks (document_id, chunk_index, text, embedding) VALUES (%s, %s, %s, %s)",
            (document_id, index, chunk, embedding)
        )

    conn.commit()
    cursor.close()
    conn.close()