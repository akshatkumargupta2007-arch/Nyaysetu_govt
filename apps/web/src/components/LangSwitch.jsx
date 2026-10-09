import React from 'react';
import { useI18n } from '../i18n/index.jsx';

export default function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="langsw" role="group" aria-label="Language">
      <button type="button" aria-pressed={lang === 'hi'} onClick={() => setLang('hi')} lang="hi">हिं</button>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
    </div>
  );
}
