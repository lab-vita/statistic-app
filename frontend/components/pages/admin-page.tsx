"use client";

import { useCallback, useEffect, useState } from "react";
import { PageContent, Skeleton, ErrorBanner, PageHeader, TabGroup } from "@/components/ui/primitives";
import { DigestSettingsCard } from "@/components/digest-settings";
import { AccessPanel } from "@/components/admin-panel";
import { RolesPanel } from "@/components/roles-panel";
import { useAuth } from "@/components/auth-gate";
import { adminApi, type AccessRequest, type AdminMeta, type AdminUser } from "@/lib/admin-api";

const TAB_ACCESS = "Доступ";
const TAB_ROLES  = "Роли";
const TAB_DIGEST = "Утренняя сводка";

export interface AdminData {
  meta:     AdminMeta;
  users:    AdminUser[];
  requests: AccessRequest[];
}

export function AdminPage() {
  const { user, can } = useAuth();
  const canUsers  = can("users:manage");
  const canDigest = can("digest:manage");
  const tabs = [...(canUsers ? [TAB_ACCESS, TAB_ROLES] : []), ...(canDigest ? [TAB_DIGEST] : [])];

  const [tab,   setTab]   = useState(tabs[0] ?? TAB_DIGEST);
  const [data,  setData]  = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [meta, users, requests] = await Promise.all([
        adminApi.meta(),
        adminApi.users(),
        canUsers ? adminApi.requests() : Promise.resolve({ requests: [] }),
      ]);
      setData({ meta, users: users.users, requests: requests.requests });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить настройки");
    }
  }, [canUsers]);

  useEffect(() => {
    const t = setTimeout(reload, 0);
    return () => clearTimeout(t);
  }, [reload]);

  const pending = data?.requests.length ?? 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader title="Настройки">
        {tabs.length > 1 && (
          <TabGroup
            items={tabs.map(t => (t === TAB_ACCESS && pending ? `${t} · ${pending}` : t))}
            active={tab === TAB_ACCESS && pending ? `${tab} · ${pending}` : tab}
            onChange={v => setTab(v.split(" · ")[0])}
            small
          />
        )}
      </PageHeader>

      <PageContent>
        {error && <ErrorBanner message={error} />}

        {!data ? (
          !error && <><Skeleton className="h-24" /><Skeleton className="h-64" /></>
        ) : tab === TAB_ACCESS && canUsers ? (
          <AccessPanel data={data} meId={user.id} onChanged={reload} />
        ) : tab === TAB_ROLES && canUsers ? (
          <RolesPanel data={data} onChanged={reload} />
        ) : canDigest ? (
          <DigestSettingsCard meId={user.id} />
        ) : null}
      </PageContent>
    </div>
  );
}
