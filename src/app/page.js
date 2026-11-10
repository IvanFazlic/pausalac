import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth/session";
import { ownerExists } from "@/lib/data/users";

// No public landing page: send everyone to where they belong.
export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  redirect((await ownerExists()) ? "/login" : "/setup");
}
