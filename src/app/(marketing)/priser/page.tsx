import type { Metadata } from "next";
import { PricingContent } from "@/components/marketing/pricing-content";

export const metadata: Metadata = {
  title: "Priser — Revizo",
  description:
    "Tre pakker tilpasset regnskapsbyråer i alle størrelser. Fra 1 990 kr/mnd.",
};

export default function PricingPage() {
  return <PricingContent />;
}
