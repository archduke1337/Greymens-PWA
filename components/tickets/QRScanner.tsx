// components/tickets/QRScanner.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Ticket } from "@/lib/types";
import { toast } from "sonner";
import {
  Camera,
  CameraOff,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  QrCode,
  User,
  Hash,
  RotateCcw,
  X,
} from "lucide-react";
import { Button, Card, CardContent, InputGroup, Badge } from "@heroui/react";

interface QRScannerProps {
  eventId: string;
  onCheckIn?: (ticket: Ticket) => void;
}

type ScanResult = {
  type: "success" | "error" | "warning";
  message: string;
  ticket?: Ticket;
};

export default function QRScanner({ eventId, onCheckIn }: QRScannerProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect: (source: HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>> } | null>(null);
  const detectingRef = useRef(false);
  const lastValueRef = useRef<string>("");
  const hintShownRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [decodeHint, setDecodeHint] = useState<string>("");
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [manualSearching, setManualSearching] = useState(false);
  const [mode, setMode] = useState<"camera" | "manual">("camera");

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setScanning(false);
  }, []);

  // scanFrame is declared below (needs refs + state settled); startCamera calls
  // it through a ref to avoid use-before-declaration. scanFrame itself is
  // stable ([] deps, refs only) so the ref never goes stale.
  const scanFrameRef = useRef<() => void>(() => {});

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setScanning(true);
        lastValueRef.current = "";
        scanFrameRef.current();
      }
    } catch (error) {
      console.error("Camera error:", error);
      setCameraError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permissions."
          : error instanceof DOMException && error.name === "NotFoundError"
            ? "No camera found on this device."
            : "Failed to access camera. Try manual search instead."
      );
      setMode("manual");
    }
  }, []);

  const processQrDataRef = useRef<(qrData: string) => Promise<void>>(async () => {});

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Native decode path: cache one BarcodeDetector and reuse it each frame.
      try {
        const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
        if (!BarcodeDetectorCtor) {
          if (!hintShownRef.current) {
            hintShownRef.current = true;
            setDecodeHint("Camera preview only on this browser — paste the QR text below");
          }
        } else {
          if (!detectorRef.current) {
            detectorRef.current = new BarcodeDetectorCtor({ formats: ["qr_code"] });
          }
          const detector = detectorRef.current;
          if (detector && !detectingRef.current) {
            detectingRef.current = true;
            detector.detect(canvas).then((codes) => {
              const rawValue = codes?.[0]?.rawValue;
              if (rawValue && rawValue !== lastValueRef.current) {
                lastValueRef.current = rawValue;
                void processQrDataRef.current(rawValue);
              }
            }).catch(() => {
              // Per-frame decode failures are ignored; the loop keeps running.
            }).finally(() => {
              detectingRef.current = false;
            });
          }
        }
      } catch {
        if (!hintShownRef.current) {
          hintShownRef.current = true;
          setDecodeHint("Camera preview only on this browser — paste the QR text below");
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, []);

  useEffect(() => {
    scanFrameRef.current = scanFrame;
  }, [scanFrame]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  /**
   * All door operations go through /api/tickets/verify.
   *
   * The scanner previously read and wrote the tickets table directly from the
   * browser. That table grants no client write, so check-in could never succeed,
   * and it is readable by every signed-in account, so the manual-search path was
   * pulling an entire event's attendee list into the browser to filter locally.
   */
  const lookupTicket = useCallback(async (query: string): Promise<{ ticket?: Ticket; error?: string }> => {
    const trimmed = query.trim();
    const attempts = trimmed.includes("@")
      ? [`email=${encodeURIComponent(trimmed)}`]
      : [`code=${encodeURIComponent(trimmed)}`, `qrData=${encodeURIComponent(trimmed)}`];

    for (const params of attempts) {
      const response = await fetch(`/api/tickets/verify?${params}`, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json().catch(() => null) as { ticket?: Ticket } | null;
        if (payload?.ticket) return { ticket: payload.ticket };
      } else if (response.status !== 404) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        return { error: payload?.error || "Search failed" };
      }
    }
    return { error: "No ticket found matching that query" };
  }, []);

  const checkInTicket = useCallback(async (ticket: Ticket, method: "qr_scan" | "manual_search", qrData?: string) => {
    const response = await fetch("/api/tickets/verify", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.$id, action: "checkIn", method, eventId, ...(qrData ? { qrData } : {}) }),
    });
    const payload = await response.json().catch(() => null) as { ticket?: Ticket; message?: string; error?: string } | null;
    return {
      ok: response.ok,
      ticket: payload?.ticket ?? ticket,
      message: response.ok
        ? payload?.message || "Checked in"
        : payload?.error || "Check-in failed",
    };
  }, [eventId]);

  const processQrData = useCallback(
    async (qrData: string) => {
      if (!user) {
        setLastResult({ type: "error", message: "You must be logged in" });
        return;
      }

      setLastResult({ type: "warning", message: "Looking up ticket..." });

      try {
        const { ticket, error } = await lookupTicket(qrData);
        if (!ticket) {
          setLastResult({ type: "error", message: error || "No ticket found for this QR code" });
          return;
        }

        if (ticket.eventId !== eventId) {
          setLastResult({
            type: "error",
            message: "This ticket is for a different event",
            ticket,
          });
          return;
        }

        const result = await checkInTicket(ticket, "qr_scan", qrData);

        if (result.ok) {
          setLastResult({ type: "success", message: result.message, ticket: result.ticket });
          toast.success(`Checked in: ${ticket.ticketCode}`);
          onCheckIn?.(result.ticket);
        } else {
          setLastResult({ type: "error", message: result.message, ticket });
          toast.error(result.message);
        }
      } catch (error) {
        console.error("Check-in error:", error);
        setLastResult({ type: "error", message: "Failed to process ticket" });
        toast.error("Failed to process ticket");
      }
    },
    [user, eventId, onCheckIn, lookupTicket, checkInTicket]
  );

  // Keep the camera loop pointed at the latest processor without re-creating
  // the rAF loop every render.
  useEffect(() => {
    processQrDataRef.current = processQrData;
  }, [processQrData]);

  const handleManualSearch = async () => {
    if (!manualQuery.trim()) {
      toast.error("Please enter a ticket code, QR payload, or attendee email");
      return;
    }

    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    setManualSearching(true);
    setLastResult(null);

    try {
      // Resolved server-side, one ticket at a time, instead of downloading the
      // whole door list to filter in the browser.
      const { ticket, error } = await lookupTicket(manualQuery);
      if (!ticket) {
        setLastResult({ type: "error", message: error || "No ticket found matching that query" });
        return;
      }

      const result = await checkInTicket(ticket, "manual_search");

      if (result.ok) {
        setLastResult({ type: "success", message: result.message, ticket: result.ticket });
        toast.success(`Checked in: ${ticket.ticketCode}`);
        onCheckIn?.(result.ticket);
      } else {
        setLastResult({ type: "error", message: result.message, ticket });
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Manual search error:", error);
      setLastResult({ type: "error", message: "Search failed" });
      toast.error("Search failed");
    } finally {
      setManualSearching(false);
    }
  };

  const resetScanner = () => {
    setLastResult(null);
    setManualQuery("");
  };

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "camera" ? "primary" : "ghost"}
          size="sm"
          onPress={() => {
            setMode("camera");
            setLastResult(null);
          }}
        >
          <Camera className="w-4 h-4 mr-2" />
          Camera Scan
        </Button>
        <Button
          variant={mode === "manual" ? "primary" : "ghost"}
          size="sm"
          onPress={() => {
            setMode("manual");
            stopCamera();
            setLastResult(null);
          }}
        >
          <Search className="w-4 h-4 mr-2" />
          Manual Search
        </Button>
      </div>

      {/* Camera Mode */}
      {mode === "camera" && (
        <Card className="border-none shadow-lg">
          <CardContent className="p-0">
            <div className="relative bg-black rounded-t-xl overflow-hidden">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                className="w-full aspect-[4/3] object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-white/60 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-green-400/60 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {/* Camera Error Overlay */}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
                  <div className="text-center">
                    <CameraOff className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-white text-sm mb-4">{cameraError}</p>
                    <Button
                      variant="primary"
                      size="sm"
                      onPress={() => setMode("manual")}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Use Manual Search
                    </Button>
                  </div>
                </div>
              )}

              {/* Loading Overlay */}
              {!cameraActive && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center">
                    <Loader2 className="animate-spin w-8 h-8 text-white mx-auto mb-3" />
                    <p className="text-white/80 text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="p-4 flex justify-center gap-3">
              {!cameraActive ? (
                <Button variant="primary" onPress={startCamera}>
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
              ) : (
                <Button variant="ghost" onPress={stopCamera}>
                  <CameraOff className="w-4 h-4 mr-2" />
                  Stop Camera
                </Button>
              )}
            </div>

            {/* Process QR Input */}
            {cameraActive && (
              <div className="px-4 pb-4">
                {decodeHint && (
                  <p role="note" className="text-xs text-default-500 mt-1 mb-2 text-center">
                    {decodeHint}
                  </p>
                )}
                <div className="flex gap-2">
                  <InputGroup className="flex-1">
                    <InputGroup.Prefix>
                      <QrCode className="w-4 h-4 text-default-400" />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      placeholder="Paste scanned QR data here..."
                      value={manualQuery}
                      onChange={(e: any) => setManualQuery(e.target.value)}
                    />
                  </InputGroup>
                  <Button
                    variant="primary"
                    onPress={() => {
                      if (manualQuery.trim()) {
                        processQrData(manualQuery.trim());
                        setManualQuery("");
                      }
                    }}
                  >
                    Process
                  </Button>
                </div>
                <p className="text-xs text-default-400 mt-2 text-center">
                  Point camera at QR code, then paste scanned data above
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Search Mode */}
      {mode === "manual" && (
        <Card className="border-none shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Manual Ticket Lookup</h3>
            </div>

            <InputGroup>
              <InputGroup.Prefix>
                <Search className="w-4 h-4 text-default-400" />
              </InputGroup.Prefix>
              <InputGroup.Input
                placeholder="Enter ticket code, user ID, or QR data..."
                value={manualQuery}
                onChange={(e: any) => setManualQuery(e.target.value)}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter") handleManualSearch();
                }}
              />
            </InputGroup>

            <Button
              variant="primary"
              className="w-full"
              onPress={handleManualSearch}
              isPending={manualSearching}
            >
              <Search className="w-4 h-4 mr-2" />
              Search & Check In
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scan Result Feedback */}
      {lastResult && (
        <Card
          role="status"
          aria-live="polite"
          className={`border-none shadow-lg ${
            lastResult.type === "success"
              ? "bg-green-50 dark:bg-green-900/20"
              : lastResult.type === "error"
                ? "bg-red-50 dark:bg-red-900/20"
                : "bg-yellow-50 dark:bg-yellow-900/20"
          }`}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  lastResult.type === "success"
                    ? "bg-green-100 dark:bg-green-900/40"
                    : lastResult.type === "error"
                      ? "bg-red-100 dark:bg-red-900/40"
                      : "bg-yellow-100 dark:bg-yellow-900/40"
                }`}
              >
                {lastResult.type === "success" && (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                )}
                {lastResult.type === "error" && (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                {lastResult.type === "warning" && (
                  <Loader2 className="w-6 h-6 text-yellow-600 animate-spin" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`font-semibold ${
                    lastResult.type === "success"
                      ? "text-green-800 dark:text-green-200"
                      : lastResult.type === "error"
                        ? "text-red-800 dark:text-red-200"
                        : "text-yellow-800 dark:text-yellow-200"
                  }`}
                >
                  {lastResult.message}
                </p>

                {lastResult.ticket && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-default-600">
                      <Hash className="w-3.5 h-3.5" />
                      <span className="font-mono">{lastResult.ticket.ticketCode}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-default-600">
                      <User className="w-3.5 h-3.5" />
                      <span className="truncate">{lastResult.ticket.userId}</span>
                    </div>
                    <div className="mt-2">
                      <Badge
                        variant={
                          lastResult.ticket.status === "checked_in"
                            ? "primary"
                            : lastResult.ticket.status === "invalidated"
                              ? "secondary"
                              : "primary"
                        }
                        size="sm"
                      >
                        {lastResult.ticket.status}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                isIconOnly
                size="sm"
                aria-label="Dismiss result"
                onPress={resetScanner}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset Button */}
      {lastResult && lastResult.type !== "warning" && (
        <div className="flex justify-center">
          <Button variant="ghost" onPress={resetScanner}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Scan Next Ticket
          </Button>
        </div>
      )}
    </div>
  );
}
