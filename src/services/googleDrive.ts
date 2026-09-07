/**
 * VERRAA — check-in photo uploads to Google Drive.
 *
 * Why Drive: check-in photos were stored as base64 data URLs inside the
 * `check_ins.photo` Postgres column. Every photo (~150-300KB of text) inflated
 * the database and was re-downloaded on every `load()`. Now the image bytes
 * live in the uploader's own Google Drive and only a short public link
 * (~60 chars) is saved in `check_ins.photo` — the DB stays tiny.
 *
 * Auth model: the uploader (client in client-mode, coach in coach-mode) grants
 * `drive.file` consent through Google's popup (see googleOAuth.ts). The app
 * only ever sees files IT created — never the user's whole Drive.
 *
 * Sharing: after upload the file gets an `anyone/reader` permission so the
 * coach's `<img>` can render it without any login. The stored URL is the
 * embeddable `lh3.googleusercontent.com` form (NOT webViewLink, which doesn't
 * render inside <img> tags).
 */

import { getValidToken } from "./googleOAuth";

/** Downscale any image file to a compact JPEG Blob (fast upload, small Drive usage). */
export function downscaleToJpeg(file: File | Blob, max = 1280, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          // Fallback: upload the original bytes as-is.
          resolve(file instanceof File ? file : new Blob([file], { type: "image/jpeg" }));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not compress the image."))),
          "image/jpeg",
          quality,
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error("Could not read that image."));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image — try another file."));
    };
    img.src = url;
  });
}

export interface DriveUploadResult {
  fileId: string;
  /** Embeddable <img>-ready URL. THIS is what gets saved in check_ins.photo. */
  url: string;
}

const friendlyDriveError = (e: unknown): Error => {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/popup_closed|sign-in window was closed|cancelled/i.test(msg)) {
    return new Error("Google Drive sign-in was closed — tap Upload again and allow access to save the photo.");
  }
  if (/Couldn't load Google sign-in|ad-blocker/i.test(msg)) {
    return new Error("Couldn't reach Google (ad-blocker?). Disable it for this site and try again — or submit without a photo.");
  }
  if (/HTTP 403/i.test(msg)) {
    return new Error("Google refused the upload (quota or permission). Try again — or submit without a photo.");
  }
  if (/HTTP 401/i.test(msg)) {
    return new Error("Google session expired — tap Upload again to reconnect, or submit without a photo.");
  }
  return new Error(msg || "Couldn't upload to Google Drive. Try again — or submit without a photo.");
};

async function driveFetch(
  clientId: string | undefined,
  path: string,
  init: RequestInit,
  retry = true,
): Promise<Response> {
  let token = await getValidToken(clientId);
  let res = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (res.status === 401 && retry) {
    token = await getValidToken(clientId, true);
    res = await fetch(`https://www.googleapis.com${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  }
  return res;
}

/**
 * Upload a check-in photo to the uploader's Drive and return a public
 * embeddable link. Triggers the Google consent popup on first use.
 */
export async function uploadCheckinPhoto(
  file: File | Blob,
  name: string,
  clientId?: string,
): Promise<DriveUploadResult> {
  let blob: Blob;
  try {
    blob = await downscaleToJpeg(file);
  } catch (e) {
    throw friendlyDriveError(e);
  }

  const safeName = (name || "checkin.jpg").replace(/[\\/:*?"<>|#]/g, "-").slice(0, 120);
  const boundary = `verraa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const metadata = JSON.stringify({ name: safeName, mimeType: "image/jpeg" });

  // Multipart/related body: [metadata JSON][JPEG bytes].
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = new Blob([head, blob, tail]);

  let createRes: Response;
  try {
    createRes = await driveFetch(clientId, "/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
  } catch (e) {
    throw friendlyDriveError(e);
  }
  if (!createRes.ok) throw friendlyDriveError(new Error(`Google Sheets error (HTTP ${createRes.status})`.replace("Sheets", "Drive")));
  const created = (await createRes.json()) as { id?: string };
  const fileId = String(created.id ?? "");
  if (!fileId) throw friendlyDriveError(new Error("Google Drive didn't return a file id."));

  // Public read so the coach side renders with a plain <img> (no login needed).
  const permRes = await driveFetch(clientId, `/drive/v3/files/${encodeURIComponent(fileId)}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!permRes.ok) {
    // The bytes are already on Drive — still usable by the owner, but the
    // coach couldn't see it. Surface it instead of saving a broken link.
    try {
      await driveFetch(clientId, `/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE" }, false);
    } catch {
      /* best-effort cleanup */
    }
    throw friendlyDriveError(new Error(`Google Drive error (HTTP ${permRes.status}) while sharing the photo.`));
  }

  return { fileId, url: driveEmbedUrl(fileId) };
}

/** Canonical embeddable URL for a Drive file id (works in <img> once shared anyone/reader). */
export const driveEmbedUrl = (fileId: string): string => `https://lh3.googleusercontent.com/d/${fileId}=w1000`;

/**
 * Normalize anything ever saved in `photo` to an <img>-renderable src:
 * - data: URLs (legacy rows) pass through untouched,
 * - Drive webViewLinks / ids convert to the embeddable form,
 * - already-embeddable URLs pass through.
 */
export function photoSrc(photo?: string): string | undefined {
  if (!photo) return undefined;
  const p = photo.trim();
  if (!p) return undefined;
  if (p.startsWith("data:") || p.startsWith("blob:") || p.startsWith("https://lh3.googleusercontent.com/d/")) return p;
  const m = p.match(/[-\w]{25,}/);
  if (p.includes("drive.google.com") && m) return driveEmbedUrl(m[0]);
  return p;
}
