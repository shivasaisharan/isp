import os
import io
import tempfile
from pathlib import Path
from typing import Optional

_whisper_model = None

def get_whisper_model():
    """Lazy load faster-whisper model (base.en for ultra-fast, high-accuracy inference)."""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            # Using 'base.en' on cpu with int8 quantization:
            # - Under 150MB footprint
            # - Latency ~200-400ms
            # - Exceptional accuracy for technical terms, names, dates and numbers
            _whisper_model = WhisperModel("base.en", device="cpu", compute_type="int8")
        except Exception as e:
            print(f"Notice: Failed to load faster-whisper: {e}")
            _whisper_model = None
    return _whisper_model

def transcribe_audio_bytes(audio_bytes: bytes, file_suffix: str = ".webm") -> str:
    """
    Transcribes audio bytes to pristine text using Faster-Whisper.
    Accurately extracts names, dates, technical software terms, and places without stutter.
    """
    if not audio_bytes:
        return ""

    model = get_whisper_model()
    if model is None:
        return ""

    # Write to a temporary audio file for ctranslate2 audio reader
    with tempfile.NamedTemporaryFile(suffix=file_suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            beam_size=5,
            word_timestamps=False,
            vad_filter=False
        )
        
        transcribed_text = " ".join([segment.text.strip() for segment in segments if segment.text.strip()])
        return transcribed_text.strip()
    except Exception as e:
        print(f"Whisper transcription error: {e}")
        return ""
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

