/**
 * Connectivity Check Page
 * Used to diagnose backend-frontend connectivity issues
 */

"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon } from "lucide-react";
import { Button, Card, CardContent, CardHeader } from "@heroui/react";

interface ConnectivityResult {
  status: "checking" | "success" | "error";
  message: string;
  details: {
    endpoint?: string;
    projectId?: string;
    appwriteReachable?: boolean;
    databaseReachable?: boolean;
    timestamp?: string;
  };
  errors: string[];
}

export default function ConnectivityCheckPage() {
  const [result, setResult] = useState<ConnectivityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const checkConnectivity = async () => {
    setLoading(true);
    setResult({ status: "checking", message: "Testing connection...", details: {}, errors: [] });

    try {
      // Check environment variables
      const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
      const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

      if (!endpoint || !projectId) {
        setResult({
          status: "error",
          message: "Missing environment variables",
          details: { endpoint, projectId },
          errors: [
            !endpoint ? "Missing NEXT_PUBLIC_APPWRITE_ENDPOINT" : "",
            !projectId ? "Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID" : "",
          ].filter(Boolean),
        });
        setLoading(false);
        return;
      }

      // Reachability probe (not an auth check): only a 2xx counts as
      // reachable. A 4xx from an unauthenticated root request proves the
      // host answers but says nothing about the database — report it as
      // unknown and point at /api/health for the real check.
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        const reachable = response.ok;

        setResult({
          status: reachable ? "success" : "error",
          message: reachable
            ? "Connection test completed"
            : `Backend answered with status ${response.status} — run /api/health for the full check`,
          details: {
            endpoint,
            projectId: projectId.substring(0, 8) + "...",
            appwriteReachable: reachable,
            databaseReachable: reachable,
            timestamp: new Date().toISOString(),
          },
          errors: reachable ? [] : [`Endpoint returned status ${response.status}`],
        });
      } catch (error) {
        setResult({
          status: "error",
          message: "Failed to reach backend",
          details: {
            endpoint,
            projectId: projectId.substring(0, 8) + "...",
            appwriteReachable: false,
            timestamp: new Date().toISOString(),
          },
          errors: [`Network error: ${String(error)}`],
        });
      }
    } catch (error) {
      setResult({
        status: "error",
        message: "Unexpected error during connectivity check",
        details: {},
        errors: [String(error)],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-check on page load
    checkConnectivity();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Backend Connectivity Check
          </h1>
          <p className="text-slate-400">
            Diagnose connection issues between frontend and Appwrite backend
          </p>
        </div>

        <Card className="mb-6 border-0 bg-slate-800">
          <CardContent className="py-8">
            <Button size="lg"
              className="w-full"
              onPress={checkConnectivity}
              isPending={loading}
              isDisabled={loading}
            >
              {loading ? "Testing connection..." : "Run Connectivity Test"}
            </Button>
          </CardContent>
        </Card>

        <div aria-live="polite">
        {result && (
          <>
            <Card className="mb-6 border-0 bg-slate-800">
              <CardHeader className="flex gap-3 bg-slate-700/50">
                <div className="flex items-center gap-2">
                  {result.status === "success" ? (
                    <CheckCircleIcon className="w-6 h-6 text-green-500" aria-hidden="true" />
                  ) : result.status === "error" ? (
                    <XCircleIcon className="w-6 h-6 text-red-500" aria-hidden="true" />
                  ) : (
                    <AlertCircleIcon className="w-6 h-6 text-yellow-500" aria-hidden="true" />
                  )}
                  <h2 className="text-xl font-bold text-white">
                    {result.message}
                  </h2>
                </div>
              </CardHeader>
              <CardContent className="py-6 space-y-4">
                {result.details.endpoint && (
                  <div>
                    <p className="text-slate-400 text-sm">Endpoint:</p>
                    <p className="text-white font-mono text-sm break-all">
                      {result.details.endpoint}
                    </p>
                  </div>
                )}

                {result.details.projectId && (
                  <div>
                    <p className="text-slate-400 text-sm">Project ID:</p>
                    <p className="text-white font-mono text-sm">
                      {result.details.projectId}
                    </p>
                  </div>
                )}

                {result.details.appwriteReachable !== undefined && (
                  <div>
                    <p className="text-slate-400 text-sm">Appwrite Reachable:</p>
                    <p
                      className={`font-bold ${
                        result.details.appwriteReachable
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {result.details.appwriteReachable ? "✓ Yes" : "✗ No"}
                    </p>
                  </div>
                )}

                {result.details.databaseReachable !== undefined && (
                  <div>
                    <p className="text-slate-400 text-sm">
                      Database Reachable:
                    </p>
                    <p
                      className={`font-bold ${
                        result.details.databaseReachable
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {result.details.databaseReachable ? "✓ Yes" : "✗ No"}
                    </p>
                  </div>
                )}

                {result.details.timestamp && (
                  <div>
                    <p className="text-slate-400 text-sm">Checked at:</p>
                    <p className="text-white text-sm">
                      {new Date(result.details.timestamp).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {result.errors.length > 0 && (
              <Card className="border-0 bg-red-900/20 border-l-4 border-red-500">
                <CardHeader className="bg-red-900/30">
                  <h3 className="text-lg font-bold text-red-400">
                    Errors ({result.errors.length})
                  </h3>
                </CardHeader>
                <CardContent className="py-4">
                  <ul className="space-y-2">
                    {result.errors.map((error, idx) => (
                      <li
                        key={idx}
                        className="text-red-300 text-sm flex gap-2"
                      >
                        <span className="text-red-500 font-bold">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
        </div>

        <Card className="mt-8 border-0 bg-slate-800/50">
          <CardHeader className="text-lg font-bold text-white">
            Troubleshooting Guide
          </CardHeader>
          <CardContent className="text-slate-300 text-sm space-y-3">
            <div>
              <p className="font-bold text-white mb-1">1. Missing Environment Variables</p>
              <p>
                Ensure your .env.local file contains all required Appwrite
                configuration. Copy from .env.example and fill in actual values.
              </p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">2. Network Issues</p>
              <p>
                Check your internet connection and firewall settings. The
                Appwrite endpoint must be reachable from your machine.
              </p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">3. CORS Issues</p>
              <p>
                If the endpoint is reachable but queries fail, check CORS
                configuration in your Appwrite console.
              </p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">4. Check Appwrite Status</p>
              <p>
                Verify that your Appwrite instance is running and accessible.
                For Appwrite Cloud, check their status page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
