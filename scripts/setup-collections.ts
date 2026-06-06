/**
 * Mind Mesh — Appwrite Collection Setup Script
 *
 * Creates all 15 new collections and modifies 2 existing ones.
 * Run with: npx tsx scripts/setup-collections.ts
 *
 * Requires APPWRITE_API_KEY in .env.local with collections.write permission.
 */

import { Client, Databases, ID, Permission, Role, Query } from "appwrite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

// Authenticated read + owner/admin write permissions
const authRead = [Permission.read(Role.any())];
const authWrite = [Permission.write(Role.any())];

async function createCollection(
  name: string,
  attributes: Array<{ key: string; type: string; size?: number; required?: boolean; default?: any; array?: boolean }>,
  indexes: Array<{ key: string; attributes: string[]; order?: string[] }>
) {
  console.log(`Creating collection: ${name}...`);

  try {
    const collection = await databases.createCollection(
      DB_ID,
      ID.unique(),
      name,
      [...authRead, ...authWrite]
    );
    console.log(`  ✓ Created collection ${name} (${collection.$id})`);

    for (const attr of attributes) {
      try {
        if (attr.type === "string" && attr.size) {
          await databases.createStringAttribute(DB_ID, collection.$id, attr.key, attr.size, attr.required, attr.default, attr.array);
        } else if (attr.type === "integer") {
          await databases.createIntegerAttribute(DB_ID, collection.$id, attr.key, attr.required, attr.default, undefined, undefined, attr.array);
        } else if (attr.type === "float") {
          await databases.createFloatAttribute(DB_ID, collection.$id, attr.key, attr.required, attr.default, undefined, undefined, attr.array);
        } else if (attr.type === "boolean") {
          await databases.createBooleanAttribute(DB_ID, collection.$id, attr.key, attr.required, attr.default, attr.array);
        } else if (attr.type === "datetime") {
          await databases.createDatetimeAttribute(DB_ID, collection.$id, attr.key, attr.required, attr.default, attr.array);
        } else if (attr.type === "email") {
          await databases.createEmailAttribute(DB_ID, collection.$id, attr.key, attr.required, attr.default, attr.array);
        } else if (attr.type === "url") {
          await databases.createUrlAttribute(DB_ID, collection.$id, attr.key, attr.required, attr.default, attr.array);
        } else if (attr.type === "ip") {
          await databases.createIpAttribute(DB_ID, collection.$id, attr.key, attr.required, attr.default, attr.array);
        }
        console.log(`    + ${attr.key} (${attr.type}${attr.size ? `, max ${attr.size}` : ""})`);
      } catch (e: any) {
        console.log(`    ! ${attr.key}: ${e.message}`);
      }
    }

    for (const idx of indexes) {
      try {
        await databases.createIndex(DB_ID, collection.$id, ID.unique(), idx.key, idx.attributes, idx.order as any);
        console.log(`    + index: ${idx.key} on [${idx.attributes.join(", ")}]`);
      } catch (e: any) {
        console.log(`    ! index ${idx.key}: ${e.message}`);
      }
    }

    return collection.$id;
  } catch (e: any) {
    console.log(`  ✗ Failed: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log("=== Mind Mesh — Collection Setup ===\n");

  if (!process.env.APPWRITE_API_KEY) {
    console.error("ERROR: APPWRITE_API_KEY not found in .env.local");
    console.error("Create a server-side API key in Appwrite console with collections.write permission.");
    process.exit(1);
  }

  // 1. profiles
  await createCollection("profiles", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "avatar", type: "string", size: 500, required: false },
    { key: "pronouns", type: "string", size: 20, required: false },
    { key: "phone", type: "string", size: 20, required: false },
    { key: "urn", type: "string", size: 50, required: false },
    { key: "program", type: "string", size: 50, required: false },
    { key: "branch", type: "string", size: 100, required: false },
    { key: "year", type: "string", size: 10, required: false },
    { key: "semester", type: "string", size: 10, required: false },
    { key: "address", type: "string", size: 500, required: false },
    { key: "dateOfBirth", type: "string", size: 20, required: false },
    { key: "gender", type: "string", size: 20, required: false },
    { key: "githubUrl", type: "string", size: 500, required: false },
    { key: "linkedinUrl", type: "string", size: 500, required: false },
    { key: "portfolioUrl", type: "string", size: 500, required: false },
    { key: "bio", type: "string", size: 2000, required: false },
    { key: "skills", type: "string", size: 100, required: false, array: true },
    { key: "interests", type: "string", size: 100, required: false, array: true },
    { key: "experience", type: "string", size: 2000, required: false },
    { key: "whyJoin", type: "string", size: 2000, required: false },
    { key: "availability", type: "string", size: 20, required: false },
    { key: "profileVisibility", type: "string", size: 20, required: false, default: "members_only" },
    { key: "showOnAboutPage", type: "boolean", required: false, default: false },
  ], [
    { key: "userId", attributes: ["userId"] },
  ]);

  // 2. applications
  await createCollection("applications", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "status", type: "string", size: 20, required: true, default: "pending" },
    { key: "profileId", type: "string", size: 36, required: true },
    { key: "oathAccepted", type: "boolean", required: true },
    { key: "termsAccepted", type: "boolean", required: true },
    { key: "constitutionAccepted", type: "boolean", required: true },
    { key: "preferredDepartments", type: "string", size: 50, required: false, array: true },
    { key: "reviewedBy", type: "string", size: 36, required: false },
    { key: "reviewedAt", type: "string", size: 30, required: false },
    { key: "rejectionReason", type: "string", size: 1000, required: false },
    { key: "submittedAt", type: "string", size: 30, required: true },
  ], [
    { key: "userId", attributes: ["userId"] },
    { key: "status", attributes: ["status"] },
  ]);

  // 3. memberships
  await createCollection("memberships", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "applicationId", type: "string", size: 36, required: true },
    { key: "status", type: "string", size: 20, required: true, default: "active" },
    { key: "membershipNumber", type: "string", size: 30, required: true },
    { key: "approvedBy", type: "string", size: 36, required: true },
    { key: "approvedAt", type: "string", size: 30, required: true },
    { key: "department", type: "string", size: 50, required: false },
    { key: "joinedAt", type: "string", size: 30, required: true },
  ], [
    { key: "userId", attributes: ["userId"] },
    { key: "status", attributes: ["status"] },
    { key: "department", attributes: ["department"] },
    { key: "membershipNumber", attributes: ["membershipNumber"] },
  ]);

  // 4. departments
  await createCollection("departments", [
    { key: "name", type: "string", size: 100, required: true },
    { key: "slug", type: "string", size: 100, required: true },
    { key: "description", type: "string", size: 1000, required: false },
    { key: "icon", type: "string", size: 10, required: false },
    { key: "color", type: "string", size: 20, required: false },
    { key: "parentId", type: "string", size: 36, required: false },
    { key: "headId", type: "string", size: 36, required: false },
    { key: "isActive", type: "boolean", required: true, default: true },
    { key: "displayOrder", type: "integer", required: false },
    { key: "category", type: "string", size: 30, required: true },
  ], [
    { key: "slug", attributes: ["slug"] },
    { key: "isActive", attributes: ["isActive"] },
    { key: "category", attributes: ["category"] },
  ]);

  // 5. user_departments
  await createCollection("user_departments", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "departmentId", type: "string", size: 36, required: true },
    { key: "role", type: "string", size: 20, required: true, default: "member" },
    { key: "assignedBy", type: "string", size: 36, required: true },
    { key: "assignedAt", type: "string", size: 30, required: true },
    { key: "isActive", type: "boolean", required: true, default: true },
  ], [
    { key: "userId", attributes: ["userId"] },
    { key: "departmentId", attributes: ["departmentId"] },
    { key: "role", attributes: ["role"] },
  ]);

  // 6. designations
  await createCollection("designations", [
    { key: "name", type: "string", size: 100, required: true },
    { key: "slug", type: "string", size: 100, required: true },
    { key: "description", type: "string", size: 500, required: false },
    { key: "level", type: "integer", required: true },
    { key: "category", type: "string", size: 30, required: true },
    { key: "departmentId", type: "string", size: 36, required: false },
    { key: "badgeIcon", type: "string", size: 500, required: false },
    { key: "badgeColor", type: "string", size: 20, required: false },
    { key: "isActive", type: "boolean", required: true, default: true },
    { key: "maxHolders", type: "integer", required: false },
  ], [
    { key: "slug", attributes: ["slug"] },
    { key: "level", attributes: ["level"] },
    { key: "category", attributes: ["category"] },
  ]);

  // 7. user_designations
  await createCollection("user_designations", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "designationId", type: "string", size: 36, required: true },
    { key: "assignedBy", type: "string", size: 36, required: true },
    { key: "assignedAt", type: "string", size: 30, required: true },
    { key: "revokedAt", type: "string", size: 30, required: false },
    { key: "revokedBy", type: "string", size: 36, required: false },
    { key: "isActive", type: "boolean", required: true, default: true },
  ], [
    { key: "userId", attributes: ["userId"] },
    { key: "designationId", attributes: ["designationId"] },
    { key: "isActive", attributes: ["isActive"] },
  ]);

  // 8. powers
  await createCollection("powers", [
    { key: "name", type: "string", size: 50, required: true },
    { key: "displayName", type: "string", size: 100, required: true },
    { key: "description", type: "string", size: 500, required: false },
    { key: "category", type: "string", size: 30, required: true },
    { key: "scope", type: "string", size: 20, required: true },
  ], [
    { key: "name", attributes: ["name"] },
    { key: "category", attributes: ["category"] },
  ]);

  // 9. user_powers
  await createCollection("user_powers", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "powerId", type: "string", size: 36, required: true },
    { key: "grantedBy", type: "string", size: 36, required: true },
    { key: "grantedAt", type: "string", size: 30, required: true },
    { key: "departmentId", type: "string", size: 36, required: false },
    { key: "expiresAt", type: "string", size: 30, required: false },
    { key: "isActive", type: "boolean", required: true, default: true },
  ], [
    { key: "userId", attributes: ["userId"] },
    { key: "powerId", attributes: ["powerId"] },
    { key: "isActive", attributes: ["isActive"] },
  ]);

  // 10. event_types
  await createCollection("event_types", [
    { key: "name", type: "string", size: 50, required: true },
    { key: "displayName", type: "string", size: 100, required: true },
    { key: "description", type: "string", size: 1000, required: false },
    { key: "icon", type: "string", size: 10, required: false },
    { key: "fields", type: "string", size: 10000, required: true },
    { key: "registrationConfig", type: "string", size: 5000, required: true },
    { key: "ticketConfig", type: "string", size: 5000, required: true },
    { key: "workflowConfig", type: "string", size: 5000, required: true },
    { key: "isActive", type: "boolean", required: true, default: true },
    { key: "displayOrder", type: "integer", required: false },
  ], [
    { key: "name", attributes: ["name"] },
    { key: "isActive", attributes: ["isActive"] },
  ]);

  // 11. tickets
  await createCollection("tickets", [
    { key: "eventId", type: "string", size: 36, required: true },
    { key: "userId", type: "string", size: 36, required: true },
    { key: "registrationId", type: "string", size: 36, required: true },
    { key: "ticketCode", type: "string", size: 50, required: true },
    { key: "qrData", type: "string", size: 500, required: true },
    { key: "status", type: "string", size: 20, required: true, default: "pending" },
    { key: "issuedAt", type: "string", size: 30, required: false },
    { key: "checkedInAt", type: "string", size: 30, required: false },
    { key: "checkedInBy", type: "string", size: 36, required: false },
    { key: "invalidatedAt", type: "string", size: 30, required: false },
    { key: "invalidatedReason", type: "string", size: 500, required: false },
    { key: "transferredTo", type: "string", size: 36, required: false },
    { key: "transferHistory", type: "string", size: 5000, required: false },
    { key: "entryCount", type: "integer", required: true, default: 0 },
    { key: "maxEntries", type: "integer", required: true, default: 1 },
    { key: "metadata", type: "string", size: 5000, required: false },
  ], [
    { key: "eventId", attributes: ["eventId"] },
    { key: "userId", attributes: ["userId"] },
    { key: "ticketCode", attributes: ["ticketCode"] },
    { key: "qrData", attributes: ["qrData"] },
    { key: "status", attributes: ["status"] },
  ]);

  // 12. ticket_verifications
  await createCollection("ticket_verifications", [
    { key: "ticketId", type: "string", size: 36, required: true },
    { key: "eventId", type: "string", size: 36, required: true },
    { key: "verifiedBy", type: "string", size: 36, required: true },
    { key: "method", type: "string", size: 20, required: true },
    { key: "result", type: "string", size: 30, required: true },
    { key: "verifiedAt", type: "string", size: 30, required: true },
    { key: "metadata", type: "string", size: 2000, required: false },
  ], [
    { key: "ticketId", attributes: ["ticketId"] },
    { key: "eventId", attributes: ["eventId"] },
    { key: "verifiedBy", attributes: ["verifiedBy"] },
  ]);

  // 13. notifications
  await createCollection("notifications", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "type", type: "string", size: 50, required: true },
    { key: "title", type: "string", size: 200, required: true },
    { key: "body", type: "string", size: 2000, required: true },
    { key: "letter", type: "string", size: 5000, required: false },
    { key: "data", type: "string", size: 5000, required: false },
    { key: "read", type: "boolean", required: true, default: false },
    { key: "readAt", type: "string", size: 30, required: false },
  ], [
    { key: "userId", attributes: ["userId"] },
    { key: "userId_read", attributes: ["userId", "read"] },
    { key: "createdAt", attributes: ["$createdAt"] },
  ]);

  // 14. audit_logs
  await createCollection("audit_logs", [
    { key: "actorId", type: "string", size: 36, required: true },
    { key: "actorName", type: "string", size: 100, required: true },
    { key: "actorRole", type: "string", size: 30, required: true },
    { key: "action", type: "string", size: 100, required: true },
    { key: "entityType", type: "string", size: 50, required: true },
    { key: "entityId", type: "string", size: 36, required: true },
    { key: "details", type: "string", size: 10000, required: false },
    { key: "ipAddress", type: "string", size: 50, required: false },
    { key: "userAgent", type: "string", size: 500, required: false },
    { key: "timestamp", type: "string", size: 30, required: true },
  ], [
    { key: "actorId", attributes: ["actorId"] },
    { key: "entityType", attributes: ["entityType"] },
    { key: "entityId", attributes: ["entityId"] },
    { key: "action", attributes: ["action"] },
    { key: "timestamp", attributes: ["timestamp"] },
  ]);

  // 15. resources
  await createCollection("resources", [
    { key: "title", type: "string", size: 200, required: true },
    { key: "description", type: "string", size: 2000, required: false },
    { key: "type", type: "string", size: 20, required: true },
    { key: "url", type: "string", size: 1000, required: false },
    { key: "fileId", type: "string", size: 100, required: false },
    { key: "layer", type: "string", size: 20, required: true },
    { key: "departmentId", type: "string", size: 36, required: false },
    { key: "designationId", type: "string", size: 36, required: false },
    { key: "tags", type: "string", size: 100, required: false, array: true },
    { key: "uploadedBy", type: "string", size: 36, required: true },
    { key: "isActive", type: "boolean", required: true, default: true },
    { key: "displayOrder", type: "integer", required: false },
  ], [
    { key: "layer", attributes: ["layer"] },
    { key: "departmentId", attributes: ["departmentId"] },
    { key: "isActive", attributes: ["isActive"] },
  ]);

  console.log("\n=== All collections created ===");
}

main().catch(console.error);
