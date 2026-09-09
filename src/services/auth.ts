/* ================================================================
   VERRAA — auth API (thin wrapper over the active Backend).
   ================================================================ */

import { backend, type RoleInfo } from "./backend";

export const coachSignUp = (email: string, password: string, name: string, remember: boolean): Promise<void> =>
  backend.coachSignUp(email, password, name, remember);

export const coachSignIn = (email: string, password: string, remember: boolean): Promise<void> =>
  backend.coachSignIn(email, password, remember);

/** Verify the 6-digit signup code emailed after coachSignUp. */
export const verifyCoachOtp = (email: string, token: string): Promise<void> =>
  backend.verifyCoachOtp(email, token);

/** Resend the 6-digit signup code. */
export const resendCoachOtp = (email: string): Promise<void> =>
  backend.resendCoachOtp(email);

/** Username + password — the backend resolves the synthetic email internally. */
export const clientSignIn = (username: string, password: string, remember: boolean): Promise<void> =>
  backend.clientSignIn(username, password, remember);

/** Owner/Admin sign in with email and password. */
export const ownerSignIn = (email: string, password: string, remember: boolean): Promise<void> =>
  backend.ownerSignIn(email, password, remember);

export const signOut = (): Promise<void> => backend.signOut();

export const getSessionUserId = (): Promise<string | null> => backend.getSessionUserId();

export const onAuthChange = (cb: (userId: string | null) => void): (() => void) =>
  backend.onAuthChange(cb);

export const resolveRole = (userId: string): Promise<RoleInfo | null> => backend.resolveRole(userId);
