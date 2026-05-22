import type { AppInfo } from "../types";

interface HeroProps {
  appInfo: AppInfo | null;
  summary: string;
  errorMessage: string | null;
}

export function Hero({ appInfo, summary, errorMessage }: HeroProps) {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Sharpify</p>
        <h1>Batch image compression without leaving the desktop.</h1>
        <p className="lede">
          Drop files, set a few real options, and export optimized images to a folder you control.
        </p>
      </div>
      <div className="hero-card">
        <span>{appInfo ? `${appInfo.platform} • ${appInfo.processorMode}` : "Loading runtime"}</span>
        <strong>{summary}</strong>
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
