import BuilderContent from "@/components/builder/BuilderContent";
import { BUILDER_API_KEY } from "@/lib/builder";

interface BuilderPageProps {
  params: Promise<{ page?: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 1;

export default async function BuilderPage({ params, searchParams }: BuilderPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  if (!BUILDER_API_KEY) {
    return (
      <div className="container mx-auto p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <h1 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-400">
            Builder.io Not Configured
          </h1>
          <p className="text-sm text-red-700 dark:text-red-300">
            Please set NEXT_PUBLIC_BUILDER_API_KEY in your environment variables to use Builder.io.
          </p>
        </div>
      </div>
    );
  }

  // Get the page path from params
  const pagePath = resolvedParams.page ? `/${resolvedParams.page.join("/")}` : "/";

  // Pass options to BuilderContent component
  const options = {
    userAttributes: {
      urlPath: pagePath,
    },
    preview: resolvedSearchParams.preview === "true",
  };

  return (
    <div className="min-h-screen">
      <BuilderContent model="page" options={options} />
    </div>
  );
}
