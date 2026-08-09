/**
 * Pre-rendered voice cue audio.
 *
 * The backend renders every cue string in `personalization.voice_cues` to a wav
 * file ahead of time (see backend `manage.py seed_voice_cue_audio`) and returns
 * the URLs in `personalization.voice_cue_audio`, keyed by the same error keys.
 *
 * Playback prefers these clips because they use the trained TTS voice and sound
 * identical on every device. Web Speech synthesis remains the fallback for any
 * cue that has not been seeded (or that is generated at runtime, such as rep
 * counts and tracking warnings).
 */

const MEDIA_API_SUFFIX = /\/api\/?$/;

/**
 * Resolve a backend-relative media path (e.g. "/media/voice_cues/x.wav") to a
 * URL the browser can load, based on the configured API base.
 *
 * A relative API base means the dev server proxies both /api and /media, so the
 * path is already correct. An absolute base is stripped of its /api suffix.
 */
export const resolveMediaUrl = (path: string): string => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "/api/";
  if (!/^https?:\/\//i.test(apiBase)) return path;
  return `${apiBase.replace(MEDIA_API_SUFFIX, "")}${path}`;
};

/**
 * Build a lookup from cue text to its pre-rendered clip URL.
 *
 * `voiceCues` and `voiceCueAudio` share their error-type keys, so matching them
 * up lets callers keep passing cue *text* around (as the tracking code already
 * does) without having to thread cue keys through every call site.
 */
export const buildCueAudioIndex = (
  voiceCues: Record<string, string> | undefined,
  voiceCueAudio: Record<string, string> | undefined,
): Record<string, string> => {
  if (!voiceCues || !voiceCueAudio) return {};
  return Object.fromEntries(
    Object.entries(voiceCues)
      .flatMap(([key, text]) => {
        const url = voiceCueAudio[key];
        if (!url || typeof text !== "string" || !text.trim()) return [];
        const resolved = resolveMediaUrl(url);
        return [[text, resolved] as const, [key, resolved] as const];
      }),
  );
};

/**
 * Get TTS audio URL for a given cue text or key.
 * Prefers pre-rendered clip from index, falls back to dynamic backend TTS endpoint.
 */
export const getTTSAudioUrl = (
  text: string,
  key?: string,
  index?: Record<string, string>
): string => {
  if (key && index && index[key]) return index[key];
  if (index && index[text]) return index[text];
  return resolveMediaUrl(`/api/exercises/tts/?text=${encodeURIComponent(text)}`);
};

/**
 * Warm the browser cache so the first cue of a session is not delayed by a
 * network round trip.
 */
export const preloadCueAudio = (index: Record<string, string>): void => {
  Object.values(index).forEach((url) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = url;
  });
};

