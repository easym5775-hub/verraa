/* ================================================================
   FORGE — Coach Settings: Profile, preferences, data management.
   ================================================================ */

import { useState } from "react";
import { useApp } from "../store";
import { Avatar, ConfirmModal, SectionCard, btnDanger, btnGhost, btnVolt, inputCls, labelCls } from "./ui";
import { IconDatabase, IconExternal, IconLink, IconRefresh, IconChevronLeft } from "../icons";

export function SettingsView() {
  const { me, toast, resetData } = useApp();

  const [helpOpen, setHelpOpen] = useState(false);

  const statusWord = "Local Storage";
  const dotCls = "bg-volt-400";

  const handleResetData = async () => {
    await resetData();
    toast("Demo data restored", "ok");
  };

  return (
    <>
      <SectionCard title="Settings" icon={<IconDatabase className="h-5 w-5" />} delay={0} bodyCls="p-0">
        <div className="space-y-4 p-4">

          {/* Connection Status */}
          <div className="rounded-xl border border-night-700 bg-night-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${dotCls}`}>
                  <IconDatabase className="h-5 w-5 text-night-950" />
                </span>
                <div>
                  <p className="font-bold text-mist-100">Data Storage</p>
                  <p className="text-sm text-mist-400">{statusWord}</p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${dotCls === "bg-volt-400" ? "bg-volt-400/10 text-volt-300" : "bg-mist-500/10 text-mist-300"}`}>
                {statusWord}
              </span>
            </div>
            <p className="mt-3 text-sm text-mist-500">
              Data is stored locally in your browser. In demo mode, data resets on refresh.
            </p>
          </div>

          {/* Profile Section */}
          <div className="rounded-xl border border-night-700 bg-night-800 p-4">
            <h3 className="font-bold text-mist-100">Profile</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Name</label>
                <input
                  className={inputCls}
                  defaultValue={me?.name ?? ""}
                  readOnly
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  className={inputCls}
                  defaultValue={me?.email ?? ""}
                  readOnly
                  type="email"
                />
              </div>
              <div>
                <label className={labelCls}>Role</label>
                <input
                  className={inputCls}
                  defaultValue={me?.role ?? ""}
                  readOnly
                />
              </div>
              <div>
                <label className={labelCls}>Coach ID</label>
                <input
                  className={inputCls}
                  defaultValue={me?.coachId ?? "—"}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className="rounded-xl border border-night-700 bg-night-800 p-4">
            <h3 className="font-bold text-mist-100">Data Management</h3>
            <div className="mt-3 space-y-3">
              <button
                onClick={handleResetData}
                className={`${btnDanger} w-full justify-start`}
              >
                <IconRefresh className="h-4 w-4" />
                Reset Demo Data
              </button>
              <p className="text-xs text-mist-500">
                Only available in demo mode. Restores all sample clients, workouts, and meals.
              </p>
            </div>
          </div>

          {/* Help & Links */}
          <div className="rounded-xl border border-night-700 bg-night-800 p-4">
            <h3 className="font-bold text-mist-100">Help & Resources</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnGhost} justify-center flex-1`}
              >
                <IconExternal className="h-4 w-4" />
                Documentation
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnGhost} justify-center flex-1`}
              >
                <IconLink className="h-4 w-4" />
                GitHub Repository
              </a>
            </div>
          </div>

          {/* Version Info */}
          <div className="rounded-xl border border-night-700 bg-night-800 p-4 text-center">
            <p className="text-xs text-mist-500">
              Forge Coaching OS · Version 1.0.0
            </p>
            <p className="mt-1 text-[10px] text-mist-600">
              Built with React, TypeScript, Vite, Tailwind CSS
            </p>
          </div>

        </div>
      </SectionCard>

      {/* Help Modal */}
      <ConfirmModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onConfirm={() => setHelpOpen(false)}
        title="Help & Shortcuts"
        message={
          <div className="space-y-3 text-sm text-mist-300">
            <p><strong>Keyboard Shortcuts:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><kbd className="px-1.5 py-0.5 bg-night-700 rounded text-mist-100 font-mono">Ctrl+K</kbd> Quick search</li>
              <li><kbd className="px-1.5 py-0.5 bg-night-700 rounded text-mist-100 font-mono">Esc</kbd> Close modals</li>
            </ul>
            <p className="pt-2"><strong>Data Storage:</strong> All data is saved locally in your browser's localStorage. In demo mode, sample data is loaded automatically.</p>
            <p><strong>Export/Import:</strong> Use browser dev tools to copy localStorage data for backup.</p>
          </div>
        }
        confirmLabel="Got it"
      />
    </>
  );
}