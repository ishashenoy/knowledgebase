## run once on first run
```
import nltk
nltk.download('punkt_tab')
```

## database schema:
3 tables: projects, documents, chunks

### projects
```
id: primary key
name: text
description: text
created_at: timestamp
```

### documents
```
id: primary key
name: text
created_at: timestamp
source_type: text
source_url: text
project_id: foreign key --> projects
raw_content: text (original document)
```

### chunks
```
id: primary key
document_id: foreign key --> documents
chunk_index: int
text: text
embedding: vector
```
