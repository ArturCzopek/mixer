"use client";

import { useActionState } from "react";
import { VButton, Well } from "@/components/vgui";
import { useT } from "@/components/i18n";
import type { DiscordActionState } from "@/lib/discord/actions";
import type { DiscordChannel, DiscordSettings } from "@/lib/discord/connection";

type Action = (
  previous: DiscordActionState,
  form: FormData,
) => Promise<DiscordActionState>;

const input = "sunk text-text w-full px-1.5 py-1 text-[13px] outline-none";

export function DiscordSettings({
  groupId,
  guild,
  channels,
  settings,
  available,
  configured,
  result,
  action,
}: {
  groupId: string;
  guild: { id: string; name: string } | null;
  channels: DiscordChannel[];
  settings: Partial<DiscordSettings>;
  available: boolean;
  configured: boolean;
  result?: string;
  action: Action;
}) {
  const t = useT().groups.discord;
  const [state, run, pending] = useActionState(action, undefined);
  const voice = channels.filter((channel) => channel.type === 2);
  const text = channels.filter((channel) => channel.type === 0);
  const connect = `/auth/discord/guild?group=${encodeURIComponent(groupId)}`;

  return (
    <div className="border-hi mt-3 flex flex-col gap-2 border-t pt-3">
      <b>{t.title}</b>
      {result && result in t.result && (
        <Well role="status" className="text-dim px-2 py-1.5 text-[11px]">
          {t.result[result as keyof typeof t.result]}
        </Well>
      )}
      {!configured ? (
        <p className="text-dim text-[11px]">{t.setup}</p>
      ) : (
        <>
          {guild ? (
            <p className="text-dim text-[11px]">{t.connected(guild.name)}</p>
          ) : null}
          <a
            href={connect}
            className="bevel bg-sheet text-gold hover:bg-hover self-start px-3 py-2.5 text-[13px] font-bold"
          >
            {guild ? t.reconnect : t.connect}
          </a>
          {guild && !available && (
            <p className="text-dim text-[11px]">{t.unavailable}</p>
          )}
          {guild && available && (voice.length < 3 || text.length < 1) && (
            <p className="text-dim text-[11px]">{t.missingChannels}</p>
          )}
          {guild && available && voice.length >= 3 && text.length >= 1 && (
            <form action={run} className="flex flex-col gap-2">
              <p className="text-dim text-[11px]">{t.choose}</p>
              {(
                [
                  ["lobby", t.lobby, settings.lobby_channel_id, voice],
                  ["teamA", t.teamA, settings.team_a_channel_id, voice],
                  ["teamB", t.teamB, settings.team_b_channel_id, voice],
                  [
                    "notification",
                    t.notification,
                    settings.notification_channel_id,
                    text,
                  ],
                ] as const
              ).map(([name, label, selected, options]) => (
                <label key={name} className="flex flex-col gap-0.5">
                  <span className="text-dim text-[11px]">{label}</span>
                  <select
                    name={name}
                    required
                    defaultValue={
                      options.some((channel) => channel.id === selected)
                        ? selected
                        : ""
                    }
                    className={input}
                  >
                    <option value="" disabled>
                      {t.select}
                    </option>
                    {options.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {state && (
                <Well
                  role="status"
                  className="text-dim px-2 py-1.5 text-[11px]"
                >
                  {"error" in state ? t.errors[state.error] : t.saved}
                </Well>
              )}
              <VButton type="submit" primary disabled={pending}>
                {t.save}
              </VButton>
            </form>
          )}
        </>
      )}
    </div>
  );
}
