import sharpifyLogo from "../../src-tauri/icons/128x128.png";

interface HeroProps {
  errorMessage: string | null;
}

export function Hero({ errorMessage }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <img className="hero-logo" src={sharpifyLogo} alt="Sharpify" />
        <div className="hero-heading">
          <h1>Batch image compression</h1>
          <p className="lede">Queue files, choose output settings, and export optimized images.</p>
        </div>
      </div>
      {errorMessage ? (
        <div className="hero-meta" aria-live="polite">
          <p className="hero-status error">{errorMessage}</p>
        </div>
      ) : null}
    </section>
  );
}
