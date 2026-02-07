import { NextRequest, NextResponse } from "next/server";
import { BUILDER_API_KEY } from "@/lib/builder";

export async function GET(request: NextRequest) {
  if (!BUILDER_API_KEY) {
    return NextResponse.json({ error: "Builder.io API key not configured" }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const urlPath = searchParams.get("urlPath") || "/";

  try {
    // Use Builder.io REST API directly for server-side preview
    const response = await fetch(
      `https://cdn.builder.io/api/v1/content/page?apiKey=${BUILDER_API_KEY}&userAttributes.urlPath=${encodeURIComponent(urlPath)}&preview=true`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Builder.io API error: ${response.statusText}`);
    }

    const content = await response.json();

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error fetching Builder.io preview:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch preview" },
      { status: 500 }
    );
  }
}
