# OnioRakshak Chatbot Module

A retrieval-augmented (RAG) chatbot that answers onion-related questions — storage, curing, diseases/pests, spoilage causes, Indian varieties, market dynamics, nutrition, and cooking — grounded in a curated knowledge base rather than relying purely on the LLM's general knowledge.

## How it works

1. **Knowledge base** (`onion_knowledge_base.json`) — a set of curated reference passages covering onion storage, disease, market, and nutrition topics, plus background on the OnioRakshak project itself.
2. **Embedding + retrieval** (`rag_pipeline.py`) — each knowledge base chunk is embedded using Google's Gemini embedding model, then indexed with **FAISS** for fast similarity search. At query time, the top-matching chunks are retrieved and only used if their similarity score clears a relevance threshold (0.5), so irrelevant chunks aren't forced into the prompt.
3. **Question answering** (`onion_qa_bot.py`) — retrieves relevant chunks, injects them as reference material into the prompt to Gemini, and falls back to general knowledge when nothing in the knowledge base is relevant. Includes a rule-based fast path, domain restriction (declines off-topic questions), and multilingual support (English/Hindi/Marathi).

## Files

| File | Purpose |
|---|---|
| `onion_knowledge_base.json` | Curated reference passages used for retrieval |
| `rag_pipeline.py` | Embeds and indexes the knowledge base, handles retrieval |
| `onion_qa_bot.py` | Main chatbot logic — RAG-grounded Q&A, domain restriction, multilingual handling |
| `requirements.txt` | Python dependencies for this module |
| `04_rag_knowledge_base.ipynb` | Builds the FAISS index, tests retrieval against sample queries, verifies the relevance threshold filters weak matches |
| `05_chatbot_testing.ipynb` | End-to-end tests: rule-based fast path, RAG-grounded answers, domain restriction, multilingual output, voice output |

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Add your Gemini API key to a `.env` file in `ml/`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Build the knowledge base index:
   ```bash
   python rag_pipeline.py
   ```
4. Run the notebooks top-to-bottom to verify retrieval quality and end-to-end behavior before relying on this module elsewhere in the app.

## Notes

- Embeddings use Gemini's embedding API (`gemini-embedding-001`) rather than a local model, to avoid the heavy `torch`/`transformers` dependency chain.
- The notebooks are unexecuted as of this writing — run them locally with a valid API key and confirm outputs (especially Hindi/Marathi responses and off-topic-question handling) before committing.
