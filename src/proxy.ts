import { NextRequest } from "next/server";
import { gandalfMiddleware } from "@bleuh-co/gandalf-sdk-next/middleware";

/**
 * Contrat d'embarquement Gandalf (embed + langue + thème + frame-ancestors hub).
 *
 * COMPAT NEXT 16 : la convention `middleware.ts` est dépréciée en Next 16 au
 * profit de `proxy.ts` (export nommé `proxy`). Le middleware du SDK reste une
 * fonction (NextRequest) => NextResponse — on le compose ici tel quel, sans
 * fork du SDK.
 *
 * Les routes /api/* sont exclues du matcher : le contrat d'embed (cookies
 * gandalf_embed/lang/theme, headers x-gandalf-*) ne concerne que les pages.
 */
export function proxy(req: NextRequest) {
  return gandalfMiddleware(req);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|favicon.svg|manifest.webmanifest|sw.js|api/).*)"],
};
