import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RouteLoading from "./route-loading";

describe("route loading state", () => {
  it("announces busy state while keeping decorative skeletons hidden", () => {
    const markup = renderToStaticMarkup(<RouteLoading />);
    expect(markup).toContain('aria-label="Loading page"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Loading ForgeRank data");
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(3);
  });
});
