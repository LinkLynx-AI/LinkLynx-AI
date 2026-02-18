import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Home from "./page";

describe("Home page", () => {
  test("主要テキストを表示する", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "LinkLynx" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Discord Clone - Real-time Chat Application"),
    ).toBeInTheDocument();
  });
});
