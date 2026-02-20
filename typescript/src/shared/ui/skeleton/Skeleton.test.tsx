/** @vitest-environment happy-dom */

import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  test("指定行数ぶんのプレースホルダーを描画する", () => {
    const { container } = render(<Skeleton lines={4} />);
    const root = container.firstElementChild;

    expect(root).not.toBeNull();
    expect(root?.children).toHaveLength(4);
  });
});
