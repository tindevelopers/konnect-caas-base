#!/bin/bash

# Script to create layout.tsx files for all client component pages
# that don't already have layouts

find apps/tenant/app -name "page.tsx" -type f -exec grep -l '"use client"' {} \; | while read page; do
  dir=$(dirname "$page")
  layout_file="$dir/layout.tsx"
  
  # Skip if layout already exists
  if [ -f "$layout_file" ]; then
    continue
  fi
  
  # Get the route name from the directory, handling dynamic routes like [id]
  route_name=$(basename "$dir" | sed 's/\[//g' | sed 's/\]//g' | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++)sub(/./,toupper(substr($i,1,1)),$i)}1' | sed 's/ //g')
  
  # If route_name is empty or invalid, use a default
  if [ -z "$route_name" ] || [[ ! "$route_name" =~ ^[A-Za-z] ]]; then
    route_name="Dynamic"
  fi
  
  # Create the layout file
  cat > "$layout_file" << EOF
// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ${route_name}Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
EOF
  
  echo "Created layout for: $dir"
done

echo "Done creating dynamic layouts!"

