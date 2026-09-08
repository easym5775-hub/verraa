/* ================================================================
   VERRAA — coach settings: account, data & connection status.
   ================================================================ */

import { useState } from "react";
import { Database, KeyRound, LogOut, Moon, Sun, User } from "lucide-react";
import { useApp } from "../store";
import { useTheme, type Theme } from "../theme";
import { signOut } from "../services/auth";
import { SectionCard, btnDanger, btnPrimary, btnSecondary, btnSm, inputCls, labelCls } from "./ui";
import { PageHeader } from "./Shell";

export function SettingsView() {
  const { me, state, updateCoachName, toast } = useApp();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(me?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState("");

  const saveName = async () => {
    if (!name.trim()) return toast("Name can't be empty.", "warn");
    setSavingName(true);
    await updateCoachName(name.trim());
    setSavingName(false);
  };

  const themes: { id: Theme; label: string; hint: string; icon: typeof Moon }[] = [
    { id: "dark", label: "Dark", hint: "Brand look", icon: Moon },
    { id: "light", label: "Light", hint: "Bright gyms", icon: Sun },
  ];

  return (
    <div>
      <PageHeader title="Coach" accent="settings" sub="Appearance, account, connection and data controls" />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Appearance" icon={<Sun className="h-4.5 w-4.5" />} bodyCls="p-5">
          <div
            role="group"
            aria-label="Color theme"
            className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.07] bg-night-800 p-1.5"
          >
            {themes.map((t) => {
              const active = theme === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTheme(t.id)}
                  className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl px-3.5 text-start transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 ${
                    active ? "bg-volt-400 text-night-950 shadow-[0_4px_16px_-6px_rgba(205,241,75,0.5)]" : "text-mist-400 hover:bg-white/[0.05] hover:text-mist-100"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{t.label}</span>
                    <span className={`block truncate text-[11px] font-semibold ${active ? "text-night-950/60" : "text-mist-500"}`}>{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-mist-500">
            Light theme keeps every number readable under bright gym lighting. Your choice is saved on this device.
          </p>
        </SectionCard>

        <SectionCard title="Profile" icon={<User className="h-4.5 w-4.5" />} bodyCls="p-5">
          <div className="grid gap-4">
            <div>
              <label className={labelCls}>Display name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Coach Dana" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={`${inputCls} opacity-60`} value={me?.email ?? ""} readOnly />
            </div>
            <button className={`${btnPrimary} ${btnSm} w-fit`} onClick={() => void saveName()} disabled={savingName || name.trim() === (me?.name ?? "")}>
              {savingName ? "Saving…" : "Save changes"}
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Security" icon={<KeyRound className="h-4.5 w-4.5" />} bodyCls="p-5">
          <div className="grid gap-4">
            <div>
              <label className={labelCls}>New password</label>
              <input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
            <button
              className={`${btnSecondary} ${btnSm} w-fit`}
              onClick={() => {
                if (pw.length < 6) return toast("Password must be at least 6 characters.", "warn");
                toast("Password changes are managed through Supabase Auth.", "warn");
                setPw("");
              }}
            >
              Update password
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Connection" icon={<Database className="h-4.5 w-4.5" />} bodyCls="p-5">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-moss-400 tick-pulse" />
            <p className="font-display text-xl font-bold uppercase text-mist-100">Supabase · live</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-mist-400">
            Data is stored in your Supabase project and scoped by Row Level Security — each account only ever sees its own rows.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-night-700 bg-night-800 p-3">
              <p className="font-display text-2xl font-bold text-volt-300 tnum">{state.clients.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">clients</p>
            </div>
            <div className="rounded-xl border border-night-700 bg-night-800 p-3">
              <p className="font-display text-2xl font-bold text-volt-300 tnum">{state.checkIns.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">check-ins</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Data" icon={<Database className="h-4.5 w-4.5" />} bodyCls="p-5">
          <p className="text-xs leading-5 text-mist-400">
            Live data is managed in Supabase. Backups, exports and schema changes live in your Supabase project —
            nothing destructive can be triggered from here.
          </p>
          <div className="mt-5 border-t border-night-700 pt-4">
            <button className={`${btnDanger} ${btnSm}`} onClick={() => void signOut()}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
