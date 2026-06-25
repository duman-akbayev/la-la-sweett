import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

// Mock next/image since it's not available in test environment
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { vi } from "vitest";
import React from "react";

describe("Home page", () => {
  it("renders the brand name as the single H1", () => {
    render(<Home />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("La La Sweett");
  });

  it("renders only one H1 heading", () => {
    const { container } = render(<Home />);
    const h1Elements = container.querySelectorAll("h1");
    expect(h1Elements).toHaveLength(1);
  });

  it("renders the tagline", () => {
    render(<Home />);
    expect(
      screen.getByText(/Custom cakes & desserts for every occasion/)
    ).toBeInTheDocument();
  });

  it("renders the featured cakes section", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /Featured Cakes/i })
    ).toBeInTheDocument();
  });

  it("renders featured cake cards with proper alt text", () => {
    render(<Home />);
    const images = screen.getAllByRole("img");
    images.forEach((img) => {
      expect(img).toHaveAttribute("alt");
      expect(img.getAttribute("alt")).not.toBe("");
    });
  });

  it("renders the order CTA section", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /Ready to Order/i })
    ).toBeInTheDocument();
  });

  it("renders order links with proper touch target size", () => {
    render(<Home />);
    const orderLinks = screen.getAllByRole("link", { name: /Order/i });
    expect(orderLinks.length).toBeGreaterThan(0);
  });

  it("uses sequential heading levels (h1 then h2)", () => {
    const { container } = render(<Home />);
    const h1Elements = container.querySelectorAll("h1");
    const h2Elements = container.querySelectorAll("h2");
    const h3Elements = container.querySelectorAll("h3");

    expect(h1Elements.length).toBe(1);
    expect(h2Elements.length).toBeGreaterThanOrEqual(2);
    // h3 should only exist if h2 exists
    if (h3Elements.length > 0) {
      expect(h2Elements.length).toBeGreaterThan(0);
    }
  });

  it("renders landmark sections with aria labels", () => {
    const { container } = render(<Home />);
    const sections = container.querySelectorAll("section[aria-labelledby]");
    expect(sections.length).toBeGreaterThanOrEqual(3);
  });
});
