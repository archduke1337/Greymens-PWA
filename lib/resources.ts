import { APPWRITE_CONFIG } from "./appwrite";
import type { Resource } from "./types";

export type { Resource };

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const RESOURCES_COLLECTION = "resources";

export { DATABASE_ID, RESOURCES_COLLECTION };
