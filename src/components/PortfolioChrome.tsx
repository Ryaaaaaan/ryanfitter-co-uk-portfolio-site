import type {ReactNode} from "react";
import "../styles/portfolio.css";

export function PortfolioChrome({children}: {children:ReactNode}){
  return <div className="portfolio">
    <a className="portfolio-skip" href="#main">Skip to content</a>
    <header className="portfolio-header">
      <div className="portfolio-container portfolio-header-inner">
        <a href="/" className="portfolio-wordmark" aria-label="Ryan Fitter home">ryan<span>.</span>fitter</a>
        <nav className="portfolio-nav" aria-label="Main navigation">
          <a href="/#work">Work</a>
          <a href="/#expertise">Expertise</a>
          <a href="/#about">About</a>
          <a className="portfolio-nav-contact" href="/#contact">Get in touch <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </header>
    {children}
    <footer className="portfolio-footer">
      <div className="portfolio-container portfolio-footer-inner">
        <span>© {new Date().getFullYear()} Ryan Fitter</span>
        <span>E-commerce. Merchandising. Digital.</span>
        <a href="https://www.linkedin.com/in/ryaaan/" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
      </div>
    </footer>
  </div>;
}
