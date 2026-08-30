import {
  LANDING_BITCOINER_BULLETS,
  LANDING_BITCOINER_TITLE,
  LANDING_CLOSER,
  LANDING_DEGEN_BULLETS,
  LANDING_DEGEN_TITLE,
  LANDING_DOOR_ADDRESS,
  LANDING_DOOR_NEED_XCP,
  LANDING_FACTS,
  LANDING_FOOTER,
  LANDING_HEADLINE,
  LANDING_LOAD,
  LANDING_PLACEHOLDER,
  LANDING_SUBHEAD,
  LANDING_XCP_DEX_LABEL,
  LANDING_XCP_DEX_URL,
  LANDING_XCP_FUN_LABEL,
  LANDING_XCP_FUN_URL,
} from "../lib/landingCopy";

export function Landing({
  input,
  error,
  onChange,
  onLoad,
}: {
  input: string;
  error: string | null;
  onChange: (value: string) => void;
  onLoad: () => void;
}) {
  return (
    <div className="landing">
      <div className="landing-brand">XCP Book</div>
      <h1>{LANDING_HEADLINE}</h1>
      <p className="landing-subhead">{LANDING_SUBHEAD}</p>

      <div className="landing-panels">
        <section className="panel landing-panel">
          <h2>{LANDING_BITCOINER_TITLE}</h2>
          <ul>
            {LANDING_BITCOINER_BULLETS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section className="panel landing-panel">
          <h2>{LANDING_DEGEN_TITLE}</h2>
          <ul>
            {LANDING_DEGEN_BULLETS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>

      <ul className="landing-facts">
        {LANDING_FACTS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <p className="landing-closer up">{LANDING_CLOSER}</p>

      <div className="landing-doors">
        <section className="panel landing-door">
          <h2>{LANDING_DOOR_ADDRESS}</h2>
          <div className="address-bar">
            <input
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onLoad()}
              placeholder={LANDING_PLACEHOLDER}
              spellCheck={false}
            />
            <button type="button" className="btn primary" onClick={onLoad}>
              {LANDING_LOAD}
            </button>
          </div>
          {error ? <div className="muted">{error}</div> : null}
        </section>
        <section className="panel landing-door">
          <h2>{LANDING_DOOR_NEED_XCP}</h2>
          <div className="landing-links">
            <a
              className="btn"
              href={LANDING_XCP_FUN_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {LANDING_XCP_FUN_LABEL}
            </a>
            <a
              className="btn"
              href={LANDING_XCP_DEX_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {LANDING_XCP_DEX_LABEL}
            </a>
          </div>
        </section>
      </div>

      <p className="landing-footer muted">{LANDING_FOOTER}</p>
    </div>
  );
}
