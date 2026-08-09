"""
management/commands/seed_voice_cue_audio.py

Pre-renders every string in Exercise.voice_cues to a wav file using the WiseYak
TTS service and records the resulting media URLs in Exercise.voice_cue_audio.

The frontend plays the pre-rendered clip when one exists for a cue and falls
back to live Web Speech synthesis when it does not, so this command is purely
additive: skipping it leaves the app working on synthesis alone.

Clips are content-addressed by a hash of the cue text plus the voice parameters,
so identical cue text shared across age bands or exercises is synthesised once
and reused. An existing file on disk is treated as a cache hit and is not
re-requested unless --force is given.

Usage:
    python manage.py seed_voice_cue_audio
    python manage.py seed_voice_cue_audio --exercise "Dumbbell Bicep Curl"
    python manage.py seed_voice_cue_audio --force   # re-synthesise, ignore cache
"""

import hashlib
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from exercise.constants import (
    TTS_AUDIO_SPEED,
    TTS_BASE_URL,
    TTS_GENERATE_PATH,
    TTS_LANGUAGE,
    TTS_MAX_ATTEMPTS,
    TTS_MODEL,
    TTS_REFERENCE_AUDIO_ID,
    TTS_REQUEST_TIMEOUT_SECONDS,
    TTS_RETRY_BACKOFF_SECONDS,
    TTS_TARGET_SAMPLE_RATE,
    TTSOutputType,
    VOICE_CUE_AUDIO_EXTENSION,
    VOICE_CUE_AUDIO_SUBDIR,
    VOICE_CUE_CACHE_KEY_LENGTH,
)
from exercise.models import Exercise


@dataclass(frozen=True)
class VoiceProfile:
    """Voice parameters that, together with the cue text, identify a clip.

    Any change to these fields changes the cache key, so a new voice or speed
    produces new files instead of silently reusing the old ones.
    """

    language: str = TTS_LANGUAGE
    model: str = str(TTS_MODEL)
    reference_audio_id: str = TTS_REFERENCE_AUDIO_ID
    audio_speed: float = TTS_AUDIO_SPEED
    target_sample_rate: int = TTS_TARGET_SAMPLE_RATE


@dataclass(frozen=True)
class CueRef:
    """A single cue awaiting synthesis, located by exercise, age band, and error key."""

    exercise_name: str
    band: str
    cue_key: str
    text: str


def _cache_key(text: str, profile: VoiceProfile) -> str:
    """Return the content-addressed stem for a clip.

    Inputs: cue text and the voice parameters it will be rendered with.
    Output: a short hex digest used as the wav filename stem.
    """
    return hashlib.sha256(
        "|".join(
            (
                text,
                profile.language,
                profile.model,
                profile.reference_audio_id,
                str(profile.audio_speed),
                str(profile.target_sample_rate),
            )
        ).encode("utf-8")
    ).hexdigest()[:VOICE_CUE_CACHE_KEY_LENGTH]


def _synthesize_gtts(text: str) -> bytes:
    import io
    from gtts import gTTS
    fp = io.BytesIO()
    tts = gTTS(text=text, lang="en")
    tts.write_to_fp(fp)
    return fp.getvalue()


def _synthesize(text: str, profile: VoiceProfile) -> bytes:
    """Call the TTS service and return raw audio bytes.

    Inputs: the cue text and the voice profile to render it with.
    Output: audio bytes.
    Retries transient failures with WiseYak, falling back to gTTS if unreachable.
    """
    payload = urllib.parse.urlencode(
        {
            "text": text,
            "language": profile.language,
            "output_type": str(TTSOutputType.AUDIO),
            "audio_speed": profile.audio_speed,
            "reference_audio_id": profile.reference_audio_id,
            "target_sample_rate": profile.target_sample_rate,
            "model": profile.model,
        }
    ).encode("utf-8")

    last_error: Exception | None = None
    for attempt in range(1, TTS_MAX_ATTEMPTS + 1):
        try:
            request = urllib.request.Request(
                f"{TTS_BASE_URL}{TTS_GENERATE_PATH}",
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=3) as response:
                return response.read()
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
            last_error = exc

    try:
        return _synthesize_gtts(text)
    except Exception as exc:
        raise CommandError(f"TTS failed after {TTS_MAX_ATTEMPTS} attempts for {text!r}: {last_error}") from exc



def _collect_cues(exercises: list[Exercise]) -> tuple[CueRef, ...]:
    """Flatten the nested voice_cues structure into a tuple of cue references.

    Inputs: the exercises to seed audio for.
    Output: one CueRef per non-empty cue string across every age band.
    """
    return tuple(
        CueRef(exercise.name, band, cue_key, text)
        for exercise in exercises
        for band, band_cues in exercise.voice_cues.items()
        for cue_key, text in band_cues.items()
        if isinstance(text, str) and text.strip()
    )


class Command(BaseCommand):
    help = "Pre-renders Exercise.voice_cues to wav files via the TTS service and stores their URLs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--exercise",
            dest="exercise_name",
            help="Only seed audio for the exercise with this exact name.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-synthesise every cue even if a cached wav already exists on disk.",
        )

    def handle(self, *args, **options):
        profile = VoiceProfile()
        output_dir = Path(settings.MEDIA_ROOT) / VOICE_CUE_AUDIO_SUBDIR
        output_dir.mkdir(parents=True, exist_ok=True)

        exercises = list(
            Exercise.objects.filter(name=options["exercise_name"])
            if options["exercise_name"]
            else Exercise.objects.all()
        )
        if not exercises:
            raise CommandError("No matching exercises found — run seed_exercises first.")

        cues = _collect_cues(exercises)
        self.stdout.write(f"Rendering {len(cues)} cues from {len(exercises)} exercise(s) via {TTS_BASE_URL}")

        urls_by_exercise: dict[str, dict[str, dict[str, str]]] = {}
        synthesized = 0
        cached = 0

        for cue in cues:
            destination = output_dir / f"{_cache_key(cue.text, profile)}{VOICE_CUE_AUDIO_EXTENSION}"
            if destination.exists() and not options["force"]:
                cached += 1
            else:
                destination.write_bytes(_synthesize(cue.text, profile))
                synthesized += 1
                self.stdout.write(f"  {cue.exercise_name} [{cue.band}] {cue.cue_key} -> {destination.name}")

            urls_by_exercise.setdefault(cue.exercise_name, {}).setdefault(cue.band, {})[cue.cue_key] = (
                f"{settings.MEDIA_URL}{VOICE_CUE_AUDIO_SUBDIR}/{destination.name}"
            )

        for exercise in exercises:
            exercise.voice_cue_audio = urls_by_exercise.get(exercise.name, {})
            exercise.save(update_fields=["voice_cue_audio"])
            self.stdout.write(self.style.SUCCESS(f"  Updated: {exercise.name}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. {synthesized} synthesised, {cached} reused from cache."
            )
        )
