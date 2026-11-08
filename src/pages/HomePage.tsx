import {PortfolioChrome} from "../components/PortfolioChrome";
import {projects, skills} from "../portfolioData";

export function HomePage(){
  return <PortfolioChrome>
    <main id="main">
      <section className="portfolio-hero portfolio-container">
        <div className="portfolio-hero-topline">
          <span className="portfolio-overline"><span className="portfolio-status-dot" aria-hidden="true"/> Open to remote opportunities & freelance projects</span>
          <span className="portfolio-hero-index">01 / INTRODUCTION</span>
        </div>
        <h1>Good e-commerce<br/><em>is in the details.</em></h1>
        <div className="portfolio-hero-bottom">
          <div className="portfolio-hero-intro">
            <p>Hi, I'm Ryan. I work across e-commerce, digital merchandising and marketing — making online stores easier to shop, manage and grow.</p>
            <span>UK based · 8+ years in online retail</span>
          </div>
          <div className="portfolio-actions">
            <a href="#work" className="portfolio-button portfolio-button-primary">Explore my work <span aria-hidden="true">↗</span></a>
            <a href="#contact" className="portfolio-button portfolio-button-outline">Work with me <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>

      <section className="portfolio-proof" aria-label="Experience at a glance">
        <div className="portfolio-container portfolio-proof-grid">
          <div><strong>25,000+</strong><span>SKUs merchandised at Bensons for Beds</span></div>
          <div><strong>8,000+</strong><span>products on LoftyCards at launch</span></div>
          <div><strong>£200k</strong><span>B2C launch revenue in six months — team result</span></div>
          <div><strong>8+ years</strong><span>across e-commerce and marketing</span></div>
        </div>
      </section>

      <section className="portfolio-section portfolio-container" id="work">
        <div className="portfolio-section-heading">
          <div><span className="portfolio-kicker">01 / SELECTED WORK</span><h2>Real work. Real retail.</h2></div>
          <p>From getting a new Shopify store off the ground to managing the details behind established e-commerce operations.</p>
        </div>
        <div className="portfolio-projects">
          {projects.map(project=><article className="portfolio-project" key={project.slug}>
            <div className="portfolio-project-top"><span>{project.number} / {project.descriptor}</span><span>{project.date}</span></div>
            <a className="portfolio-project-title" href={"/work/"+project.slug}><h3>{project.client}</h3><span aria-hidden="true">↗</span></a>
            <p>{project.title}</p>
            <div className="portfolio-project-end">
              <span>{project.facts[0].value} <small>{project.facts[0].label}</small></span>
              <a href={"/work/"+project.slug} aria-label={"Read the "+project.client+" case study"}>Case study <span aria-hidden="true">↗</span></a>
            </div>
          </article>)}
        </div>
        <p className="portfolio-work-caveat">Projects describe my contribution during the periods shown. Current websites may have evolved since then.</p>
      </section>

      <section className="portfolio-expertise" id="expertise">
        <div className="portfolio-container">
          <div className="portfolio-section-heading">
            <div><span className="portfolio-kicker">02 / WHAT I DO</span><h2>The operational side.<br/>The creative side.</h2></div>
            <p>I like the space between product data, commercial decisions and the customer experience — where small improvements make a noticeable difference.</p>
          </div>
          <div className="portfolio-expertise-grid">
            <div><span className="portfolio-expertise-num">01</span><h3>Online merchandising</h3><p>Product discovery, categories, search, promotions, pricing and the everyday details of a well-run storefront.</p></div>
            <div><span className="portfolio-expertise-num">02</span><h3>Catalogues & PIM</h3><p>Product enrichment, attributes, data quality and practical workflows for large, complex product ranges.</p></div>
            <div><span className="portfolio-expertise-num">03</span><h3>Growth & optimisation</h3><p>SEO, conversion-focused improvements, email, paid marketing and making sense of performance data.</p></div>
          </div>
          <div className="portfolio-skills" aria-label="Platforms and skills">{skills.map(skill=><span key={skill}>{skill}</span>)}</div>
        </div>
      </section>

      <section className="portfolio-section portfolio-container portfolio-about" id="about">
        <div><span className="portfolio-kicker">03 / A LITTLE ABOUT ME</span><h2>Hands-on by nature.</h2></div>
        <div className="portfolio-about-copy">
          <p>I started in e-commerce through an apprenticeship in 2018. Since then, I've worked with independent retailers and national businesses across Magento, Shopify, BigCommerce and product information systems.</p>
          <p>I've helped launch consumer stores, managed large retail catalogues and worked across digital marketing, merchandising and website operations. I now run my own online retail business, LoftyCards, alongside pursuing new opportunities.</p>
          <p>I'm interested in remote e-commerce roles and freelance projects where I can contribute practical experience and make things work better.</p>
          <a href="https://www.linkedin.com/in/ryaaan/" target="_blank" rel="noopener noreferrer" className="portfolio-text-link">Full career history on LinkedIn <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className="portfolio-contact" id="contact">
        <div className="portfolio-container portfolio-contact-inner">
          <span className="portfolio-kicker">04 / LET'S TALK</span>
          <h2>A project to improve?<br/><em>A role to fill?</em></h2>
          <div className="portfolio-contact-bottom">
            <p>Whether you're hiring or need a hand with your e-commerce operation, I'd be glad to hear about it.</p>
            <a className="portfolio-button portfolio-button-primary" href="mailto:ryan.fitter@outlook.com?subject=E-commerce%20enquiry">Get in touch <span aria-hidden="true">↗</span></a>
          </div>
          <a className="portfolio-contact-email" href="mailto:ryan.fitter@outlook.com">ryan.fitter@outlook.com</a>
        </div>
      </section>
    </main>
  </PortfolioChrome>;
}
