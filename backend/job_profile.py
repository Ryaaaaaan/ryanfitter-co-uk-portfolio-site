"""Explainable career fit estimates grounded in the owner's November 2026 CV.

This is a rules-based prioritiser, NOT an LLM, diagnosis, employer assessment,
or verified guarantee about hours, remote work or disability accommodations.
Do not store private CV text or health information in matched vacancies.
"""
from __future__ import annotations

import re

PROFILE_VERSION = 2
# Documented CV evidence: ecommerce merchandising (25k+ SKUs), Shopify,
# BigCommerce, Akeneo PIM, Magento, SEO, paid marketing, Google Analytics,
# conversion optimisation, website redesign and email/CRM campaigns.
ROLE_PATTERNS = {
    "Ecommerce": (r"e.?commerce", r"\bonline trading\b", r"\bshopify\b", r"\bweb trading\b"),
    "Merchandising": (r"merchandis", r"category management", r"product listings?", r"product range"),
    "UX": (r"\bux\b", r"user experience", r"customer journey", r"user research", r"usability"),
    "UI": (r"\bui\b", r"user interface", r"visual design", r"design systems?", r"\bfigma\b"),
    "Marketing": (r"\bmarketing\b", r"campaign", r"paid social", r"paid search", r"\bppc\b"),
    "SEO": (r"\bseo\b", r"search engine optimi"),
    "CRM & email": (r"\bcrm\b", r"email marketing", r"email campaigns?", r"\bklaviyo\b"),
    "Analytics & CRO": (r"analytic", r"conversion rate", r"\bcro\b", r"\bga4\b", r"\ba/b test"),
    "Product data & PIM": (r"product data", r"\bpim\b", r"catalogue", r"\bakeneo\b", r"product content"),
    "Marketplace": (r"\bebay\b", r"\bamazon\b", r"marketplace"),
    "Content": (r"content manag", r"website content", r"copywriting", r"digital content"),
    "Management": (r"\bmanager\b", r"management", r"\bteam lead\b", r"\bhead of\b"),
}
# CV evidence weights. Specialist UI design has deliberately lower weight than UX.
CV_WEIGHTS = {
    "Ecommerce": 25, "Merchandising": 25, "UX": 17, "UI": 4,
    "Marketing": 24, "SEO": 22, "CRM & email": 18,
    "Analytics & CRO": 19, "Product data & PIM": 23,
    "Marketplace": 15, "Content": 16, "Management": 14,
}
CV_ROLE_EVIDENCE = {
    "Ecommerce": "Ecommerce trading across Shopify, Magento and BigCommerce",
    "Merchandising": "Large-catalogue merchandising, categories and promotions",
    "UX": "Website redesign, customer journey and conversion improvements",
    "UI": "Some UX overlap; specialist visual UI craft is not evidenced",
    "Marketing": "Paid campaigns, ecommerce marketing and promotions",
    "SEO": "Hands-on search optimisation and content improvements",
    "CRM & email": "Email marketing and ecommerce customer engagement",
    "Analytics & CRO": "Analytics, conversion optimisation and performance reporting",
    "Product data & PIM": "Product data, catalogue automation and Akeneo PIM",
    "Marketplace": "eBay retail operations and online marketplace management",
    "Content": "Product and website content creation and enrichment",
    "Management": "Ecommerce and digital marketing management responsibilities",
}
CV_TOOLS = ("shopify", "bigcommerce", "akeneo", "magento", "google analytics",
            "ga4", "excel", "tableau", "seo", "google ads", "ecommerce", "product data",
            "pim", "paid advertising", "conversion optimi", "merchandis", "email marketing")
