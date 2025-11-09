/**
 * Backend-Frontend Connectivity Check Utility
 * Diagnoses connection issues between frontend and Appwrite backend
 */

import { Client, Account, Databases, Storage } from "appwrite";

export interface ConnectivityStatus {
  appwriteConnected: boolean;
  endpointValid: boolean;
  projectIdValid: boolean;
  databaseIdValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    endpoint?: string;
    projectId?: string;
    databaseId?: string;
    accountStatus?: string;
    storageStatus?: string;
    databaseStatus?: string;
  };
}

/**
 * Check if environment variables are properly configured
 */
export function checkEnvironmentVariables(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  const requiredVars = [
    "NEXT_PUBLIC_APPWRITE_ENDPOINT",
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    "NEXT_PUBLIC_APPWRITE_DATABASE_ID",
  ];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      errors.push(`Missing environment variable: ${varName}`);
    } else if (value.includes("your_")) {
      errors.push(
        `Environment variable ${varName} is not configured (contains placeholder)`
      );
    }
  }

  // Check optional but recommended variables
  const optionalVars = [
    "NEXT_PUBLIC_APPWRITE_BUCKET_ID",
    "NEXT_PUBLIC_EMAILJS_SERVICE_ID",
  ];

  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (!value) {
      warnings.push(`Optional variable not set: ${varName}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Test Appwrite client initialization
 */
export async function testAppwriteConnection(): Promise<ConnectivityStatus> {
  const status: ConnectivityStatus = {
    appwriteConnected: false,
    endpointValid: false,
    projectIdValid: false,
    databaseIdValid: false,
    errors: [],
    warnings: [],
    details: {},
  };

  // Check environment variables first
  const envCheck = checkEnvironmentVariables();
  if (!envCheck.valid) {
    status.errors.push(...envCheck.errors);
    status.warnings.push(...envCheck.warnings);
    return status;
  }

  try {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

    // Validate URLs and IDs
    if (endpoint) {
      try {
        new URL(endpoint);
        status.endpointValid = true;
        status.details.endpoint = endpoint;
      } catch (e) {
        status.errors.push(`Invalid endpoint URL: ${endpoint}`);
      }
    }

    if (projectId && projectId.length > 0) {
      status.projectIdValid = true;
      status.details.projectId = projectId;
    }

    if (databaseId && databaseId.length > 0) {
      status.databaseIdValid = true;
      status.details.databaseId = databaseId;
    }

    // Try to initialize Appwrite client
    const client = new Client()
      .setEndpoint(endpoint || "")
      .setProject(projectId || "");

    try {
      const account = new Account(client);
      status.details.accountStatus = "✓ Initialized";
    } catch (e) {
      status.errors.push(`Failed to initialize Account: ${String(e)}`);
    }

    try {
      const databases = new Databases(client);
      status.details.databaseStatus = "✓ Initialized";
    } catch (e) {
      status.errors.push(`Failed to initialize Databases: ${String(e)}`);
    }

    try {
      const storage = new Storage(client);
      status.details.storageStatus = "✓ Initialized";
    } catch (e) {
      status.errors.push(`Failed to initialize Storage: ${String(e)}`);
    }

    // If all initializations succeeded
    if (
      status.details.accountStatus &&
      status.details.databaseStatus &&
      status.details.storageStatus
    ) {
      status.appwriteConnected = true;
    }
  } catch (error) {
    status.errors.push(`Unexpected error during connectivity check: ${String(error)}`);
  }

  return status;
}

/**
 * Format connectivity status for logging/display
 */
export function formatConnectivityStatus(status: ConnectivityStatus): string {
  const lines: string[] = [];

  lines.push("=== Backend-Frontend Connectivity Report ===");
  lines.push(
    `Appwrite Connected: ${status.appwriteConnected ? "✓ YES" : "✗ NO"}`
  );
  lines.push(`Endpoint Valid: ${status.endpointValid ? "✓ YES" : "✗ NO"}`);
  lines.push(`Project ID Valid: ${status.projectIdValid ? "✓ YES" : "✗ NO"}`);
  lines.push(`Database ID Valid: ${status.databaseIdValid ? "✓ YES" : "✗ NO"}`);

  if (status.details.endpoint) {
    lines.push(`\nEndpoint: ${status.details.endpoint}`);
  }
  if (status.details.projectId) {
    lines.push(`Project ID: ${status.details.projectId.substring(0, 8)}...`);
  }
  if (status.details.databaseId) {
    lines.push(`Database ID: ${status.details.databaseId.substring(0, 8)}...`);
  }

  if (status.details.accountStatus)
    lines.push(`Account Service: ${status.details.accountStatus}`);
  if (status.details.databaseStatus)
    lines.push(`Database Service: ${status.details.databaseStatus}`);
  if (status.details.storageStatus)
    lines.push(`Storage Service: ${status.details.storageStatus}`);

  if (status.errors.length > 0) {
    lines.push("\n⚠️ ERRORS:");
    status.errors.forEach((e) => lines.push(`  - ${e}`));
  }

  if (status.warnings.length > 0) {
    lines.push("\n⚠️ WARNINGS:");
    status.warnings.forEach((w) => lines.push(`  - ${w}`));
  }

  return lines.join("\n");
}
