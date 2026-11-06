const services = [
  {
    number: "01",
    title: "Shopify & storefronts",
    description: "Product pages, collections, navigation and storefront improvements that make an online shop easier to use and manage.",
    tags: ["Shopify", "Storefront UX", "Site merchandising"],
  },
  {
    number: "02",
    title: "Catalogues & product data",
    description: "Product imports, SKU structures, pricing, categorisation and large catalogue clean-up for growing retail businesses.",
    tags: ["Product data", "CSV workflows", "Catalogue operations"],
  },
  {
    number: "03",
    title: "E-commerce operations",
    description: "Practical improvements to the systems and processes behind a store, from multi-channel workflows to repeatable tasks.",
    tags: ["Process improvement", "Integrations", "Automation"],
  },
  {
    number: "04",
    title: "Digital marketing & growth",
    description: "Campaign planning, merchandising, email marketing and the day-to-day commercial work of running an online business.",
    tags: ["Campaigns", "Email", "Retail marketing"],
  },
];

const projects = [
  {
    number: "01",
    name: "LoftyCards",
    category: "Retail · Shopify · E-commerce",
    heading: "Building and operating an independent online retailer.",
    description: "A working e-commerce business covering storefront management, an extensive trading-card catalogue, pricing, promotions and multi-channel retail operations.",
    skills: ["Shopify", "Merchandising", "Retail operations"],
    url: "https://loftycards.co.uk",
    action: "Explore the store",
    initials: "LC",
  },
  {
    number: "02",
    name: "LOPT",
    category: "SaaS · Product · Retail technology",
    heading: "Making complex product operations more manageable.",
    description: "An evolving e-commerce management platform focused on catalogue workflows, Shopify connections, product synchronisation and automated retail operations.",
    skills: ["Product design", "Catalogue systems", "Integrations"],
    url: "https://getlopt.com",
    action: "Explore LOPT",
    initials: "LO",
  },
];

export function HomePage() {
  return (
    <div className="rf-site">
      <a className="rf-skip" href="#main">Skip to content</a>
      <header className="rf-header">
        <div className="rf-container rf-header-inner">
          <a href="#top" className="rf-brand" aria-label="Ryan Fitter, back to top">ryan<span>fitter.</span></a>
          <nav className="rf-nav" aria-label="Main navigation">
            <a href="#work">Work</a>
            <a href="#services">Services</a>
            <a href="#about">About</a>
            <a className="rf-nav-contact" href="#contact">Contact <span aria-hidden="true">↗</span></a>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="rf-hero" id="top" aria-labelledby="hero-title">
          <div className="rf-container rf-hero-grid">
            <div className="rf-hero-copy">
              <p className="rf-kicker"><span className="rf-status-dot" aria-hidden="true" /> Independent e-commerce specialist · UK / Remote</p>
              <h1 id="hero-title">Making online retail <span>work better.</span></h1>
              <p className="rf-lede">I'm Ryan — I work across Shopify, e-commerce operations, product data and digital marketing. I combine first-hand retail experience with a practical understanding of the systems behind an online store.</p>
              <div className="rf-actions">
                <a href="#work" className="rf-button rf-button-primary">Explore my work <span aria-hidden="true">↗</span></a>
                <a href="#services" className="rf-button rf-button-quiet">How I can help <span aria-hidden="true">↓</span></a>
              </div>
            </div>
            <aside className="rf-hero-aside" aria-label="My focus">
              <span className="rf-aside-label">THE WORK I DO</span>
              <div className="rf-aside-line"><span>01</span><strong>Storefront experience</strong></div>
              <div className="rf-aside-line"><span>02</span><strong>Product & catalogue operations</strong></div>
              <div className="rf-aside-line"><span>03</span><strong>Commerce tools & workflows</strong></div>
              <div className="rf-aside-line"><span>04</span><strong>Commercial growth</strong></div>
              <p>Hands-on, commercially minded and focused on what makes a real retail business tick.</p>
            </aside>
          </div>
        </section>

        <section id="work" className="rf-section rf-work" aria-labelledby="work-title">
          <div className="rf-container">
            <div className="rf-section-heading">
              <div>
                <p className="rf-section-label">01 / SELECTED WORK</p>
                <h2 id="work-title">Built around real businesses.</h2>
              </div>
              <p>Two ongoing projects that bring together retail, technology and day-to-day e-commerce problem solving. Detailed case studies and original screenshots will follow.</p>
            </div>
            <div className="rf-project-grid">
              {projects.map((project) => (
                <article className="rf-project" key={project.name}>
                  <div className="rf-project-graphic" aria-hidden="true">
                    <span className="rf-project-monogram">{project.initials}</span>
                    <span className="rf-project-index">PROJECT / {project.number}</span>
                  </div>
                  <div className="rf-project-content">
                    <p className="rf-project-category">{project.category}</p>
                    <h3>{project.name}</h3>
                    <p className="rf-project-heading">{project.heading}</p>
                    <p>{project.description}</p>
                    <div className="rf-tag-list">
                      {project.skills.map((skill) => <span key={skill}>{skill}</span>)}
                    </div>
                    <a className="rf-text-link" href={project.url} target="_blank" rel="noopener noreferrer">{project.action} <span aria-hidden="true">↗</span></a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rf-section rf-services" id="services" aria-labelledby="services-title">
          <div className="rf-container">
            <div className="rf-section-heading">
              <div>
                <p className="rf-section-label">02 / HOW I CAN HELP</p>
                <h2 id="services-title">Practical help for online retailers.</h2>
              </div>
              <p>Whether it's a defined Shopify project or additional hands on an existing e-commerce team, the focus is on work that has a tangible purpose.</p>
            </div>
            <div className="rf-services-grid">
              {services.map((service) => (
                <article className="rf-service" key={service.number}>
                  <span className="rf-service-number">{service.number} /</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <div className="rf-service-tags">{service.tags.join(" · ")}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rf-section rf-about" id="about" aria-labelledby="about-title">
          <div className="rf-container rf-about-grid">
            <div>
              <p className="rf-section-label">03 / A LITTLE ABOUT ME</p>
              <h2 id="about-title">I don't just work on online stores. I run one.</h2>
            </div>
            <div className="rf-about-copy">
              <p>I've worked across e-commerce, digital marketing and sales, and I now bring that experience into my own retail and software projects.</p>
              <p>Running LoftyCards means working with the real-world details: product information, inventory, promotions, customer experience and the constant need to make better use of time.</p>
              <p>Building LOPT adds another perspective — looking at the systems and workflows that help retailers operate more effectively.</p>
              <p className="rf-about-note">More professional background, previous roles and project results will be added from my CV and verified work samples.</p>
            </div>
          </div>
        </section>

        <section className="rf-section rf-contact" id="contact" aria-labelledby="contact-title">
          <div className="rf-container rf-contact-grid">
            <div>
              <p className="rf-section-label">04 / LET'S TALK</p>
              <h2 id="contact-title">Have an e-commerce project in mind?</h2>
              <p>I'm putting together my freelance portfolio and would be interested in speaking with retailers and agencies about Shopify, catalogue work and digital operations.</p>
            </div>
            <div className="rf-contact-panel">
              <span>CONTACT</span>
              <p>Professional contact details and a project enquiry link will be added before the site goes live.</p>
              <a href="https://github.com/Ryaaaaaan" target="_blank" rel="noopener noreferrer">View GitHub profile <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="rf-footer">
        <div className="rf-container rf-footer-inner">
          <a className="rf-brand" href="#top">ryan<span>fitter.</span></a>
          <span>E-commerce · Shopify · Digital operations</span>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}
