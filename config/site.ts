export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Mind Mesh",
  description: "Collaborate, Innovate, and Create Together",
  navItems: [
    { label: "About", href: "/about" },
    { label: "Events", href: "/events" },
    { label: "Projects", href: "/projects" },
    { label: "Blog", href: "/blog" },
    { label: "Team", href: "/team" },
    { label: "Contact", href: "/contact" },
  ],
  navMenuItems: [
    { label: "Profile", href: "/profile" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Settings", href: "/settings" },
    { label: "Help & Feedback", href: "/help-feedback" },
    { label: "Logout", href: "/logout" },
  ],
  links: {
    discord: "https://discord.gg/6v89E3SaZT",
  },
};
