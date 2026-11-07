import { ErrorPanel } from "@/components/vgui/error-panel";
import { getDict } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = (await getDict()).errorPage;
  return (
    <ErrorPanel
      title={t.notFoundTitle}
      message={t.notFound}
      homeLabel={t.home}
    />
  );
}
