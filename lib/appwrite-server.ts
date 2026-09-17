// lib/appwrite-server.ts
//
// Server-only Appwrite client (Node.js route handlers and server code).
// NEVER import this module from client components: `node-appwrite` targets
// the Node runtime and must not enter the browser bundle.
//
// Why this exists alongside lib/appwrite.ts: the browser/admin client there
// is built on the `appwrite` SDK's `Databases` service, whose `listDocuments`
// calls the legacy `/databases/.../collections/.../documents` endpoint. The
// database itself is provisioned through the TablesDB API
// (`scripts/setup-appwrite.js`, `scripts/seed-data.ts`), so server reads go
// through `TablesDB.listRows` here — the canonical endpoint for those tables.
import { Client, Query, TablesDB } from "node-appwrite";

import { DATABASE_ID } from "@/lib/database";

export { Query };

export function createServerTablesClient() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("Server Appwrite configuration is incomplete");
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { tables: new TablesDB(client), databaseId: DATABASE_ID };
}
