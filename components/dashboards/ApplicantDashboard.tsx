"use client";

import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  BookOpen,
  Map,
  Calendar,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const STATUS_CONFIG = {
  pending: {
    label: "Application Under Review",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: Clock,
    progress: 50,
  },
  approved: {
    label: "Application Approved",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: CheckCircle,
    progress: 100,
  },
  rejected: {
    label: "Application Not Approved",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: XCircle,
    progress: 0,
  },
  reapplied: {
    label: "Reapplication Under Review",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: Clock,
    progress: 50,
  },
} as const;

const QUICK_LINKS = [
  {
    label: "Club Constitution",
    description: "Read our founding document",
    href: "/constitution",
    icon: BookOpen,
    color: "text-primary",
  },
  {
    label: "Learning Resources",
    description: "Explore department resources",
    href: "/resources",
    icon: Map,
    color: "text-blue-400",
  },
  {
    label: "Public Events",
    description: "See what's happening",
    href: "/events",
    icon: Calendar,
    color: "text-emerald-400",
  },
  {
    label: "About Us",
    description: "Meet the team",
    href: "/about",
    icon: ExternalLink,
    color: "text-amber-400",
  },
];

function ExploreLinks() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Explore Greymens</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-xl border border-border bg-surface p-5 hover:border-border hover:bg-surface-secondary transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <Icon className={`w-5 h-5 ${link.color}`} />
                <ArrowRight className="w-4 h-4 text-muted group-hover:text-muted group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="font-medium mt-3 group-hover:text-foreground transition-colors">{link.label}</h3>
              <p className="text-xs text-muted mt-1">{link.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function ApplicantDashboard() {
  const { user } = useAuth();
  const { application } = usePermissions();

  // No application row means the visitor has never applied: invite them into
  // the funnel instead of showing a phantom "under review" state.
  if (!application) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, <span className="tracking-tight text-foreground">{user?.name}</span>
          </h1>
          <p className="text-muted">Join the club to unlock member events, resources, and departments.</p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold">Start your application</h2>
              <p className="text-sm text-muted mt-1">
                Tell us about yourself and pick your departments. It takes a few minutes.
              </p>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                Continue to onboarding
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
        <ExploreLinks />
      </div>
    );
  }

  const appStatus = application.status || "pending";
  const config = STATUS_CONFIG[appStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, <span className="tracking-tight text-foreground">{user?.name}</span>
        </h1>
        <p className="text-muted">Track your application and explore what Greymens Club has to offer.</p>
      </div>

      {/* Application Status Card */}
      <div className={`rounded-2xl border ${config.border} ${config.bg} p-6`}>
        <div className="flex items-start gap-4">
          {(appStatus === "pending" || appStatus === "reapplied") && (
            <img
              src="/Assets/Media/sand-time-clock.gif"
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-2xl border border-default-200/70 object-cover"
            />
          )}
          <div className={`p-3 rounded-xl ${config.bg}`}>
            <StatusIcon className={`w-6 h-6 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">{config.label}</h2>
            <p className="text-sm text-muted mt-1">
              {appStatus === "pending" && "Your application is being reviewed by our team. We'll notify you once a decision is made."}
              {appStatus === "approved" && "Congratulations! Your membership has been approved. Welcome to Greymens Club!"}
              {appStatus === "rejected" && "Your application was not approved at this time. You may reapply after 30 days."}
              {appStatus === "reapplied" && "Your reapplication is being reviewed. Thank you for your patience."}
            </p>

            {application?.submittedAt && (
              <p className="text-xs text-muted mt-2">
                Submitted {new Date(application.submittedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}

            {application?.reviewedAt && (
              <p className="text-xs text-muted mt-1">
                Reviewed {new Date(application.reviewedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}

            {application?.rejectionReason && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <p className="text-sm text-red-400">
                  <span className="font-medium">Reason: </span>
                  {application.rejectionReason}
                </p>
              </div>
            )}

            {appStatus === "rejected" && (
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                Reapply now
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-muted mb-2">
            <span>Application Progress</span>
            <span>{config.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                appStatus === "approved"
                  ? "bg-emerald-500"
                  : appStatus === "rejected"
                  ? "bg-red-500"
                  : "bg-primary"
              }`}
              style={{ width: `${config.progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {["Submitted", "Under Review", "Decision"].map((step, i) => (
              <div key={step} className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    config.progress >= (i + 1) * 33.33
                      ? appStatus === "rejected" && i === 2
                        ? "border-red-500 bg-red-500"
                        : "border-primary bg-primary"
                      : "border-border bg-surface-secondary"
                  }`}
                />
                <span className="text-[10px] text-muted mt-1">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Application Details */}
      {application && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold mb-4">Application Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${application.oathAccepted ? "bg-emerald-500" : "bg-zinc-600"}`} />
                <span className="text-muted">Oath Accepted</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${application.termsAccepted ? "bg-emerald-500" : "bg-zinc-600"}`} />
                <span className="text-muted">Terms Accepted</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${application.constitutionAccepted ? "bg-emerald-500" : "bg-zinc-600"}`} />
                <span className="text-muted">Constitution Accepted</span>
              </div>
            </div>
            {application.preferredDepartments && application.preferredDepartments.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-2">Preferred Departments</p>
                <div className="flex flex-wrap gap-2">
                  {application.preferredDepartments.map((dept) => (
                    <span key={dept} className="px-2.5 py-1 text-xs rounded-full bg-muted text-primary border border-border">
                      {dept}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ExploreLinks />

      {/* What's Next */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold mb-4">What Happens Next?</h2>
        <div className="space-y-4">
          {[
            { step: 1, title: "Application Review", desc: "Our team reviews your application and profile within 3-5 business days." },
            { step: 2, title: "Welcome Package", desc: "Once approved, you'll receive a welcome letter and access to member resources." },
            { step: 3, title: "Join Your Department", desc: "Get assigned to your preferred department and start collaborating with the team." },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">{item.step}</span>
              </div>
              <div>
                <h3 className="font-medium text-sm">{item.title}</h3>
                <p className="text-xs text-muted mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
