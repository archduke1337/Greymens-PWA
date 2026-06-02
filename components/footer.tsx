// components/footer.tsx
"use client";

import { Link } from "@heroui/link";
import { FooterSponsors } from "./footer-sponsors";

export const Footer = () => {
  return (
    <footer className="w-full border-t border-default-100 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        {/* Sponsors Section */}
        <FooterSponsors />

        {/* Main Footer Content */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                Mind Mesh
              </span>
            </div>
            <p className="text-sm text-default-600">
              Where ideas connect. Join our community of innovators and creators.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-default-700">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-default-600 hover:text-primary">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/events" className="text-sm text-default-600 hover:text-primary">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/projects" className="text-sm text-default-600 hover:text-primary">
                  Projects
                </Link>
              </li>
              <li>
                <Link href="/team" className="text-sm text-default-600 hover:text-primary">
                  Team
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-default-700">
              Resources
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/sponsors" className="text-sm text-default-600 hover:text-primary">
                  Our Sponsors
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-sm text-default-600 hover:text-primary">
                  Docs
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-sm text-default-600 hover:text-primary">
                  Gallery
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-default-600 hover:text-primary">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-default-700">
              Connect
            </h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://www.linkedin.com/company/mind-mesh-adypu" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-default-600 hover:text-primary"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a 
                  href="https://www.instagram.com/mindmesh_adypu?igsh=bzhycW1rMG12Z2Vh" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-default-600 hover:text-primary"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a 
                  href="https://twitter.com/MindMeshADYPU" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-default-600 hover:text-primary"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a 
                  href="https://discord.gg/6v89E3SaZT"
                  className="text-sm text-default-600 hover:text-primary"
                >
                  Discord
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-default-100 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-default-600">
              © {new Date().getFullYear()} Mind Mesh Club. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-sm text-default-600 hover:text-primary">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-default-600 hover:text-primary">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};