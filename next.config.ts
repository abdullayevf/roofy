import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer is Node-only and not in Next's built-in server-external list; load it with require.
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