TITLE_ROLE_ELIGIBILITY = (
    r"e.?commerce", r"\bonline trading\b", r"merchandis", r"\bux\b", r"user experience",
    r"\bui\b", r"user interface", r"\bmarketing\b", r"\bseo\b", r"\bcrm\b",
    r"email", r"\banalytic", r"\bcro\b", r"\bwebsite\b", r"\bweb content",
    r"\bproduct data", r"\bpim\b", r"\bmarketplace\b", r"\bshopify\b",
    r"\bcontent manager\b", r"\bcontent executive\b", r"\bdigital trading",
    r"\bgrowth\b", r"\bconversion\b", r"\bdigital product",
)
SUPPORT_PATTERNS = {
    "Flexible working mentioned": r"flexible working|flexible hours|flexible schedule|flexitime|flexi.time",
    "Adjustments mentioned": r"reasonable adjustments?|reasonable accommodations?|disability confident",
    "Accessibility commitment mentioned": r"accessible recruitment|inclusive recruitment",
}
HOUR_RANGE = re.compile(r"\b(\d{1,2})\s*(?:to|[-–—])\s*(\d{1,2})\s*(?:hour|hr|h)s?\b", re.I)
HOURS_SINGLE = re.compile(r"\b(\d{1,2})\s*(?:hour|hr)s?\s*(?:per|a|/)\s*week\b", re.I)


def _found(text: str, pattern: str) -> bool:
    return re.search(pattern, text, flags=re.I) is not None


def eligible_title(title: str) -> bool:
    t = title.lower()
    if not any(_found(t, p) for p in TITLE_ROLE_ELIGIBILITY):
        return False
    return not _found(t, r"\b(chief|ceo|cmo|vice president|vp|intern|unpaid|volunteer)\b")


def classify(title: str, description: str = "") -> tuple[list[str], str]:
    title = (title or "").lower()
    text = (title + " " + (description or "")[:2500]).lower()
    # Strong role categories require a title signal; a mention of Figma in a
    # long spec is not sufficient to label a marketing job as UI design.
    tags = [label for label, patterns in ROLE_PATTERNS.items()
            if any(_found(title, p) for p in patterns)]
    if not tags:
        tags = [label for label, patterns in ROLE_PATTERNS.items()
                if label != "Management" and any(_found(text, p) for p in patterns)][:4]
    if _found(title, r"\b(head of|director|vp|chief)\b"):
        seniority = "Head / director"
    elif _found(title, r"\b(senior|principal|lead)\b"):
        seniority = "Senior / lead"
    elif _found(title, r"\b(junior|assistant|graduate|entry.level|apprentice|trainee)\b"):
        seniority = "Junior / entry"
    elif _found(title, r"\b(manager|management)\b"):
        seniority = "Managerial title"
    else:
        seniority = "Not stated"
    return tags[:6], seniority


def _hours(raw: str) -> tuple[int | None, int | None]:
    match = HOUR_RANGE.search(raw or "")
    if match:
        low, high = map(int, match.groups())
        if 5 <= low <= high <= 60:
            return low, high
    match = HOURS_SINGLE.search(raw or "")
    if match:
        n = int(match.group(1))
        if 5 <= n <= 60:
            return n, n
    return None, None


