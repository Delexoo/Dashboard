/**
 * Display labels for lead fields (NULL = bad data, empty = not listed).
 */
(function (global) {
  const NULL = "NULL";

  function raw(value) {
    return String(value ?? "").trim();
  }

  function isNullMarker(value) {
    return raw(value).toUpperCase() === NULL;
  }

  function isPlaceholder(value) {
    const v = raw(value).toLowerCase();
    return !v || v === "-" || v === "-" || v === "n/a";
  }

  function looksLikeBusinessName(value) {
    const n = raw(value);
    if (!n || isPlaceholder(n)) return false;
    const low = n.toLowerCase();
    if (/,/.test(n) || /\s-\s/.test(n)) return true;
    if (n.length > 32) return true;
    if (
      /academy|preschool|childcare|child care|dental|chiropractic|associates|services/i.test(low) &&
      n.split(/\s+/).length >= 3
    ) {
      return true;
    }
    return false;
  }

  function isShortCategory(value) {
    const v = raw(value);
    if (!v || isPlaceholder(v)) return false;
    if (looksLikeBusinessName(v)) return false;
    return true;
  }

  function isMapsUiLabel(value) {
    const v = raw(value).toLowerCase();
    if (!v || v === "·") return true;
    return /^(directions|website|menu|call|save|share|order online|overview|reviews|photos|updates|about)$/i.test(v);
  }

  const PHONE_RE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  const ADDRESS_RE = /\b\d{1,6}\s+[A-Za-z0-9]/;
  const STREET_WORD_RE =
    /\b(st|street|rd|road|ave|avenue|blvd|boulevard|dr|drive|ln|lane|way|suite|ste|hwy|highway|pkwy|parkway|ct|court|pl|place)\b/i;

  function looksLikeHours(value) {
    const v = raw(value).replace(/^[\s·•]+/, "");
    if (!v) return false;
    const low = v.toLowerCase();
    if (/^(open|closed|closes)\b/.test(low)) return true;
    if (/\b(opens?|closed|closes soon)\b/i.test(v) && /\b(AM|PM)\b/i.test(v)) return true;
    if (/^opens?\b/i.test(low) && /\d/.test(v)) return true;
    return false;
  }

  function looksLikeStreetAddress(value) {
    const v = raw(value);
    if (!v || isNullMarker(v) || isPlaceholder(v)) return false;
    if (looksLikeHours(v)) return false;
    if (PHONE_RE.test(v)) return false;
    if (v.startsWith("http")) return false;
    if (ADDRESS_RE.test(v)) return true;
    if (STREET_WORD_RE.test(v) && /\d/.test(v)) return true;
    if (/,/.test(v) && /\d/.test(v) && !looksLikeHours(v)) return true;
    return false;
  }

  function extraFieldCandidates(lead, keys) {
    const out = [];
    keys.forEach((key) => {
      const v = raw(lead?.[key]);
      if (v) out.push(v);
    });
    return out;
  }

  function resolveAddressRaw(lead) {
    const candidates = [
      lead?.address,
      ...extraFieldCandidates(lead, ["W4Efsd 2", "W4Efsd 5", "W4Efsd 6", "W4Efsd 7", "Address", "address"]),
    ];
    for (const c of candidates) {
      if (!c || isNullMarker(c) || isPlaceholder(c)) continue;
      if (looksLikeHours(c)) continue;
      if (looksLikeStreetAddress(c)) return c;
    }
    return "";
  }

  function resolveHoursRaw(lead) {
    const candidates = [
      lead?.hours,
      ...extraFieldCandidates(lead, ["W4Efsd 4", "Hours", "hours"]),
      lead?.address,
      ...extraFieldCandidates(lead, ["W4Efsd 2", "W4Efsd 5", "W4Efsd 6", "W4Efsd 7"]),
    ];
    for (const c of candidates) {
      if (!c || isNullMarker(c) || isPlaceholder(c)) continue;
      if (looksLikeHours(c)) return c;
    }
    return "";
  }

  function sanitizeLeadFields(lead) {
    if (!lead || typeof lead !== "object") return lead;
    return {
      ...lead,
      address: resolveAddressRaw(lead),
      hours: resolveHoursRaw(lead),
    };
  }

  function nameFromMapsUrl(mapsUrl) {
    const m = String(mapsUrl || "").match(/\/place\/([^/]+)\//);
    if (!m) return "";
    return decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
  }

  function resolveName(lead) {
    const direct = raw(lead?.name);
    if (!isBadName(direct)) return direct;
    const fromCat = raw(lead?.category);
    if (looksLikeBusinessName(fromCat)) return fromCat;
    const fromMaps = nameFromMapsUrl(lead?.mapsUrl);
    if (fromMaps && !isPlaceholder(fromMaps)) return fromMaps;
    return "";
  }

  function resolveCategory(lead) {
    const name = resolveName(lead);
    const titleLine = raw(lead?.titleLine || lead?.["W4Efsd"]);
    if (
      titleLine &&
      !isMapsUiLabel(titleLine) &&
      titleLine !== name &&
      !looksLikeBusinessName(titleLine) &&
      !looksLikeStreetAddress(titleLine) &&
      !looksLikeHours(titleLine)
    ) {
      return titleLine;
    }
    const grp = raw(lead?.categoryGroup || lead?.["R8c4Qb 2"]);
    if (grp && grp !== name && !looksLikeBusinessName(grp) && !isMapsUiLabel(grp)) return grp;
    const cat = raw(lead?.category);
    if (isShortCategory(cat) && cat !== name && !isMapsUiLabel(cat)) return cat;
    if (cat && cat !== name && !looksLikeBusinessName(cat) && !isMapsUiLabel(cat)) return cat;
    return "Local business";
  }

  function isBadAddress(value, lead) {
    const v = raw(value);
    if (!v || isNullMarker(v) || isPlaceholder(v)) return true;
    if (looksLikeHours(v)) return true;
    const cat = resolveCategory(lead).toLowerCase();
    const low = v.toLowerCase();
    if (cat && low === cat) return true;
    if (!/\d/.test(v) && /day care|daycare|preschool|chiropractor|groomer/i.test(low)) return true;
    if (!looksLikeStreetAddress(v)) return true;
    return false;
  }

  function isBadName(value) {
    const v = raw(value);
    if (!v || isNullMarker(v) || isPlaceholder(v)) return true;
    if (v.length < 2) return true;
    return false;
  }

  function isBadPhone(value) {
    const v = raw(value);
    if (!v || isNullMarker(v)) return true;
    const digits = v.replace(/\D/g, "");
    return digits.length < 10;
  }

  function hasCallablePhone(lead) {
    return !isBadPhone(lead?.phone);
  }

  /** US display for Lead Builder: +1(401)300-0957 */
  function formatPhoneForLeadBuilder(value) {
    const t = raw(value);
    if (!t || isNullMarker(t)) return "";
    let d = t.replace(/\D/g, "");
    if (!d) return "";
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    if (d.length > 10) d = d.slice(-10);
    if (d.length === 10) {
      return "+1(" + d.slice(0, 3) + ")" + d.slice(3, 6) + "-" + d.slice(6);
    }
    if (d[0] !== "1") d = "1" + d;
    d = d.slice(0, 11);
    const n = d[0] === "1" ? d.slice(1) : d;
    if (n.length <= 3) return "+1(" + n;
    if (n.length <= 6) return "+1(" + n.slice(0, 3) + ")" + n.slice(3);
    return "+1(" + n.slice(0, 3) + ")" + n.slice(3, 6) + "-" + n.slice(6);
  }

  function format(value, notListedLabel, isInvalid) {
    const v = raw(value);
    if (!v) return notListedLabel;
    if (isNullMarker(v) || (isInvalid && isInvalid(v))) return NULL;
    return v;
  }

  function avatarColorsForLead(lead) {
    const palettes = [
      ["#0f766e", "#14b8a6"],
      ["#1d4ed8", "#3b82f6"],
      ["#7c3aed", "#a78bfa"],
      ["#be185d", "#f472b6"],
      ["#c2410c", "#fb923c"],
      ["#b45309", "#fbbf24"],
      ["#047857", "#34d399"],
      ["#0e7490", "#22d3ee"],
      ["#4338ca", "#818cf8"],
      ["#a21caf", "#e879f9"],
    ];
    const key = String(lead?.id || resolveName(lead) || "?");
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return palettes[hash % palettes.length];
  }

  global.LeadDisplay = {
    NULL,
    resolveName,
    resolveCategory,
    formatName: (lead) => {
      const n = resolveName(lead);
      if (!n) return "Business name not listed";
      return n;
    },
    formatPhone: (lead) => format(lead?.phone, "Phone not listed", isBadPhone),
    hasCallablePhone,
    isBadPhone,
    formatAddress: (lead) => {
      const a = resolveAddressRaw(lead);
      if (!a) return "Address not listed";
      return format(a, "Address not listed", (v) => isBadAddress(v, lead));
    },
    formatHours: (lead) => {
      const h = resolveHoursRaw(lead);
      if (!h) return "Hours not listed";
      if (isNullMarker(h)) return NULL;
      return h;
    },
    formatCategory: (lead) => {
      const c = resolveCategory(lead);
      if (!c) return "Category not listed";
      return c;
    },
    formatRating: (lead) => {
      const n = Number(lead?.rating);
      if (!Number.isFinite(n) || n <= 0) return "";
      return n % 1 === 0 ? n.toFixed(1) : String(Math.round(n * 10) / 10);
    },
    formatReviews: (lead) => {
      if (lead?.hasNoReviews || lead?.reviewLabel === "No reviews") return "No reviews";
      const n = Number(lead?.reviewCount);
      if (!Number.isFinite(n) || n < 0) return "";
      if (n === 0) return "No reviews";
      if (n === 1) return "1 review";
      return `${Math.round(n)} reviews`;
    },
    formatRatingLine: (lead) => {
      const n = Number(lead?.rating);
      const c = Number(lead?.reviewCount);
      const rating =
        Number.isFinite(n) && n > 0 ? (n % 1 === 0 ? n.toFixed(1) : String(Math.round(n * 10) / 10)) : "";
      let reviews = "";
      if (lead?.hasNoReviews || lead?.reviewLabel === "No reviews") {
        reviews = "No reviews";
      } else if (Number.isFinite(c) && c >= 0) {
        reviews = c === 1 ? "1 review" : c === 0 ? "No reviews" : `${Math.round(c)} reviews`;
      }
      if (rating && reviews) return `${rating} · ${reviews}`;
      if (rating) return rating;
      if (reviews) return reviews;
      return "";
    },
    initials: (lead) => {
      const name = resolveName(lead);
      if (!name) return "?";
      const skip = new Set(["the", "a", "an"]);
      const parts = name.split(/\s+/).filter((p) => p && !skip.has(p.toLowerCase()));
      if (!parts.length) return "?";
      if (parts.length === 1) {
        const w = parts[0].replace(/[^A-Za-z0-9]/g, "");
        return (w.slice(0, 2) || "?").toUpperCase();
      }
      const a = parts[0][0] || "?";
      const b = parts[1][0] || "";
      return (a + b).toUpperCase();
    },
    /** Stable gradient colors per lead (by id). */
    avatarColors: (lead) => avatarColorsForLead(lead),
    avatarStyle: (lead) => {
      const [a, b] = avatarColorsForLead(lead);
      return `--lf-avatar-a:${a};--lf-avatar-b:${b}`;
    },
    /** Suggested upfront tier from Google review count (Lead Finder → Lead Builder). */
    priceTierFromReviewCount(reviewCount) {
      const c = Number(reviewCount);
      if (!Number.isFinite(c) || c < 0) return "$500";
      if (c <= 10) return "$500";
      if (c <= 30) return "$700";
      if (c <= 100) return "$1,000";
      return "$1,500";
    },
    formatPhoneForLeadBuilder,
    sanitizeLeadFields,
    resolveAddressRaw,
    resolveHoursRaw,
    looksLikeHours,
    looksLikeStreetAddress,
    buildLeadBuilderPick(lead) {
      const phone = formatPhoneForLeadBuilder(lead?.phone);
      const mapsUrl = raw(lead?.mapsUrl || lead?.maps_url);
      const formatted = global.LeadDisplay.formatName(lead);
      const businessName =
        formatted === "Business name not listed" ? raw(lead?.name) : formatted;
      return {
        leadId: raw(lead?.id),
        name: "",
        businessName,
        phone,
        mapsUrl,
        price: global.LeadDisplay.priceTierFromReviewCount(lead?.reviewCount),
      };
    },
  };
})(window);
