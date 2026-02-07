import { NextRequest, NextResponse } from "next/server";
import { builder } from "@builder.io/react";
import { BUILDER_API_KEY } from "@/lib/builder";

export async function GET(request: NextRequest) {
  if (!BUILDER_API_KEY) {
    return NextResponse.json({ error: "Builder.io API key not configured" }, { status: 500 });
  }

  builder.init(BUILDER_API_KEY);

  const searchParams = request.nextUrl.searchParams;
  const urlPath = searchParams.get("urlPath") || "/";

  try {
    const content = await builder
      .get("page", {
        userAttributes: {
          urlPath,
        },
        options: {
          includeRefs: true,
        },
        preview: true,
      })
      .promise();

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error fetching Builder.io preview:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch preview" },
      { status: 500 }
    );
  }
}
