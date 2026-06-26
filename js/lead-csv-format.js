/**
 * Google Maps lead export CSV · column layout used for Lead Finder cards.
 * Header: hfpxzc href, qBF1Pd, MW4etd, UY7F9, W4Efsd … Jn12ke src
 */
(function (global) {
  const COL = {
    mapsUrl: "hfpxzc href",
    name: "qBF1Pd",
    rating: "MW4etd",
    reviewCount: "UY7F9",
    titleLine: "W4Efsd",
    address1: "W4Efsd 2",
    line3: "W4Efsd 3",
    line4: "W4Efsd 4",
    address2: "W4Efsd 5",
    phone: "UsdlK",
    website: "lcr4fd href",
    websiteLabel: "Cw1rxd",
    directionsLabel: "R8c4Qb",
    reviewQuote: "Cw1rxd 2",
    categoryGroup: "R8c4Qb 2",
    extra: "ah5Ghc",
    reviewQuoteAlt: "W4Efsd 6",
    profileImage: "Jn12ke src",
  };

  const COLUMN_KEYS = Object.values(COL);
  const MIN_COLUMN_KEYS = 14;
  const FORMAT_ERROR = "Format error";

  const PHONE_RE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  const ADDRESS_RE = /\b\d{1,6}\s+[A-Za-z0-9]/;
  const STREET_WORD_RE =
    /\b(st|street|rd|road|ave|avenue|blvd|boulevard|dr|drive|ln|lane|way|suite|ste|hwy|highway|pkwy|parkway|ct|court|pl|place)\b/i;

  function raw(value) {
    return String(value ?? "").trim();
  }

  function hasColumnKey(row, key) {
    return row && Object.prototype.hasOwnProperty.call(row, key);
  }

  function countSchemaKeys(row) {
    if (!row || typeof row !== "object") return 0;
    return COLUMN_KEYS.filter((key) => hasColumnKey(row, key)).length;
  }

  function isValidMapsUrl(url) {
    const u = raw(url).toLowerCase();
    if (!/google\.com\/maps\/place\//i.test(u)) return false;
    if (!u.includes("/data=!") && !u.includes("/data%3d!")) return false;
    if (!u.includes("1s0x") && !u.includes("19s") && !u.includes("/g/")) return false;
    return true;
  }

  function isMapsUiLabel(value) {
    const v = raw(value).toLowerCase();
    if (!v || v === "·") return true;
    return /^(directions|website|menu|call|save|share|order online|overview|reviews|photos|updates|about)$/i.test(v);
  }

  function isValidWebsiteUrl(url) {
    const u = raw(url);
    if (!u) return false;
    const low = u.toLowerCase();
    if (!low.startsWith("http://") && !low.startsWith("https://")) return false;
    if (
      low.includes("google.com/maps") ||
      low.includes("google.com/aclk") ||
      low.includes("gstatic.com")
    ) {
      return false;
    }
    return true;
  }

  function looksLikeHours(value) {
    const v = raw(value).replace(/^[\s·•]+/, "");
    if (!v) return false;
    const low = v.toLowerCase();
    if (/^(open|closed|closes)\b/.test(low)) return true;
    if (/\b(opens?|closed|closes soon)\b/i.test(v) && /\b(AM|PM)\b/i.test(v)) return true;
    if (/^opens?\b/i.test(low) && /\d/.test(v)) return true;
    if (/open 24 hours/i.test(v)) return true;
    return false;
  }

  function cleanAddressCandidate(value) {
    let v = raw(value);
    if (!v) return "";
    v = v.replace(/\s*(Open 24 hours)\s*$/i, "").trim();
    v = v.replace(/([A-Za-z])(Open|Closed)$/i, "$1").trim();
    v = v.replace(/\s*(Opens?|Closed|Closes)\b[^]*$/i, (m) => {
      return looksLikeHours(m) ? "" : m;
    }).trim();
    v = v.replace(PHONE_RE, "").replace(/\(\s*\)/g, "").trim();
    return v;
  }

  function looksLikeStreetAddress(value) {
    const v = cleanAddressCandidate(value);
    if (!v) return false;
    if (looksLikeHours(v)) return false;
    if (v.startsWith("http")) return false;
    if (ADDRESS_RE.test(v)) return true;
    if (STREET_WORD_RE.test(v) && /\d/.test(v)) return true;
    if (/,/.test(v) && /\d/.test(v)) return true;
    return false;
  }

  function extractHoursFragment(value) {
    const v = raw(value);
    if (!v) return "";
    if (looksLikeHours(v)) return v;
    const m = v.match(/((?:Opens?|Closed|Closes|Open 24 hours)\b[^]*)/i);
    return m ? m[1].trim() : "";
  }

  function parseRatingValue(text) {
    const t = raw(text);
    if (!t) return null;
    const m = t.match(/^(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function parseReviewCount(text) {
    const t = raw(text);
    if (!t) return { count: null, label: "" };
    if (/no reviews/i.test(t)) return { count: 0, label: "No reviews" };
    const paren = t.match(/\((\d+)\)/);
    if (paren) return { count: Number(paren[1]), label: "" };
    const plain = t.match(/^(\d+)$/);
    if (plain) return { count: Number(plain[1]), label: "" };
    return { count: null, label: "" };
  }

  function resolveAddress(row) {
    const candidates = [COL.address1, COL.line3, COL.address2, COL.titleLine];
    for (const key of candidates) {
      const cleaned = cleanAddressCandidate(row[key]);
      if (looksLikeStreetAddress(cleaned)) return cleaned;
    }
    return "";
  }

  function resolveHours(row) {
    const parts = [];
    [COL.line3, COL.line4, COL.address1, COL.address2].forEach((key) => {
      const v = raw(row[key]);
      if (!v) return;
      const hours = extractHoursFragment(v);
      if (hours && !parts.includes(hours)) parts.push(hours);
    });
    return parts.slice(0, 2).join(" · ");
  }

  function resolveReviewQuote(row) {
    const quote = raw(row[COL.reviewQuote]) || raw(row[COL.reviewQuoteAlt]) || raw(row[COL.extra]);
    if (!quote) return "";
    if (/^["“]/.test(quote) || quote.length > 18) return quote;
    return "";
  }

  function resolveCategoryGroup(row) {
    const titleLine = raw(row[COL.titleLine]);
    if (
      titleLine &&
      !isMapsUiLabel(titleLine) &&
      !looksLikeStreetAddress(titleLine) &&
      !looksLikeHours(titleLine) &&
      titleLine.length <= 48
    ) {
      return titleLine;
    }
    const grp = raw(row[COL.categoryGroup]);
    if (grp && !isMapsUiLabel(grp)) return grp;
    return "Local business";
  }

  function validateRow(row) {
    if (!row || typeof row !== "object") {
      return { valid: false, error: FORMAT_ERROR };
    }
    if (countSchemaKeys(row) < MIN_COLUMN_KEYS) {
      return { valid: false, error: FORMAT_ERROR };
    }
    const mapsUrl = raw(row[COL.mapsUrl] || row.maps_url || row.mapsUrl);
    if (!isValidMapsUrl(mapsUrl)) {
      return { valid: false, error: FORMAT_ERROR };
    }
    const name = raw(row[COL.name] || row.name);
    if (!name) {
      return { valid: false, error: FORMAT_ERROR };
    }
    return { valid: true, error: "" };
  }

  function copyColumns(row) {
    const out = {};
    COLUMN_KEYS.forEach((key) => {
      if (hasColumnKey(row, key)) out[key] = row[key];
    });
    return out;
  }

  function parseRow(row) {
    const validation = validateRow(row);
    const columns = copyColumns(row);
    const mapsUrl = raw(row[COL.mapsUrl] || row.maps_url || row.mapsUrl);
    const name = raw(row[COL.name] || row.name);
    const rating = parseRatingValue(row[COL.rating]);
    const reviewMeta = parseReviewCount(row[COL.reviewCount]);
    const phone = raw(row[COL.phone]);
    const websiteUrl = raw(row[COL.website]);
    const hasWebsite = row.has_website === true || isValidWebsiteUrl(websiteUrl);
    const address = resolveAddress(row);
    const hours = resolveHours(row);
    const categoryGroup = resolveCategoryGroup(row);
    const reviewQuote = resolveReviewQuote(row);
    const profileImage = raw(row[COL.profileImage]);

    return {
      id: row.id,
      name,
      category: categoryGroup,
      categoryGroup,
      titleLine: raw(row[COL.titleLine]),
      phone,
      address,
      mapsUrl,
      website: isValidWebsiteUrl(websiteUrl) ? websiteUrl : "",
      hours,
      hasWebsite,
      rating,
      reviewCount: reviewMeta.count,
      reviewLabel: reviewMeta.label,
      hasNoReviews: reviewMeta.count === 0 && reviewMeta.label === "No reviews",
      reviewQuote,
      profileImage,
      formatValid: validation.valid,
      formatError: validation.error,
      dedupeKey: row.id || "",
      sources: [],
      ...columns,
    };
  }

  function isValidLead(lead) {
    if (!lead || typeof lead !== "object") return false;
    if (lead.formatValid === true) return true;
    if (lead.formatValid === false) return false;
    return validateRow(lead).valid;
  }

  global.LeadCsvFormat = {
    COL,
    COLUMN_KEYS,
    FORMAT_ERROR,
    validateRow,
    parseRow,
    isValidLead,
    isValidMapsUrl,
    looksLikeHours,
    looksLikeStreetAddress,
    cleanAddressCandidate,
  };
})(window);
