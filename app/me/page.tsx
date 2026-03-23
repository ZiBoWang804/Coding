import { requireUser } from "@/lib/auth";
import { getPersonalizedRecommendations, listSearchHistory, listUserSubmissions } from "@/lib/repository";
import { ProfilePanel } from "@/components/profile-panel";

export default async function MePage() {
  const user = await requireUser();
  const [history, submissions, recommendations] = await Promise.all([
    listSearchHistory(user.id),
    listUserSubmissions(user.id),
    getPersonalizedRecommendations(user.id, 6)
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ProfilePanel user={user} history={history} submissions={submissions} recommendations={recommendations} />
    </div>
  );
}