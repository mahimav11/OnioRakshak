"""
OnioRakshak - RAG Retrieval Pipeline

Builds a searchable vector index over a curated onion knowledge base
(onion_knowledge_base.json) using Gemini's embedding API + FAISS for
similarity search, then retrieves the most relevant chunks for a given
question. This grounds the chatbot's answers in specific, curated onion
domain knowledge rather than relying only on Gemini's general training
data — the actual point of RAG: answers can be traced back to a specific
source chunk, and the knowledge base can be corrected/expanded without
retraining or re-prompting from scratch.

Why FAISS (not a hosted vector DB): the knowledge base here is small
(a handful of chunks), so a lightweight local index is all that's
needed — no server, no extra infrastructure, index rebuilds in seconds.

Usage:
    from rag_pipeline import OnionKnowledgeBase
    kb = OnionKnowledgeBase()
    kb.build_index()                          # run once (or after editing the JSON)
    chunks = kb.retrieve("why do onions rot in storage", top_k=3)
"""

import json
import os

import numpy as np

try:
    import faiss
except ImportError:
    faiss = None

from dotenv import load_dotenv
from google import genai

load_dotenv()

EMBEDDING_MODEL = "gemini-embedding-001"
KB_PATH = os.path.join(os.path.dirname(__file__), "onion_knowledge_base.json")
INDEX_PATH = os.path.join(os.path.dirname(__file__), "onion_kb_index.faiss")
METADATA_PATH = os.path.join(os.path.dirname(__file__), "onion_kb_metadata.json")


class OnionKnowledgeBase:
    def __init__(self, api_key: str = None):
        if faiss is None:
            raise RuntimeError(
                "faiss is not installed. Run: pip install faiss-cpu"
            )
        api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY not set. Put it in a .env file in this "
                "folder as GEMINI_API_KEY=your_key_here"
            )
        self.client = genai.Client(api_key=api_key)
        self.chunks = self._load_chunks()
        self.index = None

    @staticmethod
    def _load_chunks() -> list:
        with open(KB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)

    def _embed(self, texts: list, task_type: str) -> np.ndarray:
        """task_type is 'RETRIEVAL_DOCUMENT' when embedding the knowledge
        base chunks, or 'RETRIEVAL_QUERY' when embedding a user question.
        Gemini's embedding model uses this to optimize each side of the
        retrieval pair differently, which measurably improves match
        quality over embedding both the same way."""
        result = self.client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=texts,
            config={"task_type": task_type},
        )
        return np.array([e.values for e in result.embeddings], dtype="float32")

    def build_index(self, force_rebuild: bool = False):
        """Embeds every chunk in the knowledge base and builds a FAISS
        index. Saves both to disk so this doesn't need to re-run (and
        re-spend API calls) every time the bot starts up."""
        if not force_rebuild and os.path.exists(INDEX_PATH) and os.path.exists(METADATA_PATH):
            self.index = faiss.read_index(INDEX_PATH)
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                self.chunks = json.load(f)
            return

        texts = [f"{c['topic']}: {c['text']}" for c in self.chunks]
        embeddings = self._embed(texts, task_type="RETRIEVAL_DOCUMENT")

        # Normalize for cosine similarity via inner product
        faiss.normalize_L2(embeddings)
        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(embeddings)

        self.index = index
        faiss.write_index(index, INDEX_PATH)
        with open(METADATA_PATH, "w", encoding="utf-8") as f:
            json.dump(self.chunks, f, ensure_ascii=False, indent=2)

        print(f"Indexed {len(self.chunks)} chunks -> {INDEX_PATH}")

    def retrieve(self, query: str, top_k: int = 3) -> list:
        """Returns the top_k most relevant knowledge base chunks for the
        query, each as a dict with 'topic', 'text', and 'score'."""
        if self.index is None:
            self.build_index()

        query_embedding = self._embed([query], task_type="RETRIEVAL_QUERY")
        faiss.normalize_L2(query_embedding)

        scores, indices = self.index.search(query_embedding, top_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            chunk = self.chunks[idx]
            results.append({
                "topic": chunk["topic"],
                "text": chunk["text"],
                "score": float(score),
            })
        return results


if __name__ == "__main__":
    kb = OnionKnowledgeBase()
    kb.build_index()

    test_queries = [
        "why do my onions rot during storage",
        "what onion variety should I grow",
        "why do I cry when cutting onions",
    ]
    for q in test_queries:
        print(f"\nQuery: {q}")
        for r in kb.retrieve(q, top_k=2):
            print(f"  [{r['score']:.3f}] {r['topic']}")
