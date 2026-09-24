"""
OnioRakshak - Onion Q&A Chatbot (Gemini-powered, domain-restricted,
multilingual, voice-enabled, RAG-grounded)

Answers open-ended onion-related questions using the Gemini API, grounded
in a curated knowledge base via retrieval-augmented generation (RAG),
while declining anything unrelated to onions.

Multilingual: responds in whatever language the farmer asks in (English,
Hindi, Marathi, or others) — Gemini handles this natively; we just
instruct it to match the input language rather than always answering
in English.

Voice input: accepts an audio file directly and lets Gemini transcribe
+ answer in a single call, rather than running a separate speech-to-text
step.

Voice output: converts the text reply to speech via gTTS. Checked at
runtime against gTTS's actual supported-language list (not assumed) —
falls back to Hindi, then English, if the detected language isn't
available as a TTS voice.

Resilience: Gemini calls retry with exponential backoff (1s, 2s, 4s) on
transient errors (e.g. 503 "high demand"), since free-tier API access
can hit these fairly often.

Setup:
    1. Get a free API key at https://aistudio.google.com/apikey
    2. Set it in a .env file in this folder: GEMINI_API_KEY=your_key_here
    3. pip install -r requirements.txt

Usage (standalone text test):
    python onion_qa_bot.py

Usage (as a module):
    from onion_qa_bot import OnionQABot
    bot = OnionQABot()
    reply = bot.ask("कांदा जास्त काळ कसा साठवायचा?")          # text, any language
    reply = bot.ask_audio("farmer_question.wav")               # voice input
    audio_path = bot.speak(reply, lang_hint="mr")               # voice output
"""

import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types
from gtts import gTTS
from gtts.lang import tts_langs

from rag_pipeline import OnionKnowledgeBase

load_dotenv()  # reads .env in this folder if present; harmless if it doesn't exist

MODEL_NAME = "gemini-flash-lite-latest"

SYSTEM_INSTRUCTION = """\
You are the OnioRakshak onion assistant, used by farmers in Maharashtra,
India. You ONLY answer questions related to onions: onion farming/
cultivation, onion storage and post-harvest handling, onion varieties,
onion diseases/pests, onion market prices and trends, onion nutrition,
onion cooking/recipes, and onion-related science or history.

If a question is not about onions in some way, politely decline and steer
the conversation back, in the same language the user wrote in.

You will sometimes be given retrieved reference passages from a curated
onion knowledge base, labeled "Reference material". When reference
material is provided and relevant, ground your answer in it and prefer
it over your own general knowledge, since it reflects this project's
specific curated sources. If the reference material doesn't cover the
question, answer from your own general onion knowledge instead — don't
force an irrelevant reference into the answer.

IMPORTANT — language: Always reply in the SAME language the user's
message is written in. If they write in Marathi, reply in Marathi. If
Hindi, reply in Hindi. If English, reply in English. If a voice message
is in a mix of languages (code-switched, e.g. Hinglish), reply naturally
in that same mixed style rather than forcing pure English or pure Hindi.

Keep answers concise (2-4 sentences for simple questions, a short
paragraph for more involved ones) and practical, since many users are
farmers looking for actionable information, not academic detail.
"""

# gTTS language fallback chain: if the detected/requested language isn't
# a supported TTS voice, try the next one down this chain.
TTS_FALLBACK_CHAIN = ["mr", "hi", "en"]


