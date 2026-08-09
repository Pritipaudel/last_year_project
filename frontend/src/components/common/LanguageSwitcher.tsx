import { useState, useEffect } from "react";
import { Globe, Check } from "lucide-react";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const [currentLang, setCurrentLang] = useState<'en' | 'ne'>('en');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check saved preference or existing googtrans cookie
    const saved = localStorage.getItem('preferred_language') as 'en' | 'ne' | null;
    const cookieMatch = document.cookie.match(/googtrans=\/en\/(en|ne)/);
    const lang = saved || (cookieMatch ? (cookieMatch[1] as 'en' | 'ne') : 'en');
    setCurrentLang(lang);

    // Continuously enforce hiding the Google Translate top banner
    const cleanBanner = () => {
      if (document.body.style.top !== '0px') {
        document.body.style.top = '0px';
      }
      const bannerFrames = document.querySelectorAll('.goog-te-banner-frame, iframe[class*="goog-te-banner-frame"]');
      bannerFrames.forEach((frame) => {
        (frame as HTMLElement).style.display = 'none';
        (frame as HTMLElement).style.visibility = 'hidden';
      });
    };

    cleanBanner();
    const interval = setInterval(cleanBanner, 400);
    return () => clearInterval(interval);
  }, []);

  const switchLanguage = (lang: 'en' | 'ne') => {
    setCurrentLang(lang);
    setIsOpen(false);
    localStorage.setItem('preferred_language', lang);

    // Set Google Translate cookies for current hostname & root domain
    const hostname = window.location.hostname;
    document.cookie = `googtrans=/en/${lang}; path=/; domain=${hostname}`;
    document.cookie = `googtrans=/en/${lang}; path=/`;

    // Try setting select element if Google Translate widget is initialized in DOM
    const selectEl = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (selectEl) {
      selectEl.value = lang;
      selectEl.dispatchEvent(new Event('change'));
    } else {
      // Reload page to apply google translate cookie
      window.location.reload();
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-card)] bg-white/90 dark:bg-slate-800/90 text-xs font-bold text-[var(--text-main)] shadow-sm hover:bg-[var(--accent-surface)] transition-all cursor-pointer"
        aria-label="Switch Language"
      >
        <Globe className="h-3.5 w-3.5 text-[var(--primary-solid)]" />
        <span>{currentLang === 'en' ? 'ENG' : 'नेपाली'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border-card)] shadow-lg py-1 z-50 animate-in fade-in zoom-in-95">
          <button
            onClick={() => switchLanguage('en')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between hover:bg-[var(--accent-surface)] transition-colors ${currentLang === 'en' ? 'text-[var(--primary-solid)] font-bold' : 'text-[var(--text-main)]'}`}
          >
            <span className="flex items-center gap-1.5">🇬🇧 English</span>
            {currentLang === 'en' && <Check className="h-3.5 w-3.5 text-[var(--primary-solid)]" />}
          </button>
          <button
            onClick={() => switchLanguage('ne')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between hover:bg-[var(--accent-surface)] transition-colors ${currentLang === 'ne' ? 'text-[var(--primary-solid)] font-bold' : 'text-[var(--text-main)]'}`}
          >
            <span className="flex items-center gap-1.5">🇳🇵 नेपाली</span>
            {currentLang === 'ne' && <Check className="h-3.5 w-3.5 text-[var(--primary-solid)]" />}
          </button>
        </div>
      )}
    </div>
  );
}
