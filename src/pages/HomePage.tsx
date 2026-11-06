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
    category: "Independent retailer · Shopify · Ongoing",
    heading: "Owning the entire e-commerce operation, from storefront to stock.",
    description: "I founded and operate LoftyCards, an independent UK trading-card retailer. My work spans Shopify storefront design, product catalogue management, merchandising, pricing, promotions, marketing and selling through multiple channels.",
    skills: ["Shopify", "Product catalogues", "Merchandising", "Retail operations"],
    highlight: "Founder-led, live e-commerce business",
    url: "https://loftycards.co.uk",
    action: "Explore LoftyCards",
    initials: "LC",
  },
  {
    number: "02",
    name: "LoveGardening",
    category: "LBS Horticulture · Magento 2 · 2019–2021",
    heading: "Helping launch a new B2C e-commerce store from the ground up.",
    description: "During my time at LBS Horticulture, I worked as part of a four-person team launching the Magento 2-based LoveGardening B2C website. My wider role also involved managing the B2B e-commerce site.",
    skills: ["Magento 2", "B2C launch", "E-commerce operations", "B2B"],
    highlight: "£200k sales in the B2C site's first six months, as recorded in my CV",
    url: "https://www.lovegardening.com/",
    action: "Explore LoveGardening",
    initials: "LG",
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
              <p className="rf-lede">I'm Ryan — I work across Shopify, e-commerce operations, product data and digital marketing. I've worked with independent retailers and large product catalogues, and I bring that experience into my own live e-commerce business.</p>
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
              <p>A business I run today, alongside an earlier Magento launch I helped bring to market. Both reflect hands-on retail experience, not speculative concept work.</p>
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
                    <p className="rf-project-highlight">{project.highlight}</p>
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
              <p>I began my e-commerce career in 2018, working across product management, digital marketing, user experience and retail operations — from independent brands to large online catalogues.</p>
              <p>At Bensons for Beds, my e-commerce merchandising work covered the product lifecycle, pricing, promotions and enrichment across more than 25,000 SKUs, using tools including Akeneo PIM and BigCommerce.</p>
              <p>At Style Cafe, I managed two Shopify stores and worked on conversion optimisation and Google Ads. Earlier, I led a website redesign and worked on SEO and email performance at Lancashire Textiles.</p>
              <p>Today, running LoftyCards keeps me close to the practical challenges retailers face every day: accurate product data, inventory, customer experience, promotions and commercial growth.</p>
              <p className="rf-about-note">Experience includes Shopify, Magento 2, BigCommerce, Akeneo, Linnworks, Google Analytics, Google Ads and Excel. Historic project results are drawn from my CV; detailed case studies will use approved evidence and original screenshots.</p>
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
