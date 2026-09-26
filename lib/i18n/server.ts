// Server-side language: the `mixer.lang` cookie set by the flag toggle (English by default).

import { cookies } from "next/headers";
import { DICTS, LANG_COOKIE, parseLang, type Dict, type Lang } from "./dict";

export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getDict(): Promise<Dict> {
  return DICTS[await getLang()];
}
