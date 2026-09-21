export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Greymens",
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
    discord: "https://discord.gg/k2G5ReVHxX",
    whatsapp: "https://whatsapp.com/channel/0029VbDw6doJJhzR3E8rm52U",
    instagram: "https://www.instagram.com/greymens.club/",
    linkedin: "https://www.linkedin.com/company/greymen-s-club-adypu/",
  },
};