class OnionQABot:
    def __init__(self, api_key: str = None, use_rag: bool = True):
        api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY not set. Get a free key at "
                "https://aistudio.google.com/apikey and put it in a "
                ".env file in this folder as GEMINI_API_KEY=your_key_here"
            )
        self.client = genai.Client(api_key=api_key)
        self._supported_tts_langs = tts_langs()  # checked once at startup, not assumed

        self.use_rag = use_rag
        self.knowledge_base = None
        if use_rag:
            self.knowledge_base = OnionKnowledgeBase(api_key=api_key)
            self.knowledge_base.build_index()  # loads from disk if already built

    def _build_prompt(self, user_message: str) -> str:
        """Builds the prompt, injecting retrieved reference material from
        the knowledge base when relevant chunks are found."""
        prompt = user_message
        if self.use_rag:
            retrieved = self.knowledge_base.retrieve(user_message, top_k=3)
            # Only use chunks that are actually relevant (similarity above
            # a floor) rather than always injecting the top-3 regardless
            # of how weak the match is.
            relevant = [r for r in retrieved if r["score"] >= 0.5]
            if relevant:
                reference_block = "\n\n".join(
                    f"[{r['topic']}]: {r['text']}" for r in relevant
                )
                prompt = (
                    f"Reference material:\n{reference_block}\n\n"
                    f"Question: {user_message}"
                )
        return prompt

    def ask(self, user_message: str, max_retries: int = 3) -> str:
        """Text-in, text-out. Responds in whatever language the message is
        in, grounded in retrieved knowledge base context when relevant.
        Retries with exponential backoff on transient Gemini errors."""
        prompt = self._build_prompt(user_message)

        for attempt in range(max_retries):
            try:
                response = self.client.models.generate_content(
                    model=MODEL_NAME,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.4,
                        max_output_tokens=300,
                    ),
                )
                return response.text.strip()
            except Exception:
                if attempt < max_retries - 1:
                    wait = 2 ** attempt  # 1s, then 2s
                    print(f"  (Gemini busy, retrying in {wait}s...)")
                    time.sleep(wait)
                else:
                    raise

    def ask_audio(self, audio_path: str, max_retries: int = 3) -> str:
        """Voice-in, text-out. Gemini transcribes and answers in one call,
        replying in whatever language the speaker used. Retries with
        exponential backoff on transient Gemini errors."""
        mime_type = self._guess_audio_mime_type(audio_path)
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        for attempt in range(max_retries):
            try:
                response = self.client.models.generate_content(
                    model=MODEL_NAME,
                    contents=[
                        types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                        "Answer the onion-related question asked in this audio clip.",
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.4,
                        max_output_tokens=300,
                    ),
                )
                return response.text.strip()
            except Exception:
                if attempt < max_retries - 1:
                    wait = 2 ** attempt
                    print(f"  (Gemini busy, retrying in {wait}s...)")
                    time.sleep(wait)
                else:
                    raise

    def speak(self, text: str, lang_hint: str = "en", output_path: str = "response.mp3") -> str:
        """Text-to-speech. lang_hint should be a language code ('en',
        'hi', 'mr', ...). Falls back down TTS_FALLBACK_CHAIN if lang_hint
        isn't an actual supported gTTS voice, rather than raising an
        error or silently producing English audio for a Marathi request.
        """
        lang_to_use = lang_hint if lang_hint in self._supported_tts_langs else None

        if lang_to_use is None:
            for fallback in TTS_FALLBACK_CHAIN:
                if fallback in self._supported_tts_langs:
                    lang_to_use = fallback
                    break
            else:
                raise RuntimeError("No supported TTS language available, including fallbacks.")

        tts = gTTS(text=text, lang=lang_to_use)
        tts.save(output_path)
        return output_path

    @staticmethod
    def _guess_audio_mime_type(path: str) -> str:
        ext = os.path.splitext(path)[1].lower()
        return {
            ".wav": "audio/wav",
            ".mp3": "audio/mp3",
            ".m4a": "audio/mp4",
            ".ogg": "audio/ogg",
            ".flac": "audio/flac",
        }.get(ext, "audio/wav")


def main():
    print("OnioRakshak Onion Assistant (Gemini-powered, multilingual). Type 'exit' to quit.\n")
    bot = OnionQABot()
    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in {"exit", "quit"}:
            print("Bot: Goodbye!")
            break
        try:
            print("Bot:", bot.ask(user_input))
        except Exception as e:
            print(f"Bot: (error reaching Gemini: {e})")


if __name__ == "__main__":
    main()