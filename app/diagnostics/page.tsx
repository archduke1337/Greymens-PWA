/**
 * System Diagnostics Page
 * Comprehensive health check and diagnostic information
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Badge } from "@heroui/badge";
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
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collectDiagnostics = async () => {
      const data: DiagnosticsData = {
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv: process.env.NODE_ENV || "unknown",
          hasEnvVars:
            !!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT &&
            !!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
          requiredVarsPresent: true,
        },
        services: [],
        buildInfo: {
          nextVersion: "14.x",
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
            endpoint: endpoint ? "✓ Set" : "✗ Missing",
            projectId: projectId ? "✓ Set" : "✗ Missing",
            databaseId: databaseId ? "✓ Set" : "✗ Missing",
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

        // Try to test Appwrite connectivity
        try {
          const response = await fetch(endpoint, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          data.services.push({
            name: "Appwrite Endpoint",
            status: response.ok ? "connected" : "disconnected",
            message: response.ok
              ? "Endpoint is reachable"
              : `Endpoint returned status ${response.status}`,
          });
        } catch (error) {
          data.services.push({
            name: "Appwrite Endpoint",
            status: "disconnected",
            message: `Cannot reach endpoint: ${String(error).substring(0, 100)}`,
          });
        }
      }

      // Check EmailJS configuration
      const emailJsServiceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      data.services.push({
        name: "EmailJS Configuration",
        status: emailJsServiceId ? "connected" : "unknown",
        message: emailJsServiceId
          ? "EmailJS is configured"
          : "EmailJS not configured (optional)",
      });

      setDiagnostics(data);
      setLoading(false);
    };

    collectDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle2Icon className="w-5 h-5 text-green-500" />;
      case "disconnected":
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            System Diagnostics
          </h1>
          <p className="text-slate-400">
            Complete health check and connectivity status
          </p>
        </div>

        {loading ? (
          <Card className="bg-slate-800 border-0">
            <CardBody className="py-12 text-center">
              <div className="text-slate-400">Loading diagnostics...</div>
            </CardBody>
          </Card>
        ) : diagnostics ? (
          <>
            {/* Environment Info */}
            <Card className="mb-6 bg-slate-800 border-0">
              <CardHeader className="bg-slate-700/50 flex gap-2">
                <ServerIcon className="w-5 h-5" />
                <h2 className="text-xl font-bold">Environment</h2>
              </CardHeader>
              <CardBody className="py-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-sm">Node Environment</p>
                  <p className="text-white font-mono">
                    {diagnostics.environment.nodeEnv}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Env Variables</p>
                  <Badge color={diagnostics.environment.hasEnvVars ? "success" : "danger"}>
                    {diagnostics.environment.hasEnvVars
                      ? "✓ Configured"
                      : "✗ Missing"}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Timestamp</p>
                  <p className="text-white text-sm">
                    {new Date(diagnostics.timestamp).toLocaleString()}
                  </p>
                </div>
              </CardBody>
            </Card>

            {/* Services Status */}
            <Card className="mb-6 bg-slate-800 border-0">
              <CardHeader className="bg-slate-700/50 flex gap-2">
                <PlugIcon className="w-5 h-5" />
                <h2 className="text-xl font-bold">Services</h2>
              </CardHeader>
              <CardBody className="py-6 space-y-4">
                {diagnostics.services.map((service, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600"
                  >
                    <div className="mt-1">
                      {getStatusIcon(service.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-white">{service.name}</h3>
                        <Badge color={getStatusColor(service.status)} size="sm">
                          {service.status}
                        </Badge>
                      </div>
                      <p className="text-slate-300 text-sm mb-2">
                        {service.message}
                      </p>
                      {service.details && (
                        <div className="grid grid-cols-1 gap-1 text-xs text-slate-400">
                          {Object.entries(service.details).map(
                            ([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="font-mono text-slate-500">
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
              </CardBody>
            </Card>

            {/* Quick Links */}
            <Card className="bg-slate-800 border-0">
              <CardHeader className="bg-slate-700/50 flex gap-2">
                <DatabaseIcon className="w-5 h-5" />
                <h2 className="text-xl font-bold">Quick Actions</h2>
              </CardHeader>
              <CardBody className="py-6">
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    as="a"
                    href="/connectivity-check"
                    color="primary"
                    variant="flat"
                  >
                    Connection Test
                  </Button>
                  <Button
                    as="a"
                    href="/events"
                    color="default"
                    variant="flat"
                  >
                    Test Events Page
                  </Button>
                </div>
              </CardBody>
            </Card>
          </>
        ) : (
          <Card className="bg-slate-800 border-0">
            <CardBody className="py-12 text-center text-red-400">
              Failed to load diagnostics
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
