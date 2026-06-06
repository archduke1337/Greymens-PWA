// components/tickets/TicketCard.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
  Clock,
  Download,
  CheckCircle,
  XCircle,
  Ticket,
  Copy,
} from "lucide-react";
import { Button, Card, CardContent, Badge, Chip } from "@heroui/react";
import type { Ticket as TicketType } from "@/lib/tickets";

interface TicketCardProps {
  ticket: TicketType;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  eventLocation?: string;
}

export default function TicketCard({
  ticket,
  eventTitle,
  eventDate,
  eventTime,
  eventVenue,
  eventLocation,
}: TicketCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [generating, setGenerating] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateQr = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(ticket.qrData, {
          width: 200,
          margin: 2,
          color: {
            dark: "#1a1a2e",
            light: "#ffffff",
          },
          errorCorrectionLevel: "H",
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error("Error generating QR code:", error);
        toast.error("Failed to generate QR code");
      } finally {
        setGenerating(false);
      }
    };

    generateQr();
  }, [ticket.qrData]);

  const handleDownload = async () => {
    try {
      if (!cardRef.current) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = 400;
      const height = 560;
      canvas.width = width;
      canvas.height = height;

      // Background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#f5f3ff");
      gradient.addColorStop(1, "#fdf2f8");
      ctx.fillStyle = gradient;
      ctx.roundRect(0, 0, width, height, 16);
      ctx.fill();

      // Header bar
      const headerGradient = ctx.createLinearGradient(0, 0, width, 0);
      headerGradient.addColorStop(0, "#7c3aed");
      headerGradient.addColorStop(1, "#ec4899");
      ctx.fillStyle = headerGradient;
      ctx.roundRect(0, 0, width, 60, [16, 16, 0, 0]);
      ctx.fill();

      // Header text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MindMesh Club", width / 2, 38);

      // Event title
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      const titleLines = wrapText(ctx, eventTitle, width - 40, 16);
      titleLines.forEach((line, i) => {
        ctx.fillText(line, width / 2, 100 + i * 22);
      });

      const titleEndY = 100 + titleLines.length * 22 + 10;

      // Divider
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(20, titleEndY);
      ctx.lineTo(width - 20, titleEndY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Details
      const detailsY = titleEndY + 30;
      ctx.font = "13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#6b7280";

      const details = [
        { label: "Date", value: new Date(eventDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) },
        { label: "Time", value: eventTime },
        { label: "Venue", value: eventVenue },
        { label: "Code", value: ticket.ticketCode },
      ];

      details.forEach((detail, i) => {
        ctx.fillStyle = "#9ca3af";
        ctx.fillText(detail.label, 30, detailsY + i * 28);
        ctx.fillStyle = "#1a1a2e";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(detail.value, 80, detailsY + i * 28);
        ctx.font = "13px sans-serif";
      });

      // QR Code
      if (qrDataUrl) {
        const qrImg = new Image();
        qrImg.src = qrDataUrl;
        await new Promise<void>((resolve) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = () => resolve();
        });

        const qrSize = 120;
        const qrX = (width - qrSize) / 2;
        const qrY = detailsY + details.length * 28 + 30;

        ctx.fillStyle = "#ffffff";
        ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12);
        ctx.fill();
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = "#6b7280";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Scan at entry", width / 2, qrY + qrSize + 25);
      }

      // Footer
      ctx.fillStyle = "#d1d5db";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MindMesh Club \u2022 Official E-Ticket", width / 2, height - 15);

      // Download
      const link = document.createElement("a");
      link.download = `ticket-${ticket.ticketCode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("Ticket downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download ticket");
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ticket.ticketCode);
    toast.success("Ticket code copied!");
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "issued":
      case "active":
        return { color: "primary" as const, label: "Valid" };
      case "checked_in":
        return { color: "primary" as const, label: "Checked In" };
      case "invalidated":
        return { color: "secondary" as const, label: "Invalidated" };
      case "completed":
        return { color: "soft" as const, label: "Completed" };
      default:
        return { color: "secondary" as const, label: status };
    }
  };

  const statusConfig = getStatusConfig(ticket.status);

  return (
    <Card
      ref={cardRef}
      className="border-none shadow-lg overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20"
    >
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Ticket className="w-5 h-5" />
            <span className="font-bold text-lg">MindMesh Club</span>
          </div>
          <p className="text-white/80 text-sm">Official E-Ticket</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Event Info */}
          <div className="text-center">
            <h3 className="text-xl font-bold mb-3">{eventTitle}</h3>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-default-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-purple-500" />
                <span>{new Date(eventDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-purple-500" />
                <span>{eventTime}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4 text-purple-500" />
                <span>{eventVenue}{eventLocation ? `, ${eventLocation}` : ""}</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-default-300" />

          {/* QR Code */}
          <div className="flex flex-col items-center">
            {generating ? (
              <div className="w-[160px] h-[160px] rounded-xl bg-default-100 animate-pulse flex items-center justify-center">
                <span className="text-xs text-default-400">Generating...</span>
              </div>
            ) : qrDataUrl ? (
              <div className="bg-white p-3 rounded-xl shadow-sm border border-default-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`QR code for ticket ${ticket.ticketCode}`}
                  width={160}
                  height={160}
                  className="rounded-lg"
                />
              </div>
            ) : (
              <div className="w-[160px] h-[160px] rounded-xl bg-default-100 flex items-center justify-center">
                <span className="text-xs text-danger">Failed to generate</span>
              </div>
            )}
            <p className="text-xs text-default-400 mt-2">Scan at entry</p>
          </div>

          {/* Ticket Code */}
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-default-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-default-500 mb-1">Ticket Code</p>
                <p className="text-lg font-mono font-bold tracking-wider">{ticket.ticketCode}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                onPress={handleCopyCode}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-default-500">Status</span>
            <Badge variant={statusConfig.color} size="lg">
              {ticket.status === "checked_in" && <CheckCircle className="w-3 h-3 mr-1" />}
              {ticket.status === "invalidated" && <XCircle className="w-3 h-3 mr-1" />}
              {statusConfig.label}
            </Badge>
          </div>

          {/* Entry Count */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-default-500">Entries</span>
            <span className="font-semibold">
              {ticket.entryCount} / {ticket.maxEntries}
            </span>
          </div>

          {/* Download Button */}
          {(ticket.status === "issued" || ticket.status === "active") && (
            <Button
              variant="primary"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              onPress={handleDownload}
              isDisabled={generating || !qrDataUrl}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Ticket
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
