/**
 * API Health Check Endpoint
 * Tests backend connectivity and service availability
 */

export async function GET() {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      status: "operational",
      services: {
        frontend: "healthy",
        appwrite: "checking",
      },
      checks: {
        environment: true,
        nodejs: process.version,
        nextjs: "14.x",
      },
    };

    // Check Appwrite connectivity
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

    if (!endpoint || !projectId) {
      return Response.json(
        {
          ...status,
          status: "degraded",
          services: {
            ...status.services,
            appwrite: "unconfigured",
          },
          error: "Missing Appwrite environment variables",
        },
        { status: 503 }
      );
    }

    try {
      const appwriteCheck = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      status.services.appwrite =
        appwriteCheck.ok || appwriteCheck.status < 500
          ? "healthy"
          : "degraded";

      return Response.json(status, {
        status: status.services.appwrite === "healthy" ? 200 : 503,
      });
    } catch (error) {
      status.services.appwrite = "unreachable";
      return Response.json(
        {
          ...status,
          status: "degraded",
          error: `Appwrite endpoint unreachable: ${String(error).substring(0, 100)}`,
        },
        { status: 503 }
      );
    }
  } catch (error) {
    return Response.json(
      {
        status: "error",
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
