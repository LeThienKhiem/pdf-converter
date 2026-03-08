import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | InvoiceToData",
  description: "Sign in to your InvoiceToData account to manage credits and conversions.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
