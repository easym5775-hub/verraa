/* ================================================================
   VERRAA — <Seo /> component: per-route head management without
   extra dependencies. Sets title, description, canonical, robots
   (index/noindex), OG + Twitter tags. Cleans up on unmount so
   SPA navigation never leaks tags between routes.
   ================================================================ */

import { useEffect } from "react";
import {
  OG_IMAGE,
  SEO_PAGES,
  SITE_LOCALE,
  SITE_LOCALE_ALT,
  SITE_NAME,
  TWITTER_HANDLE,
  canonicalFor,
  type SeoPageKey,
} from "../seo";

function upsertMeta(attr: "name" | "property", key: string, content: string): HTMLMetaElement {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  el.setAttribute("data-seo", "1");
  return el;
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>): HTMLLinkElement {
  const selector =
    rel === "canonical"
      ? `link[rel="canonical"]`
      : `link[rel="${rel}"][data-seo-href="${href}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (rel !== "canonical") el.setAttribute("data-seo-href", href);
    if (extra) for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  if (rel !== "canonical") el.setAttribute("data-seo", "1");
  return el;
}

export function Seo({
  page,
  titleOverride,
  descOverride,
  pathOverride,
  image,
}: {
  page: SeoPageKey;
  titleOverride?: string;
  descOverride?: string;
  pathOverride?: string;
  image?: string;
}) {
  useEffect(() => {
    const cfg = SEO_PAGES[page];
    const title = titleOverride ?? cfg.title;
    const desc = descOverride ?? cfg.description;
    const path = pathOverride ?? cfg.path;
    const canonical = canonicalFor(path);
    const img = image ?? OG_IMAGE;

    const prevTitle = document.title;
    document.title = title;

    upsertMeta("name", "description", desc);
    upsertMeta("name", "robots", cfg.index ? "index, follow" : "noindex, nofollow");
    upsertLink("canonical", canonical);

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", SITE_LOCALE);
    upsertMeta("property", "og:locale:alternate", SITE_LOCALE_ALT);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:image", img);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:site", TWITTER_HANDLE);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", desc);
    upsertMeta("name", "twitter:image", img);

    return () => {
      document.title = prevTitle;
    };
  }, [page, titleOverride, descOverride, pathOverride, image]);

  return null;
}
