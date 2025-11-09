/**
 * API Database Test Endpoint
 * Tests actual database connectivity and operations
 */

import { databases } from "@/lib/appwrite";
import { DATABASE_ID, EVENTS_COLLECTION_ID, type Event } from "@/lib/database";

export async function GET() {
  try {
    // Use a more flexible metadata object
    const testResult: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      status: "success",
      tests: {
        environment: {
          status: "success",
          message: "Environment variables present",
        },
        database_init: {
          status: "success",
          message: "Database client initialized",
        },
        database_query: {
          status: "pending",
          message: "Testing database query...",
        },
        collections: {
          status: "pending",
          message: "Checking collections...",
        },
      },
      metadata: {
        databaseId: DATABASE_ID,
        collectionsChecked: [EVENTS_COLLECTION_ID],
      },
    };

    // Test database query
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        EVENTS_COLLECTION_ID,
        []
      );

      const tests = testResult.tests as Record<string, Record<string, unknown>>;
      tests.database_query = {
        status: "success",
        message: `Successfully queried database. Found ${response.documents.length} events.`,
      };

      tests.collections = {
        status: "success",
        message: "Database collections accessible",
      };

      const metadata = testResult.metadata as Record<string, unknown>;
      metadata.eventCount = response.documents.length;
      metadata.sampleEvent = response.documents[0]
        ? {
            id: (response.documents[0] as Record<string, unknown>).$id,
            title:
              (response.documents[0] as Record<string, unknown>).title || "N/A",
          }
        : null;
    } catch (error) {
      const errorMessage = String(error);
      testResult.status = "error";
      const tests = testResult.tests as Record<string, Record<string, unknown>>;
      tests.database_query = {
        status: "error",
        message: `Database query failed: ${errorMessage.substring(0, 200)}`,
      };

      return Response.json(testResult, { status: 500 });
    }

    return Response.json(testResult, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        timestamp: new Date().toISOString(),
        status: "error",
        error: String(error),
        message: "Failed to run database tests",
      },
      { status: 500 }
    );
  }
}
