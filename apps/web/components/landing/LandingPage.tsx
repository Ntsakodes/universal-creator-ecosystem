import { ButtonLink } from '../ui/ButtonLink';
import styles from './LandingPage.module.css';

const features = [
  { kind: 'record', title: 'Universal IP Vault', description: 'Keep original work, immutable versions and supporting evidence together. Record authorship and rights claims with a clear history.' },
  { kind: 'knowledge', title: 'Academic Network', description: 'Connect with researchers and request reviews of specific claims, with sources, context and clear limitations.' },
  { kind: 'studio', title: 'Creative Workspace', description: 'Bring ideas into focus. Organise projects, choose your collaborators and develop your work across creative disciplines.' },
] as const;

function FeatureIcon({ kind }: { kind: typeof features[number]['kind'] }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
    {kind === 'record' && <><path d="M16 3 26 7v9c0 6-10 13-10 13S6 22 6 16V7L16 3Z" /><path d="m11 16 3 3 7-7" /></>}
    {kind === 'knowledge' && <><path d="m3 11 13-7 13 7-13 7L3 11Z" /><path d="M8 14v9c5 4 11 4 16 0v-9M29 11v12" /></>}
    {kind === 'studio' && <><rect x="4" y="4" width="24" height="24" rx="3" /><path d="M4 12h24M13 12v16M9 8h.01M13 8h.01" /></>}
  </svg>;
}

export function LandingPage() {
  return <div className={styles.page}>
    <a className="skip-link" href="#landing-content">Skip to content</a>
    <header className={styles.header}>
      <nav className={styles.headerInner} aria-label="Main navigation">
        <a className={styles.brand} href="/" aria-label="UCE — Universal Creator Ecosystem home">
          <svg className={styles.brandMark} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
            <rect width="40" height="40" rx="9" fill="currentColor" />
            <g stroke="var(--africo-on-primary)" strokeWidth="1.5" fill="var(--africo-on-primary)">
              <path d="m20 11-8 9 8 9 8-9-8-9v18M12 20h16" />
              <circle cx="20" cy="11" r="2.5" /><circle cx="12" cy="20" r="2.5" />
              <circle cx="28" cy="20" r="2.5" /><circle cx="20" cy="29" r="2.5" />
            </g>
          </svg>
          <span>UCE</span>
        </a>
        <div className={styles.headerActions}>
          <a className={styles.signIn} href="/api/v1/auth/login">Sign in</a>
          <ButtonLink href="/api/v1/auth/register">Create account</ButtonLink>
        </div>
      </nav>
    </header>

    <main id="landing-content" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroTexture} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.kicker}>A home for African creativity</p>
          <h1 id="landing-title">Own your narrative.<br />Document your work.</h1>
          <p className={styles.lede}>Bring your creative projects, original work and trusted knowledge into one connected workspace.</p>
          <div className={styles.heroActions}>
            <ButtonLink href="/api/v1/auth/register">Get started <span aria-hidden="true">↗</span></ButtonLink>
            <ButtonLink variant="secondary" href="/workspace">Open workspace <span aria-hidden="true">→</span></ButtonLink>
          </div>
          <p className={styles.heroNote}>One identity. Every creative discipline.</p>
        </div>
      </section>

      <section className={styles.foundations} aria-labelledby="foundations-title">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Create · Document · Connect</p>
          <h2 id="foundations-title">A unified creative infrastructure.</h2>
          <p>Three connected foundations for the people behind the work.</p>
        </div>
        <div className={styles.featureGrid}>
          {features.map(feature => <article className={`panel uce-card ${styles.feature}`} key={feature.kind}>
            <FeatureIcon kind={feature.kind} />
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>)}
        </div>
      </section>

      <section className={styles.connection} aria-labelledby="connection-title">
        <div className={styles.connectionInner}>
          <div className={styles.connectionCopy}>
            <p className={styles.eyebrow}>From possibility to practice</p>
            <h2 id="connection-title">Give your next idea<br />a place to grow.</h2>
            <p>A first manuscript. A documentary in development. A story taking a new form. Keep the process connected, with your creative authority at the centre.</p>
            <ul>
              <li>Projects with collaborators you choose</li>
              <li>Version history and recorded contributions</li>
              <li>Research with context and clear limitations</li>
            </ul>
            <ButtonLink variant="secondary" href="/workspace">Explore your workspace <span aria-hidden="true">→</span></ButtonLink>
          </div>
          <figure className={styles.notebook}>
            <div className={styles.notebookTop}><span>UCE / The creative process</span><span aria-hidden="true">✳</span></div>
            <ol>
              <li><span aria-hidden="true">01</span><div><strong>An original idea.</strong><p>Start with what only you can bring.</p></div></li>
              <li><span aria-hidden="true">02</span><div><strong>Room to develop.</strong><p>Make, revise and build with others.</p></div></li>
              <li><span aria-hidden="true">03</span><div><strong>A documented history.</strong><p>Keep the story of your work.</p></div></li>
            </ol>
            <figcaption>Every work starts somewhere.</figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="closing-title">
        <p className={styles.eyebrow}>Your next chapter starts here</p>
        <h2 id="closing-title">Make room for your<br />next original work.</h2>
        <ButtonLink href="/api/v1/auth/register" className={styles.closingButton}>Create your account <span aria-hidden="true">↗</span></ButtonLink>
        <p>Already part of UCE? <a href="/api/v1/auth/login">Sign in</a></p>
      </section>
    </main>

    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <p className={styles.footerBrand}>UCE <span>Universal Creator Ecosystem</span></p>
        <span className={styles.pilot}>Foundation pilot</span>
      </div>
      <p className={styles.disclaimer}>IP evidence supports documentation. Timestamps, hashes and recorded claims do not establish copyright ownership or legal registration.</p>
      <div className={styles.disclosures} aria-label="Pilot privacy and use information">
        <details><summary>Privacy in this pilot</summary><p>You choose whether to publish your creator profile. Publishing a project summary does not publish its vault files. Access to project material follows the permissions granted to collaborators.</p></details>
        <details><summary>Pilot terms &amp; IP evidence</summary><p>Recording a claim does not transfer rights or certify ownership. Expert reviews apply to the specific material and scope reviewed. Community funding records non-binding interest only; no payments are collected. These pilot disclosures are not a complete privacy policy or terms of use.</p></details>
      </div>
      <div className={styles.footerBottom}><span>© {new Date().getUTCFullYear()} Universal Creator Ecosystem</span><span>Created for the people behind the work.</span></div>
    </footer>
  </div>;
}
