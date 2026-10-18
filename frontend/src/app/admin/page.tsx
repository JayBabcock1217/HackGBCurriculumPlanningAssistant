'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Loader2,
  CloudOff,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  getAuthUsers,
  setUserRole,
  type AuthUser,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';

/**
 * Admin page (Chunk 11)
 *
 * Only visible to the admin role. Lists all accounts and lets the admin
 * promote/demote roles (teacher <-> admin). Non-admins see an "access
 * denied" card — the API also enforces this with @Roles('admin') + 403.
 */
export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await getAuthUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  async function toggleRole(u: AuthUser) {
    const next = u.role === 'admin' ? 'teacher' : 'admin';
    if (u.id === user?.id && next === 'teacher') {
      if (!confirm('You are about to remove your own admin role. Continue?')) return;
    }
    setBusy(u.id);
    try {
      await setUserRole(u.id, next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setBusy(null);
    }
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-destructive" />
              Admin Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You do not have permission to view this page. Ask a school admin
              to grant you the admin role.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <ShieldCheck className="mr-2 inline h-5 w-5 text-primary" />
              User Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage accounts and roles for your school.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-3 p-4 text-sm">
              <CloudOff className="h-5 w-5 text-destructive" />
              {error}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Accounts
            </CardTitle>
            <CardDescription>
              {users.length} account(s). Use the button to switch a role between
              teacher and admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {u.firstName || u.email}
                        {u.id === user?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={u.role === 'admin' ? 'info' : 'secondary'}
                      >
                        {u.role}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === u.id}
                        onClick={() => toggleRole(u)}
                      >
                        {busy === u.id && <Loader2 className="animate-spin" />}
                        {u.role === 'admin' ? 'Make teacher' : 'Make admin'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
