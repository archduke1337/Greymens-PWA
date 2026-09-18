/**
 * System Diagnostics Page
 * Comprehensive health check and diagnostic information
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, Chip } from "@heroui/react";
import {
  DatabaseIcon,
  ServerIcon,
  PlugIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react";

interface ServiceStatus {
  name: string;
  status: "connected" | "disconnected" | "unknown";
  message: string;
  details?: Record<string, string>;
}

interface DiagnosticsData {
  timestamp: string;
  environment: {
    nodeEnv: string;
    hasEnvVars: boolean;
    requiredVarsPresent: boolean;
  };
  services: ServiceStatus[];
  buildInfo: {
    nextVersion: string;
    typescript: boolean;
  };
}

export default function DiagnosticsPage() {
  const router = useRouter();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collectDiagnostics = async () => {
      const hasEnvVars =
        !!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT &&
        !!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
      const data: DiagnosticsData = {
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv: process.env.NODE_ENV || "unknown",
          hasEnvVars,
          requiredVarsPresent: hasEnvVars,
        },
        services: [],
        buildInfo: {
          nextVersion: "16.x",
          typescript: true,
        },
      };

      // Check Appwrite connectivity
      const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
      const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
      const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

      if (!endpoint || !projectId) {
        data.services.push({
          name: "Appwrite Configuration",
          status: "disconnected",
          message: "Missing required environment variables",
          details: {
              endpoint: endpoint ? "Set" : "Missing",
              projectId: projectId ? "Set" : "Missing",
              databaseId: databaseId ? "Set" : "Missing",
            },
        });
      } else {
        data.services.push({
          name: "Appwrite Configuration",
          status: "connected",
          message: "All required variables present",
          details: {
            endpoint: endpoint.substring(0, 50) + "...",
            projectId: projectId.substring(0, 12) + "...",
            databaseId: databaseId ? databaseId.substring(0, 12) + "..." : "Not set",
          },
        });

        // Reachability probe (not an auth check): only a 2xx from the
        // endpoint root counts as reachable. Anything else — including 4xx,
        // which an unauthenticated root request normally returns — is
        // reported honestly instead of as "connected".
        try {
          const response = await fetch(endpoint, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          const reachable = response.ok;
          data.services.push({
            name: "Appwrite Endpoint",
            status: reachable ? "connected" : "unknown",
            message: reachable
              ? "Endpoint is reachable"
              : `Endpoint returned status ${response.status} (for a full check, use /api/health)`,
          });
        } catch (error) {
          data.services.push({
            name: "Appwrite Endpoint",
            status: "disconnected",
            message: `Cannot reach endpoint: ${String(error).substring(0, 100)}`,
          });
        }
      }

      // Check EmailJS configuration. The browser can only see NEXT_PUBLIC_*
      // vars, and no such EmailJS var is provisioned (server uses
      // EMAILJS_SERVICE_ID in lib/contact-mailer.ts) — so "unknown" here
      // means "not visible to this check", never "broken". Report honestly.
      const emailJsServiceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      data.services.push({
        name: "EmailJS Configuration",
        status: emailJsServiceId ? "connected" : "unknown",
        message: emailJsServiceId
          ? "EmailJS is configured"
          : "Not visible to the browser check (server-side EMAILJS_* vars decide delivery)",
      });

      setDiagnostics(data);
      setLoading(false);
    };

    collectDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle2Icon className="w-5 h-5 text-success" />;
      case "disconnected":
        return <XCircleIcon className="w-5 h-5 text-danger" />;
      default:
        return <AlertTriangleIcon className="w-5 h-5 text-warning" />;
    }
  };

  const getStatusColor = (
    status: string
  ): "success" | "danger" | "warning" | "default" => {
    switch (status) {
      case "connected":
        return "success";
      case "disconnected":
        return "danger";
      default:
        return "warning";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Is it us or is it you?
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
              Something not loading? This page interrogates the backend and
              reports back honestly — so you know whether to retry, re-login,
              or fetch an officer.
            </p>
          </div>
          <img
            src="/Assets/Media/burden.gif"
            alt="A line figure bent under the weight of a giant cursor arrow"
            loading="lazy"
            className="h-28 w-28 shrink-0 rounded-3xl border border-default-200/70 object-cover"
          />
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center" role="status" aria-label="Loading diagnostics">
              <div className="text-default-500">Loading diagnostics...</div>
            </CardContent>
          </Card>
        ) : diagnostics ? (
          <>
            {/* Environment Info */}
            <Card className="mb-6 bg-card border">
              <CardHeader className="flex gap-2">
                <ServerIcon className="w-5 h-5" />
                <h2 className="text-xl font-bold">Environment</h2>
              </CardHeader>
              <CardContent className="py-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-default-500 text-sm">Node Environment</p>
                  <p className="text-foreground font-mono">
                    {diagnostics.environment.nodeEnv}
                  </p>
                </div>
                <div>
                  <p className="text-default-500 text-sm">Env Variables</p>
                  <Chip color={diagnostics.environment.hasEnvVars ? "success" : "danger"} variant="soft">
                    {diagnostics.environment.hasEnvVars
                      ? "Configured"
                      : "Missing"}
                  </Chip>
                </div>
                <div>
                  <p className="text-default-500 text-sm">Timestamp</p>
                  <p className="text-foreground text-sm">
                    {new Date(diagnostics.timestamp).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Services Status */}
            <Card className="mb-6 bg-card border">
              <CardHeader className="flex gap-2">
                <PlugIcon className="w-5 h-5" />
                <h2 className="text-xl font-bold">Services</h2>
              </CardHeader>
              <CardContent className="py-6 space-y-4">
                {diagnostics.services.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-start gap-4 p-4 bg-surface-secondary rounded-2xl border border-default-200/70"
                  >
                    <div className="mt-1">
                      {getStatusIcon(service.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-foreground">{service.name}</h3>
                        <Chip color={getStatusColor(service.status)} size="sm" variant="soft">
                          {service.status}
                        </Chip>
                      </div>
                      <p className="text-default-600 text-sm mb-2">
                        {service.message}
                      </p>
                      {service.details && (
                        <div className="grid grid-cols-1 gap-1 text-xs text-default-500">
                          {Object.entries(service.details).map(
                            ([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="font-mono text-default-400">
                                  {key}:
                                </span>
                                <span className="font-mono break-all">
                                  {value}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader className="flex gap-2">
                <DatabaseIcon className="w-5 h-5" />
                <h2 className="text-xl font-bold">Quick Actions</h2>
              </CardHeader>
              <CardContent className="py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button variant="primary" onPress={() => router.push("/connectivity-check")}>
                    Connection Test
                  </Button>
                  <Button variant="primary" onPress={() => router.push("/events")}>
                    Test Events Page
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-danger">
              Failed to load diagnostics
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
