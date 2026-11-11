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
  image?: string;
  /** Optional homepage-card overrides; existing case-study content remains intact. */
  cardSummary?: string;
  cardMetricValue?: string;
  cardMetricLabel?: string;
  cardLinkLabel?: string;
  cardVisible?: boolean;
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
    "slug": "lbs-horticulture",
    "number": "03",
    "client": "LBS Horticulture",
    "descriptor": "B2B and B2C / Magento 2",
    "date": "2019 — 2021",
    "title": "Helping launch LoveGardening while supporting established B2B ecommerce.",
    "summary": "Supported the day-to-day running of an established B2B ecommerce operation and contributed to the launch of LoveGardening, a separate Magento 2 consumer storefront.",
    "tools": [
      "Magento 2",
      "B2B ecommerce",
      "B2C store launch",
      "On-page SEO",
      "Product merchandising",
      "Website UX"
    ],
    "facts": [
      {
        "value": "Magento 2",
        "label": "B2C storefront launched"
      },
      {
        "value": "4-person",
        "label": "B2C launch team"
      },
      {
        "value": "B2B + B2C",
        "label": "Ecommerce operations supported"
      }
    ],
    "challenge": "Alongside ongoing B2B trading and catalogue work, the business wanted to bring its horticultural range to a consumer audience through a distinct ecommerce storefront.",
    "work": [
      "Managed day-to-day B2B ecommerce website operations, product content and online merchandising.",
      "Worked as part of a four-person team on the LoveGardening Magento 2 B2C website launch.",
      "Supported product-page content, onsite usability and customer journeys across the B2B and B2C websites.",
      "Contributed to on-page SEO and website optimisation alongside routine trading activity."
    ],
    "result": "Helped deliver a new consumer-facing Magento 2 shopping experience while continuing to support the existing B2B operation. The launch was a collaborative team effort; the project is presented through the responsibilities I held rather than confidential company revenue figures.",
    "links": [
      {
        "label": "LBS Horticulture",
        "href": "https://lbshorticulture.co.uk"
      },
      {
        "label": "LoveGardening",
        "href": "https://lovegardening.com"
      }
    ],
    "note": "This describes work undertaken during my employment, not the current implementation of these websites."
  },
  {
    "slug": "style-cafe",
    "number": "04",
    "client": "Style Cafe",
    "descriptor": "Digital marketing / Shopify",
    "date": "2022 — 2023",
    "title": "Improving paid media efficiency and ecommerce conversion.",
    "summary": "Managed digital marketing and ecommerce activity across two Shopify stores, combining Google Ads optimisation with improvements to the onsite shopping experience.",
    "tools": [
      "Shopify",
      "Google Ads",
      "Paid acquisition",
      "Conversion optimisation",
      "Website UX",
      "Digital marketing"
    ],
    "facts": [
      {
        "value": "25%+",
        "label": "reduction in Google Ads spend"
      },
      {
        "value": "1.8%",
        "label": "reported conversion-rate increase"
      },
      {
        "value": "2%",
        "label": "reported bounce-rate reduction"
      }
    ],
    "challenge": "Improve the efficiency of paid traffic while making the storefront experience more effective for shoppers across two Shopify ecommerce sites.",
    "work": [
      "Managed ecommerce and digital marketing activities across two Shopify stores.",
      "Optimised Google Ads expenditure, achieving a reduction of more than 25% while maintaining click-through rate.",
      "Worked on user experience and conversion-rate optimisation, monitoring site performance and customer behaviour.",
      "Supported brand development and B2C packaging initiatives alongside trading and marketing responsibilities."
    ],
    "result": "Reported a conversion-rate increase of 1.8% and a bounce-rate reduction of 2%, alongside more than 25% lower Google Ads expenditure with click-through rate maintained. The original reporting does not specify whether the conversion and bounce-rate changes were relative percentages or percentage points, so they are described as reported changes rather than percentage-point gains.",
    "links": [],
    "note": "Historical results from my employment, as summarised in my CV. Metrics are rounded and should not be interpreted as current company performance."
  }
];

export const skills = [
  "Shopify", "Magento 2", "BigCommerce", "Akeneo PIM", "Product data",
  "Onsite merchandising", "Digital trading", "SEO", "Google Analytics",
  "Promotions and pricing", "Email marketing", "Catalogue operations"
];
