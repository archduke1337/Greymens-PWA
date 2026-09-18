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
import { Client, Query, Storage, TablesDB } from "node-appwrite";

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

/**
 * Row shape with arbitrary columns, mirroring how callers already treat
 * `Models.Document` (system fields plus free-form column access).
 */
export type ServerRow = { $id: string; [key: string]: any };

export interface ServerDocumentList {
  documents: ServerRow[];
  total: number;
}

/**
 * Legacy-shaped database handle backed by TablesDB.
 *
 * The codebase was written against the `Databases` service
 * (`listDocuments` / `getDocument` / `createDocument` / `updateDocument` /
 * `deleteDocument` over `/databases/.../collections/.../documents`), while
 * the database itself is provisioned through the TablesDB API. This handle
 * keeps the exact call shapes and the `{ documents, total }` envelope so
 * call sites migrate by swapping the client constructor only — no query or
 * response-shape churn. Query strings are wire-compatible between the SDKs.
 */
export interface ServerDatabases {
  listDocuments(
    databaseId: string,
    collectionId: string,
    queries?: string[],
  ): Promise<ServerDocumentList>;
  getDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    queries?: string[],
  ): Promise<ServerRow>;
  createDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data: Record<string, any>,
    permissions?: string[],
  ): Promise<ServerRow>;
  updateDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data: Record<string, any>,
    permissions?: string[],
  ): Promise<ServerRow>;
  deleteDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
  ): Promise<{}>;
  incrementDocumentAttribute(
    databaseId: string,
    collectionId: string,
    documentId: string,
    attribute: string,
    value?: number,
    max?: number,
  ): Promise<ServerRow>;
  decrementDocumentAttribute(
    databaseId: string,
    collectionId: string,
    documentId: string,
    attribute: string,
    value?: number,
    min?: number,
  ): Promise<ServerRow>;
}

export function createServerStorage() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("Server Appwrite configuration is incomplete");
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { storage: new Storage(client) };
}

export function createServerDatabases(): { databases: ServerDatabases } {
  const { tables } = createServerTablesClient();
  const databases: ServerDatabases = {
    listDocuments: async (databaseId, collectionId, queries) => {
      const response = await tables.listRows({
        databaseId,
        tableId: collectionId,
        queries,
      });
      return {
        documents: response.rows as unknown as ServerRow[],
        total: response.total,
      };
    },
    getDocument: async (databaseId, collectionId, documentId, queries) => {
      const row = await tables.getRow({
        databaseId,
        tableId: collectionId,
        rowId: documentId,
        queries,
      });
      return row as unknown as ServerRow;
    },
    createDocument: async (databaseId, collectionId, documentId, data, permissions) => {
      const row = await tables.createRow({
        databaseId,
        tableId: collectionId,
        rowId: documentId,
        data,
        permissions,
      });
      return row as unknown as ServerRow;
    },
    updateDocument: async (databaseId, collectionId, documentId, data, permissions) => {
      const row = await tables.updateRow({
        databaseId,
        tableId: collectionId,
        rowId: documentId,
        data,
        permissions,
      });
      return row as unknown as ServerRow;
    },
    deleteDocument: async (databaseId, collectionId, documentId) => {
      await tables.deleteRow({ databaseId, tableId: collectionId, rowId: documentId });
      return {};
    },
    incrementDocumentAttribute: async (databaseId, collectionId, documentId, attribute, value, max) => {
      const row = await tables.incrementRowColumn({
        databaseId,
        tableId: collectionId,
        rowId: documentId,
        column: attribute,
        value,
        max,
      });
      return row as unknown as ServerRow;
    },
    decrementDocumentAttribute: async (databaseId, collectionId, documentId, attribute, value, min) => {
      const row = await tables.decrementRowColumn({
        databaseId,
        tableId: collectionId,
        rowId: documentId,
        column: attribute,
        value,
        min,
      });
      return row as unknown as ServerRow;
    },
  };
  return { databases };
}
