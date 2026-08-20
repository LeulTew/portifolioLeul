import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ContactInfo from "./ContactInfo";

describe("ContactInfo", () => {
  it("renders all contact details correctly", () => {
    render(<ContactInfo />);

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();

    const emailLink = screen.getByRole("link", { name: /leulman2@gmail.com/i });
    expect(emailLink).toHaveAttribute("href", "mailto:leulman2@gmail.com");

    const phoneLink = screen.getByRole("link", { name: /\+251 966 235 33/ });
    expect(phoneLink).toHaveAttribute("href", "tel:+25196623533");

    const locationText = screen.getByText("Addis Ababa, Ethiopia");
    expect(locationText.tagName).toBe("P");
  });
});
