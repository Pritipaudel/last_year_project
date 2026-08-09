"""
Domain constants for the exercise app.

Currently holds the configuration for the WiseYak TTS service used to
pre-render voice cue audio (see management/commands/seed_voice_cue_audio.py).
Deployment-configurable values are read from the environment so that the
service host can differ between dev, staging, and production.
"""

import os
from enum import StrEnum


class TTSModel(StrEnum):
    """TTS engines supported by the WiseYak TTS service."""

    CHATTERBOX = "chatterbox_tts"
    XTTS_V2 = "xtts_v2"
    PARLER = "parler_tts"


class TTSOutputType(StrEnum):
    """Response mode of /generate_from_text.

    AUDIO streams the wav bytes back directly; URL queues an async job and
    returns a MinIO object path instead. Seeding uses AUDIO.
    """

    AUDIO = "audio"
    URL = "url"


TTS_BASE_URL = os.environ.get("TTS_BASE_URL", "https://dev-tts.wiseai.wiseyak.com")
TTS_GENERATE_PATH = "/generate_from_text"

TTS_LANGUAGE = "en"
TTS_MODEL = TTSModel.CHATTERBOX
TTS_REFERENCE_AUDIO_ID = "Prakash_0"
TTS_AUDIO_SPEED = 1.0
TTS_TARGET_SAMPLE_RATE = 24000

TTS_REQUEST_TIMEOUT_SECONDS = 120
TTS_MAX_ATTEMPTS = 3
TTS_RETRY_BACKOFF_SECONDS = 2.0

VOICE_CUE_AUDIO_SUBDIR = "voice_cues"
VOICE_CUE_AUDIO_EXTENSION = ".wav"
VOICE_CUE_CACHE_KEY_LENGTH = 16
