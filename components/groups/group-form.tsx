"use client";

import { useActionState, useState } from "react";
import { VButton, Well } from "@/components/vgui";
import { useT } from "@/components/i18n";
import type { ActionState } from "@/lib/groups/actions";
import { toSlug } from "@/lib/groups/form";

type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

const input =
  "sunk text-text w-full px-1.5 py-1 text-[13px] outline-none focus:bg-row";

/** Create (with the fixed address) or edit a group. Errors come back from the server action. */
export function GroupForm({
  action,
  withSlug,
  defaults,
  submit,
  host,
}: {
  action: FormAction;
  withSlug: boolean;
  defaults?: { name: string; faceitClub: string | null };
  submit: string;
  /** Shown in the address preview, e.g. mixer-gray.vercel.app. */
  host?: string;
}) {
  const t = useT();
  const [state, run, pending] = useActionState(action, undefined);
  const [slug, setSlug] = useState("");
  return (
    <form action={run} className="flex flex-col gap-2">
      <label className="flex flex-col gap-0.5">
        <span className="text-dim text-[11px]">{t.groups.name}</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          defaultValue={defaults?.name}
          className={input}
        />
      </label>
      {withSlug && (
        <label className="flex flex-col gap-0.5">
          <span className="text-dim text-[11px]">{t.groups.slug}</span>
          <input
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]"
            title={t.groups.errors.slug}
            value={slug}
            onChange={(e) => setSlug(toSlug(e.target.value))}
            autoCapitalize="none"
            spellCheck={false}
            className={input}
          />
          <span className="text-[11px]">
            <span className="text-dim">{t.groups.slugPreview} </span>
            {host}/g/<b className="text-gold">{slug || "…"}</b>
          </span>
          <span className="text-dim text-[11px]">{t.groups.slugHint}</span>
        </label>
      )}
      <label className="flex flex-col gap-0.5">
        <span className="text-dim text-[11px]">{t.groups.faceitClub}</span>
        <input
          name="faceitClub"
          type="url"
          placeholder="https://www.faceit.com/…/club/…"
          defaultValue={defaults?.faceitClub ?? ""}
          className={input}
        />
      </label>
      {state && (
        <Well role="status" className="text-dim px-2 py-1.5 text-[11px]">
          {"error" in state ? t.groups.errors[state.error] : t.groups.saved}
        </Well>
      )}
      <VButton type="submit" primary disabled={pending}>
        {submit}
      </VButton>
    </form>
  );
}