def profile(title: str, description: str = "", employment: str = "",
            hours: str = "", location: str = "", warning: str = "",
            source: str = "") -> dict:
    """Return transparent estimates and evidenced tags, never opaque AI claims."""
    tags, seniority = classify(title, description)
    lower_title = (title or "").lower()
    spec = (description or "").lower()
    combined = " ".join([lower_title, spec, (employment or "").lower(),
                         (location or "").lower(), (warning or "").lower()])
    # The role must be in one of the relevant career families.
    if not eligible_title(title):
        return {}

    direct = sum(CV_WEIGHTS[t] for t in tags if t in CV_WEIGHTS)
    sorted_weights = sorted((CV_WEIGHTS[t] for t in tags if t in CV_WEIGHTS), reverse=True)
    primary = sorted_weights[0] if sorted_weights else 0
    supporting = min(16, sum(sorted_weights[1:]) // 3)
    tool_hits = [tool for tool in CV_TOOLS if tool in spec or tool in lower_title]
    cv = 45 + primary + supporting + min(17, len(tool_hits) * 3)
    if seniority == "Head / director":
        cv -= 26
    elif seniority == "Senior / lead":
        cv -= 7
    elif seniority == "Junior / entry":
        cv -= 4
    if "UI" in tags and "UX" not in tags and "Ecommerce" not in tags:
        cv -= 18  # CV does not establish specialist visual/UI craft.
    if _found(lower_title, r"\bdeveloper\b|\bengineer\b|\bdata scientist\b"):
        cv -= 15
    cv = max(10, min(98, int(cv)))

    # Explicit office-day counts give a much more useful gradient than treating
    # one day on site the same as five. Unspecified hybrid remains conservative.
    office_day_match = re.search(
        r"\b([1-5]|one|two|three|four|five)\s*days?\s*(?:(?:a|per)\s*week\s*)?"
        r"(?:in|at|on)\s*(?:the\s*)?(?:office|site)\b",
        combined, re.I,
    )
    office_days = None
    if office_day_match:
        token = office_day_match.group(1)
        office_days = int(token) if token.isdigit() else {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        }.get(token)
    mandatory = office_days is not None or _found(
        combined, r"\b(hybrid|on.site|onsite|office.based|office attendance|"
        r"regular travel|travel required)\b"
    )
    if mandatory:
        remote_status = (
            f"Hybrid / onsite: {office_days} office day(s) per week (verify)"
            if office_days is not None else "Hybrid / office attendance mentioned (verify)"
        )
        remote_points = max(0, 68 - office_days * 16) if office_days is not None else 18
    elif _found(combined, r"\b(in.office|in person only|office.only)\b"):
        remote_status = "Office attendance mentioned"
        remote_points = 0
    elif _found(location.lower(), r"\b(remote|work from home|home.based|worldwide|anywhere)\b"):
        remote_status = "Remote-labelled (unverified)"
        remote_points = 88
    elif _found(spec, r"\b(fully remote|100% remote|work from home)\b"):
        remote_status = "Remote claimed in listing (unverified)"
        remote_points = 88
    else:
        remote_status = "Remote arrangement unclear"
        remote_points = 45

    low, high = _hours(hours + " " + description[:1800])
    employment_low = employment.lower()
    if low is not None:
        if high <= 30:
            hour_points = 96
            hours_fit = "Hours within 30/week"
        elif low <= 30 < high:
            hour_points = 75
            hours_fit = "Hours range crosses 30/week"
        elif high <= 35:
            hour_points = 53
            hours_fit = "31–35 hours/week"
        else:
            hour_points = 26
            hours_fit = "Full-time hours"
    elif _found(employment_low, r"\b(part.time|part time|freelance)\b"):
        hour_points = 79
        hours_fit = "Part-time / freelance (hours unconfirmed)"
    elif _found(employment_low, r"\b(contract|temporary)\b"):
        hour_points = 64
        hours_fit = "Contract (hours unconfirmed)"
    elif _found(employment_low, r"\bfull.time\b"):
        hour_points = 30
        hours_fit = "Full-time (hours unconfirmed)"
    else:
        hour_points = 48
        hours_fit = "Hours not specified"

    support = [label for label, pattern in SUPPORT_PATTERNS.items() if _found(spec, pattern)]
    lifestyle = round(0.63 * remote_points + 0.34 * hour_points + (7 if support else 0))
    if mandatory:
        cap = {1: 58, 2: 46, 3: 34, 4: 23, 5: 12}.get(office_days, 37)
        lifestyle = min(lifestyle, cap)
    lifestyle = max(0, min(99, lifestyle))
    overall = round(0.52 * cv + 0.48 * lifestyle)
    if mandatory:
        overall = min(overall, {1: 64, 2: 57, 3: 50, 4: 40, 5: 30}.get(office_days, 54))
        # Strong CV overlap cannot conceal an office requirement.

    evidence = []
    for tag in tags[:3]:
        if tag in CV_ROLE_EVIDENCE:
            evidence.append("CV experience: " + CV_ROLE_EVIDENCE[tag])
    if tool_hits:
        evidence.append("CV overlap: " + ", ".join(tool_hits[:5]))
    if cv < 65 and "UI" in tags:
        evidence.append("Specialist UI design experience not demonstrated on the CV")
    if seniority == "Head / director":
        evidence.append("Higher seniority than CV directly demonstrates")
    evidence.append(hours_fit)
    evidence.append(remote_status)
    if support:
        evidence.append("; ".join(support))
    return {
        "profile_version": PROFILE_VERSION,
        "role_tags": tags,
        "seniority": seniority,
        "cv_score": cv,
        "lifestyle_score": lifestyle,
        "score": overall,
        "fit_evidence": evidence,
        "remote_status": remote_status,
        "office_days": office_days,
        "hours_fit": hours_fit,
        "support_signals": support,
        "score_basis": "Rules-based estimate using CV evidence and listing text; not an employer or verified remote assessment.",
    }
