import { auth } from "@clerk/nextjs/server";
import { MvaAvstemmingView } from "@/components/mva/mva-avstemming-view";

export default async function MvaAvstemmingPage() {
  await auth();

  return (
    <div className="space-y-6">
      <MvaAvstemmingView />
    </div>
  );
}
