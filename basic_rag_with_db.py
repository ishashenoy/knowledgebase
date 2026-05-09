from dotenv import load_dotenv
import os
import requests
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from nltk.tokenize import sent_tokenize
import psycopg2

"""
# run once on first run
import nltk
nltk.download('punkt_tab')
"""

load_dotenv()
api_key = os.getenv('OPENROUTER_KEY')

llm_endpoint = 'https://openrouter.ai/api/v1/chat/completions'

llm_name = "nvidia/nemotron-3-super-120b-a12b:free"
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

data = "knowledge.txt"

def store_chunks(text_file):
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()

    chunks, embeddings = chunk_and_embed_text(text_file)

    cursor.execute("INSERT INTO documents (filename) VALUES (%s) RETURNING id", (text_file,))
    document_id = cursor.fetchone()[0]

    index = 0
    for index, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        cursor.execute(
            "INSERT INTO chunks (document_id, chunk_index, text, embedding) VALUES (%s, %s, %s, %s)",
            (document_id, index, chunk, embedding)
        )
        index += 1

    conn.commit()
    cursor.close()
    conn.close()

# returns a list of sentences of the og text
def read_file(text_file):
    with open(text_file, "r") as file:
        content = file.read()
        sentences = sent_tokenize(content)
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

#one function that chunks and embeds a text file
def chunk_and_embed_text(text_file):
    chunks = chunk_text(read_file(text_file), 5)
    embeddings = [embedding_model.encode(chunk).tolist() for chunk in chunks]
    return chunks, embeddings

#finds the most similar chunk of text based on the question
def find_relevant_chunks(question):

    embedded_question = embed_text(question)

    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()

    cursor.execute("SELECT text FROM chunks ORDER BY embedding <-> %s::vector LIMIT 3", (embedded_question,))

    results = cursor.fetchall()

    cursor.close()
    conn.close()

    return results

def answer_question(question):
    relevant_chunks = find_relevant_chunks(question)

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

    return response.json()["choices"][0]["message"]["content"]

store_chunks(data)
question = "What is dharma and what does Krishna teach about duty and righteous action?"
answer = answer_question(question)
print(answer)