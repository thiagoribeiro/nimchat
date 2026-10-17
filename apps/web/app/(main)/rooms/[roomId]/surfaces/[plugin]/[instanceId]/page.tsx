"use client";

import { useParams } from "next/navigation";
import { SurfaceFocus } from "@/components/brian/surface-focus";

export default function SurfacePage() {
  const params = useParams();
  const plugin = Array.isArray(params.plugin) ? params.plugin[0] : params.plugin ?? "";
  const instanceId = Array.isArray(params.instanceId) ? params.instanceId[0] : params.instanceId ?? "";
  return <SurfaceFocus plugin={plugin} instanceId={instanceId} />;
}
