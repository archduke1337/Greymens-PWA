/**
 * Extended User type that includes runtime-available fields
 * from the Appwrite Account service that aren't reflected in
 * the SDK's TypeScript type definitions.
 */
import type { Models } from "appwrite";

export type ExtendedUser<Preferences extends Models.Preferences = Models.DefaultPreferences> = Models.User<Preferences> & {
  email: string;
  phone: string;
  phoneVerification: boolean;
  emailVerification: boolean;
  prefs: Preferences;
  status: boolean;
  registration: string;
  accessedAt: string;
  mfa: boolean;
  targets: any[];
};
