export type Project = {
  slug: string;
  number: string;
  client: string;
  descriptor: string;
  date: string;
  title: string;
  summary: string;
  tools: string[];
  facts: { value: string; label: string }[];
  challenge: string;
  work: string[];
  result: string;
  links: { label: string; href: string }[];
  note?: string;
};

export const projects: Project[] = [
  {
    slug: "loftycards",
    number: "01",
    client: "LoftyCards",
    descriptor: "Independent retail / Shopify",
    date: "2025 — Present",
    title: "Launching and running a specialist online retailer.",
    summary: "From an initial catalogue of thousands of products to the day-to-day commercial decisions behind an independent trading card business.",
    tools: ["Shopify", "Product merchandising", "SEO", "Google Ads", "Email marketing", "eBay"],
    facts: [
      { value: "8,000+", label: "listings at launch" },
      { value: "~1 month", label: "from build to launch" },
      { value: "1,000+", label: "weekly Google impressions achieved" }
    ],
    challenge: "Build a credible, searchable storefront for a product range with a large number of individual variants, while managing the realities of running a small retail business.",
    work: [
      "Built and launched the Shopify storefront, initially publishing over 8,000 product listings.",
      "Established distribution relationships and expanded the product range.",
      "Managed product data, pricing, stock, onsite merchandising, promotions and multichannel selling.",
      "Improved organic search visibility and developed automation-led processes for repetitive catalogue work."
    ],
    result: "Launched the store in approximately one month and grew Google Search impressions from a few hundred per month to more than 1,000 per week, while building a functioning independent retail operation.",
    links: [{ label: "Visit LoftyCards", href: "https://loftycards.co.uk" }]
  },
  {
    slug: "bensons-for-beds",
    number: "02",
    client: "Bensons for Beds",
    descriptor: "National retail / Digital merchandising",
    date: "2024 — 2026",
    title: "Keeping a large retail catalogue clear, accurate and easy to shop.",
    summary: "Product data, promotions and onsite merchandising across a national retailer's catalogue of more than 25,000 SKUs.",
    tools: ["BigCommerce", "Akeneo PIM", "Google Analytics", "Tableau", "Excel", "Onsite search"],
    facts: [
      { value: "25,000+", label: "SKUs across the catalogue" },
      { value: "Weekly", label: "promotional cycles" },
      { value: "2+ years", label: "e-commerce merchandising" }
    ],
    challenge: "Help customers find and understand products while keeping a large catalogue's content, prices and promotions accurate.",
    work: [
      "Managed product lifecycle details, product information, pricing and promotional merchandising.",
      "Enriched attributes, descriptions and website content through Akeneo PIM.",
      "Worked on product detail pages, category structures, site navigation and search filters.",
      "Coordinated promotions and supported launches alongside marketing, PR and purchasing teams."
    ],
    result: "Supported the day-to-day quality, discoverability and commercial presentation of a catalogue containing more than 25,000 SKUs.",
    links: [{ label: "Visit Bensons for Beds", href: "https://www.bensonsforbeds.co.uk" }],
    note: "This describes my work during my employment. The live website and its current implementation may have changed since then."
  },
  {
    slug: "lbs-horticulture",
    number: "03",
    client: "LBS Horticulture",
    descriptor: "B2B and B2C / Magento 2",
    date: "2019 — 2021",
    title: "Growing established B2B commerce while launching B2C.",
    summary: "Worked across a business-to-business website and a new consumer-facing Magento 2 store, with a focus on content, SEO and usability.",
    tools: ["Magento 2", "B2B e-commerce", "B2C launch", "On-page SEO", "Website UX"],
    facts: [
      { value: "£1.1m → £1.4m", label: "B2B annual revenue, 2019–20" },
      { value: "£200k", label: "B2C revenue in first six months" },
      { value: "4 people", label: "on the B2C launch team" }
    ],
    challenge: "Maintain and improve an established B2B online operation while helping a small team introduce a separate B2C shopping experience.",
    work: [
      "Oversaw day-to-day B2B e-commerce website activities, product content and merchandising.",
      "Worked within a four-person team to launch a Magento 2 B2C store.",
      "Improved onsite usability, website performance and organic search visibility.",
      "Maintained product pages and content across the B2B and B2C channels."
    ],
    result: "The B2B channel recorded approximately £1.1m revenue in 2019 and £1.4m in 2020. The new B2C website generated £200,000 in its first six months. These are business and team outcomes, not solely my personal results.",
    links: [
      { label: "LBS Horticulture", href: "https://lbshorticulture.co.uk" },
      { label: "LoveGardening", href: "https://lovegardening.com" }
    ],
    note: "These sites are included as references to the businesses I worked on; their live content and designs may have changed since my involvement."
  }
];

export const skills = [
  "Shopify", "Magento 2", "BigCommerce", "Akeneo PIM", "Product data",
  "Onsite merchandising", "Digital trading", "SEO", "Google Analytics",
  "Promotions and pricing", "Email marketing", "Catalogue operations"
];
